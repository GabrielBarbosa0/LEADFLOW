import { escapeHtml } from '../../shared/formatters.js';

export function reportCaptors(records) {
  return [...new Map(
    records
      .filter((lead) => lead.capturedByUid)
      .map((lead) => [lead.capturedByUid, lead.capturedByName || 'Captador'])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
}

export function reportFiltersView({ filters, records, allowedStores, loading }) {
  const storeOptions = allowedStores
    .map((store) => `<option value="${store.id}" ${filters.storeId === store.id ? 'selected' : ''}>${escapeHtml(store.displayLabel)}</option>`)
    .join('');
  const captorOptions = reportCaptors(records)
    .map(([uid, name]) => `<option value="${escapeHtml(uid)}" ${filters.capturedByUid === uid ? 'selected' : ''}>${escapeHtml(name)}</option>`)
    .join('');

  return `<form id="management-filters" class="management-filters">
    <div class="filter-title"><i data-lucide="filter"></i><div><strong>Filtros</strong><span>Período máximo recomendado: 90 dias.</span></div></div>
    <div class="management-filter-grid">
      <div class="field"><label for="management-start">Data inicial</label><input id="management-start" name="startDate" type="date" value="${escapeHtml(filters.startDate)}" required /></div>
      <div class="field"><label for="management-end">Data final</label><input id="management-end" name="endDate" type="date" value="${escapeHtml(filters.endDate)}" required /></div>
      ${allowedStores.length > 1 ? `<div class="field"><label for="management-store">Loja</label><select id="management-store" name="storeId"><option value="">Todas as lojas permitidas</option>${storeOptions}</select></div>` : ''}
      <div class="field"><label for="management-captor">Captador</label><select id="management-captor" name="capturedByUid"><option value="">Todos os captadores</option>${captorOptions}</select></div>
      <div class="field"><label for="management-archive-status">Registros</label><select id="management-archive-status" name="archiveStatus"><option value="active" ${filters.archiveStatus !== 'archived' ? 'selected' : ''}>Ativos</option><option value="archived" ${filters.archiveStatus === 'archived' ? 'selected' : ''}>Arquivados</option></select></div>
      <div class="field management-search-field"><label for="management-search">Nome ou telefone</label><input id="management-search" name="search" type="search" value="${escapeHtml(filters.search)}" placeholder="Buscar nos resultados" /></div>
      <button class="button button-primary management-filter-button" type="submit" ${loading ? 'disabled' : ''}><i data-lucide="search"></i><span>${loading ? 'Consultando...' : 'Aplicar filtros'}</span></button>
    </div>
  </form>`;
}
