import { lookupPostalCode } from '../../services/postal-code-service.js';
import { calculateAge, formatBrazilianPostalCode, normalizePostalCode } from '../../utils/lead.js';
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

export function bindPostalCodeLookup(form, {
  lookup = lookupPostalCode,
  online = () => navigator.onLine
} = {}) {
  const input = form.elements.postalCode;
  const status = form.querySelector('[data-postal-code-status]');
  if (!input) return () => {};

  let requestSequence = 0;
  let controller = null;

  const setStatus = (message = '') => {
    if (status) status.textContent = message;
  };
  const cancelCurrentLookup = () => {
    requestSequence += 1;
    controller?.abort();
    controller = null;
  };

  input.addEventListener('input', () => {
    const postalCode = normalizePostalCode(input.value);
    cancelCurrentLookup();
    if (postalCode.length !== 8) {
      setStatus('');
      return;
    }
    if (!online()) {
      setStatus('');
      return;
    }

    const sequence = requestSequence;
    const initialValues = Object.fromEntries(
      ['street', 'neighborhood', 'city', 'state'].map((name) => [name, form.elements[name]?.value || ''])
    );
    controller = new AbortController();
    setStatus('Consultando CEP...');

    Promise.resolve(lookup(postalCode, { signal: controller.signal }))
      .then((address) => {
        if (sequence !== requestSequence || normalizePostalCode(input.value) !== postalCode) return;
        controller = null;
        if (!address) {
          setStatus('CEP não encontrado. Preencha o endereço manualmente.');
          return;
        }
        ['street', 'neighborhood', 'city', 'state'].forEach((name) => {
          const field = form.elements[name];
          if (field && field.value === initialValues[name]) field.value = address[name] || '';
        });
        setStatus('Endereço preenchido automaticamente.');
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || sequence !== requestSequence) return;
        controller = null;
        setStatus('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
      });
  });

  return cancelCurrentLookup;
}

export function bindScoreInput(form) {
  const input = form.elements.score;
  input?.addEventListener('input', () => {
    input.value = String(input.value || '').replace(/\D/g, '').slice(0, 4);
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
