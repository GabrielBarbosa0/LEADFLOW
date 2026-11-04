import {
  collection,
  doc,
  getDocFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  waitForPendingWrites,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { activeLeads } from '../utils/lead-archive.js';
import { createLeadDocument, createLeadUpdate } from '../utils/lead.js';
import { followUpAppointmentKey } from '../utils/follow-up.js';
import { getInstallationId } from '../utils/installation.js';
import { createId } from '../utils/id.js';
import { canAccessStore } from '../utils/permissions.js';
import { appointmentBlockTimes, appointmentSlotId } from '../utils/schedule.js';
import { appointmentChangeEvent, leadCreationEvents } from '../app/features/funnel/funnel-model.js';
import { addLeadHistoryEvents } from './lead-history-service.js';
import {
  listOfflineLeads,
  removeOfflineLead,
  saveOfflineLead,
  subscribeToOfflineLeads,
  updateOfflineLeadState
} from './offline-lead-store.js';

const DEMO_STORAGE_KEY = 'fascinlead:demo-leads';
let synchronizationPromise = null;

function reservationBlocks(storeId, appointmentDate, appointmentTime, durationMinutes) {
  return appointmentBlockTimes(appointmentTime, durationMinutes).map((blockTime) => ({
    id: appointmentSlotId(storeId, appointmentDate, blockTime),
    blockTime
  }));
}

function setReservationBlock(batch, block, data) {
  batch.set(doc(db, 'appointmentSlots', block.id), {
    ...data,
    blockTime: block.blockTime,
    createdAt: serverTimestamp()
  });
}

async function commitReservationBatch(batch, blocks, leadId) {
  try {
    await batch.commit();
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error;
    const checks = await Promise.allSettled(blocks.map((block) => (
      getDocFromServer(doc(db, 'appointmentSlots', block.id))
    )));
    const occupied = checks.some((result) => (
      result.status === 'fulfilled'
      && result.value.exists()
      && result.value.data().leadId !== leadId
    ));
    if (occupied) throw appointmentConflictError();
    throw error;
  }
}

function readDemoLeads() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeDemoLeads(leads) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(leads));
  window.dispatchEvent(new Event('fascinlead:demo-leads'));
}

export function subscribeToLeads(profile, demoMode, onData, onError) {
  if (demoMode || !isFirebaseConfigured) {
    const emit = () => onData(readDemoLeads());
    window.addEventListener('fascinlead:demo-leads', emit);
    emit();
    return () => window.removeEventListener('fascinlead:demo-leads', emit);
  }

  let remoteLeads = [];
  let assignedWalkInLeads = [];
  let offlineLeads = [];
  let confirmedRemoteIds = new Set();
  const removingOfflineIds = new Set();
  const emit = () => {
    const merged = new Map([...remoteLeads, ...assignedWalkInLeads].map((lead) => [lead.id, lead]));
    offlineLeads.forEach((lead) => merged.set(lead.id, { ...merged.get(lead.id), ...lead }));
    onData(activeLeads([...merged.values()]).sort((a, b) => (
      String(b.capturedAtClient).localeCompare(String(a.capturedAtClient))
    )));
  };
  const removeConfirmedOfflineLeads = () => {
    const confirmedIds = offlineLeads
      .map((lead) => lead.id)
      .filter((id) => confirmedRemoteIds.has(id) && !removingOfflineIds.has(id));
    confirmedIds.forEach((id) => removingOfflineIds.add(id));
    confirmedIds.forEach((id) => {
      removeOfflineLead(id).catch((error) => {
        removingOfflineIds.delete(id);
        onError(error);
      });
    });
  };
  const unsubscribeOffline = subscribeToOfflineLeads(profile.uid, (leads) => {
    offlineLeads = leads;
    emit();
    removeConfirmedOfflineLeads();
  }, onError);
  const constraints = [orderBy('capturedAtClient', 'desc'), limit(100)];
  if (profile.role !== 'admin') constraints.unshift(where('capturedByUid', '==', profile.uid));
  const leadsQuery = query(collection(db, 'leads'), ...constraints);

  const unsubscribeRemote = onSnapshot(
    leadsQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      confirmedRemoteIds = new Set(snapshot.docs
        .filter((leadDoc) => !leadDoc.metadata.hasPendingWrites && !leadDoc.metadata.fromCache)
        .map((leadDoc) => leadDoc.id));
      remoteLeads = snapshot.docs.map((leadDoc) => ({
          id: leadDoc.id,
          ...leadDoc.data(),
          syncState: leadDoc.metadata.hasPendingWrites ? 'pending' : 'synced',
          fromCache: leadDoc.metadata.fromCache
        }));
      emit();
      removeConfirmedOfflineLeads();
    },
    onError
  );
  const unsubscribeAssignedWalkIns = profile.role === 'captor'
    ? onSnapshot(query(
      collection(db, 'leads'),
      where('followUpCaptorUid', '==', profile.uid),
      orderBy('capturedAtClient', 'desc'),
      limit(100)
    ), (snapshot) => {
      assignedWalkInLeads = snapshot.docs.map((leadDoc) => ({
        id: leadDoc.id,
        ...leadDoc.data(),
        syncState: leadDoc.metadata.hasPendingWrites ? 'pending' : 'synced',
        fromCache: leadDoc.metadata.fromCache
      }));
      emit();
    }, onError)
    : () => {};
  return () => {
    unsubscribeRemote();
    unsubscribeAssignedWalkIns();
    unsubscribeOffline();
  };
}

