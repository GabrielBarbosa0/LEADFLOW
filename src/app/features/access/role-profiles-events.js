import { deleteRoleProfile, loadRoleProfiles, resetSystemRolePermissions, saveRoleProfile, saveSystemRolePermissions } from '../../../services/role-profile-service.js';
import { normalizeRolePermissions, permissionsForScope, systemRoleProfileForId } from '../../../utils/role-profile.js';
import { setFieldErrors } from '../../shared/form-helpers.js';

const MANAGEMENT_DEPENDENTS = ['followups.team', 'goals.manage', 'dashboard.view', 'leads.export'];

export function createDefaultRoleDraft(scope = 'own') {
  return { name: '', scope, permissions: permissionsForScope(scope) };
}

function updateDependentPermissions(permissions, input) {
  if (input.checked && MANAGEMENT_DEPENDENTS.includes(input.value)) permissions.add('management.view');
  if (!input.checked && input.value === 'management.view') {
    MANAGEMENT_DEPENDENTS.forEach((permission) => permissions.delete(permission));
  }
}

function syncPermissionControls(container, selector, permissions, countSelector) {
  container.querySelectorAll(selector).forEach((permissionInput) => {
    const active = permissions.has(permissionInput.value);
    permissionInput.checked = active;
    permissionInput.closest('.role-details-permission')?.classList.toggle('is-active', active);
    const status = permissionInput.closest('.role-details-permission')?.querySelector('small');
    if (status) status.textContent = active ? 'Ativada' : 'Desativada';
  });
  const count = container.querySelector(countSelector);
  if (count) count.textContent = String(permissions.size);
}

export async function loadRoleProfilesData(state, { render }) {
  if (state.profile?.role !== 'admin') return;
  try {
    const profiles = await loadRoleProfiles(state.profile);
    state.settings.roleProfiles = profiles.map((item) => ({ ...item, permissions: [...item.permissions] }));
    state.settings.saving = false;
    render();
  } catch (error) {
    state.settings.saving = false;
    state.settings.error = error?.code === 'permission-denied'
      ? 'Seu perfil não pode consultar os perfis de acesso.'
      : 'Não foi possível carregar os perfis de acesso.';
    render();
  }
}

export function bindRoleProfileEvents({ state, render, showToast }) {
  const form = document.querySelector('#role-profile-form');
  if (form) {
    form.elements.scope.addEventListener('change', () => {
      state.settings.roleDraft.scope = form.elements.scope.value;
      state.settings.roleDraft.permissions = normalizeRolePermissions(state.settings.roleDraft.scope, state.settings.roleDraft.permissions);
      render();
      document.querySelector('#role-editor-dialog')?.showModal();
    });
    form.querySelectorAll('[name="permissions"]').forEach((input) => {
      input.addEventListener('change', () => {
        const permissions = new Set([...form.querySelectorAll('[name="permissions"]:checked')].map((item) => item.value));
        updateDependentPermissions(permissions, input);
        state.settings.roleDraft.permissions = [...permissions];
        syncPermissionControls(form, '[name="permissions"]', permissions, '[data-role-editor-count]');
      });
    });
    form.elements.name.addEventListener('input', () => {
      state.settings.roleDraft.name = form.elements.name.value;
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.settings.saving) return;
      const formData = new FormData(form);
      const values = { ...Object.fromEntries(formData), permissions: formData.getAll('permissions') };
      state.settings.saving = true;
      state.settings.error = '';
      setFieldErrors(form, {});
      try {
        const result = await saveRoleProfile(state.profile, values, state.settings.editingRoleId);
        if (!result.isValid) {
          state.settings.saving = false;
          setFieldErrors(form, result.errors);
          return;
        }
        state.settings.roleDraft = createDefaultRoleDraft();
        state.settings.editingRoleId = '';
        state.settings.roleEditorOpen = false;
        await loadRoleProfilesData(state, { render });
        showToast('Cargo salvo com sucesso.');
      } catch (error) {
        state.settings.saving = false;
        state.settings.error = error?.code === 'permission-denied'
          ? 'Seu perfil não pode gerenciar perfis e permissões.'
          : 'Não foi possível salvar o perfil.';
        render();
        document.querySelector('#role-editor-dialog')?.showModal();
      }
    });
  }

  const editorDialog = document.querySelector('#role-editor-dialog');
  const closeEditor = () => {
    state.settings.roleEditorOpen = false;
    state.settings.editingRoleId = '';
    state.settings.roleDraft = createDefaultRoleDraft();
    render();
  };
  editorDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    editorDialog.close();
    closeEditor();
  });
  editorDialog?.addEventListener('click', (event) => {
    if (event.target !== editorDialog) return;
    editorDialog.close();
    closeEditor();
  });

  const detailsDialog = document.querySelector('#role-details-dialog');
  detailsDialog?.querySelectorAll('[data-system-role-permission]').forEach((input) => {
    input.addEventListener('change', () => {
      const permissions = new Set(state.settings.detailsRolePermissions);
      if (input.checked) permissions.add(input.value);
      else permissions.delete(input.value);
      updateDependentPermissions(permissions, input);
      state.settings.detailsRolePermissions = [...permissions];
      syncPermissionControls(detailsDialog, '[data-system-role-permission]', permissions, '[data-role-details-count]');
    });
  });
  const closeDetails = () => {
    state.settings.detailsRoleId = '';
    state.settings.detailsRolePermissions = [];
    render();
  };
  detailsDialog?.addEventListener('click', (event) => {
    if (event.target !== detailsDialog) return;
    detailsDialog.close();
    closeDetails();
  });
  detailsDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    detailsDialog.close();
    closeDetails();
  });

  document.querySelector('#delete-role-dialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    state.settings.pendingDeleteRoleId = '';
    render();
  });
}

