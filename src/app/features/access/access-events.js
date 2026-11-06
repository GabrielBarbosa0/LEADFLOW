import { createTeamPasswordAccount, renameTeamMemberEmail } from '../../../firebase/auth.js';
import { deleteAccess, loadAccesses, saveAccess, setAccessActive } from '../../../services/access-service.js';
import { loadRoleProfiles } from '../../../services/role-profile-service.js';
import { DEFAULT_TEAM_PASSWORD, normalizeAccessEmail, validateAccess } from '../../../utils/access.js';
import { formatBrazilianPhone } from '../../../utils/phone.js';
import { SYSTEM_ROLE_PROFILES } from '../../../utils/role-profile.js';
import { setFieldErrors } from '../../shared/form-helpers.js';
import { normalizeSearchText } from './access-view.js';

export async function loadAccessData(state, { render }) {
  if (state.profile?.role !== 'admin' || state.access.loading) return;
  state.access.loading = true;
  state.access.error = '';
  render();
  try {
    const result = await loadAccesses(state.profile);
    state.access.accesses = result.accesses;
    state.access.storeIds = result.storeIds;
    try {
      const roleProfiles = await loadRoleProfiles(state.profile);
      state.settings.roleProfiles = roleProfiles.map((item) => ({ ...item, permissions: [...item.permissions] }));
    } catch {
      state.settings.roleProfiles = SYSTEM_ROLE_PROFILES.map((item) => ({ ...item, permissions: [...item.permissions] }));
      state.access.error = 'Os acessos foram carregados, mas os perfis personalizados estão temporariamente indisponíveis.';
    }
    state.access.loaded = true;
  } catch (error) {
    state.access.error = error?.code === 'permission-denied'
      ? 'Seu perfil não possui permissão para consultar acessos.'
      : 'Não foi possível carregar os acessos. Verifique a conexão e tente novamente.';
  } finally {
    state.access.loading = false;
    state.access.saving = false;
    render();
  }
}

export function ensureAccessData(state, dependencies) {
  if (state.route === 'access' && state.profile?.role === 'admin' && !state.access.loaded) {
    loadAccessData(state, dependencies);
  }
}

function selectedRoleProfile(form, state) {
  return state.settings.roleProfiles.find((profile) => profile.id === form.elements.roleProfileId.value);
}

function syncAccessStorePicker(form, state, creatingAccess) {
  const selected = selectedRoleProfile(form, state);
  const manager = selected?.baseRole === 'manager';
  const administrator = selected?.baseRole === 'admin';
  const captor = selected?.baseRole === 'captor';
  const multiStore = manager || captor;
  const picker = document.querySelector('#access-stores-field');
  const primaryStoreField = document.querySelector('#access-primary-store-field');
  if (picker) picker.hidden = !multiStore;
  if (primaryStoreField) primaryStoreField.hidden = false;

  if (creatingAccess) {
    const passwordInput = form.elements.password;
    const passwordHelp = form.querySelector('[data-access-password-help]');
    passwordInput.readOnly = !administrator;
    passwordInput.type = administrator ? 'password' : 'text';
    passwordInput.value = administrator ? '' : DEFAULT_TEAM_PASSWORD;
    passwordHelp.textContent = administrator
      ? 'Defina uma senha exclusiva para o acesso administrativo.'
      : 'Senha padrão para o primeiro acesso. A pessoa poderá alterá-la depois.';
  }

  if (selected?.id === 'system-mei' && creatingAccess && new FormData(form).getAll('storeIds').length <= 1) {
    form.querySelectorAll('[name="storeIds"]').forEach((input) => { input.checked = true; });
  }
  if (selected?.id === 'system-telemarketing') {
    form.querySelectorAll('[name="storeIds"]').forEach((input) => { input.checked = true; });
  }
  const selectedStoreIds = new FormData(form).getAll('storeIds');
  if (multiStore && !selectedStoreIds.length) {
    const primary = form.querySelector(`[name="storeIds"][value="${form.elements.storeId.value}"]`);
    if (primary) primary.checked = true;
  } else if (multiStore && !selectedStoreIds.includes(form.elements.storeId.value)) {
    const primary = form.querySelector(`[name="storeIds"][value="${form.elements.storeId.value}"]`);
    if (primary) primary.checked = true;
  }
}

