import { renderIcons, toastMarkup } from '../shared/ui.js';

export function syncAgendaSidebarHeight() {
  const agendaLayout = document.querySelector('.agenda-layout');
  const calendarPanel = agendaLayout?.querySelector('.calendar-panel');
  if (!agendaLayout || !calendarPanel) return;

  if (window.matchMedia('(max-width: 1000px)').matches) {
    agendaLayout.style.removeProperty('--agenda-calendar-height');
    return;
  }

  agendaLayout.style.setProperty('--agenda-calendar-height', `${calendarPanel.getBoundingClientRect().height}px`);
}

export function renderApplication({ state, appView, loginView, canAccessRoute, bindPageEvents, syncAgendaHeight = syncAgendaSidebarHeight }) {
  const root = document.querySelector('#app');
  if (!root) return;

  if (!state.loading && state.profile && !canAccessRoute(state.route)) {
    state.route = 'home';
    history.replaceState(null, '', `${location.pathname}${location.search}#/home`);
  }

  if (state.loading) {
    root.innerHTML = `<main class="loading-page"><img class="brand-logo brand-logo-loading" src="${import.meta.env.BASE_URL}leadflow-logo.png" alt="" aria-hidden="true" /><span>Preparando o LeadFlow...</span></main>`;
  } else {
    root.innerHTML = state.profile ? appView() : loginView();
  }

  if (state.updateAction) {
    root.insertAdjacentHTML('beforeend', `<aside class="update-banner" role="status">
      <i data-lucide="download"></i>
      <span>Nova versão disponível.</span>
      <button class="button button-primary" type="button" data-action="update-app">Atualizar agora</button>
    </aside>`);
  }
  if (state.toast) root.insertAdjacentHTML('beforeend', toastMarkup(state.toast));

  renderIcons();
  bindPageEvents();
  requestAnimationFrame(syncAgendaHeight);
}
