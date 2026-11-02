import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAccessClick } from '../../src/app/features/access/access-events.js';
import { accessView, filterTeamAccesses } from '../../src/app/features/access/access-view.js';
import { createDefaultRoleDraft, handleRoleProfileClick } from '../../src/app/features/access/role-profiles-events.js';
import { roleProfilesView } from '../../src/app/features/access/role-profiles-view.js';
import { SYSTEM_ROLE_PROFILES } from '../../src/utils/role-profile.js';

function roleProfiles() {
  return SYSTEM_ROLE_PROFILES.map((profile) => ({ ...profile, permissions: [...profile.permissions] }));
}

function accessState(overrides = {}) {
  return {
    accesses: [],
    loading: false,
    saving: false,
    error: '',
    query: '',
    storeFilter: '',
    editorOpen: false,
    editingEmail: '',
    pendingDeleteEmail: '',
    ...overrides
  };
}

function settings(overrides = {}) {
  return {
    roleProfiles: roleProfiles(),
    roleEditorOpen: false,
    roleDraft: createDefaultRoleDraft(),
    editingRoleId: '',
    pendingDeleteRoleId: '',
    detailsRoleId: '',
    detailsRolePermissions: [],
    saving: false,
    ...overrides
  };
}

function clickEvent(elements) {
  return { target: { closest: (selector) => elements[selector] || null } };
}

afterEach(() => vi.unstubAllGlobals());

describe('access feature modules', () => {
  it('blocks the access manager for non-administrators', () => {
    const markup = accessView({
      access: accessState(),
      profile: { role: 'manager', storeId: 'loja-02' },
      roleProfiles: roleProfiles(),
      allowed: false
    });
    expect(markup).toContain('Somente administradores');
    expect(markup).not.toContain('Novo acesso');
  });

  it('renders team access data and the selected editor', () => {
    const access = {
      email: 'maria@example.com',
      displayName: 'Maria Silva',
      phone: '81999999999',
      role: 'manager',
      roleProfileId: 'system-manager',
      storeId: 'loja-02',
      storeIds: ['loja-02', 'loja-06'],
      savwinCode: '123',
      active: true,
      hasLoggedIn: true
    };
    const markup = accessView({
      access: accessState({ accesses: [access], editorOpen: true, editingEmail: access.email }),
      profile: { role: 'admin', email: 'admin@example.com', storeId: 'loja-02' },
      roleProfiles: roleProfiles(),
      allowed: true
    });
    expect(markup).toContain('Maria Silva');
    expect(markup).toContain('Gestor loja');
    expect(markup).toContain('Editar acesso');
    expect(markup).toContain('value="loja-06" checked');
    expect(markup).toContain('data-access-search');
    expect(markup).toContain('data-access-store-filter');
    expect(markup).toContain('class="access-toolbar-actions"');
    expect(markup.indexOf('data-action="reload-accesses"')).toBeLessThan(markup.indexOf('data-access-new'));
    expect(markup).not.toContain('id="access-email" name="email" type="email" maxlength="254" autocomplete="email" value="maria@example.com" placeholder="nome@exemplo.com" readonly');
  });

  it('shows the primary-store selector for a collaborator access', () => {
    const access = {
      email: 'colaborador@example.com',
      displayName: 'Colaborador da Loja 06',
      role: 'captor',
      roleProfileId: 'system-captor',
      storeId: 'loja-06',
      storeIds: ['loja-02', 'loja-06'],
      active: true
    };
    const markup = accessView({
      access: accessState({ accesses: [access], editorOpen: true, editingEmail: access.email }),
      profile: { role: 'admin', email: 'admin@example.com', storeId: 'loja-02' },
      roleProfiles: roleProfiles(),
      allowed: true
    });

    expect(markup).toContain('id="access-primary-store-field"');
    expect(markup).toContain('<label for="access-store">Unidade principal</label>');
    expect(markup).toContain('<option value="loja-06" selected>Loja 06 - Surubim</option>');
  });

  it('filters collaborators by an accent-insensitive name, email, and store', () => {
    const accesses = [
      { displayName: 'Márcia Souza', email: 'marcia@example.com', role: 'captor', storeIds: ['loja-02'] },
      { displayName: 'Luan Israel', email: 'luan@example.com', role: 'captor', storeIds: ['loja-04'] }
    ];
    expect(filterTeamAccesses(accesses, { query: 'marcia' })).toEqual([accesses[0]]);
    expect(filterTeamAccesses(accesses, { query: 'luan@' })).toEqual([accesses[1]]);
    expect(filterTeamAccesses(accesses, { storeId: 'loja-04' })).toEqual([accesses[1]]);
  });

  it('renders system roles and the custom-role editor', () => {
    const markup = roleProfilesView(settings({ roleEditorOpen: true }));
    expect(markup).toContain('Cargos cadastrados');
    expect(markup).toContain('Administrador');
    expect(markup).toContain('Novo cargo');
    expect(markup).toContain('name="permissions"');
  });

  it('opens the access editor through delegated events', async () => {
    const showModal = vi.fn();
    const focus = vi.fn();
    vi.stubGlobal('document', { querySelector: vi.fn((selector) => selector === '#access-editor-dialog' ? { showModal } : { focus }) });
    vi.stubGlobal('requestAnimationFrame', (callback) => callback());
    const state = { access: accessState(), settings: settings() };
    const render = vi.fn();
    const handled = await handleAccessClick(clickEvent({ '[data-access-new]': {} }), { state, render, showToast: vi.fn() });
    expect(handled).toBe(true);
    expect(state.access.editorOpen).toBe(true);
    expect(render).toHaveBeenCalled();
    expect(showModal).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('opens a clean custom-role draft through delegated events', async () => {
    const showModal = vi.fn();
    const focus = vi.fn();
    vi.stubGlobal('document', { querySelector: vi.fn((selector) => selector === '#role-editor-dialog' ? { showModal } : { focus }) });
    const state = { settings: settings({ editingRoleId: 'old', roleDraft: { name: 'Antigo', scope: 'stores', permissions: [] } }) };
    const render = vi.fn();
    const handled = await handleRoleProfileClick(clickEvent({ '[data-role-new]': {} }), { state, render, showToast: vi.fn() });
    expect(handled).toBe(true);
    expect(state.settings.editingRoleId).toBe('');
    expect(state.settings.roleDraft.name).toBe('');
    expect(state.settings.roleDraft.scope).toBe('own');
    expect(showModal).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
