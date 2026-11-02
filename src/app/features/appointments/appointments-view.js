import { appointmentsByDate, calendarDays, formatMonthLabel } from '../../../utils/calendar.js';
import { formatBrazilianPhone } from '../../../utils/phone.js';
import { escapeHtml, formatAppointmentDate, storeLabel, toLocalDateInput } from '../../shared/formatters.js';

export function appointmentsView({
  allowed,
  appointments,
  records,
  allowedStores,
  backRoute,
  canCreate,
  canMarkAttendance,
  adminView,
  createDialog = '',
  queryLimit,
  now = new Date()
}) {
  if (!allowed) return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Seu perfil não possui acesso a agenda gerencial.</span></div>';
  const { loading, error, truncated, month, storeId, selectedDate, updatingId } = appointments;
  const groups = appointmentsByDate(records);
  const selected = groups[selectedDate] || [];
  const transportCustomers = selected.filter((lead) => lead.needsTransport);
  const transportSeats = transportCustomers.reduce((total, lead) => total + (Number(lead.transportSeats) || (lead.hasCompanion ? 2 : 1)), 0);
  const storeOptions = allowedStores.map((store) => `<option value="${store.id}" ${storeId === store.id ? 'selected' : ''}>${store.displayLabel}</option>`).join('');
  const cells = calendarDays(month).map((day) => {
    const items = groups[day.date] || [];
    const first = items[0];
    const classes = ['calendar-day', day.inCurrentMonth ? '' : 'is-outside', day.isToday ? 'is-today' : '', day.date === selectedDate ? 'is-selected' : '', items.length ? 'has-appointments' : ''].filter(Boolean).join(' ');
    return `<button class="${classes}" type="button" data-appointment-date="${day.date}" aria-label="${day.day} de ${escapeHtml(formatMonthLabel(month))}, ${items.length} agendamento(s)"><span class="calendar-day-number">${day.day}</span>${items.length ? `<span class="calendar-count"><strong>${items.length}</strong><span> ${items.length === 1 ? 'exame' : 'exames'}</span></span><span class="calendar-preview">${escapeHtml(first.appointmentTime)} · ${escapeHtml(first.preferredName || first.fullName)}</span>` : ''}</button>`;
  }).join('');
  const selectedItems = selected.length ? selected.map((lead) => {
    const attendance = lead.appointmentAttendance || 'pending';
    const updating = updatingId === lead.id;
    const companions = Number(lead.companionCount ?? (lead.hasCompanion ? 1 : 0));
    return `<article class="appointment-item"><div class="appointment-time"><i data-lucide="clock-3"></i><strong>${escapeHtml(lead.appointmentTime)}</strong></div><div class="appointment-person"><strong>${escapeHtml(lead.fullName)}</strong><span>${escapeHtml(formatBrazilianPhone(lead.phoneSearch))}</span><small>${escapeHtml(lead.appointmentServiceName || 'Exame de vista')} · ${Number(lead.appointmentDurationMinutes) || 20} min</small><small>${escapeHtml(storeLabel(lead.storeId))} · ${escapeHtml(lead.capturedByName || 'Captador não informado')}</small></div>${lead.needsTransport ? `<div class="appointment-transport"><i data-lucide="bus-front"></i><span><strong>${companions === 1 ? 'Transporte + Acompanhante' : companions > 1 ? `Transporte + ${companions} acompanhantes` : 'Transporte individual'}</strong></span></div>` : ''}${canMarkAttendance ? `<div class="appointment-attendance" role="group" aria-label="Comparecimento de ${escapeHtml(lead.fullName)}"><button class="attendance-button is-attended ${attendance === 'attended' ? 'is-active' : ''}" type="button" data-attendance-lead="${escapeHtml(lead.id)}" data-attendance-status="attended" aria-pressed="${attendance === 'attended'}" ${updating ? 'disabled' : ''}><i data-lucide="circle-check"></i><span>Compareceu</span></button><button class="attendance-button is-missed ${attendance === 'missed' ? 'is-active' : ''}" type="button" data-attendance-lead="${escapeHtml(lead.id)}" data-attendance-status="missed" aria-pressed="${attendance === 'missed'}" ${updating ? 'disabled' : ''}><i data-lucide="circle-x"></i><span>Não compareceu</span></button></div>` : ''}${adminView ? `<button class="icon-button appointment-open" type="button" data-appointment-lead-id="${escapeHtml(lead.id)}" title="Abrir cadastro" aria-label="Abrir cadastro de ${escapeHtml(lead.fullName)}"><i data-lucide="chevron-right"></i></button>` : ''}</article>`;
  }).join('') : '<div class="agenda-empty"><i data-lucide="calendar-days"></i><strong>Nenhum exame neste dia</strong><p>Selecione uma data destacada no calendário.</p></div>';
  const storeTotals = allowedStores.map((store) => ({ ...store, count: records.filter((lead) => lead.storeId === store.id).length })).filter((store) => !storeId || store.id === storeId).map((store) => `<div class="agenda-store-row"><span><i data-lucide="building-2"></i>${store.label}</span><strong>${store.count} exame(s)</strong></div>`).join('');
  const selectedDateCanBeScheduled = selectedDate >= toLocalDateInput(now);
  return `<section class="management-heading page-actions-only agenda-heading"><button class="button button-secondary" type="button" data-route="${backRoute}"><i data-lucide="arrow-left"></i><span>${backRoute === 'management' ? 'Voltar para gestão' : 'Voltar ao início'}</span></button>${canCreate ? `<button class="button button-primary" type="button" data-create-appointment ${selectedDateCanBeScheduled ? '' : 'disabled title="Não é possível agendar em uma data passada"'}><i data-lucide="user-plus"></i><span>Novo agendamento</span></button>` : ''}</section>
    ${error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(error)}</span></div>` : ''}${truncated ? `<div class="notice notice-warning"><i data-lucide="info"></i><span>A agenda atingiu o limite de ${queryLimit} exames neste mes.</span></div>` : ''}
    <section class="agenda-layout" aria-busy="${loading}"><div class="calendar-panel"><div class="calendar-toolbar"><div class="calendar-navigation"><button class="icon-button" type="button" data-appointment-month="-1" aria-label="Mes anterior"><i data-lucide="chevron-left"></i></button><h2>${escapeHtml(formatMonthLabel(month))}</h2><button class="icon-button" type="button" data-appointment-month="1" aria-label="Próximo mes"><i data-lucide="chevron-right"></i></button></div><div class="calendar-toolbar-actions">${allowedStores.length > 1 ? `<label class="calendar-store-filter"><span>Unidade</span><select id="appointments-store"><option value="">Todas as lojas permitidas</option>${storeOptions}</select></label>` : ''}<button class="button button-secondary calendar-today" type="button" data-action="appointments-today">Hoje</button></div></div><div class="calendar-weekdays" aria-hidden="true"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span></div>${loading ? '<div class="calendar-loading"><i data-lucide="refresh-cw"></i><span>Carregando agenda...</span></div>' : `<div class="calendar-grid">${cells}</div>`}</div>
      <aside class="agenda-sidebar"><section class="agenda-summary"><div class="agenda-section-title"><i data-lucide="building-2"></i><h2>Unidades</h2></div>${storeTotals}</section><section class="agenda-day-details"><div class="agenda-day-heading"><div class="agenda-section-title"><i data-lucide="calendar-days"></i><div><h2>Agendamentos</h2><p>${escapeHtml(formatAppointmentDate(selectedDate))}</p></div></div>${transportCustomers.length ? `<div class="transport-day-summary"><i data-lucide="bus-front"></i><span><strong>${transportCustomers.length}</strong> ${transportCustomers.length === 1 ? 'cliente' : 'clientes'} · <strong>${transportSeats}</strong> ${transportSeats === 1 ? 'assento' : 'assentos'}</span></div>` : ''}</div><div class="appointment-list">${selectedItems}</div></section></aside></section>${canCreate ? createDialog : ''}`;
}
