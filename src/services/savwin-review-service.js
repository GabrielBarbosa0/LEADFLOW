import { collection, getDocs, limit, query, serverTimestamp, updateDoc, doc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { canAccessStore } from '../utils/permissions.js';
import { hasPermission } from '../utils/role-profile.js';

export const SAVWIN_REVIEW_LIMIT = 200;

function permissionError() {
  const error = new Error('Seu perfil nao pode revisar conciliacoes desta unidade.');
  error.code = 'permission-denied';
  return error;
}

function assertAccess(profile, storeId) {
  if (!isFirebaseConfigured || !profile?.uid || !['manager', 'admin'].includes(profile.role)
    || !hasPermission(profile, 'savwin.review') || !storeId || !canAccessStore(profile, storeId)) {
    throw permissionError();
  }
}

function normalizeCase(id, value = {}) {
  return {
    id: String(id || ''),
    storeId: String(value.storeId || ''),
    period: String(value.period || ''),
    saleDate: String(value.saleDate || ''),
    netValue: Number.isFinite(Number(value.netValue)) ? Number(value.netValue) : 0,
    matchStatus: String(value.matchStatus || ''),
    reconciliationStatus: String(value.reconciliationStatus || ''),
    reviewStatus: String(value.reviewStatus || 'pending'),
    reviewReason: String(value.reviewReason || ''),
    reviewedByUid: String(value.reviewedByUid || ''),
    reviewedAt: value.reviewedAt || null,
    sourceUpdatedAt: value.sourceUpdatedAt || null
  };
}

export async function loadSavwinReviewCases(profile, { storeId, period }) {
  assertAccess(profile, storeId);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) {
    const error = new Error('Periodo invalido.');
    error.code = 'invalid-argument';
    throw error;
  }
  const snapshot = await getDocs(query(
    collection(db, 'savwinReviewCases'),
    where('storeId', '==', storeId),
    where('period', '==', period),
    limit(SAVWIN_REVIEW_LIMIT)
  ));
  return snapshot.docs
    .map((item) => normalizeCase(item.id, item.data()))
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || a.id.localeCompare(b.id));
}

export async function saveSavwinReviewDecision(profile, reviewCase, { reviewStatus, reviewReason }) {
  assertAccess(profile, reviewCase?.storeId);
  const status = String(reviewStatus || '');
  const reason = String(reviewReason || '').trim();
  if (reviewCase?.reviewStatus !== 'pending' || !['resolved', 'dismissed'].includes(status)
    || reason.length < 5 || reason.length > 500) {
    const error = new Error('Informe uma decisao e uma justificativa entre 5 e 500 caracteres.');
    error.code = 'invalid-argument';
    throw error;
  }
  await updateDoc(doc(db, 'savwinReviewCases', reviewCase.id), {
    reviewStatus: status,
    reviewReason: reason,
    reviewedByUid: profile.uid,
    reviewedAt: serverTimestamp()
  });
  return { ...reviewCase, reviewStatus: status, reviewReason: reason, reviewedByUid: profile.uid };
}
