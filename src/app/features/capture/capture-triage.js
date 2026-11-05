import {
  AMETROPIAS,
  EXAM_PAYMENT_METHODS,
  EYE_SURGERIES,
  EYE_SURGERY_STATUS_OPTIONS,
  PATHOLOGIES,
  SEX_OPTIONS,
  DIABETES_MEDICAL_ALERT_LEVEL,
  examPricing,
  ophthalmologyTriage
} from '../../../utils/lead.js';
import { DEFAULT_STORE_SCHEDULE } from '../../../utils/schedule.js';
import { escapeHtml } from '../../shared/formatters.js';
import { leadFormValues } from './capture-form.js';

export function ametropiaOptions(selectedIds = []) {
  return AMETROPIAS.map((item) => `<label class="ametropia-option checkbox-label">
    <input type="checkbox" name="ametropiaIds" value="${item.id}" ${selectedIds.includes(item.id) ? 'checked' : ''} />
    <span>${item.label}</span>
  </label>`).join('');
}

export function pathologyOptions(selectedIds = []) {
  return PATHOLOGIES.map((item) => `<label class="ametropia-option checkbox-label">
    <input type="checkbox" name="pathologyIds" value="${item.id}" ${selectedIds.includes(item.id) ? 'checked' : ''} />
    <span>${item.label}</span>
  </label>`).join('');
}

export function sexOptions(selectedId = '') {
  return SEX_OPTIONS.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.label}</option>`).join('');
}

function eyeSurgeryStatusOptions(selectedId = '') {
  return EYE_SURGERY_STATUS_OPTIONS.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.label}</option>`).join('');
}

