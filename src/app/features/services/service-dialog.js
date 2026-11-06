import { STORES } from '../../../utils/stores.js';
import { escapeHtml } from '../../shared/formatters.js';

export function serviceDialogs(settings) {
  const { services, saving, serviceEditorOpen, editingServiceId, pendingDeleteServiceId } = settings;
  const editing = services.find((service) => service.id === editingServiceId) || null;
  const deleting = services.find((service) => service.id === pendingDeleteServiceId) || null;
  const selectedStoreIds = editing?.storeIds || [settings.selectedStoreId || STORES[0].id];
  const storeOptions = STORES.map((store) => `<label class="service-store-option checkbox-label"><input type="checkbox" name="storeIds" value="${store.id}" ${selectedStoreIds.includes(store.id) ? 'checked' : ''} /><span>${store.label}</span></label>`).join('');

  return `${serviceEditorOpen ? `<dialog id="service-editor-dialog" class="access-editor-dialog service-editor-dialog" aria-labelledby="service-editor-title">
    <form id="service-form" class="access-form" novalidate>
      <header><div><span class="eyebrow">SERVIÇO DA AGENDA</span><h2 id="service-editor-title">${editing ? 'Editar serviço' : 'Novo serviço'}</h2><p>A duração será usada para calcular os horários disponíveis.</p></div><button class="icon-button" type="button" data-service-editor-close aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="access-form-body">
        <div class="field service-name-field" data-field="name"><label for="service-name">Nome do serviço</label><input id="service-name" name="name" maxlength="80" value="${escapeHtml(editing?.name || '')}" placeholder="Ex.: Exame de vista" required /><small class="field-error"></small></div>
        <div class="field service-duration-field" data-field="durationMinutes"><label for="service-duration">Duração</label><div class="number-with-unit"><input id="service-duration" name="durationMinutes" type="number" min="10" max="180" step="10" value="${editing?.durationMinutes || 30}" required /><span>min</span></div><small class="field-error"></small></div>
        <fieldset class="field access-field-wide service-store-field" data-field="storeIds"><legend>Lojas atendidas</legend><small>Marque todas as unidades que oferecem este serviço.</small><div class="service-store-options">${storeOptions}</div><small class="field-error"></small></fieldset>
        <input name="active" type="hidden" value="${editing?.active === false ? 'false' : 'true'}" />
      </div>
      <footer><button class="button button-secondary" type="button" data-service-editor-close>Cancelar</button><button class="button button-primary" type="submit" ${saving ? 'disabled' : ''}><i data-lucide="save"></i><span>${saving ? 'Salvando...' : 'Salvar serviço'}</span></button></footer>
    </form>
  </dialog>` : ''}
  ${deleting ? `<dialog id="delete-service-dialog" class="confirmation-dialog" aria-labelledby="delete-service-title" aria-describedby="delete-service-description"><div class="confirmation-dialog-icon"><i data-lucide="trash-2"></i></div><h2 id="delete-service-title">Excluir serviço?</h2><p id="delete-service-description">O serviço <strong>${escapeHtml(deleting.name)}</strong> será removido do catálogo e não aparecerá em novos agendamentos. Os agendamentos já cadastrados serão preservados.</p><div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-service-delete-cancel>Cancelar</button><button class="button button-danger-solid" type="button" data-service-delete-confirm="${escapeHtml(deleting.id)}" ${saving ? 'disabled' : ''}><i data-lucide="trash-2"></i><span>Excluir serviço</span></button></div></dialog>` : ''}`;
}
