import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/client.js';

function activeAppointment(lead) {
  return lead.archived !== true
    && lead.appointmentStatus !== 'cancelled'
    && lead.appointmentAttendance !== 'cancelled';
}

export function externalOperationRecord(lead) {
  const companions = Number(lead.companionCount ?? (lead.hasCompanion ? 1 : 0));
  return {
    id: lead.id,
    fullName: String(lead.fullName || ''),
    preferredName: String(lead.preferredName || ''),
    phoneSearch: String(lead.phoneSearch || ''),
    storeId: String(lead.storeId || ''),
    appointmentDate: String(lead.appointmentDate || ''),
    appointmentTime: String(lead.appointmentTime || ''),
    appointmentServiceName: String(lead.appointmentServiceName || ''),
    needsTransport: lead.needsTransport === true,
    hasCompanion: companions > 0,
    companionCount: Math.max(0, companions),
    transportSeats: Number(lead.transportSeats) || (lead.needsTransport ? companions + 1 : 0),
    street: String(lead.street || ''),
    number: String(lead.number || ''),
    neighborhood: String(lead.neighborhood || ''),
    city: String(lead.city || ''),
    state: String(lead.state || ''),
    addressReference: String(lead.addressReference || ''),
    capturedByName: String(lead.capturedByName || '')
  };
}

export function demoExternalOperations(leads, { startDate, endDate, storeId }) {
  return leads
    .filter((lead) => activeAppointment(lead)
      && lead.needsTransport === true
      && lead.appointmentDate >= startDate
      && lead.appointmentDate <= endDate
      && (!storeId || lead.storeId === storeId))
    .map(externalOperationRecord)
    .sort((left, right) => `${left.appointmentTime}-${left.fullName}`.localeCompare(`${right.appointmentTime}-${right.fullName}`, 'pt-BR'));
}

export async function loadExternalOperations({ startDate, endDate, storeId }) {
  if (!isFirebaseConfigured || !functions) {
    const error = new Error('Operacao externa indisponivel.');
    error.code = 'failed-precondition';
    throw error;
  }
  const request = httpsCallable(functions, 'listExternalOperations');
  const response = await request({ startDate, endDate, storeId });
  return {
    records: Array.isArray(response.data?.records) ? response.data.records : [],
    truncated: response.data?.truncated === true
  };
}
