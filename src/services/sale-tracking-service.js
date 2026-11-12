import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { createId } from '../utils/id.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { hasPermission } from '../utils/role-profile.js';
import { normalizeCpf } from '../utils/savwin-matching.js';

function saleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function canConfirmManualSale(profile, lead) {
  return Boolean(isFirebaseConfigured && profile?.uid && lead?.id
    && canAccessStore(profile, lead.storeId)
    && hasPermission(profile, 'sales.confirm_manual'));
}

function assertAuthorized(profile, lead) {
  if (!canConfirmManualSale(profile, lead)) throw saleError('permission-denied', 'Confirmacao de compra nao autorizada.');
}

export function parseManualSaleValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const amount = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export function validateManualSale(values = {}) {
  const saleDate = String(values.saleDate || '').trim();
  const orderNumber = String(values.orderNumber || '').trim();
  const notes = String(values.notes || '').trim();
  const saleValue = parseManualSaleValue(values.saleValue);
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) errors.saleDate = 'Informe a data da compra.';
  if (saleDate > new Date().toISOString().slice(0, 10)) errors.saleDate = 'A data da compra nao pode ser futura.';
  if (orderNumber.length > 40) errors.orderNumber = 'Use no maximo 40 caracteres.';
  if (!Number.isFinite(saleValue) || saleValue < 0) errors.saleValue = 'Informe um valor valido.';
  if (notes.length > 500) errors.notes = 'Use no maximo 500 caracteres.';
  return { isValid: Object.keys(errors).length === 0, errors, data: { saleDate, orderNumber, saleValue, notes } };
}

