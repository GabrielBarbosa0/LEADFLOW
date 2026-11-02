import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { createQuickLeadDocument } from '../utils/lead.js';
import { getInstallationId } from '../utils/installation.js';
import { createId } from '../utils/id.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { hasPermission } from '../utils/role-profile.js';
import { canTransitionWalkIn, validateWalkInDraft, WALK_IN_CLOSED_STATUSES } from '../utils/walk-in.js';

function permissionError(message) {
  const error = new Error(message);
  error.code = 'permission-denied';
  return error;
}

function assertWalkInAccess(profile, storeId) {
  if (!isFirebaseConfigured || !profile?.uid || !hasPermission(profile, 'walkins.manage') || !canAccessStore(profile, storeId)) {
    throw permissionError('Encaixe nao autorizado para esta unidade.');
  }
}

function historyStage(status) {
  if (status === 'completed') return 'attended';
  if (['gave_up', 'not_accommodated', 'cancelled'].includes(status)) return 'closed';
  if (status === 'called' || status === 'in_service') return 'confirmation';
  return 'awaiting_appointment';
}

function historyEvent(profile, walkIn, eventType, description) {
  return {
    leadId: walkIn.leadId,
    storeId: walkIn.storeId,
    eventType,
    funnelStage: historyStage(walkIn.status),
    reasonCode: walkIn.status,
    description: String(description || '').slice(0, 500),
    walkInId: walkIn.id,
    actorUid: profile.uid,
    actorName: String(profile.displayName || 'Usuario'),
    actorRole: String(profile.role || 'manager'),
    occurredAtClient: new Date().toISOString(),
    occurredAtServer: serverTimestamp(),
    schemaVersion: 1
  };
}

function leadCreatedHistoryEvent(profile, leadId, storeId) {
  return {
    leadId,
    storeId,
    eventType: 'lead_created',
    funnelStage: 'captured',
    reasonCode: '',
    description: 'Cadastro rapido criado a partir da fila de encaixes.',
    actorUid: profile.uid,
    actorName: String(profile.displayName || 'Usuario'),
    actorRole: String(profile.role || 'manager'),
    occurredAtClient: new Date().toISOString(),
    occurredAtServer: serverTimestamp(),
    schemaVersion: 1
  };
}

function walkInDocumentId(queueDate, leadId) {
  return `${queueDate}__${leadId}`;
}

export function subscribeToWalkIns(profile, queueDate, onData, onError) {
  if (!isFirebaseConfigured || !profile?.uid || !['manager', 'admin'].includes(profile.role)) {
    throw permissionError('Fila de encaixes indisponivel.');
  }
  const storeIds = profileStoreIds(profile);
  if (!storeIds.length) throw permissionError('Nenhuma unidade permitida.');

  const recordsByStore = new Map();
  const leadCache = new Map();
  let revision = 0;
  const emit = async () => {
    const currentRevision = ++revision;
    const records = [...recordsByStore.values()].flat();
    const leadIds = [...new Set(records.map((item) => item.leadId))];
    await Promise.all(leadIds.map(async (leadId) => {
      if (leadCache.has(leadId)) return;
      const snapshot = await getDoc(doc(db, 'leads', leadId));
      leadCache.set(leadId, snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    }));
    if (currentRevision !== revision) return;
    onData(records
      .map((item) => ({ ...item, lead: leadCache.get(item.leadId) || null }))
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)
        || Number(a.arrivedAt?.toMillis?.() || 0) - Number(b.arrivedAt?.toMillis?.() || 0)));
  };

  const unsubscribes = storeIds.map((storeId) => onSnapshot(query(
    collection(db, 'appointmentWalkIns'),
    where('storeId', '==', storeId),
    where('queueDate', '==', queueDate)
  ), (snapshot) => {
    recordsByStore.set(storeId, snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    emit().catch(onError);
  }, onError));
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

export async function createWalkIn(profile, values) {
  const validation = validateWalkInDraft(values);
  if (!validation.isValid) return validation;
  const data = validation.data;
  assertWalkInAccess(profile, data.storeId);
  const id = walkInDocumentId(data.queueDate, data.leadId);
  const reference = doc(db, 'appointmentWalkIns', id);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists()) {
      const error = new Error('Este cliente ja possui um encaixe registrado hoje.');
      error.code = 'walk-in-already-exists';
      throw error;
    }
    const walkIn = {
      ...data,
      status: 'waiting',
      priority: 0,
      priorityReason: '',
      arrivedAt: serverTimestamp(),
      calledAt: null,
      startedAt: null,
      completedAt: null,
      closedReason: '',
      convertedAppointmentLeadId: '',
      createdAt: serverTimestamp(),
      createdByUid: profile.uid,
      createdByName: String(profile.displayName || 'Usuario'),
      updatedAt: serverTimestamp(),
      updatedByUid: profile.uid,
      schemaVersion: 1
    };
    transaction.set(reference, walkIn);
    transaction.set(doc(db, 'leads', data.leadId, 'history', createId()), historyEvent(
      profile,
      { ...walkIn, id },
      'walk_in_created',
      `Encaixe criado. Motivo: ${data.reason}${data.notes ? `. Observacao: ${data.notes}` : ''}`
    ));
  });
  return { ...validation, id };
}

