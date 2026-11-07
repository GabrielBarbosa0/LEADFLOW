import { describe, expect, it, vi } from 'vitest';
import {
  bindBirthDateInput,
  bindCpfInput,
  bindExclusiveOptions,
  bindPostalCodeLookup,
  bindScoreInput,
  birthAgeText,
  revealFirstFormError,
  setFieldErrors
} from '../../src/app/shared/form-helpers.js';

function eventInput(value = '') {
  const listeners = {};
  return {
    value,
    checked: false,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type) {
      listeners[type]?.();
    }
  };
}

describe('shared form helpers', () => {
  it('keeps none and unknown exclusive from regular checkbox options', () => {
    const regular = eventInput('myopia');
    const none = eventInput('none');
    const unknown = eventInput('unknown');
    const form = { querySelectorAll: () => [regular, none, unknown] };

    bindExclusiveOptions(form, 'ametropiaIds');
    regular.checked = true;
    none.checked = true;
    none.dispatch('change');

    expect(regular.checked).toBe(false);
    expect(none.checked).toBe(true);
    expect(unknown.checked).toBe(false);
  });

  it('formats CPF input as the user types', () => {
    const input = eventInput('12345678901');
    bindCpfInput({ elements: { customerCpf: input } });
    input.dispatch('input');
    expect(input.value).toBe('123.456.789-01');
  });

  it('keeps only whole digits in the score input', () => {
    const input = eventInput('-85,7.2');
    bindScoreInput({ elements: { score: input } });
    input.dispatch('input');
    expect(input.value).toBe('8572');
  });

  it('fills the editable address fields after a complete online CEP', async () => {
    const postalCode = eventInput('50000-123');
    const status = { textContent: '' };
    const elements = {
      postalCode,
      street: eventInput(''),
      neighborhood: eventInput(''),
      city: eventInput(''),
      state: eventInput('PE'),
      streetNumber: eventInput('42')
    };
    const lookup = vi.fn().mockResolvedValue({
      street: 'Rua Nova', neighborhood: 'Centro', city: 'Recife', state: 'PE'
    });
    const form = {
      elements,
      querySelector: () => status
    };

    bindPostalCodeLookup(form, { lookup, online: () => true });
    postalCode.dispatch('input');
    await Promise.resolve();

    expect(lookup).toHaveBeenCalledWith('50000123', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(elements.street.value).toBe('Rua Nova');
    expect(elements.neighborhood.value).toBe('Centro');
    expect(elements.city.value).toBe('Recife');
    expect(elements.state.value).toBe('PE');
    expect(elements.streetNumber.value).toBe('42');
    expect(status.textContent).toContain('preenchido automaticamente');
  });

  it('keeps manual address entry available while offline', () => {
    const postalCode = eventInput('50000-123');
    const status = { textContent: '' };
    const lookup = vi.fn();
    bindPostalCodeLookup({
      elements: { postalCode },
      querySelector: () => status
    }, { lookup, online: () => false });

    postalCode.dispatch('input');

    expect(lookup).not.toHaveBeenCalled();
    expect(status.textContent).toBe('');
  });

  it('updates the birth age hint', () => {
    const input = eventInput('');
    const output = { textContent: '' };
    const form = {
      elements: { birthDate: input },
      querySelector: () => output
    };

    bindBirthDateInput(form);
    expect(output.textContent).toBe('A idade será calculada automaticamente.');
    expect(birthAgeText('')).toBe(output.textContent);
  });

  it('clears old errors and returns the first invalid field', () => {
    const oldField = { classList: { remove: vi.fn() } };
    const oldError = { textContent: 'Erro anterior' };
    const nameError = { textContent: '' };
    const nameField = {
      classList: { add: vi.fn() },
      querySelector: () => nameError
    };
    const form = {
      querySelectorAll: (selector) => selector === '.field' ? [oldField] : [oldError],
      querySelector: (selector) => selector === '[data-field="fullName"]' ? nameField : null
    };

    expect(setFieldErrors(form, { fullName: 'Informe o nome.', missing: 'Ignorado' })).toBe(nameField);
    expect(oldField.classList.remove).toHaveBeenCalledWith('has-error');
    expect(oldError.textContent).toBe('');
    expect(nameField.classList.add).toHaveBeenCalledWith('has-error');
    expect(nameError.textContent).toBe('Informe o nome.');
  });

  it('scrolls to and focuses the first invalid control', () => {
    vi.useFakeTimers();
    const control = { focus: vi.fn() };
    const field = {
      scrollIntoView: vi.fn(),
      querySelector: () => control
    };

    revealFirstFormError(field);
    expect(field.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    vi.advanceTimersByTime(250);
    expect(control.focus).toHaveBeenCalledWith({ preventScroll: true });
    vi.useRealTimers();
  });
});
