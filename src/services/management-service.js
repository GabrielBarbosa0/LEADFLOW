import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { createLeadUpdate } from '../utils/lead.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { hasPermission } from '../utils/role-profile.js';
import { appointmentBlockTimes, appointmentSlotId } from '../utils/schedule.js';
import { removeOfflineLead } from './offline-lead-store.js';
import { activeLeads, archivedLeads } from '../utils/lead-archive.js';
import { addLeadHistoryEvents } from './lead-history-service.js';

export const MANAGEMENT_QUERY_LIMIT = 300;

function localDayStart(date) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function localDayAfter(date) {
  const nextDay = new Date(`${date}T00:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString();
}

export async function loadManagementLeads(profile, startDate, endDate, { archiveStatus = 'active' } = {}) {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile.role)) {
    throw new Error('Acesso gerencial indisponível.');
  }

  const constraints = [
    where('capturedAtClient', '>=', localDayStart(startDate)),
    where('capturedAtClient', '<', localDayAfter(endDate)),
    orderBy('capturedAtClient', 'desc'),
    limit(MANAGEMENT_QUERY_LIMIT + 1)
  ];

  if (profile.role === 'manager') {
    const storeIds = profileStoreIds(profile);
    constraints.unshift(where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds));
  }

  const snapshot = await getDocs(query(collection(db, 'leads'), ...constraints));
  const documents = snapshot.docs.slice(0, MANAGEMENT_QUERY_LIMIT).map((leadDoc) => ({
    id: leadDoc.id,
    ...leadDoc.data()
  }));
  const records = archiveStatus === 'archived' ? archivedLeads(documents) : activeLeads(documents);

  return {
    records,
    truncated: snapshot.size > MANAGEMENT_QUERY_LIMIT
  };
}

export async function archiveManagementLeads(profile, leads = []) {
  if (!Array.isArray(leads) || !leads.length) return 0;
  leads.forEach((lead) => assertCanDelete(profile, lead));
  const occurredAtClient = new Date().toISOString();
  const actorName = String(profile.displayName || 'Usuário');
  const batch = writeBatch(db);

  leads.forEach((lead) => {
    batch.set(doc(db, 'leads', lead.id), {
      archived: true,
      archivedAtServer: serverTimestamp(),
      archivedByUid: profile.uid,
      archivedByName: actorName,
      updatedAtServer: serverTimestamp()
    }, { merge: true });
    addLeadHistoryEvents(batch, lead.id, [{
      storeId: lead.storeId,
      eventType: 'lead_archived',
      funnelStage: String(lead.funnelStage || 'captured'),
      reasonCode: '',
      description: 'Lead arquivado na gestão.',
      actorUid: profile.uid,
      actorName,
      actorRole: String(profile.role || 'manager'),
      occurredAtClient,
      schemaVersion: 1
    }]);
  });

  await batch.commit();
  return leads.length;
}

function assertCanUpdate(profile, lead) {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role)
    || !canAccessStore(profile, lead?.storeId)) {
    const error = new Error('Perfil sem acesso a este lead.');
    error.code = 'permission-denied';
    throw error;
  }
}

function assertCanDelete(profile, lead) {
  const canReachLead = profile?.role === 'admin'
    || lead?.capturedByUid === profile?.uid
    || canAccessStore(profile, lead?.storeId);
  if (!isFirebaseConfigured || !hasPermission(profile, 'leads.delete') || !canReachLead) {
    const error = new Error('Perfil sem permissão para excluir leads.');
    error.code = 'permission-denied';
    throw error;
  }
}

function reservationBlocks(storeId, appointmentDate, appointmentTime, durationMinutes) {
  return appointmentBlockTimes(appointmentTime, durationMinutes).map((blockTime) => ({
    id: appointmentSlotId(storeId, appointmentDate, blockTime),
    blockTime
  }));
}

export async function updateManagementLead(profile, lead, input) {
  assertCanUpdate(profile, lead);
  const validation = createLeadUpdate(input);
  if (!validation.isValid) return validation;

  const oldControlled = lead.appointmentSchedulingMode === 'controlled' && lead.appointmentDate && lead.appointmentTime;
  const newControlled = validation.data.appointmentSchedulingMode === 'controlled'
    && validation.data.appointmentDate && validation.data.appointmentTime;
  const oldBlocks = oldControlled
    ? reservationBlocks(lead.storeId, lead.appointmentDate, lead.appointmentTime, lead.appointmentDurationMinutes || 20)
    : [];
  const newBlocks = newControlled
    ? reservationBlocks(lead.storeId, validation.data.appointmentDate, validation.data.appointmentTime, validation.data.appointmentDurationMinutes || 20)
    : [];
  const newIds = new Set(newBlocks.map((block) => block.id));
  const reservationChanged = oldBlocks.length !== newBlocks.length
    || oldBlocks.some((block) => !newIds.has(block.id));
  const update = {
    ...validation.data,
    ...((lead.appointmentDate !== validation.data.appointmentDate
      || lead.appointmentTime !== validation.data.appointmentTime)
      && validation.data.appointmentDate
      ? { appointmentAttendance: 'pending' }
      : {}),
    updatedAtServer: serverTimestamp()
  };
  if (reservationChanged && (oldBlocks.length || newBlocks.length)) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', lead.id), update, { merge: true });
    oldBlocks.filter((block) => !newIds.has(block.id)).forEach((block) => batch.delete(doc(db, 'appointmentSlots', block.id)));
    newBlocks.forEach((block) => batch.set(doc(db, 'appointmentSlots', block.id), {
      storeId: lead.storeId,
      appointmentDate: validation.data.appointmentDate,
      appointmentTime: validation.data.appointmentTime,
      blockTime: block.blockTime,
      durationMinutes: validation.data.appointmentDurationMinutes,
      leadId: lead.id,
      capturedByUid: lead.capturedByUid,
      createdAt: serverTimestamp()
    }));
    await batch.commit();
  } else {
    await setDoc(doc(db, 'leads', lead.id), update, { merge: true });
  }
  return validation;
}

export async function deleteManagementLead(profile, lead) {
  assertCanDelete(profile, lead);
  if (['pending', 'error'].includes(lead.syncState) && !lead.createdAtServer) {
    await removeOfflineLead(lead.id);
    return;
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, 'leads', lead.id));
  if (lead.appointmentDate && lead.appointmentTime) {
    reservationBlocks(lead.storeId, lead.appointmentDate, lead.appointmentTime, lead.appointmentDurationMinutes || 20)
      .forEach((block) => batch.delete(doc(db, 'appointmentSlots', block.id)));
  }
  await batch.commit();
  if (['pending', 'error'].includes(lead.syncState)) await removeOfflineLead(lead.id);
}
