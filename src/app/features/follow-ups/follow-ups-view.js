import { formatBrazilianPhone } from '../../../utils/phone.js';
import {
  appointmentFollowUps,
  buildWhatsAppFollowUpUrl,
  followUpAvailableAt,
  followUpStage,
  isFollowUpContacted
} from '../../../utils/follow-up.js';
import {
  escapeHtml,
  formatAppointmentDate,
  formatDateTimeValue,
  profileInitials,
  storeLabel
} from '../../shared/formatters.js';

export function pendingFollowUps({ canViewTeam, records, leads, profile, settings, settingsByStore, now }) {
  const source = canViewTeam ? records : leads;
  return appointmentFollowUps(source, profile, { ...settings, byStore: settingsByStore }, now);
}

function formatFollowUpAvailableAt(lead, settings) {
  const availableAt = followUpAvailableAt(lead, settings.noShowGraceMinutes);
  return availableAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(availableAt)
    : '';
}

function groupByCaptor(records) {
  return [...records.reduce((groups, lead) => {
    const key = lead.capturedByUid || lead.capturedByName || 'captor';
    if (!groups.has(key)) groups.set(key, { id: key, name: lead.capturedByName || 'Captador não informado', records: [] });
    groups.get(key).records.push(lead);
    return groups;
  }, new Map()).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function followUpsView({
  allowed,
  managerView,
  adminView,
  allRecords,
  activeFilter = 'all',
  selectedCaptorId = '',
  settings,
  settingsByStore = {},
  profileName = '',
  error = '',
  truncated = false
}) {
  if (!allowed) {
    return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Esta área é exclusiva para captadores e gestores.</span></div>';
  }

  const records = activeFilter === 'waiting'
    ? allRecords.filter((lead) => !isFollowUpContacted(lead))
    : activeFilter === 'contacted'
      ? allRecords.filter(isFollowUpContacted)
      : allRecords;
  const renderItem = (lead) => {
    const followUpSettings = settingsByStore[lead.storeId] || settings;
    const stage = followUpStage(lead, followUpSettings);
    const rescheduleRecommended = stage === 'reschedule';
    const whatsAppUrl = buildWhatsAppFollowUpUrl(lead, stage, profileName);
    const manuallyMissed = lead.appointmentAttendance === 'missed';
    const contacted = isFollowUpContacted(lead);
    return `<article class="follow-up-item">
      <div class="follow-up-heading">
        <span class="follow-up-icon"><i data-lucide="bell-ring"></i></span>
        <div><strong>${escapeHtml(lead.fullName)}</strong><span>${escapeHtml(formatBrazilianPhone(lead.phoneSearch))}</span></div>
        <span class="status-badge ${rescheduleRecommended ? 'status-danger' : contacted ? 'status-success' : 'status-warning'}">${rescheduleRecommended ? 'Reagendamento recomendado' : contacted ? 'Contato iniciado' : 'Cliente atrasado'}</span>
      </div>
      <dl class="follow-up-details">
        <div><dt>Agendamento</dt><dd>${escapeHtml(formatAppointmentDate(lead.appointmentDate))}, ${escapeHtml(lead.appointmentTime)}</dd></div>
        <div><dt>Retorno liberado</dt><dd>${escapeHtml(formatFollowUpAvailableAt(lead, followUpSettings))}</dd></div>
        <div><dt>Ação sugerida</dt><dd>${rescheduleRecommended ? 'Oferecer uma nova data' : 'Confirmar se está a caminho'}</dd></div>
        ${managerView ? `<div><dt>Situação</dt><dd>${manuallyMissed ? 'Não compareceu' : 'Sem confirmação'}</dd></div>
        <div><dt>Último contato</dt><dd>${contacted ? escapeHtml(formatDateTimeValue(lead.followUpContactedAt)) : 'Ainda não iniciado'}</dd></div>
        ${contacted ? `<div><dt>Contato por</dt><dd>${escapeHtml(lead.followUpContactedByName || 'Não informado')}</dd></div>` : ''}
        ${adminView ? `<div><dt>Loja</dt><dd>${escapeHtml(storeLabel(lead.storeId))}</dd></div>` : ''}` : ''}
      </dl>
      <div class="follow-up-actions">
        <a class="button button-whatsapp" data-follow-up-whatsapp="${escapeHtml(lead.id)}" href="${escapeHtml(whatsAppUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="message-circle"></i><span>Chamar no WhatsApp</span></a>
        <button class="button button-secondary" type="button" ${managerView ? `data-follow-up-reschedule="${escapeHtml(lead.id)}"` : `data-open-lead-id="${escapeHtml(lead.id)}"`}><i data-lucide="${rescheduleRecommended ? 'calendar-days' : 'clipboard-list'}"></i><span>${rescheduleRecommended ? 'Reagendar' : 'Ver cadastro'}</span></button>
      </div>
    </article>`;
  };

  const contactedCount = allRecords.filter(isFollowUpContacted).length;
  const captorGroups = groupByCaptor(allRecords);
  const visibleCaptorGroups = groupByCaptor(records);
  const captorSummary = captorGroups.map((group) => {
    const groupContacted = group.records.filter(isFollowUpContacted).length;
    return `<article class="follow-up-captor-card"><span class="avatar">${escapeHtml(profileInitials(group.name))}</span><button class="follow-up-captor-open" type="button" data-follow-up-captor="${escapeHtml(group.id)}" aria-label="Ver retornos aguardando de ${escapeHtml(group.name)}"><strong>${escapeHtml(group.name)}</strong><span>${group.records.length} retorno(s)</span></button><dl><div><dt>Aguardando</dt><dd>${group.records.length - groupContacted}</dd></div><div><dt>Iniciados</dt><dd>${groupContacted}</dd></div></dl></article>`;
  }).join('');
  const selectedCaptor = captorGroups.find((group) => group.id === selectedCaptorId);
  const selectedCaptorPending = selectedCaptor?.records.filter((lead) => !isFollowUpContacted(lead)) || [];
  const captorDialog = selectedCaptor ? `<dialog id="follow-up-captor-dialog" class="appointment-create-dialog follow-up-captor-dialog" aria-labelledby="follow-up-captor-title">
    <div class="appointment-create-header">
      <div><span>RETORNOS PENDENTES</span><h2 id="follow-up-captor-title">${escapeHtml(selectedCaptor.name)}</h2><p>${selectedCaptorPending.length} lead(s) aguardando contato</p></div>
      <button class="icon-button" type="button" data-follow-up-captor-close aria-label="Fechar"><i data-lucide="x"></i></button>
    </div>
    <div class="follow-up-captor-dialog-content follow-up-list">
      ${selectedCaptorPending.length
        ? selectedCaptorPending.map(renderItem).join('')
        : '<div class="empty-state"><i data-lucide="circle-check"></i><strong>Nenhum contato aguardando</strong><p>Todos os retornos deste captador já tiveram o contato iniciado.</p></div>'}
    </div>
    <div class="appointment-create-actions"><button class="button button-secondary" type="button" data-follow-up-captor-close>Fechar</button></div>
  </dialog>` : '';
  const items = records.length
    ? (managerView && activeFilter === 'captors'
      ? `<section class="follow-up-captor-summary">${captorSummary}</section>`
      : managerView
        ? visibleCaptorGroups.map((group) => `<section class="follow-up-team-group">
          <header class="follow-up-team-heading"><span class="avatar">${escapeHtml(profileInitials(group.name))}</span><div><strong>${escapeHtml(group.name)}</strong><span>${group.records.length} retorno(s)</span></div></header>
          <div class="follow-up-list">${group.records.map(renderItem).join('')}</div>
        </section>`).join('')
        : records.map(renderItem).join(''))
    : `<div class="empty-state"><i data-lucide="circle-check"></i><strong>${activeFilter === 'all' ? 'Nenhum retorno pendente' : 'Nenhum retorno nesta categoria'}</strong><p>${activeFilter === 'all' ? 'Os clientes atrasados aparecerão aqui depois do tempo de alerta.' : 'Selecione outro indicador para consultar os contatos.'}</p></div>`;

  return `${error ? `<div class="notice notice-warning"><i data-lucide="info"></i><span>${escapeHtml(error)}</span></div>` : ''}
    ${truncated ? '<div class="notice notice-warning"><i data-lucide="info"></i><span>A lista atingiu o limite de 500 registros.</span></div>' : ''}
    ${managerView ? `<section class="follow-up-metrics" aria-label="Resumo dos retornos">
      <button class="metric follow-up-metric-filter ${activeFilter === 'all' ? 'is-active' : ''}" type="button" data-follow-up-filter="all" aria-pressed="${activeFilter === 'all'}"><span>Retornos</span><strong>${allRecords.length}</strong><i data-lucide="bell-ring"></i></button>
      <button class="metric metric-warning follow-up-metric-filter ${activeFilter === 'waiting' ? 'is-active' : ''}" type="button" data-follow-up-filter="waiting" aria-pressed="${activeFilter === 'waiting'}"><span>Aguardando contato</span><strong>${allRecords.length - contactedCount}</strong><i data-lucide="clock-3"></i></button>
      <button class="metric metric-success follow-up-metric-filter ${activeFilter === 'contacted' ? 'is-active' : ''}" type="button" data-follow-up-filter="contacted" aria-pressed="${activeFilter === 'contacted'}"><span>Contato iniciado</span><strong>${contactedCount}</strong><i data-lucide="message-circle"></i></button>
      <button class="metric follow-up-metric-filter ${activeFilter === 'captors' ? 'is-active' : ''}" type="button" data-follow-up-filter="captors" aria-pressed="${activeFilter === 'captors'}"><span>Captadores</span><strong>${captorGroups.length}</strong><i data-lucide="users"></i></button>
    </section>` : ''}
    <section class="${managerView ? 'follow-up-team-list' : 'follow-up-list'}">${items}</section>
    ${captorDialog}`;
}
