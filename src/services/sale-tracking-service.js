import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { createId } from '../utils/id.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { hasPermission, isCollaboratorProfile } from '../utils/role-profile.js';
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
  const responsibleUid = String(values.responsibleUid || '').trim();
  const rawSaleValue = String(values.saleValue ?? '').trim();
  const saleValue = parseManualSaleValue(rawSaleValue);
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) errors.saleDate = 'Informe a data da compra.';
  if (saleDate > new Date().toISOString().slice(0, 10)) errors.saleDate = 'A data da compra nao pode ser futura.';
  if (orderNumber.length > 40) errors.orderNumber = 'Use no maximo 40 caracteres.';
  if (!rawSaleValue || !Number.isFinite(saleValue) || saleValue <= 0) errors.saleValue = 'Informe o valor da venda.';
  if (!responsibleUid) errors.responsibleUid = 'Selecione o colaborador responsavel.';
  if (notes.length > 500) errors.notes = 'Use no maximo 500 caracteres.';
  return { isValid: Object.keys(errors).length === 0, errors, data: { saleDate, orderNumber, saleValue, responsibleUid, notes } };
}

function activePurchase(item) {
  return item.status === 'confirmed';
}

function sortPurchases(items) {
  return [...items].sort((left, right) => right.saleDate.localeCompare(left.saleDate)
    || String(right.createdAt?.seconds || '').localeCompare(String(left.createdAt?.seconds || '')));
}

function legacyPurchase(lead, tracking) {
  if (!tracking || tracking.matchStatus !== 'manual_confirmed' || !tracking.manualSaleDate) return null;
  return {
    id: `legacy-${lead.id}`, leadId: lead.id, storeId: lead.storeId,
    saleDate: tracking.manualSaleDate, orderNumber: tracking.manualOrderNumber || '',
    saleValue: Number(tracking.manualSaleValue || 0), notes: tracking.manualNotes || '',
    responsibleUid: tracking.updatedByUid || tracking.createdByUid || '',
    responsibleName: tracking.updatedByName || tracking.createdByName || 'Colaborador',
    source: 'manual', status: 'confirmed', legacy: true
  };
}

async function loadSaleAssignees(profile, lead) {
  const self = {
    uid: profile.uid, displayName: String(profile.displayName || 'Colaborador'),
    storeId: profile.storeId, storeIds: profile.storeIds || [profile.storeId],
    role: profile.role, roleProfileId: profile.roleProfileId, active: true
  };
  if (!['manager', 'admin'].includes(profile.role)) return [self];
  const snapshots = profile.role === 'admin'
    ? [await getDocs(collection(db, 'users'))]
    : [await getDocs(query(collection(db, 'users'), where('storeId', '==', lead.storeId)))];
  const uniqueMembers = new Map(snapshots.flatMap((snapshot) => snapshot.docs)
    .map((item) => ({ uid: item.id, ...item.data() }))
    .map((member) => [member.uid, member]));
  const members = [...uniqueMembers.values()]
    .filter((member) => member.active === true && isCollaboratorProfile(member) && canAccessStore(member, lead.storeId));
  if (!members.some((member) => member.uid === self.uid)) members.push(self);
  return members.sort((left, right) => String(left.displayName).localeCompare(String(right.displayName), 'pt-BR'));
}

export async function loadLeadSaleTracking(profile, lead) {
  assertAuthorized(profile, lead);
  const [purchasesSnapshot, legacySnapshot, members] = await Promise.all([
    getDocs(query(collection(db, 'leadPurchases'), where('leadId', '==', lead.id), where('storeId', '==', lead.storeId))),
    getDoc(doc(db, 'leadSales', lead.id)),
    loadSaleAssignees(profile, lead)
  ]);
  const storedPurchases = purchasesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const purchases = storedPurchases.filter((item) => item.status !== 'deleted');
  const legacy = legacyPurchase(lead, legacySnapshot.exists() ? legacySnapshot.data() : null);
  if (legacy && !storedPurchases.length) purchases.push(legacy);
  return { purchases: sortPurchases(purchases), members };
}

