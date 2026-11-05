import { calculateAge, formatBrazilianPostalCode } from '../../utils/lead.js';
import { formatBrazilianCpf } from '../../utils/savwin-matching.js';

const EXCLUSIVE_OPTION_VALUES = Object.freeze(['none', 'unknown']);

export function bindExclusiveOptions(form, fieldName) {
  const inputs = [...form.querySelectorAll(`[name="${fieldName}"]`)];
  inputs.forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    inputs.forEach((other) => {
      if (other === input) return;
      if (EXCLUSIVE_OPTION_VALUES.includes(input.value) || EXCLUSIVE_OPTION_VALUES.includes(other.value)) {
        other.checked = false;
      }
    });
  }));
}

export function bindCpfInput(form) {
  const input = form.elements.customerCpf || form.elements.cpf;
  input?.addEventListener('input', () => {
    input.value = formatBrazilianCpf(input.value);
  });
}

export function bindPostalCodeInput(form) {
  const input = form.elements.postalCode;
  input?.addEventListener('input', () => {
    input.value = formatBrazilianPostalCode(input.value);
  });
}

export function birthAgeText(value) {
  const age = calculateAge(value);
  return age === null ? 'A idade será calculada automaticamente.' : `${age} ano${age === 1 ? '' : 's'}`;
}

export function bindBirthDateInput(form) {
  const input = form.elements.birthDate;
  const output = form.querySelector('[data-birth-age]');
  if (!input || !output) return;
  const refresh = () => {
    output.textContent = birthAgeText(input.value);
  };
  input.addEventListener('input', refresh);
  refresh();
}

export function setFieldErrors(form, errors) {
  form.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
  form.querySelectorAll('.field-error').forEach((element) => {
    element.textContent = '';
  });

  let firstInvalidField = null;
  for (const [name, message] of Object.entries(errors)) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) continue;
    firstInvalidField ||= field;
    field.classList.add('has-error');
    const errorElement = field.querySelector('.field-error');
    if (errorElement) errorElement.textContent = message;
  }
  return firstInvalidField;
}

export function revealFirstFormError(field) {
  if (!field) return;
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const control = field.querySelector('input:not([type="hidden"]), select, textarea');
  setTimeout(() => control?.focus({ preventScroll: true }), 250);
}
