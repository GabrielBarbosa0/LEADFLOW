import { formatBrazilianPhone } from '../../../utils/phone.js';
import { formatBrazilianCpf } from '../../../utils/savwin-matching.js';
import { servicesForStore } from '../../../utils/service-catalog.js';
import { WALK_IN_REASONS, WALK_IN_STATUS_LABELS, walkInElapsedMinutes, walkInIsOpen } from '../../../utils/walk-in.js';
import { escapeHtml, storeDisplayLabel } from '../../shared/formatters.js';

function searchResult(result, selectedLeadId, allowedStoreIds) {
  const allowed = allowedStoreIds.includes(result.storeId);
  const selected = result.id === selectedLeadId;
  return `<button class="walk-in-search-result ${selected ? 'is-selected' : ''}" type="button" data-walk-in-select-lead="${escapeHtml(result.id)}" ${allowed ? '' : 'disabled'}>
    <span class="walk-in-search-avatar"><i data-lucide="${selected ? 'circle-check' : 'user-round'}"></i></span>
    <span><strong>${escapeHtml(result.fullName)}</strong><small>${result.customerCpf ? `CPF ${escapeHtml(formatBrazilianCpf(result.customerCpf))}` : 'CPF não informado'} · ${escapeHtml(storeDisplayLabel(result.storeId))}</small></span>
    <i data-lucide="${selected ? 'check' : 'chevron-right'}"></i>
  </button>`;
}

function queueActions(item, updating) {
  const closeMenu = `<details class="walk-in-more"><summary class="icon-button" title="Outras formas de encerrar" aria-label="Outras formas de encerrar"><i data-lucide="ellipsis"></i></summary><div><button type="button" data-walk-in-transition="not_accommodated" data-walk-in-id="${escapeHtml(item.id)}"><i data-lucide="calendar-x"></i><span>Não foi possível encaixar</span></button><button type="button" data-walk-in-transition="cancelled" data-walk-in-id="${escapeHtml(item.id)}"><i data-lucide="circle-x"></i><span>Cancelar registro</span></button></div></details>`;
  if (item.status === 'waiting') return `<div class="walk-in-actions is-waiting">
    <button class="button button-primary" type="button" data-walk-in-transition="called" data-walk-in-id="${escapeHtml(item.id)}" ${updating ? 'disabled' : ''}><i data-lucide="megaphone"></i><span>Chamar</span></button>
    <button class="button button-secondary" type="button" data-walk-in-transition="gave_up" data-walk-in-id="${escapeHtml(item.id)}" ${updating ? 'disabled' : ''}><i data-lucide="user-round-x"></i><span>Desistiu</span></button>
    ${updating ? '' : closeMenu}
  </div>`;
  if (item.status === 'called') return `<div class="walk-in-actions is-called"><button class="button button-primary" type="button" data-walk-in-transition="in_service" data-walk-in-id="${escapeHtml(item.id)}" ${updating ? 'disabled' : ''}><i data-lucide="stethoscope"></i><span>Iniciar atendimento</span></button>${updating ? '' : closeMenu}</div>`;
  if (item.status === 'in_service') return `<div class="walk-in-actions is-in-service"><button class="button button-success" type="button" data-walk-in-transition="completed" data-walk-in-id="${escapeHtml(item.id)}" ${updating ? 'disabled' : ''}><i data-lucide="circle-check"></i><span>Concluir atendimento</span></button></div>`;
  return '';
}