function appointmentConflictError() {
  const error = new Error('O horário escolhido não está mais disponível.');
  error.code = 'appointment-slot-unavailable';
  return error;
}

export function saveLead(input, profile, demoMode, onRemoteError, options = {}) {
  const result = createLeadDocument(input, profile, getInstallationId());
  if (!result.isValid) return result;

  const id = createId();

  if (demoMode || !isFirebaseConfigured) {
    const leads = readDemoLeads();
    writeDemoLeads([
      {
        id,
        ...result.data,
        syncState: 'demo',
        fromCache: true
      },
      ...leads
    ]);
    return { ...result, id };
  }

  const offline = options.offline === true || !navigator.onLine;
  if (offline) {
    const offlineLead = {
      id,
      ...result.data,
      appointmentDate: '',
      appointmentTime: '',
      syncState: 'pending',
      fromCache: true
    };
    const localSavePromise = saveOfflineLead(offlineLead).catch((error) => {
      onRemoteError(error);
      throw error;
    });
    return { ...result, data: offlineLead, id, localSavePromise };
  }

  const leadData = {
    ...result.data,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
    funnelUpdatedAtServer: serverTimestamp()
  };
  const historyEvents = leadCreationEvents({ id, ...result.data }, profile);
  let writePromise;
  if (input.schedulingMode === 'controlled' && result.data.appointmentDate && result.data.appointmentTime) {
    const durationMinutes = Number(input.appointmentDurationMinutes) || 20;
    const blocks = reservationBlocks(profile.storeId, result.data.appointmentDate, result.data.appointmentTime, durationMinutes);
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', id), leadData);
    addLeadHistoryEvents(batch, id, historyEvents);
    blocks.forEach((block) => setReservationBlock(batch, block, {
      storeId: profile.storeId,
      appointmentDate: result.data.appointmentDate,
      appointmentTime: result.data.appointmentTime,
      durationMinutes,
      leadId: id,
      capturedByUid: profile.uid
    }));
    writePromise = batch.commit();
  } else {
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', id), leadData);
    addLeadHistoryEvents(batch, id, historyEvents);
    writePromise = batch.commit();
  }

  writePromise.catch(onRemoteError);
  return { ...result, id, writePromise };
}

