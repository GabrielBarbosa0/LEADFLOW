import { escapeHtml, formatCapturedAt } from '../../shared/formatters.js';
import { FUNNEL_EVENT_LABELS, funnelStageLabel } from './funnel-model.js';

const HISTORY_EVENT_ICONS = Object.freeze({
  lead_created: 'user-plus',
  appointment_scheduled: 'calendar-plus',
  appointment_rescheduled: 'calendar-sync',
  appointment_cancelled: 'calendar-x',
  appointment_reminder_sent: 'bell-ring',
  appointment_attended: 'badge-check',
  appointment_missed: 'calendar-minus',
  follow_up_contacted: 'phone-outgoing',
  lead_archived: 'archive',
  lead_claimed: 'user-round-check',
  lead_reassigned: 'user-round-cog',
  sale_confirmed: 'badge-dollar-sign',
  sale_confirmation_removed: 'undo-2',
  purchase_created: 'badge-dollar-sign',
  purchase_updated: 'receipt-text',
  purchase_cancelled: 'circle-minus',
  purchase_reactivated: 'rotate-ccw',
  purchase_deleted: 'trash-2',
  birthday_benefit_planned: 'cake-slice',
  birthday_congratulated: 'party-popper',
  walk_in_created: 'list-plus',
  walk_in_called: 'megaphone',
  walk_in_in_service: 'stethoscope',
  walk_in_completed: 'clipboard-check',
  walk_in_gave_up: 'user-round-minus',
  walk_in_not_accommodated: 'user-round-x',
  walk_in_cancelled: 'circle-x'
});

export function leadHistoryEventIcon(eventType) {
  return HISTORY_EVENT_ICONS[eventType] || 'clock-3';
}

export function leadHistoryView(history, { lead = null } = {}) {
  const { loading, error } = history;
  const records = [...history.records];
  if (lead?.capturedAtClient && !records.some((event) => event.eventType === 'lead_created')) {
    records.unshift({
      id: `lead-created-${lead.id}`,
      eventType: 'lead_created',
      funnelStage: 'captured',
      actorName: lead.capturedByName || 'Sistema',
      occurredAtClient: lead.capturedAtClient
    });
  }
  const content = loading
    ? '<div class="lead-history-empty">Carregando histórico...</div>'
    : error
      ? `<div class="lead-history-empty">${escapeHtml(error)}</div>`
      : records.length
        ? `<ol class="lead-history-list">${records.map((event) => `<li><i data-lucide="${leadHistoryEventIcon(event.eventType)}" aria-hidden="true"></i><div><strong>${escapeHtml(FUNNEL_EVENT_LABELS[event.eventType] || event.eventType)}</strong><span>${escapeHtml(funnelStageLabel(event.funnelStage))} · ${escapeHtml(event.actorName || 'Sistema')}</span>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}<small>${escapeHtml(formatCapturedAt(event.occurredAtClient))}</small></div></li>`).join('')}</ol>`
        : '<div class="lead-history-empty">O histórico deste cadastro será registrado a partir das próximas ações.</div>';
  return `<section class="lead-history" aria-label="Eventos do histórico">${content}</section>`;
}
