import { synchronizeNow } from '../../services/lead-service.js';
import { renderIcons, syncConnectivityIndicator } from '../shared/ui.js';

export async function synchronizePendingRegistrations(state, { announce = false, showToast }) {
  try {
    const result = await synchronizeNow(state.profile);
    if (result.failed > 0) {
      showToast(`${result.failed} cadastro(s) não foram confirmados pela nuvem e continuam salvos neste aparelho.`, 'danger', 'circle-alert');
    } else if (announce && result.synchronized > 0) {
      showToast(`${result.synchronized} cadastro(s) sincronizado(s) e salvo(s) na nuvem.`, 'success', 'cloud-check');
    }
    return result;
  } catch (error) {
    if (announce) {
      showToast('Não foi possível confirmar os cadastros na nuvem. Eles continuam salvos neste aparelho.', 'danger', 'circle-alert');
    }
    return { synchronized: 0, failed: 0, error };
  }
}

export function handleConnectivityChange({ state, render, synchronize, selectedNewLeadStoreId, refreshAppointmentTimeControl }) {
  syncConnectivityIndicator();
  if (navigator.onLine && state.profile) synchronize(true);
  if (state.route !== 'new') return;

  const form = document.querySelector('#lead-form');
  if (!form) {
    render();
    return;
  }

  const online = navigator.onLine;
  const blocked = !online && !state.offlineCapture.enabled;
  const notice = form.querySelector('[data-offline-capture-notice]');
  const appointmentFields = form.querySelector('[data-online-appointment]');
  const dateInput = form.elements.appointmentDate;
  const submitButton = form.querySelector('[type="submit"]');
  if (notice) {
    notice.hidden = online;
    notice.querySelector('span').textContent = blocked
      ? 'Cadastro offline desativado. Reconecte-se antes de salvar este cadastro.'
      : 'Cadastro offline ativo. Os dados do lead serão preservados, mas data e horário só poderão ser escolhidos com internet.';
  }
  if (!online) {
    state.newLeadSchedule.appointmentDate = '';
    dateInput.value = '';
  }
  if (appointmentFields) appointmentFields.hidden = !online;
  dateInput.disabled = !online || !selectedNewLeadStoreId();
  submitButton.disabled = blocked;
  refreshAppointmentTimeControl();
  renderIcons();
}

export async function startLifecycle({
  state,
  render,
  currentRoute,
  refreshAuthorizedData,
  stopAppointmentsSubscription,
  stopConfirmationsSubscription,
  stopWalkInsSubscription,
  stopNewLeadScheduleSubscriptions,
  stopLeadHistorySubscription,
  handleConnectivity,
  syncAgendaHeight,
  synchronize,
  startAuthentication
}) {
  window.addEventListener('hashchange', () => {
    const previousRoute = state.route;
    state.route = currentRoute();
    const managementRoutes = ['management', 'management-lead', 'dashboard'];
    if (managementRoutes.includes(state.route) && !managementRoutes.includes(previousRoute)) {
      state.management.loaded = false;
    }
    if (state.route === 'dashboard' && previousRoute !== 'dashboard') state.dashboardUpcoming.loaded = false;
    if (previousRoute === 'management-lead' && state.route !== 'management-lead') state.management.activeLead = null;
    if (state.route !== 'appointments') stopAppointmentsSubscription();
    if (state.route !== 'confirmations') stopConfirmationsSubscription();
    if (state.route !== 'walk-ins') stopWalkInsSubscription?.();
    if (!['lead', 'management-lead'].includes(state.route)) stopLeadHistorySubscription?.();
    if (state.route !== 'new') {
      stopNewLeadScheduleSubscriptions();
      state.newLeadSchedule.loaded = false;
      state.newLeadSchedule.storeId = '';
      state.newLeadSchedule.appointmentDate = '';
      state.newLeadSchedule.appointments = [];
      state.newLeadSchedule.triage = {};
      state.newLeadSchedule.draft = {};
    } else if (previousRoute !== 'new') {
      state.newLeadSchedule.loaded = false;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    render();
    refreshAuthorizedData();
  });

  window.addEventListener('online', handleConnectivity);
  window.addEventListener('offline', handleConnectivity);
  window.addEventListener('resize', syncAgendaHeight);
  window.setInterval(() => {
    if (['captor', 'manager', 'admin'].includes(state.profile?.role) && ['home', 'follow-ups'].includes(state.route)) render();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.profile) synchronize(false);
  });

  await startAuthentication();
}
