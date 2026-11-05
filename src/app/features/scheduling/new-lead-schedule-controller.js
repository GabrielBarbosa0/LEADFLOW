import { subscribeToDayAppointments, subscribeToStoreSchedule } from '../../../services/schedule-service.js';
import { loadAppointmentServices } from '../../../services/service-catalog-service.js';
import { ophthalmologyTriage } from '../../../utils/lead.js';
import { defaultAppointmentService, servicesForStore } from '../../../utils/service-catalog.js';
import { buildAppointmentSlots, DEFAULT_STORE_SCHEDULE, isTransportAppointmentAllowed, isTransportDateAllowed } from '../../../utils/schedule.js';
import { bindExclusiveOptions } from '../../shared/form-helpers.js';
import { careRouteAppointmentSchedule, isCareRouteDateAllowed } from '../capture/capture-schedule.js';
import { ametropiaOptions } from '../capture/capture-triage.js';

export function stopNewLeadScheduleSubscriptions(state) {
  state.unsubscribeStoreSchedule?.();
  state.unsubscribeStoreSchedule = null;
  state.unsubscribeDayAppointments?.();
  state.unsubscribeDayAppointments = null;
}

export function refreshNewLeadAmetropiaField(state) {
  const form = document.querySelector('#lead-form');
  const pathologiesField = document.querySelector('#new-lead-pathologies');
  const existingField = document.querySelector('#new-lead-ametropias');
  if (!form || !pathologiesField) return;
  if (!state.newLeadSchedule.settings.showAmetropiaFields) {
    existingField?.remove();
    return;
  }
  if (existingField) return;
  pathologiesField.insertAdjacentHTML('beforebegin', `<fieldset id="new-lead-ametropias" class="field ametropia-field"><legend>Ametropias</legend><small>Marque todas que se aplicam.</small><div class="ametropia-options">${ametropiaOptions()}</div></fieldset>`);
  bindExclusiveOptions(form, 'ametropiaIds');
}

export function refreshAppointmentTimeControl({ state, appointmentTimeMarkup, selectedService, captureProfile }) {
  const container = document.querySelector('#appointment-time-field');
  if (container) container.innerHTML = appointmentTimeMarkup();
  const dateField = document.querySelector('[data-field="appointmentDate"]');
  const dateStatus = dateField?.querySelector('.schedule-date-status');
  const { settings, appointmentDate, appointments, loading, error } = state.newLeadSchedule;
  const service = selectedService();
  const triage = ophthalmologyTriage(state.newLeadSchedule.triage || {}, settings);
  const routeAllowed = isCareRouteDateAllowed(settings, triage.careRoute, appointmentDate);
  const needsTransport = state.newLeadSchedule.triage?.needsTransport === true || state.newLeadSchedule.triage?.needsTransport === 'true';
  const transportAllowed = !needsTransport || isTransportDateAllowed(settings, appointmentDate);
  const slots = appointmentDate && settings.schedulingMode === 'controlled' ? buildAppointmentSlots({ ...careRouteAppointmentSchedule(settings, triage.careRoute), appointmentDurationMinutes: service.durationMinutes }, appointments, '', { appointmentDate, profile: captureProfile() }) : [];
  const available = slots.filter((slot) => slot.available && (!needsTransport || isTransportAppointmentAllowed(settings, appointmentDate, slot.time, service.durationMinutes)));
  const fullyBooked = Boolean(appointmentDate && routeAllowed && transportAllowed && !loading && !error && slots.length && !available.length);
  dateField?.classList.toggle('is-fully-booked', fullyBooked);
  dateField?.classList.toggle('is-date-restricted', Boolean(appointmentDate && (!routeAllowed || !transportAllowed)));
  if (dateStatus) dateStatus.textContent = !transportAllowed ? 'Não há transporte disponível neste dia.' : !routeAllowed ? triage.careRoute === 'ophthalmologist' ? 'O oftalmologista não atende neste dia.' : 'O optometrista não atende neste dia.' : fullyBooked ? 'Dia sem horários disponíveis.' : '';
}

export function startDayAppointmentsSubscription({ state, selectedStoreId, captureProfile, refresh }) {
  state.unsubscribeDayAppointments?.();
  state.unsubscribeDayAppointments = null;
  state.newLeadSchedule.appointments = [];
  state.newLeadSchedule.error = '';
  const appointmentDate = state.newLeadSchedule.appointmentDate;
  if (!appointmentDate || state.newLeadSchedule.settings.schedulingMode === 'free') {
    state.newLeadSchedule.loading = false;
    refresh();
    return;
  }
  state.newLeadSchedule.loading = true;
  refresh();
  try {
    state.unsubscribeDayAppointments = subscribeToDayAppointments(captureProfile(), appointmentDate, (appointments) => {
      Object.assign(state.newLeadSchedule, { appointments, loading: false, error: '' });
      refresh();
    }, () => {
      state.newLeadSchedule.loading = false;
      state.newLeadSchedule.error = 'Não foi possível consultar os horários desta data.';
      refresh();
    }, selectedStoreId());
  } catch {
    state.newLeadSchedule.loading = false;
    state.newLeadSchedule.error = 'Não foi possível consultar os horários desta data.';
    refresh();
  }
}

export async function ensureNewLeadSchedule({ state, render, selectedStoreId, captureProfile, refresh }) {
  if (state.route !== 'new' || !state.profile || state.newLeadSchedule.loaded || state.newLeadSchedule.loading) return;
  const storeId = selectedStoreId();
  state.newLeadSchedule.loading = true;
  try {
    state.newLeadSchedule.services = await loadAppointmentServices(state.profile);
    if (storeId && !servicesForStore(state.newLeadSchedule.services, storeId).length) state.newLeadSchedule.services.push(defaultAppointmentService(storeId, state.newLeadSchedule.settings.appointmentDurationMinutes));
    const available = servicesForStore(state.newLeadSchedule.services, storeId);
    state.newLeadSchedule.serviceId = available.some((service) => service.id === state.newLeadSchedule.draft.appointmentServiceId) ? state.newLeadSchedule.draft.appointmentServiceId : available[0]?.id || '';
  } catch {
    state.newLeadSchedule.services = storeId ? [defaultAppointmentService(storeId, state.newLeadSchedule.settings.appointmentDurationMinutes)] : [];
    state.newLeadSchedule.serviceId = state.newLeadSchedule.services[0]?.id || '';
  }
  if (state.route !== 'new' || storeId !== selectedStoreId()) return;
  if (!storeId) {
    state.newLeadSchedule.loaded = true;
    state.newLeadSchedule.loading = false;
    render();
    return;
  }
  try {
    state.unsubscribeStoreSchedule = subscribeToStoreSchedule(captureProfile(), (settings) => updateSchedule(settings), () => updateSchedule({ ...DEFAULT_STORE_SCHEDULE }, 'Usando a configuração padrão da agenda.'), storeId);
  } catch {
    state.newLeadSchedule.settings = { ...DEFAULT_STORE_SCHEDULE };
    state.newLeadSchedule.loaded = true;
    state.newLeadSchedule.loading = false;
    render();
  }
  function updateSchedule(settings, error = '') {
    if (state.route !== 'new' || storeId !== selectedStoreId()) return;
    const firstLoad = !state.newLeadSchedule.loaded;
    Object.assign(state.newLeadSchedule, { settings, loaded: true, loading: false, error });
    if (firstLoad) render();
    else refresh();
  }
}