function queueItem(item, updatingId, now) {
  const lead = item.lead || {};
  const elapsed = walkInElapsedMinutes(item.arrivedAt, now);
  const professional = item.professionalType === 'ophthalmologist' ? 'Oftalmologista' : 'Optometrista';
  const open = walkInIsOpen(item.status);
  return `<article class="walk-in-item ${open ? '' : 'is-closed'}">
    <div class="walk-in-order"><strong>${open ? elapsed : '✓'}</strong><span>${open ? 'min' : 'fim'}</span></div>
    <div class="walk-in-person"><div class="walk-in-person-heading"><strong>${escapeHtml(lead.fullName || 'Cadastro indisponível')}</strong><span class="status-badge status-${item.status === 'completed' ? 'success' : open ? 'warning' : 'neutral'}">${escapeHtml(WALK_IN_STATUS_LABELS[item.status] || item.status)}</span></div><span>${lead.phoneSearch ? escapeHtml(formatBrazilianPhone(lead.phoneSearch)) : 'Telefone não informado'}</span><small>${escapeHtml(item.serviceName)} · ${professional} · chegada há ${elapsed} min</small>${item.broughtByName ? `<small><strong>Quem trouxe:</strong> ${escapeHtml(item.broughtByName)}</small>` : ''}<small>${escapeHtml(item.reason)}</small>${item.closedReason ? `<small class="walk-in-closed-reason">Motivo do encerramento: ${escapeHtml(item.closedReason)}</small>` : ''}</div>
    ${queueActions(item, updatingId === item.id)}
  </article>`;
}

function quickClientForm(searchQuery, draft = {}) {
  const digits = String(searchQuery || '').replace(/\D/g, '');
  const fullName = draft.fullName ?? (/\p{L}/u.test(searchQuery) ? String(searchQuery).trim() : '');
  const customerCpf = formatBrazilianCpf(draft.customerCpf ?? (digits.length === 11 ? digits : ''));
  const phone = draft.phone || '';
  return `<form id="walk-in-quick-client-form" class="walk-in-quick-client" novalidate>
    <div class="walk-in-quick-heading"><div><span class="eyebrow">CADASTRO RÁPIDO</span><strong>Novo cliente</strong></div><button class="icon-button" type="button" data-walk-in-quick-cancel title="Cancelar cadastro rápido" aria-label="Cancelar cadastro rápido"><i data-lucide="x"></i></button></div>
    <p>Preencha somente os dados essenciais. O restante pode ser complementado depois.</p>
    <div class="field" data-field="fullName"><label for="walk-in-quick-name">Nome completo <span aria-hidden="true">*</span></label><input id="walk-in-quick-name" name="fullName" maxlength="120" autocomplete="name" value="${escapeHtml(fullName)}" required /><small class="field-error"></small></div>
    <div class="field" data-field="phone"><label for="walk-in-quick-phone">Telefone ou WhatsApp <span aria-hidden="true">*</span></label><input id="walk-in-quick-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="(00) 00000-0000" value="${escapeHtml(phone)}" required /><small class="field-error"></small></div>
    <div class="field" data-field="customerCpf"><label for="walk-in-quick-cpf">CPF <span class="field-optional">(opcional)</span></label><input id="walk-in-quick-cpf" name="customerCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" value="${escapeHtml(customerCpf)}" /><small class="field-error"></small></div>
    <div class="notice notice-info walk-in-quick-notice"><i data-lucide="info"></i><span>Ao confirmar, o cadastro e o encaixe serão criados juntos.</span></div>
  </form>`;
}

