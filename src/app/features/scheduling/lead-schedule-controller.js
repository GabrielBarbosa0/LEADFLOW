import { loadStoreSchedule, subscribeToDayAppointments } from '../../../services/schedule-service.js';
import { loadAppointmentServices } from '../../../services/service-catalog-service.js';
import { defaultAppointmentService, servicesForStore } from '../../../utils/service-catalog.js';
import { DEFAULT_STORE_SCHEDULE } from '../../../utils/schedule.js';

export function refreshLeadDetailAppointmentTime(lead, renderTimeField) {
  const container = document.querySelector('#edit-appointment-time-field');
  if (container && lead) container.outerHTML = renderTimeField(lead);
}

export function startLeadDetailDayAppointmentsSubscription({ state, lead, findLead, renderTimeField }) {
  state.unsubscribeDayAppointments?.();
  state.unsubscribeDayAppointments = null;
  state.leadDetailSchedule.appointments = [];
  state.leadDetailSchedule.error = '';
  const appointmentDate = state.leadDetailSchedule.appointmentDate;
  if (!lead || !appointmentDate || state.leadDetailSchedule.settings.schedulingMode === 'free') {
    state.leadDetailSchedule.appointmentLoading = false;
    refreshLeadDetailAppointmentTime(lead, renderTimeField);
    return;
  }
  state.leadDetailSchedule.appointmentLoading = true;
  refreshLeadDetailAppointmentTime(lead, renderTimeField);
  try {
    state.unsubscribeDayAppointments = subscribeToDayAppointments({ ...state.profile, storeId: lead.storeId }, appointmentDate, (appointments) => {
      if (state.leadDetailSchedule.appointmentDate !== appointmentDate) return;
      Object.assign(state.leadDetailSchedule, { appointments, appointmentLoading: false, error: '' });
      refreshLeadDetailAppointmentTime(findLead(), renderTimeField);
    }, () => {
      if (state.leadDetailSchedule.appointmentDate !== appointmentDate) return;
      state.leadDetailSchedule.appointmentLoading = false;
      state.leadDetailSchedule.error = 'Não foi possível consultar os horários.';
      refreshLeadDetailAppointmentTime(findLead(), renderTimeField);
    }, lead.storeId);
  } catch {
    state.leadDetailSchedule.appointmentLoading = false;
    state.leadDetailSchedule.error = 'Não foi possível consultar os horários.';
    refreshLeadDetailAppointmentTime(lead, renderTimeField);
  }
}

export async function ensureLeadDetailSchedule({ state, routeParam, findLead, render, renderTimeField, isOpen = () => ['lead', 'management-lead'].includes(state.route) }) {
  if (!isOpen() || !state.profile || state.leadDetailSchedule.loading) return;
  const lead = findLead(routeParam());
  if (!lead?.storeId || (state.leadDetailSchedule.leadId === lead.id && state.leadDetailSchedule.storeId === lead.storeId)) return;
  Object.assign(state.leadDetailSchedule, { loading: true, leadId: lead.id, appointmentDate: lead.appointmentDate || '', appointments: [], services: [], serviceId: lead.appointmentServiceId || '', triage: {}, error: '' });
  try {
    const [settings, services] = await Promise.all([loadStoreSchedule(state.profile, lead.storeId), loadAppointmentServices(state.profile)]);
    state.leadDetailSchedule.storeId = lead.storeId;
    state.leadDetailSchedule.settings = { ...DEFAULT_STORE_SCHEDULE, ...settings };
    state.leadDetailSchedule.services = services;
    if (!servicesForStore(state.leadDetailSchedule.services, lead.storeId).length) state.leadDetailSchedule.services.push(defaultAppointmentService(lead.storeId, state.leadDetailSchedule.settings.appointmentDurationMinutes));
    const available = servicesForStore(state.leadDetailSchedule.services, lead.storeId);
    state.leadDetailSchedule.serviceId = available.some((service) => service.id === lead.appointmentServiceId) ? lead.appointmentServiceId : available[0]?.id || '';
  } catch {
    state.leadDetailSchedule.storeId = lead.storeId;
    state.leadDetailSchedule.settings = { ...DEFAULT_STORE_SCHEDULE };
    state.leadDetailSchedule.services = [defaultAppointmentService(lead.storeId, lead.appointmentDurationMinutes || DEFAULT_STORE_SCHEDULE.appointmentDurationMinutes)];
    state.leadDetailSchedule.serviceId = state.leadDetailSchedule.services[0].id;
    state.leadDetailSchedule.error = 'Não foi possível carregar a agenda desta loja.';
  } finally {
    state.leadDetailSchedule.loading = false;
    render();
    startLeadDetailDayAppointmentsSubscription({ state, lead, findLead: () => findLead(routeParam()), renderTimeField });
  }
}
