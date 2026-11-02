const NEW_LEAD_DRAFT_FIELDS = Object.freeze([
  'fullName', 'phone', 'customerRg', 'customerCpf', 'birthDate', 'sex', 'preferredName',
  'street', 'streetNumber', 'neighborhood', 'city', 'state', 'addressReference', 'interestId', 'appointmentServiceId',
  'ametropiaIds', 'pathologyIds', 'diabetesLevel', 'eyeSurgeryStatus', 'eyeSurgeryType', 'eyeSurgeryDetails',
  'careRouteOverride', 'examPaymentType', 'examPaymentMethods', 'creditFatherName', 'creditMotherName', 'creditAuxiliaryPhone',
  'needsTransport', 'companionCount', 'notes'
]);

export function leadFormValues(form) {
  const formData = new FormData(form);
  return {
    ...Object.fromEntries(formData),
    ametropiaIds: formData.getAll('ametropiaIds'),
    pathologyIds: formData.getAll('pathologyIds'),
    examPaymentMethods: formData.getAll('examPaymentMethods')
  };
}

export function captureNewLeadDraft(form) {
  const values = leadFormValues(form);
  return Object.fromEntries(NEW_LEAD_DRAFT_FIELDS
    .filter((name) => Object.hasOwn(values, name))
    .map((name) => [name, values[name]]));
}

export function restoreNewLeadDraft(form, draft = {}) {
  NEW_LEAD_DRAFT_FIELDS.forEach((name) => {
    if (!Object.hasOwn(draft, name) || name === 'appointmentServiceId') return;
    const controls = [...form.querySelectorAll(`[name="${name}"]`)];
    if (!controls.length) return;
    const values = Array.isArray(draft[name]) ? draft[name].map(String) : [String(draft[name] ?? '')];
    controls.forEach((control) => {
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = values.includes(control.value);
      else control.value = values[0];
    });
  });
  if (draft.eyeSurgeryStatus === 'yes' && form.elements.eyeSurgeryType) {
    form.elements.eyeSurgeryType.disabled = false;
    form.elements.eyeSurgeryType.value = draft.eyeSurgeryType || '';
  }
}
