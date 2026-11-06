import { filterExternalOperationRecords } from '../../../services/external-operations-service.js';
import { formatBrazilianPhone } from '../../../utils/phone.js';
import { escapeHtml, formatAppointmentDate, storeDisplayLabel } from '../../shared/formatters.js';

function addressLine(lead) {
  const street = [lead.street, lead.streetNumber].filter(Boolean).join(', ');
  return [street, lead.neighborhood].filter(Boolean).join(' · ') || 'Endereço não informado';
}

function cityLine(lead) {
  return [lead.city, lead.state].filter(Boolean).join(' - ');
}

function transportLabel(lead) {
  if (!lead.needsTransport) return 'Sem transporte';
  return `${lead.transportSeats || 1} assento(s)`;
}

function companionLabel(lead) {
  if (!lead.hasCompanion) return 'Sem acompanhante';
  return lead.companionCount === 1 ? '1 acompanhante' : `${lead.companionCount} acompanhantes`;
}

function periodLabel(startDate, endDate) {
  if (startDate === endDate) return formatAppointmentDate(startDate);
  return `${formatAppointmentDate(startDate)} a ${formatAppointmentDate(endDate)}`;
}

function compactDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return '--/--';
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${String(day).padStart(2, '0')} ${months[month - 1]}`;
}

function option(value, label, selected) {
  return `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;
}

function detailDialog(lead) {
  if (!lead) return '';
  return `<dialog class="external-detail-dialog" id="external-operation-detail-dialog" aria-labelledby="external-operation-detail-title">
    <section>
      <header><div><span class="eyebrow">ROTA DO CLIENTE</span><h2 id="external-operation-detail-title">${escapeHtml(lead.preferredName || lead.fullName)}</h2><p>${escapeHtml(formatAppointmentDate(lead.appointmentDate))} às ${escapeHtml(lead.appointmentTime)} · ${escapeHtml(storeDisplayLabel(lead.storeId))}</p></div><button class="icon-button" type="button" data-external-detail-close aria-label="Fechar detalhes"><i data-lucide="x"></i></button></header>
      <div class="external-detail-content">
        <section><h3><i data-lucide="user-round"></i>Cliente</h3><p><strong>${escapeHtml(lead.fullName)}</strong>${lead.preferredName ? `<span>Apelido: ${escapeHtml(lead.preferredName)}</span>` : ''}<span>${escapeHtml(formatBrazilianPhone(lead.phoneSearch) || 'Telefone não informado')}</span></p></section>
        <section><h3><i data-lucide="map-pin"></i>Endereço</h3><p><strong>${escapeHtml(addressLine(lead))}</strong>${cityLine(lead) ? `<span>${escapeHtml(cityLine(lead))}</span>` : ''}${lead.addressReference ? `<span>Referência: ${escapeHtml(lead.addressReference)}</span>` : ''}</p></section>
        <section><h3><i data-lucide="bus-front"></i>Deslocamento</h3><p><strong>${escapeHtml(lead.needsTransport ? 'Transporte solicitado' : 'Sem transporte')}</strong><span>${escapeHtml(transportLabel(lead))}</span><span>${escapeHtml(companionLabel(lead))}</span></p></section>
      </div>
      <footer><span>${lead.capturedByName ? `Cadastro de ${escapeHtml(lead.capturedByName)}` : ''}</span></footer>
    </section>
  </dialog>`;
}

function operationRow(lead) {
  return `<article class="external-operation-row">
    <div class="external-operation-time"><span>${escapeHtml(compactDate(lead.appointmentDate))}</span><strong>${escapeHtml(lead.appointmentTime || '--:--')}</strong></div>
    <div class="external-operation-person"><strong>${escapeHtml(lead.preferredName || lead.fullName)}</strong>${lead.preferredName ? `<span>${escapeHtml(lead.fullName)}</span>` : ''}<small>${escapeHtml(formatBrazilianPhone(lead.phoneSearch) || 'Telefone não informado')}</small></div>
    <div class="external-operation-address"><i data-lucide="map-pin"></i><span><strong>${escapeHtml(addressLine(lead))}</strong>${lead.addressReference ? `<small>Referência: ${escapeHtml(lead.addressReference)}</small>` : ''}</span></div>
    <div class="external-operation-tags"><span class="external-operation-tag external-operation-tag-transport ${lead.needsTransport ? 'is-transport' : ''}"><i data-lucide="${lead.needsTransport ? 'bus-front' : 'circle-minus'}"></i>${escapeHtml(transportLabel(lead))}</span><span class="external-operation-tag external-operation-tag-companion ${lead.hasCompanion ? 'is-companion' : ''}"><i data-lucide="users-round"></i>${escapeHtml(companionLabel(lead))}</span></div>
    <button class="icon-button" type="button" data-external-detail-open="${escapeHtml(lead.id)}" aria-label="Ver rota de ${escapeHtml(lead.fullName)}"><i data-lucide="chevron-right"></i></button>
  </article>`;
}

