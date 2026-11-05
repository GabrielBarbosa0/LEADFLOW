import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { monthRange } from '../utils/calendar.js';
import { followUpAppointmentKey } from '../utils/follow-up.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { activeLeads } from '../utils/lead-archive.js';
import { appointmentBlockTimes, appointmentSlotId } from '../utils/schedule.js';
import { appointmentCancellationReasonLabel, validateAppointmentCancellation } from '../utils/appointment-cancellation.js';
import { hasPermission } from '../utils/role-profile.js';
import { addLeadHistoryEvents } from './lead-history-service.js';

export const APPOINTMENTS_QUERY_LIMIT = 500;
export const APPOINTMENT_ATTENDANCE = new Set(['pending', 'attended', 'missed', 'cancelled']);

function reservationSlotIds(lead) {
  if (Array.isArray(lead.appointmentSlotIds) && lead.appointmentSlotIds.length) {
    return [...new Set(lead.appointmentSlotIds.map(String).filter(Boolean))];
  }
  return appointmentBlockTimes(lead.appointmentTime, lead.appointmentDurationMinutes || 20)
    .map((blockTime) => appointmentSlotId(lead.storeId, lead.appointmentDate, blockTime));
}

export function canCancelAppointment(profile, lead) {
  if (!profile?.uid || !lead?.id || !hasPermission(profile, 'appointments.cancel')) return false;
  if (!lead.appointmentDate || !lead.appointmentTime
    || lead.appointmentStatus === 'cancelled'
    || ['attended', 'missed', 'cancelled'].includes(String(lead.appointmentAttendance || 'pending'))) return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'captor') return lead.capturedByUid === profile.uid && canAccessStore(profile, lead.storeId);
  return canAccessStore(profile, lead.storeId);
}