function eyeSurgeryOptions(selectedId = '') {
  return EYE_SURGERIES.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.label}</option>`).join('');
}

export function triageConfigFields(settings) {
  return `<input name="ophthalmologyRoutingEnabled" type="hidden" value="${settings.ophthalmologyRoutingEnabled}" />
    <input name="ophthalmologyMinimumAge" type="hidden" value="${settings.ophthalmologyMinimumAge}" />
    <input name="optometristExamPrice" type="hidden" value="${settings.optometristExamPrice}" />
    <input name="ophthalmologistExamPrice" type="hidden" value="${settings.ophthalmologistExamPrice}" />
    <input name="transportEnabled" type="hidden" value="${settings.transportEnabled}" />
    <input name="maxCompanions" type="hidden" value="${settings.maxCompanions}" />
    <input name="transportAllowedWeekdays" type="hidden" value="${escapeHtml(JSON.stringify(settings.transportHoursRules.map((rule) => rule.weekday)))}" />`;
}

export function eyeTriageFields(values = {}, settings = DEFAULT_STORE_SCHEDULE, idPrefix = 'eye') {
  const triage = ophthalmologyTriage(values, settings);
  const configuredPricing = examPricing(triage.careRoute, values.examPaymentType, settings);
  const storedExamPrice = Number(values.examPrice);
  const pricing = {
    ...configuredPricing,
    examPrice: configuredPricing.examPaymentType === 'courtesy'
      ? 0
      : Number.isFinite(storedExamPrice) && values.examPrice !== ''
        ? storedExamPrice
        : values.id ? examPricing(triage.careRoute, values.examPaymentType).examPrice : configuredPricing.examPrice
  };
  const selectedPaymentMethods = Array.isArray(values.examPaymentMethods)
    ? values.examPaymentMethods
    : [values.examPaymentMethod].filter(Boolean);
  const selectedProductPaymentMethods = Array.isArray(values.productPaymentMethods)
    ? values.productPaymentMethods
    : [];
  const showCreditFields = (pricing.examPaymentType === 'paid' && selectedPaymentMethods.includes('bank-slip'))
    || selectedProductPaymentMethods.includes('bank-slip');
  const paymentMethodOptions = EXAM_PAYMENT_METHODS.map((method) => `<label class="ametropia-option checkbox-label">
    <input type="checkbox" name="examPaymentMethods" value="${method.id}" ${selectedPaymentMethods.includes(method.id) ? 'checked' : ''} ${pricing.examPaymentType === 'courtesy' ? 'disabled' : ''} />
    <span>${method.label}</span>
  </label>`).join('');
  const showSurgeryType = values.eyeSurgeryStatus === 'yes';
  const hasDiabetes = (values.pathologyIds || []).includes('diabetes');
  const diabetesLevel = Number(values.diabetesLevel);
  const diabetesAlert = hasDiabetes && Number.isFinite(diabetesLevel) && diabetesLevel > DIABETES_MEDICAL_ALERT_LEVEL;
  return `<section class="eye-triage-section" data-eye-triage data-initial-care-route="${triage.careRoute}" data-initial-payment-type="${pricing.examPaymentType}" data-initial-exam-price="${pricing.examPrice}" data-preserve-exam-price="${Boolean(values.id)}">
    <input type="hidden" name="examPrice" value="${pricing.examPrice}" data-exam-price-value />
    <div class="field" data-field="diabetesLevel" data-diabetes-level ${hasDiabetes ? '' : 'hidden'}>
      <label for="${idPrefix}-diabetes-level">Nivel de glicemia (mg/dL)</label>
      <input id="${idPrefix}-diabetes-level" name="diabetesLevel" type="number" inputmode="numeric" min="20" max="600" step="1" value="${hasDiabetes && values.diabetesLevel !== null && values.diabetesLevel !== undefined ? escapeHtml(values.diabetesLevel) : ''}" placeholder="Ex.: 150" />
      <small class="field-help">Opcional na captação. Registrar quando a medição for feita no atendimento.</small><small class="field-error"></small>
    </div>
    <div class="notice notice-warning" data-diabetes-medical-alert ${diabetesAlert ? '' : 'hidden'}><i data-lucide="triangle-alert"></i><span>Glicemia acima de ${DIABETES_MEDICAL_ALERT_LEVEL} mg/dL: avisar o medico antes do exame.</span></div>
    <div class="field-row eye-surgery-fields" data-eye-surgery-question>
      <div class="field" data-field="eyeSurgeryStatus">
        <label for="${idPrefix}-surgery-status">Já realizou cirurgia nos olhos? <span aria-hidden="true">*</span></label>
        <select id="${idPrefix}-surgery-status" name="eyeSurgeryStatus">${eyeSurgeryStatusOptions(values.eyeSurgeryStatus || '')}</select>
        <small class="field-help">Informacao obrigatoria para todos os clientes.</small>
        <small class="field-error"></small>
      </div>
      <div class="field eye-surgery-dependent ${showSurgeryType ? '' : 'is-disabled'}" data-field="eyeSurgeryType" data-eye-surgery-type>
        <label for="${idPrefix}-surgery-type">Qual cirurgia? <span aria-hidden="true">*</span></label>
        <select id="${idPrefix}-surgery-type" name="eyeSurgeryType" ${showSurgeryType ? '' : 'disabled'}>${eyeSurgeryOptions(values.eyeSurgeryType || '')}</select>
        <small class="field-error"></small>
      </div>
      <div class="field" data-field="eyeSurgeryDetails" data-eye-surgery-details ${showSurgeryType && values.eyeSurgeryType === 'other' ? '' : 'hidden'}>
        <label for="${idPrefix}-surgery-details">Nome da cirurgia <span aria-hidden="true">*</span></label>
        <input id="${idPrefix}-surgery-details" name="eyeSurgeryDetails" maxlength="120" value="${escapeHtml(values.eyeSurgeryDetails || '')}" placeholder="Informe a cirurgia" />
        <small class="field-error"></small>
      </div>
    </div>
    <div class="field-row exam-billing-fields">
      <div class="field eye-route-override"><label for="${idPrefix}-care-route">Encaminhamento</label><input type="hidden" name="careRouteOverride" value="${escapeHtml(triage.careRouteOverride)}" /><select id="${idPrefix}-care-route" name="careRouteSelection"><option value="optometrist" ${triage.careRoute === 'optometrist' ? 'selected' : ''}>Optometrista</option><option value="ophthalmologist" ${triage.careRoute === 'ophthalmologist' ? 'selected' : ''}>Oftalmologista</option></select></div>
      <div class="field"><label for="${idPrefix}-exam-payment">Tipo do exame</label><select id="${idPrefix}-exam-payment" name="examPaymentType"><option value="paid" ${values.examPaymentType !== 'courtesy' ? 'selected' : ''}>Exame pago</option><option value="courtesy" ${values.examPaymentType === 'courtesy' ? 'selected' : ''}>Cortesia</option></select></div>
      <div class="field exam-price-field"><span class="exam-price-label">Valor do exame</span><div class="exam-price-display"><strong data-exam-price>${pricing.examPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><small data-exam-price-detail>${triage.careRoute === 'ophthalmologist' ? 'Oftalmologista' : 'Optometrista'}</small></div></div>
    </div>
    <div class="field-row exam-payment-method-row" data-exam-payment-method-row ${pricing.examPaymentType === 'courtesy' ? 'hidden' : ''}>
      <fieldset class="field ametropia-field exam-payment-method-field" data-field="examPaymentMethods"><legend>Forma de pagamento do exame</legend><small>Marque todas as formas que serão utilizadas.</small><div class="ametropia-options exam-payment-method-options">${paymentMethodOptions}</div><small class="field-error"></small></fieldset>
    </div>
    <div class="field-row credit-details-fields" data-credit-details-fields ${showCreditFields ? '' : 'hidden'}>
      <div class="field" data-field="creditFatherName"><label for="${idPrefix}-credit-father-name">Nome do pai (opcional)</label><input id="${idPrefix}-credit-father-name" name="creditFatherName" maxlength="120" autocomplete="off" value="${escapeHtml(values.creditFatherName || '')}" ${showCreditFields ? '' : 'disabled'} /><small class="field-error"></small></div>
      <div class="field" data-field="creditMotherName"><label for="${idPrefix}-credit-mother-name">Nome da mãe (opcional)</label><input id="${idPrefix}-credit-mother-name" name="creditMotherName" maxlength="120" autocomplete="off" value="${escapeHtml(values.creditMotherName || '')}" ${showCreditFields ? '' : 'disabled'} /><small class="field-error"></small></div>
      <div class="field" data-field="creditAuxiliaryPhone"><label for="${idPrefix}-credit-auxiliary-phone">Telefone auxiliar (opcional)</label><input id="${idPrefix}-credit-auxiliary-phone" name="creditAuxiliaryPhone" type="tel" inputmode="numeric" maxlength="16" autocomplete="tel" placeholder="(00) 00000-0000" value="${escapeHtml(values.creditAuxiliaryPhone || '')}" ${showCreditFields ? '' : 'disabled'} /><small class="field-error"></small></div>
    </div>
    <div class="eye-route-status ${triage.careRoute === 'ophthalmologist' ? 'is-ophthalmology' : ''}" data-eye-route-status ${triage.careRoute === 'ophthalmologist' ? '' : 'hidden'}><i data-lucide="stethoscope"></i><span>Encaminhamento para oftalmologista. A agenda mostrará somente os dias configurados.</span></div>
  </section>`;
}

export function enrichLeadTriage(values, settings) {
  const triage = ophthalmologyTriage(values, settings);
  const configuredPricing = examPricing(triage.careRoute, values.examPaymentType, settings);
  const storedExamPrice = Number(values.examPrice);
  const pricing = {
    ...configuredPricing,
    examPrice: configuredPricing.examPaymentType === 'courtesy'
      ? 0
      : Number.isFinite(storedExamPrice) && storedExamPrice >= 0 ? storedExamPrice : configuredPricing.examPrice
  };
  return {
    ...values,
    ophthalmologyRoutingEnabled: settings.ophthalmologyRoutingEnabled,
    ophthalmologyMinimumAge: settings.ophthalmologyMinimumAge,
    ophthalmologyPathologyIds: settings.ophthalmologyPathologyIds,
    ophthalmologySurgeryIds: settings.ophthalmologySurgeryIds,
    ophthalmologyAllowedWeekdays: settings.ophthalmologyWeekdays,
    transportEnabled: settings.transportEnabled,
    maxCompanions: settings.maxCompanions,
    transportAllowedWeekdays: settings.transportHoursRules.map((rule) => rule.weekday),
    transportHoursRules: settings.transportHoursRules,
    eyeSurgeryStatus: triage.eyeSurgeryStatus,
    eyeSurgeryType: triage.eyeSurgeryType,
    eyeSurgeryDetails: triage.eyeSurgeryDetails,
    careRoute: triage.careRoute,
    careRouteOverride: triage.careRouteOverride,
    careRouteReasons: triage.careRouteReasons,
    examPaymentType: pricing.examPaymentType,
    examPrice: pricing.examPrice
  };
}

export function bindEyeTriage(form, settings, onChange = () => {}) {
  const section = form.querySelector('[data-eye-triage]');
  if (!section) return;
  const refresh = () => {
    const values = leadFormValues(form);
    const triage = ophthalmologyTriage(values, settings);
    const question = section.querySelector('[data-eye-surgery-question]');
    const typeField = section.querySelector('[data-eye-surgery-type]');
    const detailsField = section.querySelector('[data-eye-surgery-details]');
    const routeStatus = section.querySelector('[data-eye-route-status]');
    const price = section.querySelector('[data-exam-price]');
    const priceDetail = section.querySelector('[data-exam-price-detail]');
    question.hidden = false;
    const surgeryTypeEnabled = values.eyeSurgeryStatus === 'yes';
    typeField.classList.toggle('is-disabled', !surgeryTypeEnabled);
    form.elements.eyeSurgeryType.disabled = !surgeryTypeEnabled;
    detailsField.hidden = values.eyeSurgeryStatus !== 'yes' || values.eyeSurgeryType !== 'other';
    form.elements.eyeSurgeryStatus.required = true;
    form.elements.eyeSurgeryType.required = surgeryTypeEnabled;
    form.elements.eyeSurgeryDetails.required = values.eyeSurgeryStatus === 'yes' && values.eyeSurgeryType === 'other';
    const hasDiabetes = values.pathologyIds.includes('diabetes');
    const diabetesField = section.querySelector('[data-diabetes-level]');
    const diabetesInput = form.elements.diabetesLevel;
    const diabetesAlert = section.querySelector('[data-diabetes-medical-alert]');
    diabetesField.hidden = !hasDiabetes;
    diabetesInput.required = false;
    if (!hasDiabetes) diabetesInput.value = '';
    diabetesAlert.hidden = !hasDiabetes || Number(diabetesInput.value) <= DIABETES_MEDICAL_ALERT_LEVEL;
    routeStatus.hidden = triage.careRoute !== 'ophthalmologist';
    routeStatus.classList.toggle('is-ophthalmology', triage.careRoute === 'ophthalmologist');
    const routeSelection = form.elements.careRouteSelection;
    if (routeSelection) routeSelection.value = triage.careRoute;
    const configuredPricing = examPricing(triage.careRoute, values.examPaymentType, settings);
    const preservePrice = section.dataset.preserveExamPrice === 'true'
      && triage.careRoute === section.dataset.initialCareRoute
      && configuredPricing.examPaymentType === section.dataset.initialPaymentType;
    const pricing = {
      ...configuredPricing,
      examPrice: preservePrice ? Number(section.dataset.initialExamPrice) : configuredPricing.examPrice
    };
    const paymentMethodRow = section.querySelector('[data-exam-payment-method-row]');
    const paymentMethodInputs = [...form.querySelectorAll('[name="examPaymentMethods"]')];
    const creditDetailsFields = section.querySelector('[data-credit-details-fields]');
    const creditInputs = [...form.querySelectorAll('[name="creditFatherName"], [name="creditMotherName"], [name="creditAuxiliaryPhone"]')];
    const isCourtesy = pricing.examPaymentType === 'courtesy';
    paymentMethodRow.hidden = isCourtesy;
    paymentMethodInputs.forEach((input) => {
      input.disabled = isCourtesy;
      if (isCourtesy) input.checked = false;
    });
    const usesStoreCredit = (!isCourtesy && paymentMethodInputs.some((input) => input.value === 'bank-slip' && input.checked))
      || [...form.querySelectorAll('[name="productPaymentMethods"]')]
        .some((input) => !input.disabled && input.value === 'bank-slip' && input.checked);
    creditDetailsFields.hidden = !usesStoreCredit;
    creditInputs.forEach((input) => {
      input.disabled = !usesStoreCredit;
      input.required = false;
      if (!usesStoreCredit) input.value = '';
    });
    price.textContent = pricing.examPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    section.querySelector('[data-exam-price-value]').value = String(pricing.examPrice);
    priceDetail.textContent = pricing.examPaymentType === 'courtesy'
      ? 'Cortesia'
      : triage.careRoute === 'ophthalmologist' ? 'Oftalmologista' : 'Optometrista';
    onChange(values, triage);
  };
  form.elements.birthDate?.addEventListener('input', refresh);
  form.elements.eyeSurgeryStatus?.addEventListener('change', refresh);
  form.elements.eyeSurgeryType?.addEventListener('change', refresh);
  form.elements.careRouteSelection?.addEventListener('change', (event) => {
    form.elements.careRouteOverride.value = event.target.value;
    refresh();
  });
  form.elements.examPaymentType?.addEventListener('change', refresh);
  form.querySelectorAll('[name="examPaymentMethods"]').forEach((input) => input.addEventListener('change', refresh));
  form.elements.interestId?.addEventListener('change', refresh);
  form.querySelectorAll('[name="productPaymentMethods"]').forEach((input) => input.addEventListener('change', refresh));
  form.querySelectorAll('[name="pathologyIds"]').forEach((input) => input.addEventListener('change', refresh));
  refresh();
}
