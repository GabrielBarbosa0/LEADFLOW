import { formatBrazilianCpf } from '../../../utils/savwin-matching.js';
import { escapeHtml, formatAppointmentDate, storeLabel } from '../../shared/formatters.js';

function appointmentStatus(lead) {
  if (lead.appointmentStatus === 'cancelled' || lead.appointmentAttendance === 'cancelled') return ['Cancelado', 'warning', 'calendar-x'];
  if (lead.appointmentAttendance === 'attended') return ['Compareceu', 'success', 'circle-check'];
  if (lead.appointmentAttendance === 'missed') return ['Não compareceu', 'danger', 'circle-x'];
  if (lead.appointmentDate && lead.appointmentTime) return ['Agendado', 'success', 'calendar-check'];
  return ['Sem agendamento', 'neutral', 'calendar-x'];
}

function searchResult(lead) {
  const [status, tone, icon] = appointmentStatus(lead);
  const appointment = lead.appointmentDate && lead.appointmentTime
    ? `${formatAppointmentDate(lead.appointmentDate)} às ${lead.appointmentTime}`
    : 'Nenhuma data e horário cadastrados';
  return `<article class="lead-search-result">
    <div class="lead-search-result-icon status-${tone}"><i data-lucide="${icon}"></i></div>
    <div class="lead-search-result-person"><strong>${escapeHtml(lead.fullName)}</strong><span>${lead.customerCpf ? `CPF ${escapeHtml(formatBrazilianCpf(lead.customerCpf))}` : 'CPF não informado'}</span><small>${escapeHtml(storeLabel(lead.storeId))}${lead.capturedByName ? ` · ${escapeHtml(lead.capturedByName)}` : ''}</small></div>
    <div class="lead-search-result-appointment"><span class="status-badge status-${tone}">${status}</span><strong>${escapeHtml(appointment)}</strong>${lead.appointmentServiceName ? `<small>${escapeHtml(lead.appointmentServiceName)}</small>` : ''}</div>
    ${lead.canOpen ? `<button class="icon-button lead-search-open" type="button" data-search-open-lead="${escapeHtml(lead.id)}" title="${lead.canClaim ? 'Consultar lead cancelado' : 'Abrir cadastro'}" aria-label="Abrir cadastro de ${escapeHtml(lead.fullName)}"><i data-lucide="chevron-right"></i></button>` : ''}
  </article>`;
}

export function leadSearchView({ search }) {
  let content = `<div class="lead-search-empty"><i data-lucide="search"></i><strong>Consultar cliente</strong><p>Informe o nome ou CPF para verificar o agendamento.</p></div>`;
  if (search.loading) {
    content = '<div class="lead-search-empty"><i class="spin" data-lucide="loader-circle"></i><strong>Pesquisando...</strong><p>Consultando os cadastros autorizados.</p></div>';
  } else if (search.error) {
    content = `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(search.error)}</span></div>`;
  } else if (search.searched && search.results.length) {
    content = `<div class="lead-search-results-heading"><strong>${search.results.length} ${search.results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}</strong></div><section class="lead-search-results">${search.results.map(searchResult).join('')}</section>`;
  } else if (search.searched) {
    content = '<div class="lead-search-empty"><i data-lucide="user-round-x"></i><strong>Nenhum cadastro encontrado</strong><p>Confira o nome ou CPF e tente novamente.</p></div>';
  }

  return `<section class="lead-search-page">
    <form id="lead-appointment-search" class="lead-search-form" novalidate>
      <label for="lead-appointment-search-input">Nome ou CPF</label>
      <div class="lead-search-control"><i data-lucide="search"></i><input id="lead-appointment-search-input" name="query" type="search" value="${escapeHtml(search.query)}" autocomplete="off" placeholder="Digite o nome ou CPF" aria-describedby="lead-search-error" required /><button class="button button-primary" type="submit" ${search.loading ? 'disabled' : ''}><i data-lucide="search"></i><span>Pesquisar</span></button></div>
      <small id="lead-search-error" class="lead-search-error" aria-live="polite"></small>
    </form>
    <div class="lead-search-content" aria-live="polite">${content}</div>
  </section>`;
}
