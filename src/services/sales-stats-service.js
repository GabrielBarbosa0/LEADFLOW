import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { canAccessStore } from '../utils/permissions.js';
import { hasPermission } from '../utils/role-profile.js';
import { normalizeSalesStatsDocument, normalizeSalesStatsPeriod } from '../utils/sales-stats.js';

function permissionError(message) {
  const error = new Error(message);
  error.code = 'permission-denied';
  return error;
}

function assertAvailable(profile) {
  if (!isFirebaseConfigured || !profile?.uid) {
    throw new Error('Indicadores de vendas indisponiveis.');
  }
}

export async function loadOwnSalesStats(profile, periodValue) {
  assertAvailable(profile);
  if (!hasPermission(profile, 'goals.view_own')) {
    throw permissionError('Seu perfil nao pode consultar indicadores pessoais.');
  }
  const period = normalizeSalesStatsPeriod(periodValue);
  const snapshot = await getDocs(query(
    collection(db, 'captorSalesStats'),
    where('captorUid', '==', profile.uid),
    where('period', '==', period),
    limit(1)
  ));
  const item = snapshot.docs[0];
  return item ? normalizeSalesStatsDocument(item.id, item.data()) : null;
}

export async function loadStoreSalesStats(profile, periodValue, storeIdValue) {
  assertAvailable(profile);
  const storeId = String(storeIdValue || '').trim();
  if (!['manager', 'admin'].includes(profile.role)
    || !hasPermission(profile, 'dashboard.view')
    || !storeId
    || !canAccessStore(profile, storeId)) {
    throw permissionError('Seu perfil nao pode consultar indicadores desta unidade.');
  }
  const period = normalizeSalesStatsPeriod(periodValue);
  const snapshot = await getDocs(query(
    collection(db, 'storeCaptorSalesStats'),
    where('storeId', '==', storeId),
    where('period', '==', period)
  ));
  return snapshot.docs.map((item) => normalizeSalesStatsDocument(item.id, item.data()));
}
