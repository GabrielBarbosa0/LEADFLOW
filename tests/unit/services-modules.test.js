import { afterEach, describe, expect, it, vi } from 'vitest';
import { serviceDialogs } from '../../src/app/features/services/service-dialog.js';
import { handleServiceClick } from '../../src/app/features/services/service-events.js';
import { servicesView } from '../../src/app/features/services/services-view.js';

const services = [
  { id: 'exam', name: 'Exame de Vista', durationMinutes: 20, storeIds: ['loja-02'], active: true },
  { id: 'cleaning', name: 'Limpeza', durationMinutes: 10, storeIds: ['loja-06'], active: false }
];

function settings(overrides = {}) {
  return {
    services,
    saving: false,
    serviceEditorOpen: false,
    editingServiceId: '',
    pendingDeleteServiceId: '',
    selectedStoreId: 'loja-02',
    ...overrides
  };
}

function clickEvent(elements) {
  return { target: { closest: (selector) => elements[selector] || null } };
}

afterEach(() => vi.unstubAllGlobals());

describe('services feature modules', () => {
  it('renders active and inactive services with stable actions', () => {
    const markup = servicesView(settings());
    expect(markup).toContain('Exame de Vista');
    expect(markup).toContain('Limpeza');
    expect(markup).toContain('service-toggle-button');
    expect(markup).toContain('Desativar');
    expect(markup).toContain('Ativar');
  });

  it('renders editor and deletion dialogs for the selected service', () => {
    const editor = serviceDialogs(settings({ serviceEditorOpen: true, editingServiceId: 'exam' }));
    expect(editor).toContain('Editar serviço');
    expect(editor).toContain('value="Exame de Vista"');
    expect(editor).toContain('value="loja-02" checked');

    const deletion = serviceDialogs(settings({ pendingDeleteServiceId: 'cleaning' }));
    expect(deletion).toContain('Excluir serviço?');
    expect(deletion).toContain('Limpeza');
  });

  it('opens the new-service editor and focuses the name', async () => {
    const showModal = vi.fn();
    const focus = vi.fn();
    vi.stubGlobal('document', { querySelector: vi.fn((selector) => selector === '#service-editor-dialog' ? { showModal } : { focus }) });
    const state = { settings: settings() };
    const render = vi.fn();
    const handled = await handleServiceClick(clickEvent({ '[data-service-new]': {} }), {
      state,
      render,
      showToast: vi.fn(),
      refreshServices: vi.fn()
    });
    expect(handled).toBe(true);
    expect(state.settings.serviceEditorOpen).toBe(true);
    expect(render).toHaveBeenCalled();
    expect(showModal).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('prevents disabling the last active service of a store', async () => {
    const button = { dataset: { serviceToggle: 'exam' }, disabled: false };
    const showToast = vi.fn();
    const state = { settings: settings({ services: [services[0]] }) };
    await handleServiceClick(clickEvent({ '[data-service-toggle]': button }), {
      state,
      render: vi.fn(),
      showToast,
      refreshServices: vi.fn()
    });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('pelo menos um serviço ativo'), 'warning', 'circle-alert');
    expect(state.settings.services[0].active).toBe(true);
  });
});
