import { EXAM_PAYMENT_METHODS, PRODUCT_INTEREST_IDS } from '../../../utils/lead.js';

export function isProductInterest(interestId) {
  return PRODUCT_INTEREST_IDS.includes(String(interestId || ''));
}

export function productPaymentFields(values = {}, idPrefix = 'product-payment', disabled = false) {
  const selected = Array.isArray(values.productPaymentMethods)
    ? values.productPaymentMethods.map(String)
    : [];
  const visible = isProductInterest(values.interestId);
  const options = EXAM_PAYMENT_METHODS.map((method) => `<label class="ametropia-option checkbox-label">
    <input type="checkbox" name="productPaymentMethods" value="${method.id}" ${selected.includes(method.id) ? 'checked' : ''} ${visible && !disabled ? '' : 'disabled'} />
    <span>${method.label}</span>
  </label>`).join('');

  return `<fieldset id="${idPrefix}" class="field ametropia-field product-payment-field" data-product-payment data-field="productPaymentMethods" ${visible ? '' : 'hidden'} ${disabled ? 'disabled' : ''}>
    <legend>Forma de pagamento do produto de interesse</legend>
    <small>Marque todas as formas que serão utilizadas.</small>
    <div class="ametropia-options exam-payment-method-options">${options}</div>
    <small class="field-error"></small>
  </fieldset>`;
}

export function bindProductPaymentFields(form) {
  const field = form.querySelector('[data-product-payment]');
  const interest = form.elements.interestId;
  if (!field || !interest) return;

  const inputs = [...form.querySelectorAll('[name="productPaymentMethods"]')];
  const refresh = () => {
    const visible = isProductInterest(interest.value);
    field.hidden = !visible;
    inputs.forEach((input) => {
      input.disabled = !visible || field.disabled;
    });
  };

  interest.addEventListener('change', refresh);
  refresh();
}
