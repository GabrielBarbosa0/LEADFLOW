import { formatBrazilianPhone } from '../../../utils/phone.js';
import { formatBrazilianCpf } from '../../../utils/savwin-matching.js';
import { escapeHtml } from '../../shared/formatters.js';

const RELATIONSHIPS = Object.freeze([
  { id: '', label: 'Não informado' },
  { id: 'parent', label: 'Pai ou mãe' },
  { id: 'legal-guardian', label: 'Responsável legal' },
  { id: 'spouse', label: 'Cônjuge' },
  { id: 'relative', label: 'Outro familiar' },
  { id: 'other', label: 'Outra pessoa' }
]);

export function purchaseHolderFields(values = {}, idPrefix = 'purchase-holder', disabled = false) {
  const holder = values.purchaseHolder || values;
  const otherHolder = (holder.type || values.purchaseHolderType) === 'other';
  const locked = disabled ? 'disabled' : '';
  const detailLocked = disabled || !otherHolder ? 'disabled' : '';
  const relationshipOptions = RELATIONSHIPS.map((item) => (
    `<option value="${item.id}" ${(holder.relationship || values.purchaseHolderRelationship) === item.id ? 'selected' : ''}>${item.label}</option>`
  )).join('');

  return `<section class="purchase-holder-section" data-purchase-holder>
    <div class="field" data-field="purchaseHolderType"><label for="${idPrefix}-type">Titular da compra</label><select id="${idPrefix}-type" name="purchaseHolderType" ${locked}><option value="customer" ${otherHolder ? '' : 'selected'}>O próprio cliente</option><option value="other" ${otherHolder ? 'selected' : ''}>Outra pessoa</option></select><small class="field-help">Use outra pessoa quando a compra ficar em nome de um responsável ou terceiro.</small><small class="field-error"></small></div>
    <div class="field-row purchase-holder-details" data-purchase-holder-details ${otherHolder ? '' : 'hidden'}>
      <div class="field" data-field="purchaseHolderName"><label for="${idPrefix}-name">Nome do titular <span aria-hidden="true">*</span></label><input id="${idPrefix}-name" name="purchaseHolderName" maxlength="120" autocomplete="off" value="${escapeHtml(holder.name || values.purchaseHolderName || '')}" ${detailLocked} ${otherHolder ? 'required' : ''} /><small class="field-error"></small></div>
      <div class="field" data-field="purchaseHolderCpf"><label for="${idPrefix}-cpf">CPF do titular <span aria-hidden="true">*</span></label><input id="${idPrefix}-cpf" name="purchaseHolderCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" value="${escapeHtml(formatBrazilianCpf(holder.cpf || values.purchaseHolderCpf || ''))}" ${detailLocked} ${otherHolder ? 'required' : ''} /><small class="field-error"></small></div>
      <div class="field" data-field="purchaseHolderRelationship"><label for="${idPrefix}-relationship">Vínculo</label><select id="${idPrefix}-relationship" name="purchaseHolderRelationship" ${detailLocked}>${relationshipOptions}</select><small class="field-error"></small></div>
      <div class="field" data-field="purchaseHolderPhone"><label for="${idPrefix}-phone">Telefone do titular (opcional)</label><input id="${idPrefix}-phone" name="purchaseHolderPhone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="(00) 00000-0000" value="${escapeHtml(formatBrazilianPhone(holder.phoneSearch || holder.phone || values.purchaseHolderPhone || ''))}" ${detailLocked} /><small class="field-error"></small></div>
    </div>
  </section>`;
}

export function bindPurchaseHolderFields(form) {
  const section = form.querySelector('[data-purchase-holder]');
  const type = form.elements.purchaseHolderType;
  if (!section || !type) return;
  const details = section.querySelector('[data-purchase-holder-details]');
  const detailInputs = ['purchaseHolderName', 'purchaseHolderCpf', 'purchaseHolderRelationship', 'purchaseHolderPhone']
    .map((name) => form.elements[name])
    .filter(Boolean);

  const refresh = () => {
    const otherHolder = type.value === 'other';
    details.hidden = !otherHolder;
    detailInputs.forEach((input) => {
      input.disabled = !otherHolder;
      input.required = otherHolder && ['purchaseHolderName', 'purchaseHolderCpf'].includes(input.name);
      if (!otherHolder) input.value = '';
    });
  };

  type.addEventListener('change', refresh);
  form.elements.purchaseHolderCpf?.addEventListener('input', (event) => {
    event.target.value = formatBrazilianCpf(event.target.value);
  });
  form.elements.purchaseHolderPhone?.addEventListener('input', (event) => {
    event.target.value = formatBrazilianPhone(event.target.value);
  });
  refresh();
}
