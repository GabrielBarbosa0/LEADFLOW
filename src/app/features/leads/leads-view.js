import { formatBrazilianPhone } from '../../../utils/phone.js';
import { leadOriginLabel } from '../../../utils/lead-origin.js';
import { escapeHtml, offlineSyncDetail, syncLabel } from '../../shared/formatters.js';

export function filterLeadRecords(leads = [], filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase('pt-BR');
  const phoneQuery = query.replace(/\D/g, '');
  return leads.filter((lead) => {
    const capturedDate = String(lead.capturedAtClient || '').slice(0, 10);
    const matchesQuery = !query
      || String(lead.fullName || '').toLocaleLowerCase('pt-BR').includes(query)
      || Boolean(phoneQuery && String(lead.phoneSearch || '').includes(phoneQuery));
    if (!matchesQuery || (filters.storeId && lead.storeId !== filters.storeId)) return false;
    if (filters.startDate && capturedDate < filters.startDate) return false;
    if (filters.endDate && capturedDate > filters.endDate) return false;
    return true;
  });
}

export function leadsView({ leads, filters = {}, allowedStores = [], dataError = '', canCreate = false }) {
  const filtered = filterLeadRecords(leads, filters);
  const visibleIds = new Set(filtered.map((lead) => lead.id));
  const filtersActive = Boolean(filters.query || filters.storeId || filters.startDate || filters.endDate);
  const storeOptions = allowedStores.map((store) => `<option value="${escapeHtml(store.id)}" ${filters.storeId === store.id ? 'selected' : ''}>${escapeHtml(store.displayLabel || store.label)}</option>`).join('');
  const rows = leads.map((lead) => {
    const [label, tone] = syncLabel(lead);
    const originLabel = leadOriginLabel(lead);
    return `<button class="lead-item" type="button" data-lead-list-row data-open-lead-id="${escapeHtml(lead.id)}" ${visibleIds.has(lead.id) ? '' : 'hidden'} aria-label="Ver cadastro de ${escapeHtml(lead.fullName)}">
      <div class="lead-avatar">${escapeHtml(lead.fullName[0]?.toUpperCase() || '?')}</div>
      <div class="lead-content"><strong>${escapeHtml(lead.fullName)}</strong><span>${escapeHtml(formatBrazilianPhone(lead.phoneSearch))}</span><small>${escapeHtml(offlineSyncDetail(lead) || lead.interestLabel || 'Interesse não informado')}</small>${originLabel ? `<small class="lead-origin-label"><i data-lucide="archive"></i>${escapeHtml(originLabel)}</small>` : ''}</div>
      <span class="status-badge status-${tone}">${label}</span>
      <i class="lead-chevron" data-lucide="chevron-right"></i>
    </button>`;
  }).join('');
  const empty = `<div class="empty-state" data-lead-filter-empty ${filtered.length ? 'hidden' : ''}><i data-lucide="clipboard-x"></i><strong>Nenhum cadastro encontrado</strong><p>${filtersActive ? 'Revise a busca, a loja ou o período informado.' : 'Os contatos registrados aparecerão aqui.'}</p>${canCreate ? '<button class="button button-primary" type="button" data-route="new"><i data-lucide="user-plus"></i>Novo cadastro</button>' : ''}</div>`;

  return `
    <section class="lead-list-filters" data-lead-filters role="search" aria-label="Filtrar cadastros">
      <div class="search-box lead-list-search"><i data-lucide="search"></i><input id="lead-search" type="search" value="${escapeHtml(filters.query || '')}" placeholder="Buscar por nome ou telefone" aria-label="Buscar cadastros" autocomplete="off" /></div>
      <div class="field"><label for="lead-store-filter">Loja</label><select id="lead-store-filter"><option value="">Todas as lojas permitidas</option>${storeOptions}</select></div>
      <div class="field"><label for="lead-start-date">Data inicial</label><input id="lead-start-date" type="date" value="${escapeHtml(filters.startDate || '')}" /></div>
      <div class="field"><label for="lead-end-date">Data final</label><input id="lead-end-date" type="date" value="${escapeHtml(filters.endDate || '')}" /></div>
      <footer class="lead-filter-footer"><span class="lead-filter-count" data-lead-filter-count>${filtered.length} de ${leads.length}</span><button class="icon-button lead-filter-clear" type="button" data-lead-filters-clear aria-label="Limpar filtros" title="Limpar filtros" ${filtersActive ? '' : 'disabled'}><i data-lucide="x"></i></button></footer>
    </section>
    ${dataError ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(dataError)}</span></div>` : ''}
    <section class="lead-list">${rows}${empty}</section>`;
}
