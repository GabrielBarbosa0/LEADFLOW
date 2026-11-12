export const FUNNEL_STAGES = Object.freeze([
  { id: 'captured', label: 'Captado' },
  { id: 'awaiting_appointment', label: 'Aguardando agendamento' },
  { id: 'scheduled', label: 'Agendado' },
  { id: 'confirmation', label: 'Confirmação pendente' },
  { id: 'confirmed', label: 'Confirmado' },
  { id: 'attended', label: 'Compareceu' },
  { id: 'missed', label: 'Não compareceu' },
  { id: 'awaiting_reschedule', label: 'Aguardando reagendamento' },
  { id: 'cancelled', label: 'Cancelado' },
  { id: 'closed', label: 'Encerrado' }
]);

export const FUNNEL_EVENT_LABELS = Object.freeze({
  lead_created: 'Cadastro criado',
  appointment_scheduled: 'Agendamento realizado',
  appointment_rescheduled: 'Agendamento reagendado',
  appointment_cancelled: 'Agendamento cancelado',
  appointment_reminder_sent: 'Lembrete enviado',
  appointment_attended: 'Comparecimento registrado',
  appointment_missed: 'Falta registrada',
  follow_up_contacted: 'Retorno iniciado',
  lead_archived: 'Lead arquivado',
  lead_claimed: 'Lead assumido',
  lead_reassigned: 'Responsável transferido',
  sale_confirmed: 'Compra confirmada',
  sale_confirmation_removed: 'Confirmação de compra removida',
  birthday_benefit_planned: 'Beneficio de aniversario planejado',
  birthday_congratulated: 'Cliente parabenizado',
  walk_in_created: 'Encaixe criado',
  walk_in_called: 'Cliente chamado para encaixe',
  walk_in_in_service: 'Atendimento do encaixe iniciado',
  walk_in_completed: 'Encaixe atendido',
  walk_in_gave_up: 'Desistencia do encaixe',
  walk_in_not_accommodated: 'Encaixe nao realizado',
  walk_in_cancelled: 'Encaixe cancelado'
});

export function funnelStageLabel(stage) {
  return FUNNEL_STAGES.find((item) => item.id === stage)?.label || 'Captado';
}

export function initialFunnelStage(appointmentDate = '') {
  return appointmentDate ? 'scheduled' : 'awaiting_appointment';
}

export function leadCreationEvents(lead, profile, now = new Date()) {
  const base = {
    leadId: lead.id,
    storeId: lead.storeId,
    actorUid: profile.uid,
    actorName: String(profile.displayName || 'Usuario'),
    actorRole: String(profile.role || 'captor'),
    occurredAtClient: now.toISOString(),
    reasonCode: '',
    schemaVersion: 1
  };
  const events = [{ ...base, eventType: 'lead_created', funnelStage: 'captured' }];
  if (lead.appointmentDate && lead.appointmentTime) {
    events.push({ ...base, eventType: 'appointment_scheduled', funnelStage: 'scheduled' });
  }
  return events;
}

export function appointmentChangeEvent(previousLead, nextLead, profile, now = new Date()) {
  const wasScheduled = Boolean(previousLead?.appointmentDate && previousLead?.appointmentTime);
  const isScheduled = Boolean(nextLead?.appointmentDate && nextLead?.appointmentTime);
  if (!wasScheduled && !isScheduled) return null;

  const eventType = isScheduled
    ? (wasScheduled ? 'appointment_rescheduled' : 'appointment_scheduled')
    : 'appointment_cancelled';
  const funnelStage = isScheduled ? 'scheduled' : 'awaiting_reschedule';
  return {
    leadId: nextLead.id || previousLead.id,
    storeId: nextLead.storeId || previousLead.storeId,
    eventType,
    funnelStage,
    reasonCode: '',
    actorUid: profile.uid,
    actorName: String(profile.displayName || 'Usuario'),
    actorRole: String(profile.role || 'captor'),
    occurredAtClient: now.toISOString(),
    schemaVersion: 1
  };
}
