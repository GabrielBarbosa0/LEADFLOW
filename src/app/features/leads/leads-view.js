import { formatBrazilianPhone } from '../../../utils/phone.js';
import { leadOriginLabel } from '../../../utils/lead-origin.js';
import { escapeHtml, offlineSyncDetail, syncLabel } from '../../shared/formatters.js';

export function leadsView({ leads, search = '', dataError = '', canCreate = false }) {
  const needle = search.trim().toLowerCase().replace(/\D/g, '');
  const textNeedle = search.trim().toLowerCase();
  const filtered = leads.filter((lead) => {
    if (!textNeedle) return true;
    return lead.fullName.toLowerCase().includes(textNeedle) || (needle && lead.phoneSearch.includes(needle));
  });

  const list = filtered.length
    ? filtered.map((lead) => {
        const [label, tone] = syncLabel(lead);
        const originLabel = leadOriginLabel(lead);
        return `<button class="lead-item" type="button" data-open-lead-id="${escapeHtml(lead.id)}" aria-label="Ver cadastro de ${escapeHtml(lead.fullName)}">
          <div class="lead-avatar">${escapeHtml(lead.fullName[0]?.toUpperCase() || '?')}</div>
          <div class="lead-content"><strong>${escapeHtml(lead.fullName)}</strong><span>${escapeHtml(formatBrazilianPhone(lead.phoneSearch))}</span><small>${escapeHtml(offlineSyncDetail(lead) || lead.interestLabel || 'Interesse não informado')}</small>${originLabel ? `<small class="lead-origin-label"><i data-lucide="archive"></i>${escapeHtml(originLabel)}</small>` : ''}</div>
          <span class="status-badge status-${tone}">${label}</span>
          <i class="lead-chevron" data-lucide="chevron-right"></i>
        </button>`;
      }).join('')
    : `<div class="empty-state"><i data-lucide="clipboard-x"></i><strong>Nenhum cadastro encontrado</strong><p>${search ? 'Tente outro nome ou telefone.' : 'Os contatos registrados aparecerão aqui.'}</p>${canCreate ? '<button class="button button-primary" type="button" data-route="new"><i data-lucide="user-plus"></i>Novo cadastro</button>' : ''}</div>`;

  return `
    <div class="search-box"><i data-lucide="search"></i><input id="lead-search" type="search" value="${escapeHtml(search)}" placeholder="Buscar por nome ou telefone" aria-label="Buscar cadastros" /></div>
    ${dataError ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(dataError)}</span></div>` : ''}
    <section class="lead-list">${list}</section>`;
}
