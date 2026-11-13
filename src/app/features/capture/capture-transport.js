import { DEFAULT_STORE_SCHEDULE, transportHoursForDate } from '../../../utils/schedule.js';
import { escapeHtml } from '../../shared/formatters.js';
import { leadFormValues } from './capture-form.js';

function transportStatus(settings, appointmentDate, needsTransport, loading = false) {
  if (!needsTransport) return '';
  if (loading) return 'Carregando a disponibilidade do transporte...';
  if (!settings.transportEnabled) return 'O transporte ainda não está configurado para esta loja.';
  if (!appointmentDate) return 'Escolha a data para consultar a disponibilidade do transporte.';
  const hours = transportHoursForDate(settings, appointmentDate);
  return hours
    ? `Transporte disponível das ${hours.openingTime} às ${hours.closingTime}.`
    : 'Não há transporte disponível nesta data.';
}

export function transportFields(values = {}, settings = DEFAULT_STORE_SCHEDULE, idPrefix = 'transport', locked = false, loading = false) {
  const needsTransport = values.needsTransport === true || values.needsTransport === 'true';
  const legacyCompanionCount = values.hasCompanion === true || values.hasCompanion === 'true' ? 1 : 0;
  const companionCount = needsTransport ? Math.min(settings.maxCompanions, Number(values.companionCount ?? legacyCompanionCount) || 0) : 0;
  const companionOptions = Array.from({ length: settings.maxCompanions + 1 }, (_, count) => (
    `<option value="${count}" ${companionCount === count ? 'selected' : ''}>${count === 0 ? 'Sem acompanhante' : `${count} ${count === 1 ? 'acompanhante' : 'acompanhantes'}`}</option>`
  )).join('');
  const appointmentDate = values.appointmentDate || '';
  const status = transportStatus(settings, appointmentDate, needsTransport, loading);
  return `<section class="transport-section" data-transport-section>
    ${locked ? `<input type="hidden" name="needsTransport" value="${needsTransport}" /><input type="hidden" name="companionCount" value="${companionCount}" />` : ''}
    <div class="field-row transport-fields">
      <div class="field" data-field="needsTransport"><label for="${idPrefix}-needed">Transporte</label><select id="${idPrefix}-needed" name="needsTransport" ${locked ? 'disabled' : ''}><option value="false" ${needsTransport ? '' : 'selected'}>Sem transporte</option><option value="true" ${needsTransport ? 'selected' : ''}>Com transporte</option></select><small class="field-error"></small></div>
      <div class="field ${needsTransport ? '' : 'is-disabled'}" data-transport-companion data-field="companionCount"><label for="${idPrefix}-companion">Quantidade de acompanhantes</label><select id="${idPrefix}-companion" name="companionCount" ${locked || !needsTransport ? 'disabled' : ''}>${companionOptions}</select><small class="field-help">Limite desta loja: ${settings.maxCompanions} acompanhante(s).</small><small class="field-error"></small></div>
    </div>
    <div class="transport-status" data-transport-status ${status ? '' : 'hidden'}><i data-lucide="bus-front"></i><span>${escapeHtml(status)}</span></div>
  </section>`;
}

export function bindTransportFields(form, settings, onChange = () => {}) {
  const section = form.querySelector('[data-transport-section]');
  if (!section) return;
  const transportInput = section.querySelector('select[name="needsTransport"]');
  const companionInput = section.querySelector('select[name="companionCount"]');
  const companionField = section.querySelector('[data-transport-companion]');
  const status = section.querySelector('[data-transport-status]');
  const refresh = () => {
    const needsTransport = transportInput.value === 'true';
    companionInput.disabled = !needsTransport;
    companionField.classList.toggle('is-disabled', !needsTransport);
    if (!needsTransport) companionInput.value = '0';
    const appointmentDate = form.elements.appointmentDate?.value || '';
    const message = transportStatus(settings, appointmentDate, needsTransport);
    status.hidden = !message;
    status.querySelector('span').textContent = message;
    onChange(leadFormValues(form));
  };
  transportInput.addEventListener('change', refresh);
  companionInput.addEventListener('change', refresh);
  form.elements.appointmentDate?.addEventListener('input', refresh);
  refresh();
}
