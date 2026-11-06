import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import {
  LEGACY_ROLE_PROFILE_ALIASES,
  PERMISSION_SCHEMA_VERSION,
  SYSTEM_ROLE_PROFILES,
  normalizeRolePermissions,
  systemRoleProfileForId,
  validateRoleProfile
} from '../utils/role-profile.js';

function assertAdmin(profile) {
  if (!isFirebaseConfigured || profile?.role !== 'admin') {
    const error = new Error('Apenas administradores podem gerenciar perfis.');
    error.code = 'permission-denied';
    throw error;
  }
}

export async function loadRoleProfiles(profile) {
  assertAdmin(profile);
  const snapshot = await getDocs(collection(db, 'roleProfiles'));
  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const canonicalSystemIds = new Set(SYSTEM_ROLE_PROFILES.map((item) => item.id));
  const systemIds = new Set([...canonicalSystemIds, ...Object.keys(LEGACY_ROLE_PROFILE_ALIASES)]);
  const overrides = new Map(records.filter((item) => canonicalSystemIds.has(item.id)).map((item) => [item.id, item]));
  const system = SYSTEM_ROLE_PROFILES.map((item) => {
    const override = item.baseRole === 'admin' ? null : overrides.get(item.id);
    if (!override) return { ...item, permissions: [...item.permissions] };
    return {
      ...item,
      permissions: Array.isArray(override.permissions)
        ? normalizeRolePermissions(item.scope, override.permissions)
        : [...item.permissions],
      customized: Array.isArray(override.permissions)
    };
  });
  const custom = records
    .filter((item) => !systemIds.has(item.id))
    .map((item) => ({ ...item, system: false }))
    .filter((item) => item.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return [...system, ...custom];
}

async function persistSystemRolePermissions(profile, roleProfileId, permissions, reset = false) {
  assertAdmin(profile);
  const systemProfile = systemRoleProfileForId(roleProfileId);
  if (!systemProfile || systemProfile.baseRole === 'admin') {
    const error = new Error('O perfil Administrador permanece sempre com acesso completo.');
    error.code = 'protected-role';
    throw error;
  }
  const normalizedPermissions = normalizeRolePermissions(
    systemProfile.scope,
    reset ? systemProfile.permissions : permissions
  );
  const validation = {
    isValid: true,
    errors: {},
    data: { ...systemProfile, permissions: normalizedPermissions }
  };

  const [accesses, users] = await Promise.all([
    getDocs(query(collection(db, 'allowedEmails'), where('roleProfileId', '==', roleProfileId))),
    getDocs(query(collection(db, 'users'), where('roleProfileId', '==', roleProfileId)))
  ]);
  const batch = writeBatch(db);
  const profileRef = doc(db, 'roleProfiles', roleProfileId);
  if (reset) {
    batch.delete(profileRef);
  } else {
    batch.set(profileRef, {
      permissions: validation.data.permissions,
      system: true,
      schemaVersion: 1,
      permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
      updatedAt: serverTimestamp(),
      updatedByUid: profile.uid
    });
  }
  accesses.docs.forEach((item) => batch.update(item.ref, {
    role: systemProfile.baseRole,
    permissions: validation.data.permissions,
    permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  }));
  users.docs.forEach((item) => batch.update(item.ref, {
    role: systemProfile.baseRole,
    permissions: validation.data.permissions,
    permissionSchemaVersion: PERMISSION_SCHEMA_VERSION
  }));
  await batch.commit();
  return { ...validation, id: roleProfileId };
}

export function saveSystemRolePermissions(profile, roleProfileId, permissions) {
  return persistSystemRolePermissions(profile, roleProfileId, permissions, false);
}

export function resetSystemRolePermissions(profile, roleProfileId) {
  return persistSystemRolePermissions(profile, roleProfileId, [], true);
}

export async function saveRoleProfile(profile, values, existingId = '') {
  assertAdmin(profile);
  const validation = validateRoleProfile(values);
  if (!validation.isValid) return validation;
  const id = existingId || crypto.randomUUID();
  await setDoc(doc(db, 'roleProfiles', id), {
    ...validation.data,
    active: true,
    system: false,
    schemaVersion: 1,
    permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
    updatedByUid: profile.uid,
    ...(!existingId ? { createdAt: serverTimestamp(), createdByUid: profile.uid } : {})
  }, { merge: true });
  if (existingId) {
    const [accesses, users] = await Promise.all([
      getDocs(query(collection(db, 'allowedEmails'), where('roleProfileId', '==', id))),
      getDocs(query(collection(db, 'users'), where('roleProfileId', '==', id)))
    ]);
    const batch = writeBatch(db);
    accesses.docs.forEach((item) => batch.update(item.ref, {
      role: validation.data.baseRole,
      permissions: validation.data.permissions,
      permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid
    }));
    users.docs.forEach((item) => batch.update(item.ref, {
      role: validation.data.baseRole,
      permissions: validation.data.permissions,
      permissionSchemaVersion: PERMISSION_SCHEMA_VERSION
    }));
    if (!accesses.empty || !users.empty) await batch.commit();
  }
  return { ...validation, id };
}

export async function deleteRoleProfile(profile, roleProfile) {
  assertAdmin(profile);
  if (!roleProfile || roleProfile.system) throw new Error('Perfis padrão não podem ser excluídos.');
  const assigned = await getDocs(query(
    collection(db, 'allowedEmails'),
    where('roleProfileId', '==', roleProfile.id),
    limit(1)
  ));
  if (!assigned.empty) {
    const error = new Error('Este perfil está atribuído a um ou mais acessos. Troque esses acessos antes de excluir.');
    error.code = 'role-in-use';
    throw error;
  }
  await deleteDoc(doc(db, 'roleProfiles', roleProfile.id));
}
