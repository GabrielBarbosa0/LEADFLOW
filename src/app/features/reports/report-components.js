import { formatBrazilianPhone } from '../../../utils/phone.js';
import { isCaptarImportedLead } from '../../../utils/lead-origin.js';
import { escapeHtml, formatCapturedAt, storeLabel } from '../../shared/formatters.js';

export function reportToolbar({ permissions, adminView, recordCount, archivedView }) {
  return `<section class="management-heading management-dashboard-heading management-toolbar"><div class="management-heading-actions">
    ${permissions.appointments ? '<button class="button button-secondary" type="button" data-route="appointments"><i data-lucide="calendar-days"></i><span>Agenda de exames</span></button>' : ''}
    ${permissions.followUps ? '<button class="button button-secondary" type="button" data-route="follow-ups"><i data-lucide="bell-ring"></i><span>Retornos da equipe</span></button>' : ''}
    ${adminView ? '<button class="button button-secondary" type="button" data-route="settings"><i data-lucide="settings"></i><span>Configurações</span></button><button class="button button-secondary" type="button" data-route="access"><i data-lucide="user-round-cog"></i><span>Gerenciar acessos</span></button>' : ''}
    ${permissions.dashboard ? '<button class="button button-secondary" type="button" data-route="dashboard"><i data-lucide="bar-chart-3"></i><span>Dashboard</span></button>' : ''}
    ${permissions.kanban ? '<button class="button button-secondary" type="button" data-route="kanban"><i data-lucide="layout-dashboard"></i><span>Kanban</span></button>' : ''}
    ${permissions.archive ? `<button class="button button-secondary" type="button" data-action="open-management-archive" ${recordCount === 0 || archivedView ? 'disabled' : ''}><i data-lucide="archive"></i><span>Arquivar leads</span></button>` : ''}
    ${permissions.export ? `<button class="button button-secondary" type="button" data-action="export-management" ${recordCount === 0 ? 'disabled' : ''}><i data-lucide="file-down"></i><span>Exportar CSV</span></button>` : ''}
  </div></section>`;
}

export function managementArchiveDialog({ open, records, selectedIds, saving }) {
  if (!open) return '';
  const selected = new Set(selectedIds);
  const importedCount = records.filter(isCaptarImportedLead).length;
  const allSelected = records.length > 0 && records.every((lead) => selected.has(lead.id));
  const rows = records.map((lead) => `<label class="archive-lead-option"><input type="checkbox" name="leadId" value="${escapeHtml(lead.id)}" ${selected.has(lead.id) ? 'checked' : ''} ${saving ? 'disabled' : ''} /><span><strong>${escapeHtml(lead.fullName || 'Sem nome')}</strong><small>${escapeHtml(storeLabel(lead.storeId))} · ${escapeHtml(lead.capturedByName || 'Captador não informado')}${isCaptarImportedLead(lead) ? ' · Importado do Captar' : ''}</small></span></label>`).join('');
  return `<dialog id="management-archive-dialog" class="role-details-dialog management-archive-dialog" aria-labelledby="management-archive-title"><form id="management-archive-form" method="dialog"><header><div><span class="eyebrow">GESTÃO</span><h2 id="management-archive-title"><i data-lucide="archive"></i>Arquivar leads</h2><p>Arquivados não entram em estatísticas, alertas ou retornos. O histórico é preservado.</p></div><button class="icon-button" type="button" data-action="close-management-archive" aria-label="Fechar"><i data-lucide="x"></i></button></header><div class="management-archive-body"><div class="archive-selection-summary"><label class="archive-select-all"><input type="checkbox" data-archive-select-all ${allSelected ? 'checked' : ''} ${saving ? 'disabled' : ''} /><span>Selecionar todos os resultados (${records.length})</span></label><p class="archive-helper">${importedCount ? `${importedCount} lead(s) importado(s) do Captar foram pré-selecionados.` : 'Selecione os leads que deseja retirar do ciclo operacional.'}</p></div><div class="archive-lead-list">${rows}</div></div><footer><strong>${selected.size} selecionado(s)</strong><div class="role-details-actions"><button class="button button-secondary" type="button" data-action="close-management-archive" ${saving ? 'disabled' : ''}>Cancelar</button><button class="button button-primary" type="submit" ${saving || !selected.size ? 'disabled' : ''}><i data-lucide="archive"></i><span>${saving ? 'Arquivando...' : 'Arquivar selecionados'}</span></button></div></footer></form></dialog>`;
}