export function externalOperationsView({ allowed, operations, allowedStores }) {
  if (!allowed) return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Seu perfil não possui acesso à operação externa.</span></div>';
  const records = operations.records || [];
  const visible = filterExternalOperationRecords(records, operations);
  const storeOptions = allowedStores.map((store) => `<option value="${store.id}" ${operations.storeId === store.id ? 'selected' : ''}>${escapeHtml(store.displayLabel)}</option>`).join('');
  const companions = visible.reduce((total, lead) => total + Number(lead.companionCount || 0), 0);
  const seats = visible.reduce((total, lead) => total + (lead.needsTransport ? Number(lead.transportSeats || 1) : 0), 0);
  const rows = visible.length
    ? visible.map(operationRow).join('')
    : `<div class="empty-state external-operation-empty"><i data-lucide="${operations.loading ? 'refresh-cw' : 'map-pinned'}"></i><strong>${operations.loading ? 'Carregando operação' : 'Nenhum cliente encontrado'}</strong><p>${operations.loading ? 'Consultando as unidades permitidas.' : 'Ajuste o período ou os filtros para localizar clientes.'}</p></div>`;
  const detail = records.find((lead) => lead.id === operations.detailLeadId);

  return `<div class="external-operations-toolbar"><button class="icon-button" type="button" data-route="home" aria-label="Voltar ao início" title="Voltar ao início"><i data-lucide="arrow-left"></i></button></div>
    ${operations.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(operations.error)}</span></div>` : ''}
    <section class="external-operations-filters" aria-label="Filtros da operação externa">
      <div class="field"><label for="external-operations-start-date">Data inicial</label><input id="external-operations-start-date" type="date" value="${escapeHtml(operations.startDate)}" /></div>
      <div class="field"><label for="external-operations-end-date">Data final</label><input id="external-operations-end-date" type="date" value="${escapeHtml(operations.endDate)}" /></div>
      <div class="field"><label for="external-operations-store">Unidade</label><select id="external-operations-store"><option value="">Todas as unidades permitidas</option>${storeOptions}</select></div>
      <div class="field"><label for="external-operations-transport">Transporte</label><select id="external-operations-transport">${option('all', 'Todos', operations.transportMode)}${option('with', 'Com transporte', operations.transportMode)}${option('without', 'Sem transporte', operations.transportMode)}</select></div>
      <div class="field"><label for="external-operations-companion">Acompanhante</label><select id="external-operations-companion">${option('all', 'Todos', operations.companionMode)}${option('with', 'Com acompanhante', operations.companionMode)}${option('without', 'Sem acompanhante', operations.companionMode)}</select></div>
      <button class="button button-primary external-operations-apply" type="button" data-external-operations-apply><i data-lucide="refresh-cw"></i><span>Atualizar</span></button>
      <div class="field external-operations-search"><label for="external-operations-search">Cliente ou localização</label><div class="external-operations-search-control"><i data-lucide="search"></i><input id="external-operations-search" type="search" value="${escapeHtml(operations.query)}" placeholder="Nome, apelido, bairro ou referência" /></div></div>
    </section>
    <section class="external-operations-metrics"><article><span>Clientes</span><strong>${visible.length}</strong><i data-lucide="route"></i></article><article><span>Com transporte</span><strong>${visible.filter((lead) => lead.needsTransport).length}</strong><i data-lucide="bus-front"></i></article><article><span>Acompanhantes</span><strong>${companions}</strong><i data-lucide="users-round"></i></article><article><span>Assentos</span><strong>${seats}</strong><i data-lucide="armchair"></i></article></section>
    <section class="external-operations-list"><header><div><h2>Operação de ${escapeHtml(periodLabel(operations.startDate, operations.endDate))}</h2><p>${visible.length} cliente(s) nos filtros atuais</p></div>${operations.truncated ? '<span class="status-badge status-warning">Limite de 500 registros</span>' : ''}</header><div>${rows}</div></section>
    ${detailDialog(detail)}`;
}
