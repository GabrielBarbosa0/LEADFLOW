import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  inMemoryPersistence,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  setPersistence
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, authPersistenceReady, db, functions, isFirebaseConfigured } from './client.js';
import {
  PERMISSION_SCHEMA_VERSION,
  permissionsForProfile,
  systemRoleProfileForId,
  systemRoleProfileForRole
} from '../utils/role-profile.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const accessSyncEnabled = import.meta.env.VITE_ENABLE_ACCESS_SYNC === 'true'
  || import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  || import.meta.env.PROD;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertEmailPassword(email, password) {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.');
  if (String(password || '').length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
}

export async function completeRedirectSignIn() {
  if (!isFirebaseConfigured) return null;
  return getRedirectResult(auth);
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase ainda não foi configurado.');
  }

  await authPersistenceReady;
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (isLocalhost && ['auth/popup-blocked', 'auth/cancelled-popup-request'].includes(error?.code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    if (error?.code === 'auth/popup-blocked') {
      throw new Error('O navegador bloqueou o login do Google. Abra o LeadFlow diretamente no Chrome ou Safari e tente novamente.');
    }

    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('A janela do Google foi fechada antes de concluir o login. Tente novamente e mantenha a janela aberta.');
    }

    if (error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Já existe uma tentativa de login aberta. Aguarde alguns segundos e tente novamente.');
    }

    throw error;
  }
}

export async function signInWithEmail(emailInput, password) {
  if (!isFirebaseConfigured) throw new Error('Firebase ainda não foi configurado.');
  const email = normalizeEmail(emailInput);
  assertEmailPassword(email, password);
  await authPersistenceReady;
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if (!credential.user.emailVerified) {
    await signOut(auth);
    throw new Error('Confirme o e-mail enviado para sua caixa de entrada antes de acessar.');
  }
  return credential;
}

export async function createEmailPasswordAccess(emailInput, password) {
  if (!isFirebaseConfigured) throw new Error('Firebase ainda não foi configurado.');
  const email = normalizeEmail(emailInput);
  assertEmailPassword(email, password);
  await authPersistenceReady;
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    await sendEmailVerification(credential.user);
  } finally {
    await signOut(auth);
  }
}

export async function createTeamPasswordAccount(emailInput, password) {
  if (!isFirebaseConfigured) throw new Error('Firebase ainda não foi configurado.');
  const email = normalizeEmail(emailInput);
  assertEmailPassword(email, password);

  if (functions) {
    try {
      const provisionAccount = httpsCallable(functions, 'provisionTeamMemberAccount');
      const result = await provisionAccount({ email, password });
      return result.data?.uid || '';
    } catch (error) {
      if (!['functions/not-found', 'functions/unavailable'].includes(error?.code)) throw error;
    }
  }
  return createLegacyTeamPasswordAccount(email, password);
}