export function paginateReportRecords(records, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return {
    currentPage,
    totalPages,
    pageRecords: records.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  };
}

function reportLeadIdentity(lead, canOpenLead, compact = false) {
  const name = escapeHtml(lead.fullName);
  const phone = escapeHtml(formatBrazilianPhone(lead.phoneSearch));
  return canOpenLead
    ? `<button class="management-lead-link" type="button" data-management-lead-id="${escapeHtml(lead.id)}"><strong>${name}</strong><${compact ? 'span' : 'small'}>${phone}</${compact ? 'span' : 'small'}></button>`
    : `<strong>${name}</strong><${compact ? 'span' : 'small'}>${phone}</${compact ? 'span' : 'small'}>`;
}

export function reportResultsView({ records, loaded, canOpenLead, currentPage, totalPages, totalRecords }) {
  if (!records.length) {
    return `<div class="empty-state management-empty"><i data-lucide="bar-chart-3"></i><strong>${loaded ? 'Nenhum cadastro no período' : 'Consulte as captações'}</strong><p>${loaded ? 'Ajuste os filtros para ampliar a busca.' : 'Escolha o período e carregue os resultados.'}</p></div>`;
  }

  const tableRows = records.map((lead) => `<tr><td>${reportLeadIdentity(lead, canOpenLead)}</td><td>${escapeHtml(lead.capturedByName || 'Não informado')}</td><td>${escapeHtml(storeLabel(lead.storeId))}</td><td>${escapeHtml(lead.interestLabel || 'Não informado')}</td><td>${escapeHtml(formatCapturedAt(lead.capturedAtClient))}</td></tr>`).join('');
  const mobileRows = records.map((lead) => `<article class="management-card"><div>${reportLeadIdentity(lead, canOpenLead, true)}</div><dl><div><dt>Captador</dt><dd>${escapeHtml(lead.capturedByName || 'Não informado')}</dd></div><div><dt>Loja</dt><dd>${escapeHtml(storeLabel(lead.storeId))}</dd></div><div><dt>Captado em</dt><dd>${escapeHtml(formatCapturedAt(lead.capturedAtClient))}</dd></div></dl></article>`).join('');

  return `<div class="management-table-wrap"><table class="management-table"><thead><tr><th>Lead</th><th>Captador</th><th>Loja</th><th>Interesse</th><th>Captado em</th></tr></thead><tbody>${tableRows}</tbody></table></div>
    <div class="management-mobile-list">${mobileRows}</div>
    <div class="pagination"><span>${totalRecords} registro(s)</span><div><button class="button button-secondary" type="button" data-management-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button><strong>${currentPage} de ${totalPages}</strong><button class="button button-secondary" type="button" data-management-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button></div></div>`;
}

export function reportMetricsView(records) {
  return `<section class="management-metrics" aria-label="Resumo do período">
    <div><i data-lucide="clipboard-list"></i><span>Leads encontrados</span><strong>${records.length}</strong></div>
    <div><i data-lucide="users"></i><span>Captadores</span><strong>${new Set(records.map((lead) => lead.capturedByUid)).size}</strong></div>
    <div><i data-lucide="building-2"></i><span>Lojas</span><strong>${new Set(records.map((lead) => lead.storeId)).size}</strong></div>
  </section>`;
}

export function reportNoticesView({ error, truncated, queryLimit }) {
  return `${error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(error)}</span></div>` : ''}${truncated ? `<div class="notice notice-warning"><i data-lucide="info"></i><span>A consulta atingiu o limite de ${queryLimit} registros. Reduza o período para obter a lista completa.</span></div>` : ''}`;
}