export function applyAccessListFilters(state, root = document) {
  const query = normalizeSearchText(state.access.query?.trim());
  const storeId = state.access.storeFilter || '';
  const rows = [...root.querySelectorAll('[data-access-filter-row]')];
  let visibleCount = 0;
  rows.forEach((row) => {
    const storeIds = row.dataset.accessStoreIds?.split(',').filter(Boolean) || [];
    const visible = (!query || row.dataset.accessSearchText.includes(query))
      && (!storeId || storeIds.includes(storeId));
    row.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  const filtersActive = Boolean(query || storeId);
  const count = root.querySelector('[data-access-filter-count]');
  if (count) count.textContent = filtersActive ? `${visibleCount} de ${rows.length}` : `${rows.length} pessoa(s)`;
  const empty = root.querySelector('[data-access-filter-empty]');
  if (empty) empty.hidden = visibleCount > 0;
  const clear = root.querySelector('[data-access-clear-filters]');
  if (clear) clear.disabled = !filtersActive;
}

export function bindAccessEvents({ state, render, showToast }) {
  const searchInput = document.querySelector('[data-access-search]');
  searchInput?.addEventListener('input', () => {
    state.access.query = searchInput.value;
    applyAccessListFilters(state);
  });
  document.querySelector('[data-access-store-filter]')?.addEventListener('change', (event) => {
    state.access.storeFilter = event.target.value;
    applyAccessListFilters(state);
  });

  const form = document.querySelector('#access-form');
  if (form) {
    const creatingAccess = !state.access.editingEmail;
    const syncStorePicker = () => syncAccessStorePicker(form, state, creatingAccess);
    form.elements.roleProfileId.addEventListener('change', syncStorePicker);
    form.elements.storeId.addEventListener('change', syncStorePicker);
    form.querySelectorAll('[name="storeIds"]').forEach((input) => input.addEventListener('change', () => {
      const selected = selectedRoleProfile(form, state);
      if (selected?.id === 'system-telemarketing') {
        form.querySelectorAll('[name="storeIds"]').forEach((storeInput) => { storeInput.checked = true; });
        return;
      }
      const selectedStoreIds = new FormData(form).getAll('storeIds');
      if (!selectedStoreIds.length) {
        input.checked = true;
        return;
      }
      if (!selectedStoreIds.includes(form.elements.storeId.value)) {
        form.elements.storeId.value = selectedStoreIds[0];
      }
    }));
    form.elements.phone.addEventListener('input', () => {
      form.elements.phone.value = formatBrazilianPhone(form.elements.phone.value);
    });
    syncStorePicker();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.access.saving) return;
      const creating = !state.access.editingEmail;
      state.access.saving = true;
      setFieldErrors(form, {});
      const formData = new FormData(form);
      const values = { ...Object.fromEntries(formData), storeIds: formData.getAll('storeIds') };
      const submitButton = form.querySelector('[type="submit"]');
      submitButton.disabled = true;

      try {
        const validation = validateAccess(values, state.settings.roleProfiles, { requirePassword: creating });
        if (!validation.isValid) {
          state.access.saving = false;
          submitButton.disabled = false;
          setFieldErrors(form, validation.errors);
          return;
        }
        const currentEmail = normalizeAccessEmail(state.access.editingEmail);
        if (!creating && validation.data.email !== currentEmail) {
          await renameTeamMemberEmail(currentEmail, validation.data.email);
          state.access.editingEmail = validation.data.email;
        }
        const result = await saveAccess(state.profile, values, state.settings.roleProfiles, { requirePassword: creating });
        if (!result.isValid) {
          state.access.saving = false;
          submitButton.disabled = false;
          setFieldErrors(form, result.errors);
          return;
        }
        let credentialWarning = '';
        if (creating) {
          try {
            await createTeamPasswordAccount(result.data.email, result.data.password);
          } catch (error) {
            credentialWarning = error?.code === 'auth/email-already-in-use'
              ? ' O e-mail já possuía uma conta; a senha não foi alterada.'
              : ' A autorização foi salva, mas não foi possível criar a senha inicial.';
          }
        }
        state.access.editorOpen = false;
        state.access.editingEmail = '';
        await loadAccessData(state, { render });
        showToast(`${creating ? 'Acesso criado.' : 'Acesso atualizado.'}${credentialWarning}`, credentialWarning ? 'warning' : 'success', credentialWarning ? 'circle-alert' : 'circle-check');
      } catch (error) {
        state.access.saving = false;
        submitButton.disabled = false;
        const errorMessages = {
          'functions/already-exists': 'Este e-mail já está cadastrado para outra pessoa.',
          'functions/failed-precondition': error?.message || 'Este e-mail não pode ser alterado por esta tela.',
          'functions/not-found': 'A autorização original não foi encontrada. Atualize a página e tente novamente.',
          'functions/permission-denied': 'Seu perfil não possui permissão para gerenciar acessos.',
          'permission-denied': 'Seu perfil não possui permissão para gerenciar acessos.'
        };
        const message = errorMessages[error?.code]
          || 'Não foi possível salvar o acesso. Verifique a conexão e tente novamente.';
        if (error?.code === 'functions/already-exists') setFieldErrors(form, { email: message });
        else showToast(message, 'danger', 'circle-alert');
      }
    });
  }

  document.querySelector('#access-editor-dialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    state.access.editorOpen = false;
    state.access.editingEmail = '';
    render();
  });
  document.querySelector('#delete-access-dialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    state.access.pendingDeleteEmail = '';
    render();
  });
}

