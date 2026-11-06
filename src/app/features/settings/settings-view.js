import { escapeHtml } from '../../shared/formatters.js';

export function settingsView({ allowed, settings, content }) {
  if (!allowed) {
    return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Somente administradores podem alterar as configurações das lojas.</span></div>';
  }

  const { loading, saving, error, section } = settings;
  return `<section class="page-toolbar settings-toolbar">
      <div class="settings-tabs" role="tablist" aria-label="Categorias de configuração">
        <button class="settings-tab ${section === 'schedule' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${section === 'schedule'}" data-settings-section="schedule"><i data-lucide="calendar-days"></i><span>Agenda</span></button>
        <button class="settings-tab ${section === 'services' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${section === 'services'}" data-settings-section="services"><i data-lucide="stethoscope"></i><span>Serviços</span></button>
        <button class="settings-tab ${section === 'roles' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${section === 'roles'}" data-settings-section="roles"><i data-lucide="shield-check"></i><span>Perfis e permissões</span></button>
      </div>
      <button class="icon-button" type="button" data-route="management" aria-label="Voltar para gestão" title="Voltar para gestão"><i data-lucide="arrow-left"></i></button>
    </section>
    ${error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(error)}</span></div>` : ''}
    <div aria-busy="${loading || saving}">${content}</div>`;
}