export async function createQuickWalkIn(profile, leadValues, walkInValues, options = {}) {
  const leadId = createId();
  const quickLead = createQuickLeadDocument(
    { ...leadValues, ...walkInValues },
    { ...profile, storeId: walkInValues.storeId },
    getInstallationId()
  );
  if (!quickLead.isValid) return { ...quickLead, scope: 'lead' };

  const walkInValidation = validateWalkInDraft({ ...walkInValues, leadId });
  if (!walkInValidation.isValid) return { ...walkInValidation, scope: 'walkIn' };
  const data = walkInValidation.data;
  assertWalkInAccess(profile, data.storeId);

  const id = walkInDocumentId(data.queueDate, leadId);
  const walkIn = {
    ...data,
    status: 'waiting',
    priority: 0,
    priorityReason: '',
    arrivedAt: serverTimestamp(),
    calledAt: null,
    startedAt: null,
    completedAt: null,
    closedReason: '',
    convertedAppointmentLeadId: '',
    createdAt: serverTimestamp(),
    createdByUid: profile.uid,
    createdByName: String(profile.displayName || 'Usuario'),
    updatedAt: serverTimestamp(),
    updatedByUid: profile.uid,
    schemaVersion: 1
  };

  if (options.demoMode === true || !isFirebaseConfigured) {
    return { isValid: true, errors: {}, id, lead: { id: leadId, ...quickLead.data }, walkIn: { ...walkIn, id } };
  }

  await runTransaction(db, async (transaction) => {
    const leadReference = doc(db, 'leads', leadId);
    const walkInReference = doc(db, 'appointmentWalkIns', id);
    const existing = await transaction.get(walkInReference);
    if (existing.exists()) {
      const error = new Error('Este cliente ja possui um encaixe registrado hoje.');
      error.code = 'walk-in-already-exists';
      throw error;
    }

    transaction.set(leadReference, {
      ...quickLead.data,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
      funnelUpdatedAtServer: serverTimestamp()
    });
    transaction.set(doc(db, 'leads', leadId, 'history', createId()), leadCreatedHistoryEvent(profile, leadId, data.storeId));
    transaction.set(walkInReference, walkIn);
    transaction.set(doc(db, 'leads', leadId, 'history', createId()), historyEvent(
      profile,
      { ...walkIn, id },
      'walk_in_created',
      `Encaixe criado. Motivo: ${data.reason}${data.notes ? `. Observacao: ${data.notes}` : ''}`
    ));
  });

  return { isValid: true, errors: {}, id, lead: { id: leadId, ...quickLead.data } };
}

export async function transitionWalkIn(profile, walkIn, nextStatus, closedReason = '') {
  assertWalkInAccess(profile, walkIn?.storeId);
  if (!walkIn?.id) throw new Error('Encaixe invalido.');
  const reason = String(closedReason || '').trim();
  if (WALK_IN_CLOSED_STATUSES.includes(nextStatus) && nextStatus !== 'completed' && reason.length < 3) {
    const error = new Error('Informe o motivo do encerramento.');
    error.code = 'walk-in-reason-required';
    throw error;
  }
  const reference = doc(db, 'appointmentWalkIns', walkIn.id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('Encaixe nao encontrado.');
    const current = { id: snapshot.id, ...snapshot.data() };
    if (!canTransitionWalkIn(current.status, nextStatus)) {
      const error = new Error('Este encaixe foi atualizado por outra pessoa.');
      error.code = 'walk-in-stale-state';
      throw error;
    }
    const timestamps = {};
    if (nextStatus === 'called') timestamps.calledAt = serverTimestamp();
    if (nextStatus === 'in_service') timestamps.startedAt = serverTimestamp();
    if (nextStatus === 'completed') timestamps.completedAt = serverTimestamp();
    const next = {
      ...current,
      ...timestamps,
      status: nextStatus,
      closedReason: WALK_IN_CLOSED_STATUSES.includes(nextStatus) ? reason : '',
      updatedAt: serverTimestamp(),
      updatedByUid: profile.uid
    };
    transaction.update(reference, {
      ...timestamps,
      status: nextStatus,
      closedReason: next.closedReason,
      updatedAt: serverTimestamp(),
      updatedByUid: profile.uid
    });
    const labels = {
      called: 'Cliente chamado para o encaixe.',
      in_service: 'Atendimento do encaixe iniciado.',
      completed: 'Atendimento do encaixe concluido.',
      gave_up: `Cliente desistiu do encaixe. Motivo: ${reason}`,
      not_accommodated: `Nao foi possivel realizar o encaixe. Motivo: ${reason}`,
      cancelled: `Encaixe cancelado. Motivo: ${reason}`
    };
    transaction.set(doc(db, 'leads', current.leadId, 'history', createId()), historyEvent(
      profile,
      next,
      `walk_in_${nextStatus}`,
      labels[nextStatus]
    ));
  });
}
