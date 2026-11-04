export const APPOINTMENT_RESCHEDULE_REASONS = Object.freeze([
  { id: 'client_request', label: 'Solicitação do cliente' },
  { id: 'schedule_conflict', label: 'Conflito de horário' },
  { id: 'professional_availability', label: 'Disponibilidade do profissional' },
  { id: 'transport_issue', label: 'Problema de transporte' },
  { id: 'other', label: 'Outro motivo' }
]);

const reasonIds = new Set(APPOINTMENT_RESCHEDULE_REASONS.map((item) => item.id));

function appointmentValue(value) {
  return String(value || '').trim();
}

export function hasAppointmentScheduleChanged(current = {}, next = {}) {
  return ['appointmentDate', 'appointmentTime'].some((field) => (
    appointmentValue(current[field]) !== appointmentValue(next[field])
  ));
}

export function validateRescheduleSchedule(values = {}) {
  const appointmentDate = appointmentValue(values.appointmentDate);
  const appointmentTime = appointmentValue(values.appointmentTime);
  const errors = {};
  if (!appointmentDate) errors.appointmentDate = 'Escolha a nova data do agendamento.';
  if (!appointmentTime) errors.appointmentTime = 'Escolha o novo horario do agendamento.';
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateAppointmentReschedule(values = {}) {
  const reason = String(values.reason || '').trim();
  const details = String(values.details || '').trim();
  const errors = {};
  if (!reasonIds.has(reason)) errors.reason = 'Selecione o motivo do reagendamento.';
  if (reason === 'other' && details.length < 3) errors.details = 'Descreva o motivo do reagendamento.';
  if (details.length > 500) errors.details = 'A observação deve ter no máximo 500 caracteres.';
  return { isValid: Object.keys(errors).length === 0, errors, data: { reason, details } };
}

export function appointmentRescheduleReasonLabel(reason) {
  return APPOINTMENT_RESCHEDULE_REASONS.find((item) => item.id === reason)?.label || 'Motivo não informado';
}
