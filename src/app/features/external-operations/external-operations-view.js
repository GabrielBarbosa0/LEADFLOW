import { formatBrazilianPhone } from '../../../utils/phone.js';
import { escapeHtml, formatAppointmentDate, storeDisplayLabel } from '../../shared/formatters.js';

function addressLine(lead) {
  return [lead.street, lead.number, lead.neighborhood].filter(Boolean).join(', ') || 'Endereco nao informado';
}

function transportLabel(lead) {
  if (!lead.needsTransport) return 'Sem transporte';
  if (!lead.hasCompanion) return 'Transporte individual';
  return lead.companionCount === 1 ? 'Transporte + Acompanhante' : `Transporte + ${lead.companionCount} acompanhantes`;
}

function periodLabel(startDate, endDate) {
  if (startDate === endDate) return formatAppointmentDate(startDate);
  return `${formatAppointmentDate(startDate)} a ${formatAppointmentDate(endDate)}`;
}

function detailsDialog(lead) {
  if (!lead) return '';
  const cityLine = [lead.neighborhood, lead.city, lead.state].filter(Boolean).join(' - ');
  return `<dialog class="external-detail-dialog" id="external-operation-detail-dialog" aria-labelledby="external-operation-detail-title"><section><header><div><p class="eyebrow">ROTA DO DIA</p><h2 id="external-operation-detail-title">${escapeHtml(lead.preferredName || lead.fullName)}</h2><p>${escapeHtml(lead.appointmentTime)} · ${escapeHtml(storeDisplayLabel(lead.storeId))}</p></div><button class="icon-button" type="button" data-external-detail-close aria-label="Fechar detalhes"><i data-lucide="x"></i></button></header><div class="external-detail-content"><section><h3><i data-lucide="map-pin"></i>Localizacao</h3><p><strong>${escapeHtml(addressLine(lead))}</strong>${cityLine ? `<span>${escapeHtml(cityLine)}</span>` : ''}${lead.addressReference ? `<span>Referencia: ${escapeHtml(lead.addressReference)}</span>` : ''}</p></section><section><h3><i data-lucide="bus-front"></i>Deslocamento</h3><p><strong>${escapeHtml(transportLabel(lead))}</strong>${lead.needsTransport ? `<span>${lead.transportSeats} assento(s) reservado(s)</span>` : ''}</p></section><section><h3><i data-lucide="phone"></i>Contato</h3><p><strong>${escapeHtml(formatBrazilianPhone(lead.phoneSearch) || 'Telefone nao informado')}</strong>${lead.capturedByName ? `<span>Captado por ${escapeHtml(lead.capturedByName)}</span>` : ''}</p></section></div><footer><button class="button button-secondary" type="button" data-external-detail-close>Fechar</button></footer></section></dialog>`;
}

function recordRow(lead) {
  return `<article class="external-operation-row"><div class="external-operation-time"><i data-lucide="clock-3"></i><strong>${escapeHtml(lead.appointmentTime || '--:--')}</strong></div><div class="external-operation-person"><strong>${escapeHtml(lead.fullName)}</strong>${lead.preferredName ? `<span>Conhecido como ${escapeHtml(lead.preferredName)}</span>` : ''}<small><i data-lucide="map-pin"></i>${escapeHtml(addressLine(lead))}</small></div><div class="external-operation-tags"><span class="external-operation-tag ${lead.needsTransport ? 'is-transport' : ''}"><i data-lucide="${lead.needsTransport ? 'bus-front' : 'circle-minus'}"></i>${escapeHtml(transportLabel(lead))}</span><span class="external-operation-tag"><i data-lucide="users-round"></i>${lead.hasCompanion ? `${lead.companionCount} acompanhante(s)` : 'Sem acompanhante'}</span></div><button class="icon-button" type="button" data-external-detail-open="${escapeHtml(lead.id)}" aria-label="Ver dados de rota de ${escapeHtml(lead.fullName)}"><i data-lucide="chevron-right"></i></button></article>`;
}

