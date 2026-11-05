const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const systemRoleConfig = require('./system-role-profiles.json');

initializeApp();

const PRIMARY_ADMIN_EMAIL = 'oticasfascinantes.financeiro@gmail.com';
const PERMISSION_SCHEMA_VERSION = systemRoleConfig.permissionSchemaVersion;
const SYSTEM_ROLE_PROFILES = new Map(systemRoleConfig.profiles.map((profile) => [profile.id, profile]));

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function systemProfileForAccess(access = {}) {
  const assigned = SYSTEM_ROLE_PROFILES.get(String(access.roleProfileId || ''));
  if (assigned) return assigned;
  if (access.roleProfileId) return null;
  return systemRoleConfig.profiles.find((profile) => profile.baseRole === access.role) || null;
}

function sameStringArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function currentPermissions(access, systemProfile) {
  if (access.role === 'admin') {
    return [...(SYSTEM_ROLE_PROFILES.get('system-admin')?.permissions || [])];
  }
  const storedVersion = Number(access.permissionSchemaVersion) || 0;
  if (systemProfile && storedVersion < PERMISSION_SCHEMA_VERSION) {
    return [...systemProfile.permissions];
  }
  if (Array.isArray(access.permissions)) return [...access.permissions];
  return [...(systemProfile?.permissions || [])];
}

function canonicalAccessProfile(email, access, authUser) {
  const systemProfile = systemProfileForAccess(access);
  const storeIds = Array.isArray(access.storeIds) && access.storeIds.length
    ? [...new Set(access.storeIds.map(String))]
    : [String(access.storeId || '')].filter(Boolean);
  return {
    email,
    displayName: access.displayName || authUser.displayName || 'Colaborador',
    photoUrl: authUser.photoURL || '',
    role: access.role,
    roleProfileId: access.roleProfileId || systemProfile?.id || '',
    permissions: currentPermissions(access, systemProfile),
    permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
    storeId: access.storeId || storeIds[0] || '',
    storeIds,
    phone: access.phone || '',
    savwinCode: access.savwinCode || '',
    active: true
  };
}

function accessProfileChanged(current = {}, canonical) {
  const scalarFields = [
    'email', 'displayName', 'role', 'roleProfileId', 'permissionSchemaVersion',
    'storeId', 'phone', 'savwinCode', 'active'
  ];
  return scalarFields.some((field) => current[field] !== canonical[field])
    || !sameStringArray(current.permissions, canonical.permissions)
    || !sameStringArray(current.storeIds, canonical.storeIds);
}