async function createLegacyTeamPasswordAccount(email, password) {
  const secondaryApp = initializeApp(auth.app.options, `team-access-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondaryApp);
  await setPersistence(secondaryAuth, inMemoryPersistence);
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await sendEmailVerification(credential.user);
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function updateTeamMemberPassword(emailInput, password) {
  if (!isFirebaseConfigured || !functions) throw new Error('Firebase ainda não foi configurado.');
  const email = normalizeEmail(emailInput);
  assertEmailPassword(email, password);
  const updatePassword = httpsCallable(functions, 'updateTeamMemberPassword');
  return updatePassword({ email, password });
}

export async function renameTeamMemberEmail(currentEmailInput, newEmailInput) {
  if (!isFirebaseConfigured || !functions) throw new Error('Firebase ainda não foi configurado.');
  const currentEmail = normalizeEmail(currentEmailInput);
  const newEmail = normalizeEmail(newEmailInput);
  if (!/^\S+@\S+\.\S+$/.test(currentEmail) || !/^\S+@\S+\.\S+$/.test(newEmail)) {
    throw new Error('Informe um e-mail válido.');
  }
  const renameEmail = httpsCallable(functions, 'renameTeamMemberEmail');
  return renameEmail({ currentEmail, newEmail });
}

export async function requestPasswordReset(emailInput) {
  if (!isFirebaseConfigured) throw new Error('Firebase ainda não foi configurado.');
  const email = normalizeEmail(emailInput);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe o e-mail para recuperar a senha.');
  await sendPasswordResetEmail(auth, email);
}

export function observeAuth(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }

  let active = true;
  let unsubscribe = () => {};

  authPersistenceReady
    .catch(() => {
      // Firebase still provides an in-memory session when persistent storage is unavailable.
    })
    .then(() => {
      if (active) unsubscribe = onAuthStateChanged(auth, callback);
    });

  return () => {
    active = false;
    unsubscribe();
  };
}

export async function loadAuthorizedProfile(firebaseUser) {
  if (!firebaseUser?.email || !firebaseUser.emailVerified) {
    throw new Error('Use uma conta Google com e-mail verificado.');
  }

  const email = firebaseUser.email.toLowerCase();
  let synchronizedProfile = null;
  if (functions && accessSyncEnabled) {
    try {
      const synchronizeAccess = httpsCallable(functions, 'syncCurrentAccess');
      const result = await synchronizeAccess();
      synchronizedProfile = result.data?.profile || null;
    } catch {
      // Access sync is a migration aid; the existing Firestore profile remains the login fallback.
    }
  }
  const permissionRef = doc(db, 'allowedEmails', email);
  const permissionSnapshot = await getDoc(permissionRef);

  if (!permissionSnapshot.exists() || permissionSnapshot.data().active !== true) {
    throw new Error('Esta conta ainda não foi autorizada no LeadFlow.');
  }

  const permission = permissionSnapshot.data();
  const initialRoleProfile = systemRoleProfileForId(permission.roleProfileId)
    || systemRoleProfileForRole(permission.role);
  const assignedPermissions = Array.isArray(permission.permissions) ? permission.permissions : initialRoleProfile.permissions;
  const profileRef = doc(db, 'users', firebaseUser.uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    await setDoc(profileRef, {
      email,
      displayName: permission.displayName || firebaseUser.displayName || 'Colaborador',
      photoUrl: firebaseUser.photoURL || '',
      role: permission.role,
      roleProfileId: permission.roleProfileId || '',
      permissions: assignedPermissions,
      permissionSchemaVersion: permission.permissionSchemaVersion || PERMISSION_SCHEMA_VERSION,
      storeId: permission.storeId,
      storeIds: permission.storeIds || [permission.storeId],
      phone: permission.phone || '',
      savwinCode: permission.savwinCode || '',
      active: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });
  }

  const profile = synchronizedProfile || (profileSnapshot.exists()
    ? profileSnapshot.data()
    : {
        email,
        displayName: permission.displayName || firebaseUser.displayName || 'Colaborador',
        photoUrl: firebaseUser.photoURL || '',
        role: permission.role,
        roleProfileId: permission.roleProfileId || '',
        permissions: assignedPermissions,
        permissionSchemaVersion: permission.permissionSchemaVersion || PERMISSION_SCHEMA_VERSION,
        storeId: permission.storeId,
        storeIds: permission.storeIds || [permission.storeId],
        phone: permission.phone || '',
        savwinCode: permission.savwinCode || '',
        active: true
      });

  if (profile.active !== true) {
    throw new Error('Este acesso está inativo. Procure o administrador.');
  }

  let roleProfile = systemRoleProfileForId(profile.roleProfileId)
    || systemRoleProfileForRole(profile.role);
  if (profile.roleProfileId?.startsWith('system-') && !systemRoleProfileForId(profile.roleProfileId)) {
    throw new Error('O perfil de acesso desta conta não está disponível. Procure o administrador.');
  }
  if (profile.roleProfileId && !profile.roleProfileId.startsWith('system-')) {
    const roleSnapshot = await getDoc(doc(db, 'roleProfiles', profile.roleProfileId));
    if (!roleSnapshot.exists() || roleSnapshot.data().active === false) {
      throw new Error('O perfil de acesso desta conta não está disponível. Procure o administrador.');
    }
    roleProfile = { id: roleSnapshot.id, ...roleSnapshot.data() };
  }

  return {
    uid: firebaseUser.uid,
    ...profile,
    roleProfileName: roleProfile.name,
    permissions: permissionsForProfile(profile)
  };
}

export function observeAuthorizedProfile(firebaseUser, callback, errorCallback = () => {}) {
  if (!isFirebaseConfigured || !firebaseUser?.uid) return () => {};
  let revision = 0;
  return onSnapshot(doc(db, 'users', firebaseUser.uid), async () => {
    const currentRevision = ++revision;
    try {
      const profile = await loadAuthorizedProfile(firebaseUser);
      if (currentRevision === revision) callback(profile);
    } catch (error) {
      if (currentRevision === revision) errorCallback(error);
    }
  }, errorCallback);
}

export async function signOutUser() {
  if (isFirebaseConfigured) await signOut(auth);
}