export function externalOperationsView({ allowed, operations, allowedStores }) {
  if (!allowed) return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Seu perfil nao possui acesso a operacao externa.</span></div>';
  const records = operations.records || [];
  const search = String(operations.query || '').trim().toLocaleLowerCase('pt-BR');
  const visible = records.filter((lead) => {
    if (operations.transportMode === 'with-companion' && !lead.hasCompanion) return false;
    if (operations.transportMode === 'without-companion' && lead.hasCompanion) return false;
    return !search || [lead.fullName, lead.preferredName, lead.neighborhood, lead.addressReference]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
  });
  const transport = visible.filter((lead) => lead.needsTransport);
  const seats = transport.reduce((total, lead) => total + Number(lead.transportSeats || 0), 0);
  const detail = records.find((lead) => lead.id === operations.detailLeadId);
  const storeOptions = allowedStores.map((store) => `<option value="${store.id}" ${operations.storeId === store.id ? 'selected' : ''}>${escapeHtml(store.displayLabel)}</option>`).join('');
  const transportOptions = [
    ['all', 'Todos com transporte'],
    ['with-companion', 'Com acompanhante'],
    ['without-companion', 'Sem acompanhante']
  ].map(([value, label]) => `<option value="${value}" ${operations.transportMode === value ? 'selected' : ''}>${label}</option>`).join('');
  const rows = visible.length
    ? visible.map(recordRow).join('')
    : `<div class="empty-state external-operation-empty"><i data-lucide="${operations.loading ? 'refresh-cw' : 'map-pinned'}"></i><strong>${operations.loading ? 'Carregando rotas' : 'Nenhuma rota encontrada'}</strong><p>${operations.loading ? 'Consultando os transportes permitidos.' : 'Ajuste o período ou os filtros para localizar clientes.'}</p></div>`;
  return `<section class="external-operations-heading"><div><p class="eyebrow">OPERAÇÃO EXTERNA</p><h2>Leads externa</h2><p>Rotas, transporte e dados de localização para a equipe externa.</p></div><button class="button button-secondary" type="button" data-route="home"><i data-lucide="arrow-left"></i><span>Voltar ao início</span></button></section>${operations.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(operations.error)}</span></div>` : ''}<section class="external-operations-filters"><div class="field"><label for="external-operations-start-date">Data inicial</label><input id="external-operations-start-date" type="date" value="${escapeHtml(operations.startDate)}" /></div><div class="field"><label for="external-operations-end-date">Data final</label><input id="external-operations-end-date" type="date" value="${escapeHtml(operations.endDate)}" /></div><div class="field"><label for="external-operations-store">Unidade</label><select id="external-operations-store"><option value="">Todas as unidades permitidas</option>${storeOptions}</select></div><div class="field external-operations-search"><label for="external-operations-search">Cliente ou localização</label><input id="external-operations-search" type="search" value="${escapeHtml(operations.query)}" placeholder="Buscar por cliente ou localização" /></div><div class="field"><label for="external-operations-transport">Transporte</label><select id="external-operations-transport">${transportOptions}</select></div><button class="button button-primary external-operations-apply" type="button" data-external-operations-apply><i data-lucide="search"></i><span>Atualizar rotas</span></button></section><section class="external-operations-metrics"><article><span>Rotas encontradas</span><strong>${visible.length}</strong></article><article><span>Com acompanhante</span><strong>${visible.filter((lead) => lead.hasCompanion).length}</strong></article><article><span>Sem acompanhante</span><strong>${visible.filter((lead) => !lead.hasCompanion).length}</strong></article><article><span>Assentos reservados</span><strong>${seats}</strong></article></section><section class="external-operations-list"><header><div><h2>Rotas de ${escapeHtml(periodLabel(operations.startDate, operations.endDate))}</h2><p>${visible.length} cliente(s) visível(is)</p></div><i data-lucide="route"></i></header><div>${rows}</div></section>${detailsDialog(detail)}`;
}