exports.syncCurrentAccess = onCall({ region: 'southamerica-east1' }, async (request) => {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth || request.auth.token.email_verified !== true || !email) {
    throw new HttpsError('unauthenticated', 'Entre novamente para sincronizar o acesso.');
  }

  const firestore = getFirestore();
  const accessRef = firestore.doc(`allowedEmails/${email}`);
  const userRef = firestore.doc(`users/${request.auth.uid}`);
  const [accessSnapshot, userSnapshot] = await Promise.all([accessRef.get(), userRef.get()]);
  const access = accessSnapshot.data();
  if (!accessSnapshot.exists || access?.active !== true) {
    throw new HttpsError('permission-denied', 'Esta conta nao esta autorizada no LeadFlow.');
  }

  const authUser = await getAuth().getUser(request.auth.uid);
  const canonical = canonicalAccessProfile(email, access, authUser);
  const currentUser = userSnapshot.data() || {};
  const accessNeedsUpdate = access.permissionSchemaVersion !== PERMISSION_SCHEMA_VERSION
    || access.roleProfileId !== canonical.roleProfileId
    || !sameStringArray(access.permissions, canonical.permissions);
  const userNeedsUpdate = !userSnapshot.exists || accessProfileChanged(currentUser, canonical);

  if (accessNeedsUpdate || userNeedsUpdate) {
    const batch = firestore.batch();
    if (accessNeedsUpdate) {
      batch.set(accessRef, {
        roleProfileId: canonical.roleProfileId,
        permissions: canonical.permissions,
        permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid
      }, { merge: true });
    }
    if (userNeedsUpdate) {
      batch.set(userRef, {
        ...canonical,
        ...(!userSnapshot.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
        accessSyncedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
  }

  return { profile: canonical, synchronized: accessNeedsUpdate || userNeedsUpdate };
});

async function assertAdministrator(request) {
  const callerEmail = normalizeEmail(request.auth?.token?.email);
  if (!request.auth || !request.auth.token.email_verified || !callerEmail) {
    throw new HttpsError('unauthenticated', 'Entre novamente para alterar a senha.');
  }

  if (callerEmail === PRIMARY_ADMIN_EMAIL) return callerEmail;

  const access = await getFirestore().doc(`allowedEmails/${callerEmail}`).get();
  const data = access.data();
  if (!access.exists || data?.active !== true || data?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Somente administradores podem alterar senhas.');
  }
  return callerEmail;
}

exports.renameTeamMemberEmail = onCall({ region: 'southamerica-east1' }, async (request) => {
  const callerEmail = await assertAdministrator(request);
  const currentEmail = normalizeEmail(request.data?.currentEmail);
  const newEmail = normalizeEmail(request.data?.newEmail);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(currentEmail) || !emailPattern.test(newEmail)) {
    throw new HttpsError('invalid-argument', 'Informe um e-mail valido.');
  }
  if (currentEmail === newEmail) return { updated: false };
  if (currentEmail === callerEmail) {
    throw new HttpsError('failed-precondition', 'O administrador conectado nao pode alterar o proprio e-mail por esta tela.');
  }

  const firestore = getFirestore();
  const currentAccessRef = firestore.doc(`allowedEmails/${currentEmail}`);
  const newAccessRef = firestore.doc(`allowedEmails/${newEmail}`);
  const [currentAccess, newAccess] = await Promise.all([currentAccessRef.get(), newAccessRef.get()]);
  if (!currentAccess.exists) throw new HttpsError('not-found', 'O acesso informado nao existe.');
  if (newAccess.exists) throw new HttpsError('already-exists', 'Este e-mail ja possui um acesso cadastrado.');

  let authUser = null;
  try {
    authUser = await getAuth().getUserByEmail(currentEmail);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }

  try {
    const existingUser = await getAuth().getUserByEmail(newEmail);
    if (!authUser || existingUser.uid !== authUser.uid) {
      throw new HttpsError('already-exists', 'Este e-mail ja esta vinculado a outra conta de login.');
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error?.code !== 'auth/user-not-found') throw error;
  }

  if (authUser) await getAuth().updateUser(authUser.uid, { email: newEmail, emailVerified: true });

  try {
    const linkedUsers = await firestore.collection('users').where('email', '==', currentEmail).get();
    const batch = firestore.batch();
    batch.set(newAccessRef, {
      ...currentAccess.data(),
      email: newEmail,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    });
    batch.delete(currentAccessRef);
    linkedUsers.docs.forEach((userSnapshot) => batch.update(userSnapshot.ref, {
      email: newEmail,
      accessSyncedAt: FieldValue.serverTimestamp()
    }));
    const auditRef = firestore.collection('accessAuditEvents').doc();
    batch.set(auditRef, {
      action: 'team_email_renamed',
      actorEmail: callerEmail,
      actorUid: request.auth.uid,
      currentEmail,
      newEmail,
      targetUid: authUser?.uid || '',
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    if (authUser) {
      try {
        await getAuth().updateUser(authUser.uid, { email: currentEmail, emailVerified: true });
      } catch {
        // The audit log and support tooling can reconcile an unlikely rollback failure.
      }
    }
    throw error;
  }

  return { updated: true, uid: authUser?.uid || '' };
});

exports.updateTeamMemberPassword = onCall({ region: 'southamerica-east1' }, async (request) => {
  const callerEmail = await assertAdministrator(request);
  const targetEmail = normalizeEmail(request.data?.email);
  const password = String(request.data?.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  }
  if (password.length < 6 || password.length > 72) {
    throw new HttpsError('invalid-argument', 'A senha deve ter entre 6 e 72 caracteres.');
  }

  const targetAccess = await getFirestore().doc(`allowedEmails/${targetEmail}`).get();
  if (!targetAccess.exists) {
    throw new HttpsError('not-found', 'O acesso informado não existe.');
  }

  let user;
  try {
    user = await getAuth().getUserByEmail(targetEmail);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'A conta de login não foi encontrada.');
    }
    throw error;
  }

  await getAuth().updateUser(user.uid, { password, emailVerified: true });
  await getAuth().revokeRefreshTokens(user.uid);
  await getFirestore().collection('accessAuditEvents').add({
    action: 'password_reset_by_admin',
    actorEmail: callerEmail,
    actorUid: request.auth.uid,
    targetEmail,
    targetUid: user.uid,
    createdAt: FieldValue.serverTimestamp()
  });

  return { updated: true };
});

exports.provisionTeamMemberAccount = onCall({ region: 'southamerica-east1' }, async (request) => {
  const callerEmail = await assertAdministrator(request);
  const email = normalizeEmail(request.data?.email);
  const password = String(request.data?.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Informe um e-mail valido.');
  }
  if (password.length < 6 || password.length > 72) {
    throw new HttpsError('invalid-argument', 'A senha deve ter entre 6 e 72 caracteres.');
  }

  const access = await getFirestore().doc(`allowedEmails/${email}`).get();
  if (!access.exists || access.data()?.active !== true) {
    throw new HttpsError('failed-precondition', 'Autorize o e-mail antes de criar a conta.');
  }

  let user;
  let created = false;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    user = await getAuth().createUser({
      email,
      password,
      emailVerified: true,
      displayName: access.data()?.displayName || 'Colaborador'
    });
    created = true;
  }

  if (!created && user.emailVerified !== true) {
    await getAuth().updateUser(user.uid, { emailVerified: true });
  }

  await getFirestore().collection('accessAuditEvents').add({
    action: created ? 'team_account_provisioned' : 'team_account_already_exists',
    actorEmail: callerEmail,
    actorUid: request.auth.uid,
    targetEmail: email,
    targetUid: user.uid,
    createdAt: FieldValue.serverTimestamp()
  });

  return { uid: user.uid, created };
});

function normalizedLeadSearch(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function leadSearchNamePrefixes(value) {
  const text = normalizedLeadSearch(value);
  const title = text.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'));
  return [...new Set([
    text,
    title,
    text.toLocaleLowerCase('pt-BR'),
    text.toLocaleUpperCase('pt-BR')
  ].filter(Boolean))];
}

async function searchCallerProfile(request) {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth || request.auth.token.email_verified !== true || !email) {
    throw new HttpsError('unauthenticated', 'Entre novamente para pesquisar cadastros.');
  }
  const snapshot = await getFirestore().doc(`users/${request.auth.uid}`).get();
  const profile = snapshot.data();
  if (email !== PRIMARY_ADMIN_EMAIL && (!snapshot.exists || profile?.active !== true)) {
    throw new HttpsError('permission-denied', 'Seu perfil nao possui acesso a pesquisa.');
  }
  const role = email === PRIMARY_ADMIN_EMAIL ? 'admin' : profile.role;
  const permissions = role === 'admin'
    ? ['leads.view_own', 'management.view']
    : Array.isArray(profile.permissions)
      ? profile.permissions
      : role === 'manager'
        ? ['leads.view_own', 'management.view']
        : ['leads.view_own'];
  if (!permissions.includes('leads.view_own')) {
    throw new HttpsError('permission-denied', 'Seu perfil nao possui acesso a pesquisa.');
  }
  const storeIds = role === 'admin'
    ? []
    : [...new Set([profile.storeId, ...(Array.isArray(profile.storeIds) ? profile.storeIds : [])].filter(Boolean))];
  return { uid: request.auth.uid, role, permissions, storeIds };
}

function searchResultForLead(snapshot, caller) {
  const lead = snapshot.data();
  const ownsLead = lead.capturedByUid === caller.uid;
  const canManageLead = caller.role === 'admin'
    || (caller.role === 'manager'
      && (caller.permissions.includes('management.view') || caller.permissions.includes('leads.view_stores'))
      && caller.storeIds.includes(lead.storeId));
  return {
    id: snapshot.id,
    fullName: String(lead.fullName || ''),
    customerCpf: String(lead.customerCpf || ''),
    storeId: String(lead.storeId || ''),
    appointmentDate: String(lead.appointmentDate || ''),
    appointmentTime: String(lead.appointmentTime || ''),
    appointmentAttendance: String(lead.appointmentAttendance || ''),
    appointmentServiceName: String(lead.appointmentServiceName || ''),
    capturedByName: String(lead.capturedByName || ''),
    canOpen: ownsLead || canManageLead
  };
}

exports.searchLeadAppointments = onCall({ region: 'southamerica-east1' }, async (request) => {
  const caller = await searchCallerProfile(request);
  const search = normalizedLeadSearch(request.data?.query);
  const digits = search.replace(/\D/g, '');
  const hasLetters = /\p{L}/u.test(search);
  if (!search || (hasLetters && search.length < 3) || (!hasLetters && digits.length !== 11)) {
    throw new HttpsError('invalid-argument', 'Informe um nome com pelo menos 3 letras ou um CPF com 11 digitos.');
  }

  const leads = getFirestore().collection('leads');
  let snapshots;
  if (!hasLetters) {
    snapshots = [await leads.where('customerCpf', '==', digits).limit(20).get()];
  } else {
    snapshots = await Promise.all(leadSearchNamePrefixes(search).map((prefix) => (
      leads
        .where('fullName', '>=', prefix)
        .where('fullName', '<=', `${prefix}\uf8ff`)
        .orderBy('fullName')
        .limit(20)
        .get()
    )));
  }

  const matches = new Map();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((lead) => {
    if (lead.data().archived === true) return;
    if (caller.role !== 'admin' && !caller.storeIds.includes(lead.data().storeId)) return;
    matches.set(lead.id, lead);
  }));
  const results = [...matches.values()]
    .sort((left, right) => String(left.data().fullName || '').localeCompare(String(right.data().fullName || ''), 'pt-BR'))
    .slice(0, 20)
    .map((lead) => searchResultForLead(lead, caller));
  return { results };
});

function saoPauloDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function hasActiveAppointment(lead = {}, today = saoPauloDateKey()) {
  const attendance = String(lead.appointmentAttendance || 'pending');
  return Boolean(
    lead.appointmentDate
    && lead.appointmentTime
    && String(lead.appointmentDate) >= today
    && lead.appointmentStatus !== 'cancelled'
    && !['attended', 'missed', 'cancelled'].includes(attendance)
  );
}

exports.checkCpfActiveAppointment = onCall({ region: 'southamerica-east1' }, async (request) => {
  await searchCallerProfile(request);
  const customerCpf = String(request.data?.customerCpf || '').replace(/\D/g, '');
  if (customerCpf.length !== 11) {
    throw new HttpsError('invalid-argument', 'Informe um CPF com 11 dígitos.');
  }

  const snapshot = await getFirestore()
    .collection('leads')
    .where('customerCpf', '==', customerCpf)
    .limit(20)
    .get();
  return { hasAppointment: snapshot.docs.some((lead) => lead.data().archived !== true && hasActiveAppointment(lead.data())) };
});