export function updateLead(id, input, demoMode, onRemoteError, existingLead = null, options = {}) {
  const result = createLeadUpdate(input);
  if (!result.isValid) return result;

  const appointmentChanged = existingLead && (
    existingLead.appointmentDate !== result.data.appointmentDate
    || existingLead.appointmentTime !== result.data.appointmentTime
  );
  const now = new Date();
  const isScheduled = Boolean(result.data.appointmentDate && result.data.appointmentTime);
  const appointmentFunnelUpdate = appointmentChanged ? {
    funnelStage: isScheduled ? 'scheduled' : 'awaiting_reschedule',
    funnelReasonCode: '',
    funnelUpdatedAtClient: now.toISOString(),
    funnelUpdatedAtServer: serverTimestamp(),
    appointmentCycle: isScheduled && !existingLead.appointmentDate
      ? Number(existingLead.appointmentCycle || 0) + 1
      : Number(existingLead.appointmentCycle || 0)
  } : {};
  const historyEvent = appointmentChanged && options.profile
    ? appointmentChangeEvent(existingLead, { id, ...existingLead, ...result.data }, options.profile, now)
    : null;

  if (demoMode || !isFirebaseConfigured) {
    const leads = readDemoLeads();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index === -1) return { isValid: false, errors: {}, notFound: true };
    leads[index] = {
      ...leads[index],
      ...result.data,
      ...appointmentFunnelUpdate,
      ...(appointmentChanged && result.data.appointmentDate ? { appointmentAttendance: 'pending' } : {}),
      syncState: 'demo',
      fromCache: true
    };
    writeDemoLeads(leads);
    return { ...result, id };
  }

  const appointmentUpdate = {
    appointmentDate: result.data.appointmentDate,
    appointmentTime: result.data.appointmentTime,
    appointmentSchedulingMode: result.data.appointmentSchedulingMode,
    appointmentDurationMinutes: result.data.appointmentDurationMinutes,
    ...(result.data.appointmentServiceId ? {
      appointmentServiceId: result.data.appointmentServiceId,
      appointmentServiceName: result.data.appointmentServiceName
    } : {}),
    ...(appointmentChanged && result.data.appointmentDate ? { appointmentAttendance: 'pending' } : {}),
    ...appointmentFunnelUpdate,
    updatedAtServer: serverTimestamp()
  };
  const leadUpdate = options.appointmentOnly
    ? appointmentUpdate
    : { ...result.data, ...appointmentUpdate };
  const localOnly = existingLead
    && ['pending', 'error'].includes(existingLead.syncState)
    && !existingLead.createdAtServer;
  const oldControlled = existingLead?.appointmentSchedulingMode === 'controlled'
    && existingLead.appointmentDate && existingLead.appointmentTime;
  const newControlled = result.data.appointmentSchedulingMode === 'controlled'
    && result.data.appointmentDate && result.data.appointmentTime;
  const oldBlocks = oldControlled
    ? reservationBlocks(existingLead.storeId, existingLead.appointmentDate, existingLead.appointmentTime, existingLead.appointmentDurationMinutes || 20)
    : [];
  const newBlocks = newControlled
    ? reservationBlocks(existingLead.storeId, result.data.appointmentDate, result.data.appointmentTime, result.data.appointmentDurationMinutes || 20)
    : [];
  const newIds = new Set(newBlocks.map((block) => block.id));
  const reservationChanged = oldBlocks.length !== newBlocks.length
    || oldBlocks.some((block) => !newIds.has(block.id));
  let writePromise;
  if (localOnly) {
    const { id: ignoredId, syncState, fromCache, createdAtServer, ...localData } = existingLead;
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', id), {
      ...localData,
      ...result.data,
      ...(result.data.appointmentDate ? { appointmentAttendance: 'pending' } : {}),
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp()
    }, { merge: true });
    newBlocks.forEach((block) => setReservationBlock(batch, block, {
      storeId: existingLead.storeId,
      appointmentDate: result.data.appointmentDate,
      appointmentTime: result.data.appointmentTime,
      durationMinutes: result.data.appointmentDurationMinutes,
      leadId: id,
      capturedByUid: existingLead.capturedByUid
    }));
    writePromise = commitReservationBatch(batch, newBlocks, id);
  } else if (existingLead && reservationChanged && (oldBlocks.length || newBlocks.length)) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', id), leadUpdate, { merge: true });
    oldBlocks.filter((block) => !newIds.has(block.id)).forEach((block) => batch.delete(doc(db, 'appointmentSlots', block.id)));
    newBlocks.forEach((block) => setReservationBlock(batch, block, {
      storeId: existingLead.storeId,
      appointmentDate: result.data.appointmentDate,
      appointmentTime: result.data.appointmentTime,
      durationMinutes: result.data.appointmentDurationMinutes,
      leadId: id,
      capturedByUid: existingLead.capturedByUid
    }));
    if (historyEvent) addLeadHistoryEvents(batch, id, [historyEvent]);
    writePromise = commitReservationBatch(batch, newBlocks, id);
  } else if (historyEvent) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', id), leadUpdate, { merge: true });
    addLeadHistoryEvents(batch, id, [historyEvent]);
    writePromise = batch.commit();
  } else {
    writePromise = setDoc(doc(db, 'leads', id), leadUpdate, { merge: true });
  }

  writePromise.catch(onRemoteError);
  return { ...result, id, writePromise };
}