export async function cancelAppointment(profile, lead, values) {
  const validation = validateAppointmentCancellation(values);
  if (!validation.isValid) return validation;
  if (!isFirebaseConfigured || !canCancelAppointment(profile, lead)) {
    const error = new Error('Cancelamento de agendamento não autorizado.');
    error.code = 'permission-denied';
    throw error;
  }

  const now = new Date();
  const { reason, details } = validation.data;
  const description = `Agendamento de ${lead.appointmentDate} às ${lead.appointmentTime} cancelado. Motivo: ${appointmentCancellationReasonLabel(reason)}.${details ? ` Observação: ${details}` : ''}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'leads', lead.id), {
    appointmentStatus: 'cancelled',
    appointmentAttendance: 'cancelled',
    appointmentCancelledAtServer: serverTimestamp(),
    appointmentCancelledByUid: profile.uid,
    appointmentCancelledByName: String(profile.displayName || 'Usuário'),
    appointmentCancellationReason: reason,
    appointmentCancellationDetails: details,
    funnelStage: 'cancelled',
    funnelReasonCode: reason,
    funnelUpdatedAtClient: now.toISOString(),
    funnelUpdatedAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp()
  }, { merge: true });

  if (lead.appointmentSchedulingMode !== 'free') {
    reservationSlotIds(lead).forEach((slotId) => batch.delete(doc(db, 'appointmentSlots', slotId)));
  }
  addLeadHistoryEvents(batch, lead.id, [{
    leadId: lead.id,
    storeId: lead.storeId,
    eventType: 'appointment_cancelled',
    funnelStage: 'cancelled',
    reasonCode: reason,
    description,
    actorUid: profile.uid,
    actorName: String(profile.displayName || 'Usuário'),
    actorRole: String(profile.role || 'captor'),
    occurredAtClient: now.toISOString(),
    schemaVersion: 1
  }]);
  await batch.commit();
  return validation;
}

function appointmentReminderId(lead) {
  return `${lead.id}__${lead.appointmentDate}__${lead.appointmentTime.replace(':', '-')}`;
}

function appointmentsQuery(profile, monthKey, selectedStoreId = '') {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role)) {
    const error = new Error('Agenda indisponível para este perfil.');
    error.code = 'permission-denied';
    throw error;
  }

  const { startDate, endDate } = monthRange(monthKey);
  if (selectedStoreId && !canAccessStore(profile, selectedStoreId)) {
    const error = new Error('Unidade não autorizada.');
    error.code = 'permission-denied';
    throw error;
  }
  const storeIds = profileStoreIds(profile);
  const constraints = [
    where('appointmentDate', '>=', startDate),
    where('appointmentDate', '<=', endDate),
    limit(APPOINTMENTS_QUERY_LIMIT + 1)
  ];
  if (selectedStoreId) constraints.unshift(where('storeId', '==', selectedStoreId));
  else if (profile.role === 'manager') constraints.unshift(where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds));
  return query(collection(db, 'leads'), ...constraints);
}

export function subscribeToAppointments(profile, monthKey, selectedStoreId, onData, onError) {
  return onSnapshot(appointmentsQuery(profile, monthKey, selectedStoreId), (snapshot) => {
    const records = activeLeads(snapshot.docs.slice(0, APPOINTMENTS_QUERY_LIMIT)
      .map((item) => ({ id: item.id, ...item.data() })))
      .sort((a, b) => String(a.appointmentDate || '').localeCompare(String(b.appointmentDate || ''))
        || String(a.appointmentTime || '').localeCompare(String(b.appointmentTime || ''))
        || String(a.fullName || '').localeCompare(String(b.fullName || ''), 'pt-BR'));
    onData({ records, truncated: snapshot.size > APPOINTMENTS_QUERY_LIMIT });
  }, onError);
}

export async function loadUpcomingAppointments(profile, startDate, endDate, selectedStoreId = '') {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role)) {
    const error = new Error('Demanda futura indisponivel para este perfil.');
    error.code = 'permission-denied';
    throw error;
  }
  if (selectedStoreId && !canAccessStore(profile, selectedStoreId)) {
    const error = new Error('Unidade nao autorizada.');
    error.code = 'permission-denied';
    throw error;
  }

  const constraints = [
    where('appointmentDate', '>=', startDate),
    where('appointmentDate', '<=', endDate),
    limit(APPOINTMENTS_QUERY_LIMIT + 1)
  ];
  if (selectedStoreId) constraints.unshift(where('storeId', '==', selectedStoreId));
  else if (profile.role === 'manager') {
    const storeIds = profileStoreIds(profile);
    constraints.unshift(where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds));
  }

  const snapshot = await getDocs(query(collection(db, 'leads'), ...constraints));
  return {
    records: activeLeads(snapshot.docs.slice(0, APPOINTMENTS_QUERY_LIMIT).map((item) => ({ id: item.id, ...item.data() }))),
    truncated: snapshot.size > APPOINTMENTS_QUERY_LIMIT
  };
}

export function subscribeToAppointmentConfirmations(profile, startDate, endDate, onData, onError) {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role)) {
    const error = new Error('Confirmações indisponíveis para este perfil.');
    error.code = 'permission-denied';
    throw error;
  }

  const leadConstraints = [
    where('appointmentDate', '>=', startDate),
    where('appointmentDate', '<=', endDate),
    limit(APPOINTMENTS_QUERY_LIMIT + 1)
  ];
  const reminderConstraints = [
    where('appointmentDate', '>=', startDate),
    where('appointmentDate', '<=', endDate),
    limit(APPOINTMENTS_QUERY_LIMIT + 1)
  ];
  if (profile.role === 'manager') {
    const storeIds = profileStoreIds(profile);
    const storeConstraint = where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds);
    leadConstraints.unshift(storeConstraint);
    reminderConstraints.unshift(storeConstraint);
  }
  let leads = null;
  let reminders = null;
  let truncated = false;
  const emit = () => {
    if (!leads || !reminders) return;
    const reminderByLeadAndAppointment = new Map(reminders.map((item) => (
      [`${item.leadId}|${item.appointmentKey}`, item]
    )));
    const records = leads
      .map((lead) => {
        const reminder = reminderByLeadAndAppointment.get(`${lead.id}|${followUpAppointmentKey(lead)}`);
        return reminder ? {
          ...lead,
          appointmentReminderSentAt: reminder.completedAt,
          appointmentReminderSentByUid: reminder.completedByUid,
          appointmentReminderSentByName: reminder.completedByName,
          appointmentReminderAppointmentKey: reminder.appointmentKey
        } : lead;
      })
      .sort((a, b) => String(a.appointmentDate || '').localeCompare(String(b.appointmentDate || ''))
        || String(a.appointmentTime || '').localeCompare(String(b.appointmentTime || ''))
        || String(a.fullName || '').localeCompare(String(b.fullName || ''), 'pt-BR'));
    onData({ records, truncated });
  };
  const unsubscribeLeads = onSnapshot(query(collection(db, 'leads'), ...leadConstraints), (snapshot) => {
    leads = activeLeads(snapshot.docs.slice(0, APPOINTMENTS_QUERY_LIMIT)
      .map((item) => ({ id: item.id, ...item.data() })))
    truncated = truncated || snapshot.size > APPOINTMENTS_QUERY_LIMIT;
    emit();
  }, onError);
  const unsubscribeReminders = onSnapshot(query(collection(db, 'appointmentReminders'), ...reminderConstraints), (snapshot) => {
    reminders = snapshot.docs.slice(0, APPOINTMENTS_QUERY_LIMIT).map((item) => ({ id: item.id, ...item.data() }));
    truncated = truncated || snapshot.size > APPOINTMENTS_QUERY_LIMIT;
    emit();
  }, onError);
  return () => {
    unsubscribeLeads();
    unsubscribeReminders();
  };
}

export async function setAppointmentAttendance(profile, lead, attendance) {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role)
    || !APPOINTMENT_ATTENDANCE.has(attendance)
    || (profile.role === 'manager' && !canAccessStore(profile, lead.storeId))) {
    const error = new Error('Status de comparecimento não autorizado.');
    error.code = 'permission-denied';
    throw error;
  }

  await setDoc(doc(db, 'leads', lead.id), {
    appointmentAttendance: attendance,
    appointmentAttendanceUpdatedAt: serverTimestamp(),
    appointmentAttendanceUpdatedByUid: profile.uid,
    updatedAtServer: serverTimestamp()
  }, { merge: true });
}

export async function markAppointmentReminderDone(profile, lead) {
  const canAccess = profile?.role === 'admin'
    || (profile?.role === 'manager' && canAccessStore(profile, lead?.storeId));
  if (!isFirebaseConfigured || !canAccess || !lead?.appointmentDate || !lead?.appointmentTime) {
    const error = new Error('Confirmação não autorizada.');
    error.code = 'permission-denied';
    throw error;
  }
  const appointmentKey = followUpAppointmentKey(lead);
  await setDoc(doc(db, 'appointmentReminders', appointmentReminderId(lead)), {
    leadId: lead.id,
    storeId: lead.storeId,
    appointmentDate: lead.appointmentDate,
    appointmentTime: lead.appointmentTime,
    appointmentKey,
    completedAt: serverTimestamp(),
    completedByUid: profile.uid,
    completedByName: profile.displayName,
    schemaVersion: 1
  });
}

export async function undoAppointmentReminderDone(profile, lead) {
  const canAccess = profile?.role === 'admin'
    || (profile?.role === 'manager' && canAccessStore(profile, lead?.storeId));
  if (!isFirebaseConfigured || !canAccess || !lead?.appointmentDate || !lead?.appointmentTime) {
    const error = new Error('Reabertura não autorizada.');
    error.code = 'permission-denied';
    throw error;
  }
  await deleteDoc(doc(db, 'appointmentReminders', appointmentReminderId(lead)));
}
