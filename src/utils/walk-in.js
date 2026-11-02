export const WALK_IN_OPEN_STATUSES = Object.freeze(['waiting', 'called', 'in_service']);
export const WALK_IN_CLOSED_STATUSES = Object.freeze(['completed', 'gave_up', 'not_accommodated', 'cancelled']);

export const WALK_IN_STATUS_LABELS = Object.freeze({
  waiting: 'Aguardando',
  called: 'Chamado',
  in_service: 'Em atendimento',
  completed: 'Atendido',
  gave_up: 'Desistiu',
  not_accommodated: 'Nao foi possivel encaixar',
  cancelled: 'Cancelado'
});

export const WALK_IN_REASONS = Object.freeze([
  'Cliente presencial solicitou exame imediato',
  'Cliente precisa de atendimento no mesmo dia',
  'Oportunidade entre atendimentos',
  'Orientacao da recepcao',
  'Outro motivo operacional'
]);

export const WALK_IN_TRANSITIONS = Object.freeze({
  waiting: ['called', 'gave_up', 'not_accommodated', 'cancelled'],
  called: ['in_service', 'gave_up', 'not_accommodated', 'cancelled'],
  in_service: ['completed', 'cancelled']
});

export function walkInIsOpen(status) {
  return WALK_IN_OPEN_STATUSES.includes(status);
}

export function canTransitionWalkIn(currentStatus, nextStatus) {
  return WALK_IN_TRANSITIONS[currentStatus]?.includes(nextStatus) === true;
}

export function validateWalkInDraft(values = {}) {
  const data = {
    leadId: String(values.leadId || '').trim(),
    storeId: String(values.storeId || '').trim(),
    queueDate: String(values.queueDate || '').trim(),
    serviceId: String(values.serviceId || '').trim(),
    serviceName: String(values.serviceName || '').trim(),
    professionalType: String(values.professionalType || '').trim(),
    reason: String(values.reason || '').trim(),
    notes: String(values.notes || '').trim()
  };
  const errors = {};
  if (!data.leadId) errors.leadId = 'Selecione um cliente.';
  if (!data.storeId) errors.storeId = 'Selecione a unidade.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.queueDate)) errors.queueDate = 'A data da fila e invalida.';
  if (!data.serviceId || data.serviceId.length > 120) errors.serviceId = 'Selecione o servico.';
  if (data.serviceName.length < 2 || data.serviceName.length > 80) errors.serviceName = 'Selecione um servico valido.';
  if (!['optometrist', 'ophthalmologist'].includes(data.professionalType)) errors.professionalType = 'Selecione o profissional.';
  if (data.reason.length < 5 || data.reason.length > 240) errors.reason = 'Informe o motivo do encaixe.';
  if (data.notes.length > 500) errors.notes = 'A observacao deve ter no maximo 500 caracteres.';
  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

export function walkInElapsedMinutes(value, now = new Date()) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
}
