import { backfillAppointmentSlots, loadStoreSchedules } from '../../../services/schedule-service.js';
import { loadAppointmentServices } from '../../../services/service-catalog-service.js';
import { defaultAppointmentService, servicesForStore } from '../../../utils/service-catalog.js';
import { DEFAULT_STORE_SCHEDULE } from '../../../utils/schedule.js';
import { STORES } from '../../../utils/stores.js';
import { toLocalDateInput } from '../../shared/formatters.js';
import { confirmationEndDate } from '../appointments/confirmation-period.js';
import { startAppointmentsLiveSubscription, startConfirmationsLiveSubscription } from '../appointments/appointment-subscriptions.js';

export function stopAppointmentsSubscription(state) {
  state.unsubscribeAppointments?.();
  state.unsubscribeAppointments = null;
}

export function stopConfirmationsSubscription(state) {
  state.unsubscribeConfirmations?.();
  state.unsubscribeConfirmations = null;
}

export function startConfirmationsSubscription({ state, render, hasAccess, subscribe }) {
  if (!hasAccess('appointments.confirmations') || state.route !== 'confirmations') return;
  stopConfirmationsSubscription(state);
  const startDate = toLocalDateInput(new Date());
  const endDate = confirmationEndDate(startDate, state.confirmations.days);
  state.confirmations.loading = true;
  state.confirmations.loaded = false;
  state.confirmations.error = '';
  render();
  state.unsubscribeConfirmations = startConfirmationsLiveSubscription({
    subscribe,
    profile: state.profile,
    startDate,
    endDate,
    onData: (result) => {
      Object.assign(state.confirmations, { records: result.records, truncated: result.truncated, loaded: true, loading: false });
      render();
    },
    onError: (error) => {
      state.confirmations.error = error?.code === 'permission-denied'
        ? 'Seu perfil não possui permissão para consultar estas confirmações.'
        : 'Não foi possível carregar as confirmações. Verifique a conexão e tente novamente.';
      state.confirmations.loading = false;
      state.confirmations.loaded = false;
      stopConfirmationsSubscription(state);
      render();
    }
  });
}

export function startAppointmentsSubscription({ state, render, hasAccess, isAdmin, subscribe, shouldRender = () => true }) {
  if (!hasAccess('appointments.view') || state.route !== 'appointments') return;
  stopAppointmentsSubscription(state);
  state.appointments.loading = true;
  state.appointments.loaded = false;
  state.appointments.error = '';
  render();
  state.unsubscribeAppointments = startAppointmentsLiveSubscription({
    subscribe,
    profile: state.profile,
    month: state.appointments.month,
    storeId: state.appointments.storeId,
    onData: (result) => {
      Object.assign(state.appointments, { records: result.records, truncated: result.truncated, loaded: true, loading: false });
      if (shouldRender(result.records)) render();
      if (isAdmin() && !state.appointments.backfilledMonths.includes(state.appointments.month) && state.appointments.backfillingMonth !== state.appointments.month) {
        const month = state.appointments.month;
        state.appointments.backfillingMonth = month;
        backfillAppointmentSlots(state.profile, result.records, month)
          .then(() => state.appointments.backfilledMonths.push(month))
          .catch(() => {})
          .finally(() => { state.appointments.backfillingMonth = ''; });
      }
    },
    onError: (error) => {
      state.appointments.error = error?.code === 'permission-denied'
        ? 'Seu perfil não possui permissão para consultar esta agenda.'
        : 'Não foi possível acompanhar a agenda. Verifique a conexão e tente novamente.';
      state.appointments.loading = false;
      state.appointments.loaded = false;
      stopAppointmentsSubscription(state);
      render();
    }
  });
}

export function ensureAppointmentData({ state, hasAccess, startAppointments, startConfirmations }) {
  if (state.route === 'appointments' && hasAccess('appointments.view') && !state.unsubscribeAppointments) startAppointments();
  if (state.route === 'confirmations' && hasAccess('appointments.confirmations') && !state.unsubscribeConfirmations) startConfirmations();
}

export async function openAppointmentCreateDialog({ state, render, profileStoreIds }) {
  const allowedStores = STORES.filter((store) => profileStoreIds(state.profile).includes(store.id));
  const preferredStoreId = state.appointments.storeId || (allowedStores.some((store) => store.id === state.profile.storeId) ? state.profile.storeId : allowedStores[0]?.id) || '';
  state.appointmentCreate = { loading: true, saving: false, error: '', schedules: [], storeId: preferredStoreId, services: [], serviceId: '', draft: {} };
  render();
  document.querySelector('#appointment-create-dialog')?.showModal();
  try {
    [state.appointmentCreate.schedules, state.appointmentCreate.services] = await Promise.all([loadStoreSchedules(state.profile), loadAppointmentServices(state.profile)]);
    const schedule = state.appointmentCreate.schedules.find((item) => item.id === preferredStoreId) || DEFAULT_STORE_SCHEDULE;
    if (!servicesForStore(state.appointmentCreate.services, preferredStoreId).length) state.appointmentCreate.services.push(defaultAppointmentService(preferredStoreId, schedule.appointmentDurationMinutes));
    state.appointmentCreate.serviceId = servicesForStore(state.appointmentCreate.services, preferredStoreId)[0]?.id || '';
  } catch {
    state.appointmentCreate.error = 'Não foi possível carregar os horários das lojas.';
  } finally {
    state.appointmentCreate.loading = false;
    render();
    document.querySelector('#appointment-create-dialog')?.showModal();
  }
}
