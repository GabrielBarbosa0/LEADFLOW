import { escapeHtml, formatCapturedAt } from '../../shared/formatters.js';
import { FUNNEL_EVENT_LABELS, funnelStageLabel } from './funnel-model.js';

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
        ? `<ol class="lead-history-list">${records.map((event) => `<li><i data-lucide="clock-3"></i><div><strong>${escapeHtml(FUNNEL_EVENT_LABELS[event.eventType] || event.eventType)}</strong><span>${escapeHtml(funnelStageLabel(event.funnelStage))} · ${escapeHtml(event.actorName || 'Sistema')}</span>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}<small>${escapeHtml(formatCapturedAt(event.occurredAtClient))}</small></div></li>`).join('')}</ol>`
        : '<div class="lead-history-empty">O histórico deste cadastro será registrado a partir das próximas ações.</div>';
  return `<section class="lead-history" aria-label="Histórico do lead"><header><div><span>FUNIL</span><h3>Histórico do lead</h3></div><strong>${escapeHtml(funnelStageLabel(history.stage))}</strong></header>${content}</section>`;
}
