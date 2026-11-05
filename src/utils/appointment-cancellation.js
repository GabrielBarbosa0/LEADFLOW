export const APPOINTMENT_CANCELLATION_REASONS = Object.freeze([
  { id: 'client_withdrew', label: 'Cliente desistiu' },
  { id: 'unable_to_attend', label: 'Não conseguiu comparecer' },
  { id: 'schedule_conflict', label: 'Horário incompatível' },
  { id: 'other_provider', label: 'Atendimento realizado em outro local' },
  { id: 'transport_issue', label: 'Problema de transporte' },
  { id: 'duplicate_registration', label: 'Cadastro duplicado' },
  { id: 'operational_guidance', label: 'Orientação clínica ou operacional' },
  { id: 'other', label: 'Outro motivo' }
]);

const CANCELLATION_REASON_IDS = new Set(APPOINTMENT_CANCELLATION_REASONS.map((reason) => reason.id));

export function hasActiveAppointment(lead = {}, today = '') {
  const attendance = String(lead.appointmentAttendance || 'pending');
  return Boolean(
    lead.appointmentDate
    && lead.appointmentTime
    && lead.appointmentStatus !== 'cancelled'
    && !['attended', 'missed', 'cancelled'].includes(attendance)
    && (!today || String(lead.appointmentDate) >= today)
  );
}

export function appointmentCancellationReasonLabel(reason) {
  return APPOINTMENT_CANCELLATION_REASONS.find((item) => item.id === reason)?.label || 'Motivo não informado';
}

export function validateAppointmentCancellation(values = {}) {
  const reason = String(values.reason || '').trim();
  const details = String(values.details || '').trim();
  const errors = {};
  if (!CANCELLATION_REASON_IDS.has(reason)) errors.reason = 'Selecione o motivo do cancelamento.';
  if (reason === 'other' && details.length < 3) errors.details = 'Descreva o motivo do cancelamento.';
  if (details.length > 500) errors.details = 'A observação deve ter no máximo 500 caracteres.';
  return { isValid: Object.keys(errors).length === 0, errors, data: { reason, details } };
}
