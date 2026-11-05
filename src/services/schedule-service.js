import { collection, doc, documentId, getDoc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import {
  appointmentBlockTimes,
  appointmentSlotId,
  DEFAULT_STORE_SCHEDULE,
  normalizeStoreSchedule,
  validateStoreSchedule
} from '../utils/schedule.js';
import { appointmentResourceStoreIds, STORES, transportResourceStoreIds } from '../utils/stores.js';
import { profileStoreIds } from '../utils/permissions.js';

function permissionError(message) {
  const error = new Error(message);
  error.code = 'permission-denied';
  return error;
}

function scheduleWithSharedTransport(storeId, schedulesByStore) {
  const ownSchedule = normalizeStoreSchedule(schedulesByStore.get(storeId) || DEFAULT_STORE_SCHEDULE);
  const resourceStoreIds = transportResourceStoreIds(storeId);
  if (resourceStoreIds.length === 1) return ownSchedule;

  const resourceSchedules = resourceStoreIds.map((id) => (
    normalizeStoreSchedule(schedulesByStore.get(id) || DEFAULT_STORE_SCHEDULE)
  ));
  const transportSchedule = resourceSchedules.find((schedule) => schedule.transportEnabled)
    || resourceSchedules.find((schedule) => schedule.transportHoursRules.length)
    || resourceSchedules[0];
  return {
    ...ownSchedule,
    transportEnabled: transportSchedule.transportEnabled,
    transportHoursRules: transportSchedule.transportHoursRules
  };
}

export function subscribeToStoreSchedule(profile, onData, onError, storeId = profile?.storeId) {
  if (!isFirebaseConfigured || !storeId || !profileStoreIds(profile).includes(storeId)) throw permissionError('Configuração de agenda indisponível.');
  const resourceStoreIds = transportResourceStoreIds(storeId);
  const storesQuery = query(
    collection(db, 'stores'),
    where(documentId(), 'in', resourceStoreIds)
  );
  return onSnapshot(
    storesQuery,
    (snapshot) => {
      const schedulesByStore = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
      onData(scheduleWithSharedTransport(storeId, schedulesByStore));
    },
    onError
  );
}

export function subscribeToDayAppointments(profile, appointmentDate, onData, onError, storeId = profile?.storeId) {
  if (!isFirebaseConfigured || !storeId || !profileStoreIds(profile).includes(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate || '')) {
    throw permissionError('Data de agendamento indisponível.');
  }
  const resourceStoreIds = appointmentResourceStoreIds(storeId);
  const dayQuery = query(
    collection(db, 'appointmentSlots'),
    where('storeId', resourceStoreIds.length === 1 ? '==' : 'in', resourceStoreIds.length === 1 ? storeId : resourceStoreIds),
    where('appointmentDate', '==', appointmentDate)
  );
  return onSnapshot(dayQuery, (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}

export async function loadStoreSchedules(profile) {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role)) throw permissionError('Agendas indisponíveis.');
  const snapshot = await getDocs(collection(db, 'stores'));
  const byId = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  const allowedStoreIds = profileStoreIds(profile);
  return STORES.filter((store) => allowedStoreIds.includes(store.id)).map((store) => ({
    ...store,
    ...scheduleWithSharedTransport(store.id, byId)
  }));
}

export async function loadStoreSchedule(profile, storeId) {
  if (!isFirebaseConfigured || !profile?.uid || !profileStoreIds(profile).includes(storeId)) {
    throw permissionError('Configuração de agenda indisponível.');
  }
  const resourceStoreIds = transportResourceStoreIds(storeId);
  const snapshots = await Promise.all(resourceStoreIds.map((id) => getDoc(doc(db, 'stores', id))));
  const byId = new Map(snapshots.map((snapshot, index) => [
    resourceStoreIds[index],
    snapshot.exists() ? snapshot.data() : DEFAULT_STORE_SCHEDULE
  ]));
  return {
    id: storeId,
    ...scheduleWithSharedTransport(storeId, byId)
  };
}

export async function saveStoreSchedule(profile, storeId, values) {
  if (!isFirebaseConfigured || profile?.role !== 'admin') throw permissionError('Apenas administradores podem configurar agendas.');
  const validation = validateStoreSchedule(values);
  if (!validation.isValid) return validation;
  const updatedAt = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(doc(db, 'stores', storeId), {
    ...validation.data,
    updatedAt,
    updatedByUid: profile.uid
  }, { merge: true });
  transportResourceStoreIds(storeId)
    .filter((resourceStoreId) => resourceStoreId !== storeId)
    .forEach((resourceStoreId) => batch.set(doc(db, 'stores', resourceStoreId), {
      transportEnabled: validation.data.transportEnabled,
      transportHoursRules: validation.data.transportHoursRules,
      updatedAt,
      updatedByUid: profile.uid
    }, { merge: true }));
  await batch.commit();
  return validation;
}

export async function backfillAppointmentSlots(profile, records, monthKey) {
  if (!isFirebaseConfigured || profile?.role !== 'admin' || !/^\d{4}-\d{2}$/.test(monthKey || '')) return 0;
  const startDate = `${monthKey}-01`;
  const [year, month] = monthKey.split('-').map(Number);
  const endDate = `${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const [slotsSnapshot, storesSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, 'appointmentSlots'),
      where('appointmentDate', '>=', startDate),
      where('appointmentDate', '<=', endDate)
    )),
    getDocs(collection(db, 'stores'))
  ]);
  const existingIds = new Set(slotsSnapshot.docs.map((item) => item.id));
  const settingsByStore = new Map(storesSnapshot.docs.map((item) => [item.id, normalizeStoreSchedule(item.data())]));
  const missing = [];
  records.forEach((lead) => {
    if (!lead.appointmentDate || !lead.appointmentTime || lead.appointmentSchedulingMode === 'free'
      || lead.appointmentStatus === 'cancelled' || lead.appointmentAttendance === 'cancelled') return;
    const duration = Number(lead.appointmentDurationMinutes)
      || settingsByStore.get(lead.storeId)?.appointmentDurationMinutes
      || DEFAULT_STORE_SCHEDULE.appointmentDurationMinutes;
    appointmentBlockTimes(lead.appointmentTime, duration).forEach((blockTime) => {
      const slotId = appointmentSlotId(lead.storeId, lead.appointmentDate, blockTime);
      if (!existingIds.has(slotId) && missing.length < 450) {
        missing.push({ lead, duration, blockTime, slotId });
        existingIds.add(slotId);
      }
    });
  });
  if (!missing.length) return 0;

  const batch = writeBatch(db);
  missing.forEach(({ lead, duration, blockTime, slotId }) => {
    batch.set(doc(db, 'appointmentSlots', slotId), {
      storeId: lead.storeId,
      appointmentDate: lead.appointmentDate,
      appointmentTime: lead.appointmentTime,
      blockTime,
      durationMinutes: duration,
      leadId: lead.id,
      capturedByUid: lead.capturedByUid,
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
  return missing.length;
}