export async function loadLeadSaleTracking(profile, lead) {
  assertAuthorized(profile, lead);
  const snapshot = await getDoc(doc(db, 'leadSales', lead.id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeToManualSaleStatuses(profile, onData, onError) {
  const statuses = collection(db, 'leadPurchaseStatuses');
  const storeIds = profileStoreIds(profile).slice(0, 10);
  const statusQuery = profile?.role === 'admin'
    ? query(statuses)
    : profile?.role === 'manager'
      ? query(statuses, where('storeId', 'in', storeIds.length ? storeIds : ['__none__']))
      : query(statuses, where('capturedByUid', '==', profile?.uid || '__none__'));
  return onSnapshot(statusQuery, (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function saveLeadSaleTracking(profile, lead, cpf, selectedSale = null) {
  assertAuthorized(profile, lead);
  const reference = doc(db, 'leadSales', lead.id);
  const existing = await getDoc(reference);
  const data = {
    leadId: lead.id, storeId: lead.storeId, capturedByUid: lead.capturedByUid,
    customerCpf: normalizeCpf(cpf), purchaseInterest: true,
    matchStatus: selectedSale ? 'sale_linked' : 'interest_registered', source: 'savwin',
    savwinStoreCode: String(selectedSale?.storeCode || ''),
    savwinOsNumber: String(selectedSale?.osNumber || ''),
    savwinSaleCode: String(selectedSale?.saleCode || ''),
    savwinCustomerCode: String(selectedSale?.customerCode || ''),
    savwinSaleDate: String(selectedSale?.saleDate || ''),
    savwinSaleValue: Number(selectedSale?.saleValue || 0),
    manualSaleDate: '', manualOrderNumber: '', manualSaleValue: 0, manualNotes: '',
    createdByUid: existing.data()?.createdByUid || profile.uid,
    createdByName: existing.data()?.createdByName || String(profile.displayName || 'Usuario'),
    createdAt: existing.data()?.createdAt || serverTimestamp(),
    updatedByUid: profile.uid, updatedByName: String(profile.displayName || 'Usuario'),
    updatedAt: serverTimestamp(), schemaVersion: 1
  };
  await setDoc(reference, data);
  return data;
}

async function changeManualSale(profile, lead, values, reverting = false) {
  assertAuthorized(profile, lead);
  if (!navigator.onLine) throw saleError('offline', 'Conecte-se para confirmar uma compra.');
  const validation = reverting ? { isValid: true, data: null } : validateManualSale(values);
  if (!validation.isValid) return validation;

  const leadRef = doc(db, 'leads', lead.id);
  const saleRef = doc(db, 'leadSales', lead.id);
  const statusRef = doc(db, 'leadPurchaseStatuses', lead.id);
  const historyRef = doc(db, 'leadSaleEvents', createId());
  const actorName = String(profile.displayName || 'Usuario');
  const leadSnapshot = await getDoc(leadRef);
  const saleSnapshot = await getDoc(saleRef);
  if (!leadSnapshot.exists()) throw saleError('not-found', 'Cadastro nao encontrado.');
  const current = { id: leadSnapshot.id, ...leadSnapshot.data() };
  if (current.storeId !== lead.storeId) throw saleError('lead-changed', 'A unidade deste cadastro foi alterada.');
  const existing = saleSnapshot.exists() ? saleSnapshot.data() : {};
  if (reverting && existing.matchStatus !== 'manual_confirmed') {
    throw saleError('sale-not-confirmed', 'Este cadastro nao possui compra confirmada.');
  }
  const saleData = {
      leadId: current.id, storeId: current.storeId, capturedByUid: current.capturedByUid,
      customerCpf: normalizeCpf(current.customerCpf || ''), purchaseInterest: true,
      matchStatus: reverting ? 'manual_reverted' : 'manual_confirmed', source: 'manual',
      savwinStoreCode: String(existing.savwinStoreCode || ''), savwinOsNumber: String(existing.savwinOsNumber || ''),
      savwinSaleCode: String(existing.savwinSaleCode || ''), savwinCustomerCode: String(existing.savwinCustomerCode || ''),
      savwinSaleDate: String(existing.savwinSaleDate || ''), savwinSaleValue: Number(existing.savwinSaleValue || 0),
      manualSaleDate: reverting ? String(existing.manualSaleDate || current.saleDate || '') : validation.data.saleDate,
      manualOrderNumber: reverting ? String(existing.manualOrderNumber || '') : validation.data.orderNumber,
      manualSaleValue: reverting ? Number(existing.manualSaleValue || 0) : validation.data.saleValue,
      manualNotes: reverting ? String(existing.manualNotes || '') : validation.data.notes,
      createdByUid: String(existing.createdByUid || profile.uid), createdByName: String(existing.createdByName || actorName),
      createdAt: existing.createdAt || serverTimestamp(), updatedByUid: profile.uid, updatedByName: actorName,
      updatedAt: serverTimestamp(), schemaVersion: 1
  };
  const summary = {
    leadId: current.id,
    storeId: current.storeId,
    capturedByUid: current.capturedByUid,
    saleStatus: reverting ? 'pending' : 'confirmed',
    saleDate: reverting ? '' : validation.data.saleDate,
    updatedAt: serverTimestamp()
  };
  const history = {
      leadId: current.id, storeId: current.storeId,
      eventType: reverting ? 'sale_confirmation_removed' : 'sale_confirmed',
      funnelStage: String(current.funnelStage || 'captured'), reasonCode: 'manual',
      description: reverting ? 'Confirmacao manual de compra removida.'
        : `Compra confirmada manualmente${validation.data.orderNumber ? ` (OS/pedido ${validation.data.orderNumber})` : ''}.`,
      actorUid: profile.uid, actorName, actorRole: String(profile.role || 'manager'),
      occurredAtClient: new Date().toISOString(), occurredAtServer: serverTimestamp(), schemaVersion: 1
  };

  // These writes are intentionally separate because the existing rules are close
  // to Firestore's 1,000-expression limit. Repeating the operation is idempotent.
  await setDoc(saleRef, saleData);
  await setDoc(statusRef, summary);
  await setDoc(historyRef, history);
  return { isValid: true, data: { ...current, saleStatus: summary.saleStatus, saleDate: summary.saleDate } };
}

export function confirmManualSale(profile, lead, values) {
  return changeManualSale(profile, lead, values, false);
}

export function removeManualSaleConfirmation(profile, lead) {
  return changeManualSale(profile, lead, null, true);
}
