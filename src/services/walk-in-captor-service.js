import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { profileStoreIds } from '../utils/permissions.js';
import { hasPermission } from '../utils/role-profile.js';

function permissionError(message) {
  const error = new Error(message);
  error.code = 'permission-denied';
  return error;
}

function captorCanWorkAtStore(captor, storeId) {
  return captor.storeId === storeId || (Array.isArray(captor.storeIds) && captor.storeIds.includes(storeId));
}

export async function loadWalkInCaptors(profile) {
  if (!isFirebaseConfigured || !profile?.uid || !hasPermission(profile, 'walkins.manage')) {
    throw permissionError('Captadores indisponiveis para encaixes.');
  }
  const storeIds = profileStoreIds(profile);
  if (!storeIds.length) return [];

  const snapshots = await Promise.all(storeIds.map((storeId) => getDocs(query(
    collection(db, 'users'),
    where('storeId', '==', storeId),
    where('role', '==', 'captor')
  ))));
  const captors = new Map();
  snapshots.flatMap((snapshot) => snapshot.docs).forEach((item) => {
    const data = { uid: item.id, ...item.data() };
    if (data.active !== true || !captorCanWorkAtStore(data, data.storeId)) return;
    captors.set(data.uid, {
      uid: data.uid,
      displayName: String(data.displayName || data.email || 'Captador'),
      storeId: data.storeId,
      storeIds: Array.isArray(data.storeIds) ? data.storeIds : [data.storeId]
    });
  });
  return [...captors.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}