function createPanel({ walkIns, selectedLead, allowedStores, services, canCreate }) {
  const selectedStoreId = selectedLead?.storeId || walkIns.storeId || allowedStores[0]?.id || '';
  const storeOptions = allowedStores.map((store) => `<option value="${store.id}" ${store.id === selectedStoreId ? 'selected' : ''}>${escapeHtml(store.displayLabel)}</option>`).join('');
  const availableServices = servicesForStore(services, selectedStoreId);
  const serviceOptions = availableServices.map((service) => `<option value="${escapeHtml(service.id)}" data-service-name="${escapeHtml(service.name)}" ${service.id === walkIns.serviceId ? 'selected' : ''}>${escapeHtml(service.name)} · ${service.durationMinutes} min</option>`).join('');
  const reasonOptions = WALK_IN_REASONS.map((reason) => `<option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>`).join('');
  const availableCaptors = walkIns.captors.filter((captor) => captor.storeId === selectedStoreId || captor.storeIds?.includes(selectedStoreId));
  const captorOptions = availableCaptors.map((captor) => `<option value="${escapeHtml(captor.uid)}" ${captor.uid === walkIns.broughtByUid ? 'selected' : ''}>${escapeHtml(captor.displayName)}</option>`).join('');
  let searchContent = '<div class="walk-in-search-empty"><i data-lucide="search"></i><span>Pesquise para selecionar o cliente.</span></div>';
  if (walkIns.quickCreate) searchContent = quickClientForm(walkIns.searchQuery, walkIns.quickDraft);
  else if (walkIns.searchLoading) searchContent = '<div class="walk-in-search-empty"><i class="spin" data-lucide="loader-circle"></i><span>Pesquisando...</span></div>';
  else if (walkIns.searchError) searchContent = `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(walkIns.searchError)}</span></div>`;
  else if (walkIns.searchSearched && walkIns.searchResults.length) searchContent = `<div class="walk-in-search-results">${walkIns.searchResults.map((result) => searchResult(result, walkIns.selectedLeadId, allowedStores.map((store) => store.id))).join('')}</div>`;
  else if (walkIns.searchSearched) searchContent = `<div class="walk-in-search-empty"><i data-lucide="user-round-x"></i><strong>Nenhum cadastro encontrado</strong><span>${canCreate ? 'Cadastre os dados essenciais sem sair desta tela.' : 'Seu perfil não pode criar um novo cadastro.'}</span>${canCreate ? '<button class="button button-primary" type="button" data-walk-in-quick-create><i data-lucide="user-plus"></i><span>Cadastrar cliente rapidamente</span></button>' : ''}</div>`;

  return `<section class="walk-in-create-panel">
    <header><div><span class="eyebrow">ENTRADA RÁPIDA</span><h2>Novo encaixe</h2><p>Adicione o cliente à fila sem ocupar um horário da agenda.</p></div></header>
    <div class="walk-in-create-grid">
      <div class="walk-in-client-search">
        <form id="walk-in-search-form" class="lead-search-form" novalidate><label for="walk-in-search-input">Localizar cliente</label><div class="lead-search-control"><i data-lucide="search"></i><input id="walk-in-search-input" name="query" type="search" value="${escapeHtml(walkIns.searchQuery)}" placeholder="Nome ou CPF" autocomplete="off" required /><button class="button button-secondary" type="submit" ${walkIns.searchLoading ? 'disabled' : ''}><i data-lucide="search"></i><span>Buscar</span></button></div><small id="walk-in-search-error" class="lead-search-error"></small></form>
        ${searchContent}
      </div>
      <form id="walk-in-create-form" class="walk-in-form" novalidate>
        <input type="hidden" name="leadId" value="${escapeHtml(selectedLead?.id || '')}" />
        ${selectedLead ? `<div class="walk-in-selected-client"><i data-lucide="circle-check"></i><div><span>Cliente selecionado</span><strong>${escapeHtml(selectedLead.fullName)}</strong><small>${selectedLead.customerCpf ? `CPF ${escapeHtml(formatBrazilianCpf(selectedLead.customerCpf))}` : 'CPF não informado'}</small></div></div>` : walkIns.quickCreate ? '<div class="walk-in-selected-client"><i data-lucide="user-plus"></i><div><span>Novo cliente</span><strong>Cadastro rápido</strong><small>O cliente será cadastrado ao entrar na fila.</small></div></div>' : '<div class="walk-in-selected-client is-empty"><i data-lucide="user-round-search"></i><div><span>Cliente</span><strong>Nenhum cadastro selecionado</strong><small>Use a pesquisa ao lado para continuar.</small></div></div>'}
        <div class="field-row"><div class="field"><label for="walk-in-store">Unidade</label><select id="walk-in-store" name="storeId" required ${selectedLead ? 'disabled' : ''}><option value="">Selecione</option>${storeOptions}</select>${selectedLead ? `<input type="hidden" name="storeId" value="${escapeHtml(selectedStoreId)}" />` : ''}<small class="field-error"></small></div><div class="field"><label for="walk-in-professional">Profissional</label><select id="walk-in-professional" name="professionalType" required><option value="optometrist">Optometrista</option><option value="ophthalmologist">Oftalmologista</option></select><small class="field-error"></small></div></div>
        <div class="field"><label for="walk-in-service">Serviço solicitado</label><select id="walk-in-service" name="serviceId" required><option value="">${availableServices.length ? 'Selecione o serviço' : 'Nenhum serviço disponível'}</option>${serviceOptions}</select><small class="field-error"></small></div>
        <div class="field" data-field="broughtByUid"><label for="walk-in-captor">Quem trouxe o cliente <span class="field-optional">(opcional)</span></label><select id="walk-in-captor" name="broughtByUid"><option value="">Atendimento espontâneo / sem indicação</option>${captorOptions}</select><small>Este vínculo pertence somente ao encaixe e não altera o captador original do cadastro.</small><small class="field-error"></small></div>
        <div class="field"><label for="walk-in-reason">Motivo do encaixe</label><select id="walk-in-reason" name="reason" required><option value="">Selecione o motivo</option>${reasonOptions}</select><small class="field-error"></small></div>
        <div class="field"><label for="walk-in-notes">Observação <span class="field-optional">(opcional)</span></label><textarea id="walk-in-notes" name="notes" maxlength="500" rows="3" placeholder="Informação útil para a recepção ou profissional"></textarea><small class="field-error"></small></div>
        <button class="button button-primary button-block" type="submit" ${(!selectedLead && !walkIns.quickCreate) || walkIns.saving || !availableServices.length ? 'disabled' : ''}><i data-lucide="list-plus"></i><span>${walkIns.saving ? 'Adicionando...' : walkIns.quickCreate ? 'Cadastrar e adicionar a fila' : 'Adicionar a fila de encaixes'}</span></button>
      </form>
    </div>
  </section>`;
}