export async function handleAccessClick(event, { state, render, showToast }) {
  if (event.target.closest('[data-access-clear-filters]')) {
    state.access.query = '';
    state.access.storeFilter = '';
    render();
    return true;
  }

  if (event.target.closest('[data-action="reload-accesses"]')) {
    await loadAccessData(state, { render });
    return true;
  }

  if (event.target.closest('[data-access-new]')) {
    state.access.editingEmail = '';
    state.access.editorOpen = true;
    render();
    requestAnimationFrame(() => {
      document.querySelector('#access-editor-dialog')?.showModal();
      document.querySelector('#access-name')?.focus();
    });
    return true;
  }

  if (event.target.closest('[data-access-editor-close]')) {
    document.querySelector('#access-editor-dialog')?.close();
    state.access.editorOpen = false;
    state.access.editingEmail = '';
    render();
    return true;
  }

  const toggleButton = event.target.closest('[data-access-email]');
  if (toggleButton && !toggleButton.disabled) {
    const access = state.access.accesses.find((item) => item.email === toggleButton.dataset.accessEmail);
    if (!access) return true;
    toggleButton.disabled = true;
    try {
      await setAccessActive(state.profile, access, toggleButton.dataset.accessActive !== 'true');
      await loadAccessData(state, { render });
      showToast(access.active ? 'Acesso bloqueado.' : 'Acesso reativado.');
    } catch (error) {
      state.access.error = error.message || 'Não foi possível alterar o acesso.';
      render();
    }
    return true;
  }

  const editButton = event.target.closest('[data-access-edit]');
  if (editButton && !editButton.disabled) {
    const access = state.access.accesses.find((item) => item.email === editButton.dataset.accessEdit);
    if (!access) return true;
    state.access.editingEmail = access.email;
    state.access.editorOpen = true;
    render();
    requestAnimationFrame(() => {
      document.querySelector('#access-editor-dialog')?.showModal();
      document.querySelector('#access-name')?.focus();
    });
    return true;
  }

  const deleteButton = event.target.closest('[data-access-delete]');
  if (deleteButton && !deleteButton.disabled) {
    state.access.pendingDeleteEmail = deleteButton.dataset.accessDelete;
    render();
    requestAnimationFrame(() => document.querySelector('#delete-access-dialog')?.showModal());
    return true;
  }

  if (event.target.closest('[data-access-delete-cancel]')) {
    document.querySelector('#delete-access-dialog')?.close();
    state.access.pendingDeleteEmail = '';
    render();
    return true;
  }

  const confirmButton = event.target.closest('[data-access-delete-confirm]');
  if (confirmButton && !confirmButton.disabled) {
    const access = state.access.accesses.find((item) => item.email === confirmButton.dataset.accessDeleteConfirm);
    if (!access) return true;
    confirmButton.disabled = true;
    state.access.saving = true;
    try {
      await deleteAccess(state.profile, access);
      state.access.pendingDeleteEmail = '';
      await loadAccessData(state, { render });
      showToast('Acesso excluído. O histórico da pessoa foi preservado.');
    } catch (error) {
      state.access.saving = false;
      confirmButton.disabled = false;
      showToast(error?.message || 'Não foi possível excluir o acesso.', 'danger', 'circle-alert');
    }
    return true;
  }

  return false;
}