export function updateDemoAppointmentAttendance(id, attendance, profile) {
  const allowed = new Set(['pending', 'attended', 'missed']);
  if (!allowed.has(attendance)) return false;
  const leads = readDemoLeads();
  const index = leads.findIndex((lead) => lead.id === id);
  if (index === -1) return false;
  leads[index] = {
    ...leads[index],
    appointmentAttendance: attendance,
    appointmentAttendanceUpdatedAt: new Date().toISOString(),
    appointmentAttendanceUpdatedByUid: profile.uid
  };
  writeDemoLeads(leads);
  return true;
}

export function markDemoFollowUpContact(id, profile) {
  const leads = readDemoLeads();
  const index = leads.findIndex((lead) => lead.id === id && (
    lead.capturedByUid === profile.uid || ['manager', 'admin'].includes(profile?.role)
  ));
  if (index === -1) return false;
  leads[index] = {
    ...leads[index],
    followUpContactedAt: new Date().toISOString(),
    followUpContactedByUid: profile.uid,
    followUpContactedByName: profile.displayName,
    followUpContactedAppointmentKey: followUpAppointmentKey(leads[index])
  };
  writeDemoLeads(leads);
  return true;
}

async function synchronizeOfflineLeads(profile) {
  if (!profile?.uid) return { synchronized: 0, failed: 0 };
  const leads = await listOfflineLeads(profile.uid);
  let synchronized = 0;
  let failed = 0;
  for (const lead of leads) {
    const { id, syncState, fromCache, ...data } = lead;
    try {
      await updateOfflineLeadState(id, 'syncing');
      const leadReference = doc(db, 'leads', id);
      let writeError = null;
      try {
        const synchronizedLead = {
          ...data,
          appointmentDate: '',
          appointmentTime: '',
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
          funnelStage: 'awaiting_appointment',
          funnelReasonCode: '',
          funnelUpdatedAtClient: new Date().toISOString(),
          funnelUpdatedAtServer: serverTimestamp(),
          appointmentCycle: 0
        };
        const batch = writeBatch(db);
        batch.set(leadReference, synchronizedLead);
        addLeadHistoryEvents(batch, id, leadCreationEvents({ id, ...synchronizedLead }, profile));
        await batch.commit();
      } catch (error) {
        writeError = error;
      }

      let confirmedLead;
      try {
        confirmedLead = await getDocFromServer(leadReference);
      } catch (error) {
        throw writeError || error;
      }
      if (!confirmedLead.exists() || confirmedLead.data().capturedByUid !== profile.uid) {
        if (writeError) throw writeError;
        const error = new Error('O cadastro não foi confirmado pelo servidor.');
        error.code = 'offline-lead-not-confirmed';
        throw error;
      }
      await removeOfflineLead(id);
      synchronized += 1;
    } catch (error) {
      await updateOfflineLeadState(id, 'error');
      failed += 1;
    }
  }
  return { synchronized, failed };
}

export function markDemoAppointmentReminderDone(id, profile) {
  const leads = readDemoLeads();
  const index = leads.findIndex((lead) => lead.id === id && (
    profile.role === 'admin' || (profile.role === 'manager' && canAccessStore(profile, lead.storeId))
  ));
  if (index === -1 || !leads[index].appointmentDate || !leads[index].appointmentTime) return false;
  leads[index] = {
    ...leads[index],
    appointmentReminderSentAt: new Date().toISOString(),
    appointmentReminderSentByUid: profile.uid,
    appointmentReminderSentByName: profile.displayName,
    appointmentReminderAppointmentKey: followUpAppointmentKey(leads[index])
  };
  writeDemoLeads(leads);
  return true;
}

export function undoDemoAppointmentReminderDone(id, profile) {
  const leads = readDemoLeads();
  const index = leads.findIndex((lead) => lead.id === id && (
    profile.role === 'admin' || (profile.role === 'manager' && canAccessStore(profile, lead.storeId))
  ));
  if (index === -1) return false;
  const {
    appointmentReminderSentAt,
    appointmentReminderSentByUid,
    appointmentReminderSentByName,
    appointmentReminderAppointmentKey,
    ...pendingLead
  } = leads[index];
  leads[index] = pendingLead;
  writeDemoLeads(leads);
  return true;
}

export async function synchronizeNow(demoMode, profile = null) {
  if (demoMode || !isFirebaseConfigured) return { demo: true };
  if (synchronizationPromise) return synchronizationPromise;

  synchronizationPromise = (async () => {
    const offline = await synchronizeOfflineLeads(profile);
    await waitForPendingWrites(db);
    return { demo: false, ...offline };
  })().finally(() => {
    synchronizationPromise = null;
  });
  return synchronizationPromise;
}