export async function handleRoleProfileClick(event, { state, render, showToast }) {
  if (event.target.closest('[data-role-new]')) {
    state.settings.editingRoleId = '';
    state.settings.roleDraft = createDefaultRoleDraft();
    state.settings.roleEditorOpen = true;
    render();
    document.querySelector('#role-editor-dialog')?.showModal();
    document.querySelector('#role-profile-name')?.focus();
    return true;
  }

  const editButton = event.target.closest('[data-role-edit]');
  if (editButton) {
    const profile = state.settings.roleProfiles.find((item) => item.id === editButton.dataset.roleEdit && !item.system);
    if (profile) {
      state.settings.editingRoleId = profile.id;
      state.settings.roleDraft = { name: profile.name, scope: profile.scope, permissions: [...profile.permissions] };
      state.settings.roleEditorOpen = true;
      render();
      document.querySelector('#role-editor-dialog')?.showModal();
      const nameInput = document.querySelector('#role-profile-form')?.elements.name;
      nameInput?.focus({ preventScroll: true });
      nameInput?.select();
    }
    return true;
  }

  const detailsButton = event.target.closest('[data-role-details]');
  if (detailsButton) {
    state.settings.detailsRoleId = detailsButton.dataset.roleDetails;
    const profile = state.settings.roleProfiles.find((item) => item.id === state.settings.detailsRoleId);
    state.settings.detailsRolePermissions = [...(profile?.permissions || [])];
    render();
    document.querySelector('#role-details-dialog')?.showModal();
    return true;
  }

  const saveSystemButton = event.target.closest('[data-system-role-save]');
  if (saveSystemButton && !saveSystemButton.disabled) {
    const roleProfileId = saveSystemButton.dataset.systemRoleSave;
    const profile = state.settings.roleProfiles.find((item) => item.id === roleProfileId);
    if (!profile || profile.baseRole === 'admin') return true;
    state.settings.saving = true;
    saveSystemButton.disabled = true;
    try {
      const result = await saveSystemRolePermissions(state.profile, roleProfileId, state.settings.detailsRolePermissions);
      if (!result.isValid) {
        state.settings.saving = false;
        showToast(result.errors.permissions || 'Escolha permissões válidas.', 'danger', 'circle-alert');
        render();
        return true;
      }
      state.settings.detailsRoleId = '';
      state.settings.detailsRolePermissions = [];
      await loadRoleProfilesData(state, { render });
      showToast('Permissões do perfil atualizadas.');
    } catch (error) {
      state.settings.saving = false;
      state.settings.error = error?.code === 'permission-denied'
        ? 'Seu perfil não pode alterar estas permissões.'
        : error?.message || 'Não foi possível salvar as permissões.';
      render();
    }
    return true;
  }

  const resetSystemButton = event.target.closest('[data-system-role-reset]');
  if (resetSystemButton && !resetSystemButton.disabled) {
    const roleProfileId = resetSystemButton.dataset.systemRoleReset;
    const defaultProfile = systemRoleProfileForId(roleProfileId);
    if (!defaultProfile || defaultProfile.baseRole === 'admin') return true;
    state.settings.saving = true;
    resetSystemButton.disabled = true;
    try {
      await resetSystemRolePermissions(state.profile, roleProfileId);
      state.settings.detailsRoleId = '';
      state.settings.detailsRolePermissions = [];
      await loadRoleProfilesData(state, { render });
      showToast('Permissões restauradas para o padrão.');
    } catch (error) {
      state.settings.saving = false;
      state.settings.error = error?.code === 'permission-denied'
        ? 'Seu perfil não pode restaurar estas permissões.'
        : error?.message || 'Não foi possível restaurar o perfil.';
      render();
    }
    return true;
  }

  if (event.target.closest('[data-role-details-close]')) {
    document.querySelector('#role-details-dialog')?.close();
    state.settings.detailsRoleId = '';
    state.settings.detailsRolePermissions = [];
    render();
    return true;
  }

  if (event.target.closest('[data-role-cancel]')) {
    document.querySelector('#role-editor-dialog')?.close();
    state.settings.roleEditorOpen = false;
    state.settings.editingRoleId = '';
    state.settings.roleDraft = createDefaultRoleDraft();
    render();
    return true;
  }

  const deleteButton = event.target.closest('[data-role-delete]');
  if (deleteButton) {
    state.settings.pendingDeleteRoleId = deleteButton.dataset.roleDelete;
    render();
    document.querySelector('#delete-role-dialog')?.showModal();
    return true;
  }

  if (event.target.closest('[data-role-delete-cancel]')) {
    document.querySelector('#delete-role-dialog')?.close();
    state.settings.pendingDeleteRoleId = '';
    render();
    return true;
  }

  const confirmDeleteButton = event.target.closest('[data-role-delete-confirm]');
  if (confirmDeleteButton && !confirmDeleteButton.disabled) {
    const roleProfile = state.settings.roleProfiles.find((item) => item.id === confirmDeleteButton.dataset.roleDeleteConfirm);
    if (!roleProfile) return true;
    state.settings.saving = true;
    render();
    try {
      await deleteRoleProfile(state.profile, roleProfile);
      state.settings.pendingDeleteRoleId = '';
      await loadRoleProfilesData(state, { render });
      showToast('Cargo excluído.');
    } catch (error) {
      state.settings.saving = false;
      state.settings.pendingDeleteRoleId = '';
      state.settings.error = error?.code === 'role-in-use' ? error.message : 'Não foi possível excluir o perfil.';
      render();
    }
    return true;
  }

  return false;
}