export function walkInsView({ walkIns, selectedLead, allowedStores, services, canCreate = false, now = new Date() }) {
  const filtered = walkIns.storeFilter ? walkIns.records.filter((item) => item.storeId === walkIns.storeFilter) : walkIns.records;
  const open = filtered.filter((item) => walkInIsOpen(item.status));
  const closed = filtered.filter((item) => !walkInIsOpen(item.status));
  const storeOptions = allowedStores.map((store) => `<option value="${store.id}" ${walkIns.storeFilter === store.id ? 'selected' : ''}>${escapeHtml(store.displayLabel)}</option>`).join('');
  const queue = open.length ? open.map((item) => queueItem(item, walkIns.updatingId, now)).join('') : '<div class="empty-state walk-in-empty"><i data-lucide="armchair"></i><strong>Ninguém aguardando</strong><p>Os novos encaixes do dia aparecerão aqui.</p></div>';
  const finished = closed.length ? `<details class="walk-in-closed-list"><summary><span>Encerrados hoje</span><strong>${closed.length}</strong></summary><div>${closed.map((item) => queueItem(item, walkIns.updatingId, now)).join('')}</div></details>` : '';
  return `<section class="management-heading page-actions-only walk-in-heading"><button class="button button-secondary" type="button" data-route="home"><i data-lucide="arrow-left"></i><span>Voltar ao início</span></button></section>
    ${walkIns.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(walkIns.error)}</span></div>` : ''}
    <section class="walk-in-metrics"><article><span>Aguardando</span><strong>${open.filter((item) => item.status === 'waiting').length}</strong><i data-lucide="clock-3"></i></article><article><span>Chamados</span><strong>${open.filter((item) => item.status === 'called').length}</strong><i data-lucide="megaphone"></i></article><article><span>Em atendimento</span><strong>${open.filter((item) => item.status === 'in_service').length}</strong><i data-lucide="stethoscope"></i></article><article><span>Atendidos</span><strong>${closed.filter((item) => item.status === 'completed').length}</strong><i data-lucide="circle-check"></i></article></section>
    ${createPanel({ walkIns, selectedLead, allowedStores, services, canCreate })}
    <section class="walk-in-queue-panel"><header><div><span class="eyebrow">OPERAÇÃO DO DIA</span><h2>Fila de encaixes</h2><p>Agendamentos regulares continuam com prioridade.</p></div>${allowedStores.length > 1 ? `<div class="field walk-in-queue-filter"><label for="walk-in-store-filter">Unidade</label><select id="walk-in-store-filter"><option value="">Todas as lojas permitidas</option>${storeOptions}</select></div>` : ''}</header><div class="walk-in-list" aria-busy="${walkIns.loading}">${walkIns.loading && !walkIns.loaded ? '<div class="empty-state walk-in-empty"><i class="spin" data-lucide="loader-circle"></i><strong>Carregando fila...</strong></div>' : queue}</div>${finished}</section>`;
}
