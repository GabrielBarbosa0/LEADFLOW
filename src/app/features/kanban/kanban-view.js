import { formatAppointmentDate, storeLabel, escapeHtml } from '../../shared/formatters.js';
import { kanbanColumns } from './kanban-data.js';

function leadCard(lead) {
  const appointment = lead.appointmentDate && lead.appointmentTime
    ? `${formatAppointmentDate(lead.appointmentDate)} - ${lead.appointmentTime}`
    : 'Sem data definida';
  return `<button class="kanban-card" type="button" data-management-lead-id="${escapeHtml(lead.id)}"><strong>${escapeHtml(lead.fullName)}</strong><span>${escapeHtml(storeLabel(lead.storeId))}</span><small><i data-lucide="calendar-clock"></i>${escapeHtml(appointment)}</small>${lead.capturedByName ? `<small><i data-lucide="user-round"></i>${escapeHtml(lead.capturedByName)}</small>` : ''}</button>`;
}

export function kanbanView({ allowed, records, loading, error, truncated }) {
  if (!allowed) return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Seu perfil nao possui acesso ao funil da equipe.</span></div>';
  const columns = kanbanColumns(records);
  const total = records.length;
  return `<section class="kanban-heading kanban-heading-compact"><strong>${total} lead(s)</strong></section>${loading ? '<div class="loading-inline"><i data-lucide="loader-circle"></i><span>Carregando funil...</span></div>' : ''}${error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(error)}</span></div>` : ''}${truncated ? '<div class="notice notice-warning"><i data-lucide="info"></i><span>Exibindo parte dos resultados do periodo atual.</span></div>' : ''}<section class="kanban-board" data-kanban-board aria-label="Kanban do funil">${columns.map((column) => `<section class="kanban-column kanban-stage-${escapeHtml(column.id)}"><header><span>${escapeHtml(column.label)}</span><strong>${column.leads.length}</strong></header><div class="kanban-cards">${column.leads.length ? column.leads.map(leadCard).join('') : '<p class="kanban-empty">Nenhum lead nesta etapa.</p>'}</div></section>`).join('')}</section><div class="kanban-scrollbar-dock" aria-label="Navegacao horizontal do Kanban"><div class="kanban-scrollbar" data-kanban-scrollbar><div data-kanban-scrollbar-track></div></div></div>`;
}
