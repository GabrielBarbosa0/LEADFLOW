import { formatBrazilianPhone } from '../../../utils/phone.js';
import { bindBirthDateInput, bindCpfInput, bindExclusiveOptions, bindPostalCodeInput, bindPostalCodeLookup, bindScoreInput } from '../../shared/form-helpers.js';
import { leadFormValues } from '../capture/capture-form.js';
import { bindEyeTriage, enrichLeadTriage } from '../capture/capture-triage.js';
import { bindProductPaymentFields } from '../capture/product-payment.js';
import { bindTransportFields } from '../capture/capture-transport.js';

export function initializeLeadDetailForm(form, options) {
  const phoneInput = form.elements.phone;
  const notesInput = form.elements.notes;
  const notesCount = form.querySelector('#edit-notes-count');
  bindCpfInput(form);
  bindPostalCodeInput(form);
  bindPostalCodeLookup(form);
  bindScoreInput(form);
  bindBirthDateInput(form);
  bindProductPaymentFields(form);
  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatBrazilianPhone(phoneInput.value);
  });
  notesInput.addEventListener('input', () => {
    if (notesCount) notesCount.textContent = notesInput.value.length;
  });
  bindExclusiveOptions(form, 'ametropiaIds');
  bindExclusiveOptions(form, 'pathologyIds');
  bindEyeTriage(form, options.settings, (values) => options.onTriageChange?.(values, form));
  bindTransportFields(form, options.settings, (values) => options.onTriageChange?.(values, form));
  form.elements.appointmentServiceId?.addEventListener('change', () => options.onServiceChange?.(form.elements.appointmentServiceId.value, form));
  form.elements.appointmentDate?.addEventListener('input', () => options.onAppointmentDateChange?.(form.elements.appointmentDate.value, form));
}

export function leadDetailSubmissionValues(form, existingLead, settings, { managerReschedule = false } = {}) {
  let values = enrichLeadTriage(leadFormValues(form), settings);
  if (existingLead && !form.querySelector('[name="ametropiaIds"]')) {
    values.ametropiaIds = existingLead.ametropiaIds || [];
  }
  if (managerReschedule && existingLead) {
    values = {
      ...existingLead,
      phone: existingLead.phone || existingLead.phoneSearch,
      schedulingMode: form.elements.schedulingMode?.value || existingLead.appointmentSchedulingMode || 'free',
      appointmentDurationMinutes: Number(form.elements.appointmentDurationMinutes?.value)
        || existingLead.appointmentDurationMinutes
        || 20,
      appointmentServiceId: form.elements.appointmentServiceId?.value || existingLead.appointmentServiceId || '',
      appointmentServiceName: form.elements.appointmentServiceName?.value || existingLead.appointmentServiceName || '',
      appointmentDate: form.elements.appointmentDate.value,
      appointmentTime: form.elements.appointmentTime.value,
      ametropiaIds: existingLead.ametropiaIds || [],
      pathologyIds: existingLead.pathologyIds || []
    };
  }
  return values;
}
