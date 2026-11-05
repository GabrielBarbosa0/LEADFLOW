import { deleteAppointmentService, saveAppointmentService, setAppointmentServiceActive } from '../../../services/service-catalog-service.js';
import { servicesForStore } from '../../../utils/service-catalog.js';
import { setFieldErrors } from '../../shared/form-helpers.js';

export function serviceFormValues(form) {
  const formData = new FormData(form);
  return { ...Object.fromEntries(formData), storeIds: formData.getAll('storeIds') };
}

export function bindServiceEvents({ state, render, showToast, refreshServices }) {
  const form = document.querySelector('#service-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.settings.saving) return;
    const values = serviceFormValues(form);
    const editingId = state.settings.editingServiceId;
    state.settings.saving = true;
    setFieldErrors(form, {});
    try {
      const result = await saveAppointmentService(state.profile, values, editingId);
      if (!result.isValid) {
        state.settings.saving = false;
        setFieldErrors(form, result.errors);
        return;
      }
      state.settings.serviceEditorOpen = false;
      state.settings.editingServiceId = '';
      await refreshServices();
      showToast('Serviço salvo com sucesso.');
    } catch (error) {
      state.settings.saving = false;
      state.settings.error = error?.code === 'permission-denied'
        ? 'Seu perfil não pode gerenciar serviços.'
        : 'Não foi possível salvar o serviço.';
      render();
    }
  });

  document.querySelector('#service-editor-dialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    state.settings.serviceEditorOpen = false;
    state.settings.editingServiceId = '';
    render();
  });
  const deleteDialog = document.querySelector('#delete-service-dialog');
  deleteDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    deleteDialog.close();
    state.settings.pendingDeleteServiceId = '';
    render();
  });
}

export async function handleServiceClick(event, { state, render, showToast, refreshServices }) {
  const newButton = event.target.closest('[data-service-new]');
  if (newButton) {
    state.settings.editingServiceId = '';
    state.settings.serviceEditorOpen = true;
    render();
    document.querySelector('#service-editor-dialog')?.showModal();
    document.querySelector('#service-name')?.focus();
    return true;
  }

  const editButton = event.target.closest('[data-service-edit]');
  if (editButton) {
    state.settings.editingServiceId = editButton.dataset.serviceEdit;
    state.settings.serviceEditorOpen = true;
    render();
    document.querySelector('#service-editor-dialog')?.showModal();
    document.querySelector('#service-name')?.focus();
    return true;
  }

  if (event.target.closest('[data-service-editor-close]')) {
    document.querySelector('#service-editor-dialog')?.close();
    state.settings.serviceEditorOpen = false;
    state.settings.editingServiceId = '';
    render();
    return true;
  }

  const toggleButton = event.target.closest('[data-service-toggle]');
  if (toggleButton && !toggleButton.disabled) {
    await toggleService(toggleButton, { state, render, showToast, refreshServices });
    return true;
  }

  const deleteButton = event.target.closest('[data-service-delete]');
  if (deleteButton && !deleteButton.disabled) {
    state.settings.pendingDeleteServiceId = deleteButton.dataset.serviceDelete;
    render();
    document.querySelector('#delete-service-dialog')?.showModal();
    return true;
  }

  if (event.target.closest('[data-service-delete-cancel]')) {
    document.querySelector('#delete-service-dialog')?.close();
    state.settings.pendingDeleteServiceId = '';
    render();
    return true;
  }

  const confirmButton = event.target.closest('[data-service-delete-confirm]');
  if (confirmButton && !confirmButton.disabled) {
    await removeService(confirmButton, { state, render, showToast, refreshServices });
    return true;
  }
  return false;
}

function uncoveredStoreIds(service, services) {
  return service.storeIds.filter((storeId) => !servicesForStore(
    services.filter((item) => item.id !== service.id),
    storeId
  ).length);
}

async function toggleService(button, { state, render, showToast, refreshServices }) {
  const service = state.settings.services.find((item) => item.id === button.dataset.serviceToggle);
  if (!service) return;
  if (service.active && uncoveredStoreIds(service, state.settings.services).length) {
    showToast('Mantenha pelo menos um serviço ativo em cada unidade atendida.', 'warning', 'circle-alert');
    return;
  }
  state.settings.saving = true;
  button.disabled = true;
  try {
    await setAppointmentServiceActive(state.profile, service, !service.active);
    await refreshServices();
    showToast(service.active ? 'Serviço desativado.' : 'Serviço ativado.');
  } catch (error) {
    state.settings.saving = false;
    state.settings.error = error?.code === 'permission-denied'
      ? 'Seu perfil não pode alterar este serviço.'
      : error?.code === 'last-active-service' ? error.message : 'Não foi possível alterar o serviço.';
    render();
  }
}

async function removeService(button, { state, render, showToast, refreshServices }) {
  const service = state.settings.services.find((item) => item.id === button.dataset.serviceDeleteConfirm);
  if (!service) return;
  state.settings.saving = true;
  render();
  try {
    await deleteAppointmentService(state.profile, service);
    state.settings.pendingDeleteServiceId = '';
    await refreshServices();
    showToast('Serviço excluído.');
  } catch (error) {
    state.settings.saving = false;
    state.settings.pendingDeleteServiceId = '';
    state.settings.error = error?.code === 'permission-denied'
      ? 'Seu perfil não pode excluir este serviço.'
      : error?.code === 'last-active-service' ? error.message : 'Não foi possível excluir o serviço.';
    render();
  }
}