export function subscribeToManualSaleStatuses(profile, onData, onError) {
  const statuses = collection(db, 'leadPurchaseStatuses');
  const storeIds = profileStoreIds(profile).slice(0, 10);
  const statusQuery = profile?.role === 'admin'
    ? query(statuses)
    : profile?.role === 'manager'
      ? query(statuses, where('storeId', 'in', storeIds.length ? storeIds : ['__none__']))
      : query(statuses, where('capturedByUid', '==', profile?.uid || '__none__'));
  return onSnapshot(statusQuery, (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function saveLeadSaleTracking(profile, lead, cpf, selectedSale = null) {
  assertAuthorized(profile, lead);
  const reference = doc(db, 'leadSales', lead.id);
  const existing = await getDoc(reference);
  const data = {
    leadId: lead.id, storeId: lead.storeId, capturedByUid: lead.capturedByUid,
    customerCpf: normalizeCpf(cpf), purchaseInterest: true,
    matchStatus: selectedSale ? 'sale_linked' : 'interest_registered', source: 'savwin',
    savwinStoreCode: String(selectedSale?.storeCode || ''), savwinOsNumber: String(selectedSale?.osNumber || ''),
    savwinSaleCode: String(selectedSale?.saleCode || ''), savwinCustomerCode: String(selectedSale?.customerCode || ''),
    savwinSaleDate: String(selectedSale?.saleDate || ''), savwinSaleValue: Number(selectedSale?.saleValue || 0),
    manualSaleDate: '', manualOrderNumber: '', manualSaleValue: 0, manualNotes: '',
    createdByUid: existing.data()?.createdByUid || profile.uid,
    createdByName: existing.data()?.createdByName || String(profile.displayName || 'Usuario'),
    createdAt: existing.data()?.createdAt || serverTimestamp(), updatedByUid: profile.uid,
    updatedByName: String(profile.displayName || 'Usuario'), updatedAt: serverTimestamp(), schemaVersion: 1
  };
  await setDoc(reference, data);
  return data;
}

async function currentLead(profile, lead) {
  assertAuthorized(profile, lead);
  if (!navigator.onLine) throw saleError('offline', 'Conecte-se para registrar uma compra.');
  const snapshot = await getDoc(doc(db, 'leads', lead.id));
  if (!snapshot.exists()) throw saleError('not-found', 'Cadastro nao encontrado.');
  const current = { id: snapshot.id, ...snapshot.data() };
  if (current.storeId !== lead.storeId) throw saleError('lead-changed', 'A unidade deste cadastro foi alterada.');
  return current;
}

async function resolveResponsible(profile, lead, uid) {
  if (uid === profile.uid) return { uid: profile.uid, displayName: String(profile.displayName || 'Colaborador') };
  const snapshot = await getDoc(doc(db, 'users', uid));
  const member = snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
  if (!member) throw saleError('invalid-responsible', 'Colaborador nao encontrado.');
  if (member.active !== true || !isCollaboratorProfile(member) || !canAccessStore(member, lead.storeId)) {
    throw saleError('invalid-responsible', 'Colaborador indisponivel para esta loja.');
  }
  return member;
}

async function purchaseSummary(lead, override = null) {
  const snapshot = await getDocs(query(
    collection(db, 'leadPurchases'),
    where('leadId', '==', lead.id),
    where('storeId', '==', lead.storeId)
  ));
  const purchases = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const merged = override ? [...purchases.filter((item) => item.id !== override.id), override] : purchases;
  const active = sortPurchases(merged.filter(activePurchase));
  return {
    leadId: lead.id, storeId: lead.storeId, capturedByUid: lead.capturedByUid,
    saleStatus: active.length ? 'confirmed' : 'pending', saleDate: active[0]?.saleDate || '',
    purchaseCount: active.length,
    purchaseTotal: active.reduce((total, item) => total + Number(item.saleValue || 0), 0),
    updatedAt: serverTimestamp()
  };
}

function purchaseHistoryWrite(profile, lead, purchase, eventType) {
  const labels = {
    purchase_created: 'Compra registrada', purchase_updated: 'Compra atualizada',
    purchase_cancelled: 'Compra cancelada', purchase_reactivated: 'Compra reativada',
    purchase_deleted: 'Compra excluida'
  };
  const order = purchase.orderNumber ? `, OS/pedido ${purchase.orderNumber}` : '';
  return {
    reference: doc(db, 'leads', lead.id, 'history', createId()),
    data: {
      leadId: lead.id, storeId: lead.storeId, eventType,
      funnelStage: String(lead.funnelStage || 'captured'), reasonCode: 'manual',
      description: `${labels[eventType]} para ${purchase.responsibleName}${order}.`,
      actorUid: profile.uid, actorName: String(profile.displayName || 'Usuario'),
      actorRole: String(profile.role || 'manager'), occurredAtClient: new Date().toISOString(),
      occurredAtServer: serverTimestamp(), schemaVersion: 1
    }
  };
}

export async function confirmManualSale(profile, lead, values, purchaseId = '') {
  const validation = validateManualSale(values);
  if (!validation.isValid) return validation;
  const current = await currentLead(profile, lead);
  const responsible = await resolveResponsible(profile, current, validation.data.responsibleUid);
  const reference = doc(db, 'leadPurchases', purchaseId || createId());
  const existingSnapshot = purchaseId ? await getDoc(reference) : null;
  if (purchaseId && (!existingSnapshot.exists() || existingSnapshot.data().leadId !== current.id)) {
    throw saleError('not-found', 'Compra nao encontrada.');
  }
  const existing = existingSnapshot?.data() || {};
  const actorName = String(profile.displayName || 'Usuario');
  const lifecycle = existing.status === 'cancelled'
    ? {
        status: 'cancelled', cancelledByUid: existing.cancelledByUid,
        cancelledByName: existing.cancelledByName, cancelledAt: existing.cancelledAt
      }
    : { status: 'confirmed' };
  const purchase = {
    leadId: current.id, leadName: String(current.fullName || ''), storeId: current.storeId,
    capturedByUid: String(current.capturedByUid || ''), capturedByName: String(current.capturedByName || ''),
    responsibleUid: responsible.uid, responsibleName: String(responsible.displayName || 'Colaborador'),
    saleDate: validation.data.saleDate, orderNumber: validation.data.orderNumber,
    saleValue: validation.data.saleValue, notes: validation.data.notes,
    source: 'manual', ...lifecycle,
    createdByUid: String(existing.createdByUid || profile.uid), createdByName: String(existing.createdByName || actorName),
    createdAt: existing.createdAt || serverTimestamp(), updatedByUid: profile.uid,
    updatedByName: actorName, updatedAt: serverTimestamp(), schemaVersion: 1
  };
  const saved = { id: reference.id, ...purchase };
  const summary = await purchaseSummary(current, saved);
  const history = purchaseHistoryWrite(profile, current, saved, purchaseId ? 'purchase_updated' : 'purchase_created');
  const batch = writeBatch(db);
  batch.set(reference, purchase);
  batch.set(doc(db, 'leadPurchaseStatuses', current.id), summary);
  batch.set(history.reference, history.data);
  await batch.commit();
  return { isValid: true, data: { ...current, saleStatus: summary.saleStatus, saleDate: summary.saleDate, purchaseCount: summary.purchaseCount, purchaseTotal: summary.purchaseTotal }, purchase: saved };
}

export async function removeManualSaleConfirmation(profile, lead, purchaseId) {
  const current = await currentLead(profile, lead);
  const reference = doc(db, 'leadPurchases', purchaseId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists() || snapshot.data().leadId !== current.id) throw saleError('not-found', 'Compra nao encontrada.');
  const existing = snapshot.data();
  const cancelled = {
    ...existing, status: 'cancelled', updatedByUid: profile.uid,
    updatedByName: String(profile.displayName || 'Usuario'), updatedAt: serverTimestamp(),
    cancelledByUid: profile.uid, cancelledByName: String(profile.displayName || 'Usuario'), cancelledAt: serverTimestamp()
  };
  const summary = await purchaseSummary(current, { id: purchaseId, ...cancelled });
  const history = purchaseHistoryWrite(profile, current, { id: purchaseId, ...cancelled }, 'purchase_cancelled');
  const batch = writeBatch(db);
  batch.set(reference, cancelled);
  batch.set(doc(db, 'leadPurchaseStatuses', current.id), summary);
  batch.set(history.reference, history.data);
  await batch.commit();
  return { isValid: true, data: { ...current, saleStatus: summary.saleStatus, saleDate: summary.saleDate, purchaseCount: summary.purchaseCount, purchaseTotal: summary.purchaseTotal } };
}

export async function reactivateManualSaleConfirmation(profile, lead, purchaseId) {
  const current = await currentLead(profile, lead);
  const reference = doc(db, 'leadPurchases', purchaseId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists() || snapshot.data().leadId !== current.id) throw saleError('not-found', 'Compra nao encontrada.');
  const existing = snapshot.data();
  if (existing.status !== 'cancelled') throw saleError('invalid-status', 'A compra nao esta cancelada.');
  const { cancelledByUid, cancelledByName, cancelledAt, deletedByUid, deletedByName, deletedAt, ...preserved } = existing;
  const reactivated = {
    ...preserved, status: 'confirmed', updatedByUid: profile.uid,
    updatedByName: String(profile.displayName || 'Usuario'), updatedAt: serverTimestamp()
  };
  const summary = await purchaseSummary(current, { id: purchaseId, ...reactivated });
  const history = purchaseHistoryWrite(profile, current, { id: purchaseId, ...reactivated }, 'purchase_reactivated');
  const batch = writeBatch(db);
  batch.set(reference, reactivated);
  batch.set(doc(db, 'leadPurchaseStatuses', current.id), summary);
  batch.set(history.reference, history.data);
  await batch.commit();
  return { isValid: true, data: { ...current, saleStatus: summary.saleStatus, saleDate: summary.saleDate, purchaseCount: summary.purchaseCount, purchaseTotal: summary.purchaseTotal } };
}

export async function deleteManualSaleConfirmation(profile, lead, purchaseId) {
  const current = await currentLead(profile, lead);
  const actorName = String(profile.displayName || 'Usuario');
  if (purchaseId === `legacy-${current.id}`) {
    const reference = doc(db, 'leadSales', current.id);
    const snapshot = await getDoc(reference);
    const existing = snapshot.exists() ? snapshot.data() : null;
    if (!existing || existing.matchStatus !== 'manual_confirmed') throw saleError('not-found', 'Compra nao encontrada.');
    const deleted = {
      ...existing, matchStatus: 'manual_reverted', updatedByUid: profile.uid,
      updatedByName: actorName, updatedAt: serverTimestamp()
    };
    const legacy = legacyPurchase(current, existing);
    const summary = await purchaseSummary(current);
    const history = purchaseHistoryWrite(profile, current, legacy, 'purchase_deleted');
    const batch = writeBatch(db);
    batch.set(reference, deleted);
    batch.set(doc(db, 'leadPurchaseStatuses', current.id), summary);
    batch.set(history.reference, history.data);
    await batch.commit();
    return { isValid: true, data: { ...current, saleStatus: summary.saleStatus, saleDate: summary.saleDate, purchaseCount: summary.purchaseCount, purchaseTotal: summary.purchaseTotal } };
  }

  const reference = doc(db, 'leadPurchases', purchaseId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists() || snapshot.data().leadId !== current.id || snapshot.data().status === 'deleted') {
    throw saleError('not-found', 'Compra nao encontrada.');
  }
  const deleted = {
    ...snapshot.data(), status: 'deleted', updatedByUid: profile.uid, updatedByName: actorName,
    updatedAt: serverTimestamp(), deletedByUid: profile.uid, deletedByName: actorName, deletedAt: serverTimestamp()
  };
  const summary = await purchaseSummary(current, { id: purchaseId, ...deleted });
  const history = purchaseHistoryWrite(profile, current, { id: purchaseId, ...deleted }, 'purchase_deleted');
  const batch = writeBatch(db);
  batch.set(reference, deleted);
  batch.set(doc(db, 'leadPurchaseStatuses', current.id), summary);
  batch.set(history.reference, history.data);
  await batch.commit();
  return { isValid: true, data: { ...current, saleStatus: summary.saleStatus, saleDate: summary.saleDate, purchaseCount: summary.purchaseCount, purchaseTotal: summary.purchaseTotal } };
}
