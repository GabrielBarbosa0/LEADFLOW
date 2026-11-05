import { formatBrazilianPhone } from '../../../utils/phone.js';
import { bindBirthDateInput, bindCpfInput, bindExclusiveOptions, bindPostalCodeInput, bindScoreInput } from '../../shared/form-helpers.js';
import { restoreNewLeadDraft } from './capture-form.js';
import { bindEyeTriage } from './capture-triage.js';
import { bindTransportFields } from './capture-transport.js';

export function initializeCaptureForm(form, options) {
  const phoneInput = form.elements.phone;
  const creditAuxiliaryPhoneInput = form.elements.creditAuxiliaryPhone;
  const notesInput = form.elements.notes;
  const appointmentDateInput = form.elements.appointmentDate;
  restoreNewLeadDraft(form, options.draft);
  const notesCount = form.querySelector('#notes-count');
  if (notesCount) notesCount.textContent = notesInput.value.length;
  bindCpfInput(form);
  bindPostalCodeInput(form);
  bindScoreInput(form);
  bindBirthDateInput(form);
  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatBrazilianPhone(phoneInput.value);
  });
  creditAuxiliaryPhoneInput?.addEventListener('input', () => {
    creditAuxiliaryPhoneInput.value = formatBrazilianPhone(creditAuxiliaryPhoneInput.value);
  });
  notesInput.addEventListener('input', () => {
    if (notesCount) notesCount.textContent = notesInput.value.length;
  });
  form.elements.storeId?.addEventListener('change', () => options.onStoreChange?.(form.elements.storeId.value, form));
  form.elements.appointmentServiceId?.addEventListener('change', () => options.onServiceChange?.(form.elements.appointmentServiceId.value, form));
  appointmentDateInput.addEventListener('input', () => options.onAppointmentDateChange?.(appointmentDateInput.value, form));
  bindExclusiveOptions(form, 'ametropiaIds');
  bindExclusiveOptions(form, 'pathologyIds');
  bindEyeTriage(form, options.settings, (values, triage) => options.onTriageChange?.(values, triage, form));
  bindTransportFields(form, options.settings, (values) => options.onTransportChange?.(values, form));
  if (!options.controlsEnabled) {
    [...form.elements].forEach((control) => {
      if (control.name !== 'storeId') control.disabled = true;
    });
  }
}
