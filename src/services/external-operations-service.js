import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase/client.js';

function hasActiveAppointment(lead) {
  return lead.archived !== true
    && Boolean(lead.appointmentDate && lead.appointmentTime)
    && lead.appointmentStatus !== 'cancelled'
    && lead.appointmentAttendance !== 'cancelled';
}

export function externalOperationRecord(lead) {
  const companions = Number(lead.companionCount ?? (lead.hasCompanion ? 1 : 0));
  return {
    id: String(lead.id || ''),
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
    postalCode: String(lead.postalCode || ''),
    street: String(lead.street || ''),
    streetNumber: String(lead.streetNumber || lead.number || ''),
    neighborhood: String(lead.neighborhood || ''),
    city: String(lead.city || ''),
    state: String(lead.state || ''),
    addressReference: String(lead.addressReference || ''),
    capturedByName: String(lead.capturedByName || '')
  };
}

export function demoExternalOperations(leads, { startDate, endDate, storeId }) {
  return leads
    .filter((lead) => hasActiveAppointment(lead)
      && lead.appointmentDate >= startDate
      && lead.appointmentDate <= endDate
      && (!storeId || lead.storeId === storeId))
    .map(externalOperationRecord)
    .sort((left, right) => `${left.appointmentDate}-${left.appointmentTime}-${left.fullName}`
      .localeCompare(`${right.appointmentDate}-${right.appointmentTime}-${right.fullName}`, 'pt-BR'));
}

export function filterExternalOperationRecords(records, { transportMode = 'all', companionMode = 'all', query = '' } = {}) {
  const search = String(query).trim().toLocaleLowerCase('pt-BR');
  return records.filter((lead) => {
    if (transportMode === 'with' && !lead.needsTransport) return false;
    if (transportMode === 'without' && lead.needsTransport) return false;
    if (companionMode === 'with' && !lead.hasCompanion) return false;
    if (companionMode === 'without' && lead.hasCompanion) return false;
    return !search || [
      lead.fullName,
      lead.preferredName,
      lead.street,
      lead.neighborhood,
      lead.city,
      lead.addressReference
    ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
  });
}

export async function loadExternalOperations({ startDate, endDate, storeId }) {
  if (!isFirebaseConfigured || !functions) {
    const error = new Error('Operação externa indisponível.');
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
