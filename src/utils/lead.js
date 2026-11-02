import { normalizeBrazilianPhone } from './phone.js';
import { isValidCpf, normalizeCpf } from './savwin-matching.js';
import { isTransportAppointmentAllowed } from './schedule.js';

export const INTERESTS = [
  { id: '', label: 'Não informado' },
  { id: 'complete-glasses', label: 'Óculos completo' },
  { id: 'frames', label: 'Armação' },
  { id: 'lenses', label: 'Lentes' },
  { id: 'eye-exam', label: 'Exame de vista' },
  { id: 'other', label: 'Outro' }
];

export const AMETROPIAS = [
  { id: 'myopia', label: 'Miopia' },
  { id: 'hyperopia', label: 'Hipermetropia' },
  { id: 'astigmatism', label: 'Astigmatismo' },
  { id: 'presbyopia', label: 'Presbiopia' },
  { id: 'none', label: 'Não possui' },
  { id: 'unknown', label: 'Não sabe informar' }
];

export const PATHOLOGIES = [
  { id: 'cataract', label: 'Catarata' },
  { id: 'glaucoma', label: 'Glaucoma' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'hypertension', label: 'Pressao alta' },
  { id: 'keratoconus', label: 'Ceratocone' },
  { id: 'retinopathy', label: 'Retinopatia' },
  { id: 'other', label: 'Outra' },
  { id: 'none', label: 'Não possui' },
  { id: 'unknown', label: 'Não sabe informar' }
];

export const SEX_OPTIONS = [
  { id: '', label: 'Não informado' },
  { id: 'female', label: 'Feminino' },
  { id: 'male', label: 'Masculino' }
];

export const EYE_SURGERY_STATUS_OPTIONS = [
  { id: '', label: 'Selecione' },
  { id: 'yes', label: 'Sim' },
  { id: 'no', label: 'Não' },
  { id: 'unknown', label: 'Não sabe informar' }
];

export const EYE_SURGERIES = [
  { id: '', label: 'Selecione' },
  { id: 'cataract', label: 'Catarata' },
  { id: 'refractive', label: 'Cirurgia refrativa (correcao de grau)' },
  { id: 'corneal-transplant', label: 'Transplante de cornea' },
  { id: 'other', label: 'Outra' }
];

export const DIABETES_MEDICAL_ALERT_LEVEL = 150;

export const EXAM_PRICES = Object.freeze({
  optometrist: 150,
  ophthalmologist: 200
});

export const EXAM_PAYMENT_METHODS = Object.freeze([
  { id: 'cash', label: 'Dinheiro' },
  { id: 'pix', label: 'Pix' },
  { id: 'debit-card', label: 'Cartão de débito' },
  { id: 'credit-card', label: 'Cartão de crédito' },
  { id: 'bank-slip', label: 'Boleto' },
  { id: 'other', label: 'Outro' }
]);

export function examPaymentMethodsLabel(values) {
  const requested = Array.isArray(values) ? values : [values].filter(Boolean);
  const labels = requested
    .map((value) => EXAM_PAYMENT_METHODS.find((method) => method.id === String(value))?.label)
    .filter(Boolean);
  return labels.length ? labels.join(' + ') : 'A definir';
}

export function examPricing(careRoute, paymentType = 'paid', settings = {}) {
  const examPaymentType = paymentType === 'courtesy' ? 'courtesy' : 'paid';
  const configuredPrice = Number(careRoute === 'ophthalmologist'
    ? settings.ophthalmologistExamPrice
    : settings.optometristExamPrice);
  const defaultPrice = EXAM_PRICES[careRoute] || EXAM_PRICES.optometrist;
  return {
    examPaymentType,
    examPrice: examPaymentType === 'courtesy'
      ? 0
      : Number.isFinite(configuredPrice) && configuredPrice >= 0 ? configuredPrice : defaultPrice
  };
}

function normalizeAmetropias(values) {
  const requested = Array.isArray(values) ? values : [values].filter(Boolean);
  const validIds = new Set(AMETROPIAS.map((item) => item.id));
  const selected = [...new Set(requested.map(String).filter((id) => validIds.has(id)))];
  if (selected.includes('none')) return ['none'];
  if (selected.includes('unknown')) return ['unknown'];
  return selected;
}

function ametropiaData(input) {
  const ametropiaIds = normalizeAmetropias(input.ametropiaIds);
  return {
    ametropiaIds,
    ametropiaLabels: ametropiaIds.map((id) => AMETROPIAS.find((item) => item.id === id).label)
  };
}

function normalizePathologies(values) {
  const requested = Array.isArray(values) ? values : [values].filter(Boolean);
  const validIds = new Set(PATHOLOGIES.map((item) => item.id));
  const selected = [...new Set(requested.map(String).filter((id) => validIds.has(id)))];
  if (selected.includes('none')) return ['none'];
  if (selected.includes('unknown')) return ['unknown'];
  return selected;
}

function pathologyData(input) {
  const pathologyIds = normalizePathologies(input.pathologyIds);
  return {
    pathologyIds,
    pathologyLabels: pathologyIds.map((id) => PATHOLOGIES.find((item) => item.id === id).label)
  };
}

function normalizeStreetNumber(value) {
  const number = String(value || '').trim();
  return /^s\/?n$/i.test(number) ? 'S/N' : number;
}

function normalizeRg(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function birthMonthDay(birthDate) {
  const birth = parseBirthDate(birthDate);
  if (!birth) return '';
  return `${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}`;
}

export function calculateAge(birthDate, referenceDate = new Date()) {
  const birth = parseBirthDate(birthDate);
  if (!birth || Number.isNaN(referenceDate.getTime())) return null;
  let age = referenceDate.getFullYear() - birth.year;
  const beforeBirthday = referenceDate.getMonth() + 1 < birth.month
    || (referenceDate.getMonth() + 1 === birth.month && referenceDate.getDate() < birth.day);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function booleanValue(value) {
  return value === true || value === 'true';
}

function weekdayFromDate(value) {
  const parsed = parseBirthDate(value);
  return parsed ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay() : null;
}

export function ophthalmologyTriage(input = {}, settings = {}, referenceDate = new Date()) {
  const enabled = settings.ophthalmologyRoutingEnabled === undefined
    ? true
    : booleanValue(settings.ophthalmologyRoutingEnabled);
  const minimumAge = Number.isInteger(Number(settings.ophthalmologyMinimumAge))
    ? Number(settings.ophthalmologyMinimumAge)
    : 55;
  const age = calculateAge(input.birthDate, referenceDate);
  const surgeryQuestionRequired = true;
  const surgeryStatus = EYE_SURGERY_STATUS_OPTIONS.some((item) => item.id === input.eyeSurgeryStatus)
    ? input.eyeSurgeryStatus
    : '';
  const surgeryType = EYE_SURGERIES.some((item) => item.id === input.eyeSurgeryType)
    ? input.eyeSurgeryType
    : '';
  const pathologyCriteria = Array.isArray(settings.ophthalmologyPathologyIds)
    ? settings.ophthalmologyPathologyIds
    : ['cataract'];
  const surgeryCriteria = ['cataract', 'refractive', 'corneal-transplant'];
  const pathologyIds = normalizePathologies(input.pathologyIds);
  const pathologyMatch = pathologyIds.some((id) => pathologyCriteria.includes(id));
  const surgeryMatch = surgeryStatus === 'yes' && surgeryCriteria.includes(surgeryType);
  const override = ['automatic', 'ophthalmologist', 'optometrist'].includes(input.careRouteOverride)
    ? input.careRouteOverride
    : 'automatic';
  const automaticRoute = enabled && (pathologyMatch || surgeryMatch) ? 'ophthalmologist' : 'optometrist';
  const careRoute = override === 'automatic' ? automaticRoute : override;
  const reasons = [];
  if (pathologyMatch) reasons.push('pathology');
  if (surgeryMatch) reasons.push('surgery');
  if (override !== 'automatic') reasons.push('manual');

  return {
    age,
    surgeryQuestionRequired,
    eyeSurgeryStatus: surgeryStatus,
    eyeSurgeryType: surgeryStatus === 'yes' ? surgeryType : '',
    eyeSurgeryDetails: surgeryStatus === 'yes' && surgeryType === 'other'
      ? String(input.eyeSurgeryDetails || '').trim().slice(0, 120)
      : '',
    careRoute,
    careRouteOverride: override,
    careRouteReasons: reasons
  };
}

function diabetesData(input, pathologyIds) {
  const hasDiabetes = pathologyIds.includes('diabetes');
  const rawValue = String(input.diabetesLevel ?? '').trim();
  const value = Number(rawValue);
  const diabetesLevel = hasDiabetes && rawValue !== '' && Number.isInteger(value) ? value : null;
  return {
    hasDiabetes,
    diabetesLevel,
    diabetesNeedsMedicalAlert: diabetesLevel !== null && diabetesLevel > DIABETES_MEDICAL_ALERT_LEVEL
  };
}

export function validateLeadInput(input, options = {}) {
  const errors = {};
  const fullName = input.fullName?.trim() || '';
  const phone = normalizeBrazilianPhone(input.phone);
  const customerCpf = normalizeCpf(input.customerCpf);
  const customerRg = normalizeRg(input.customerRg);
  const birthDate = String(input.birthDate || '').trim();
  const sex = String(input.sex || '').trim();
  const needsTransport = booleanValue(input.needsTransport);
  const maxCompanions = Number(input.maxCompanions ?? 1);
  const requestedCompanionCount = input.companionCount === undefined || input.companionCount === ''
    ? (booleanValue(input.hasCompanion) ? 1 : 0)
    : Number(input.companionCount);
  const companionCount = needsTransport && Number.isInteger(requestedCompanionCount)
    ? requestedCompanionCount
    : 0;
  const hasCompanion = companionCount > 0;
  const diabetes = diabetesData(input, normalizePathologies(input.pathologyIds));

  if (fullName.length < 2) errors.fullName = 'Informe o nome do cliente.';
  if (fullName.length > 120) errors.fullName = 'Use no máximo 120 caracteres.';
  if (!phone) errors.phone = 'Informe um telefone com DDD.';
  if (customerCpf && !isValidCpf(customerCpf)) errors.customerCpf = 'Informe um CPF válido.';
  if (customerRg.length > 20) errors.customerRg = 'Use no máximo 20 caracteres.';
  if (diabetes.hasDiabetes && diabetes.diabetesLevel !== null && (diabetes.diabetesLevel < 20 || diabetes.diabetesLevel > 600)) {
    errors.diabetesLevel = 'Informe um nivel entre 20 e 600 mg/dL.';
  }
  if (!birthDate) {
    if (options.requireBirthDate !== false) errors.birthDate = 'Informe a data de nascimento.';
  } else if (calculateAge(birthDate) === null) {
    errors.birthDate = 'Informe uma data de nascimento válida.';
  }
  if (!SEX_OPTIONS.some((option) => option.id === sex)) errors.sex = 'Selecione uma opção válida.';
  if ((input.street?.trim().length || 0) > 120) errors.street = 'Use no máximo 120 caracteres.';
  if (normalizeStreetNumber(input.streetNumber).length > 12) errors.streetNumber = 'Use no máximo 12 caracteres.';
  if ((input.addressReference?.trim().length || 0) > 160) errors.addressReference = 'Use no máximo 160 caracteres.';
  if ((input.notes?.trim().length || 0) > 500) errors.notes = 'Use no máximo 500 caracteres.';
  if (!Number.isInteger(requestedCompanionCount) || requestedCompanionCount < 0 || requestedCompanionCount > 5) {
    errors.companionCount = 'Informe uma quantidade válida de acompanhantes.';
  } else if (needsTransport && Number.isInteger(maxCompanions) && requestedCompanionCount > maxCompanions) {
    errors.companionCount = `Esta loja permite no máximo ${maxCompanions} acompanhante(s).`;
  }

  const triage = ophthalmologyTriage(input, {
    ophthalmologyRoutingEnabled: input.ophthalmologyRoutingEnabled,
    ophthalmologyMinimumAge: input.ophthalmologyMinimumAge,
    ophthalmologyPathologyIds: input.ophthalmologyPathologyIds,
    ophthalmologySurgeryIds: input.ophthalmologySurgeryIds
  });
  const configuredPricing = examPricing(triage.careRoute, input.examPaymentType, input);
  const requestedExamPrice = Number(input.examPrice);
  const pricing = {
    ...configuredPricing,
    examPrice: configuredPricing.examPaymentType === 'courtesy'
      ? 0
      : Number.isFinite(requestedExamPrice) && requestedExamPrice >= 0 && requestedExamPrice <= 100000
        ? requestedExamPrice
        : configuredPricing.examPrice
  };
  const requestedPaymentMethods = Array.isArray(input.examPaymentMethods)
    ? input.examPaymentMethods.map(String)
    : [input.examPaymentMethods ?? input.examPaymentMethod].filter(Boolean).map(String);
  const validPaymentMethodIds = new Set(EXAM_PAYMENT_METHODS.map((method) => method.id));
  const invalidPaymentMethod = requestedPaymentMethods.some((method) => !validPaymentMethodIds.has(method));
  const examPaymentMethods = pricing.examPaymentType === 'paid'
    ? [...new Set(requestedPaymentMethods.filter((method) => validPaymentMethodIds.has(method)))]
    : [];
  if (pricing.examPaymentType === 'paid' && invalidPaymentMethod) {
    errors.examPaymentMethods = 'Selecione somente formas de pagamento válidas.';
  }
  if (!triage.eyeSurgeryStatus) {
    errors.eyeSurgeryStatus = 'Informe se o cliente já realizou cirurgia nos olhos.';
  }
  if (triage.eyeSurgeryStatus === 'yes' && !triage.eyeSurgeryType) {
    errors.eyeSurgeryType = 'Informe qual cirurgia foi realizada.';
  }
  if (triage.eyeSurgeryStatus === 'yes' && triage.eyeSurgeryType === 'other' && !triage.eyeSurgeryDetails) {
    errors.eyeSurgeryDetails = 'Informe o nome da cirurgia.';
  }

  const appointmentDate = input.appointmentDate?.trim() || '';
  const appointmentTime = input.appointmentTime?.trim() || '';
  if ((appointmentDate && !appointmentTime) || (!appointmentDate && appointmentTime)) {
    errors.appointmentDate = 'Informe a data e o horário do pré-agendamento.';
    errors.appointmentTime = 'Informe a data e o horário do pré-agendamento.';
  }
  if (appointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    errors.appointmentDate = 'Informe uma data válida.';
  }
  if (appointmentTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
    errors.appointmentTime = 'Informe um horário válido.';
  }
  if (input.appointmentServiceId && String(input.appointmentServiceId).length > 120) {
    errors.appointmentServiceId = 'Selecione um serviço válido.';
  }
  if (appointmentDate && !input.appointmentServiceId) {
    errors.appointmentServiceId = 'Selecione o serviço do agendamento.';
  }
  const transportAllowedWeekdays = Array.isArray(input.transportAllowedWeekdays)
    ? input.transportAllowedWeekdays.map(Number)
    : [];
  if (needsTransport && !booleanValue(input.transportEnabled)) {
    errors.needsTransport = 'O transporte ainda não está configurado para esta loja.';
  }
  if (needsTransport && appointmentDate && !transportAllowedWeekdays.includes(weekdayFromDate(appointmentDate))) {
    errors.appointmentDate = 'Escolha um dia com transporte disponível.';
  }
  if (needsTransport && appointmentDate && appointmentTime && Array.isArray(input.transportHoursRules)
    && !isTransportAppointmentAllowed({
      transportEnabled: booleanValue(input.transportEnabled),
      transportHoursRules: input.transportHoursRules
    }, appointmentDate, appointmentTime, Number(input.appointmentDurationMinutes) || 20)) {
    errors.appointmentTime = 'Escolha um horário dentro da disponibilidade do transporte.';
  }
  const allowedWeekdays = Array.isArray(input.ophthalmologyAllowedWeekdays)
    ? input.ophthalmologyAllowedWeekdays.map(Number)
    : [];
  if (triage.careRoute === 'ophthalmologist' && appointmentDate && allowedWeekdays.length
    && !allowedWeekdays.includes(weekdayFromDate(appointmentDate))) {
    errors.appointmentDate = 'Escolha um dia de atendimento do oftalmologista.';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    phone,
    customerCpf,
    customerRg,
    birthDate,
    sex,
    needsTransport,
    hasCompanion,
    companionCount,
    transportSeats: needsTransport ? companionCount + 1 : 0,
    diabetes,
    triage,
    pricing,
    examPaymentMethods
  };
}

export function validateQuickLeadInput(input = {}) {
  const errors = {};
  const fullName = String(input.fullName || '').trim();
  const phone = normalizeBrazilianPhone(input.phone);
  const customerCpf = normalizeCpf(input.customerCpf);

  if (fullName.length < 2) errors.fullName = 'Informe o nome do cliente.';
  if (fullName.length > 120) errors.fullName = 'Use no maximo 120 caracteres.';
  if (!phone) errors.phone = 'Informe um telefone com DDD.';
  if (customerCpf && !isValidCpf(customerCpf)) errors.customerCpf = 'Informe um CPF valido.';

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    fullName,
    phone,
    customerCpf
  };
}

export function createQuickLeadDocument(input, profile, installationId, now = new Date()) {
  const validation = validateQuickLeadInput(input);
  if (!validation.isValid) return { ...validation, data: null };

  const careRoute = input.professionalType === 'ophthalmologist' ? 'ophthalmologist' : 'optometrist';
  return {
    errors: {},
    isValid: true,
    data: {
      fullName: validation.fullName,
      preferredName: '',
      phone: validation.phone.e164,
      phoneSearch: validation.phone.search,
      customerCpf: validation.customerCpf,
      customerRg: '',
      birthDate: '',
      birthMonthDay: '',
      sex: '',
      street: '',
      streetNumber: '',
      neighborhood: '',
      city: '',
      state: 'PE',
      addressReference: '',
      interestId: 'eye-exam',
      interestLabel: 'Exame de vista',
      ametropiaIds: ['unknown'],
      pathologyIds: ['unknown'],
      diabetesLevel: null,
      diabetesNeedsMedicalAlert: false,
      eyeSurgeryStatus: '',
      eyeSurgeryType: '',
      eyeSurgeryDetails: '',
      careRoute,
      careRouteOverride: careRoute,
      careRouteReasons: ['manual'],
      examPaymentType: 'paid',
      examPaymentMethods: [],
      examPrice: EXAM_PRICES[careRoute],
      needsTransport: false,
      hasCompanion: false,
      companionCount: 0,
      transportSeats: 0,
      appointmentDate: '',
      appointmentTime: '',
      funnelStage: 'awaiting_appointment',
      funnelReasonCode: '',
      funnelUpdatedAtClient: now.toISOString(),
      appointmentCycle: 0,
      appointmentSchedulingMode: 'free',
      appointmentDurationMinutes: Number(input.appointmentDurationMinutes) || 20,
      appointmentServiceId: String(input.serviceId || '').trim(),
      appointmentServiceName: String(input.serviceName || 'Exame de vista').trim().slice(0, 80),
      notes: String(input.notes || '').trim().slice(0, 500),
      registrationMode: 'quick_walk_in',
      registrationCompleted: false,
      source: 'street',
      capturedAtClient: now.toISOString(),
      capturedByUid: profile.uid,
      capturedByName: profile.displayName,
      storeId: profile.storeId,
      installationId,
      appVersion: '0.1.0',
      schemaVersion: 1
    }
  };
}

export function createLeadDocument(input, profile, installationId, now = new Date()) {
  const validation = validateLeadInput(input, { requireBirthDate: true });
  if (!validation.isValid) return { ...validation, data: null };

  const interest = INTERESTS.find((item) => item.id === input.interestId) || INTERESTS[0];

  return {
    errors: {},
    isValid: true,
    data: {
      fullName: input.fullName.trim(),
      preferredName: input.preferredName?.trim() || '',
      phone: validation.phone.e164,
      phoneSearch: validation.phone.search,
      customerCpf: validation.customerCpf,
      customerRg: validation.customerRg,
      birthDate: validation.birthDate,
      birthMonthDay: birthMonthDay(validation.birthDate),
      sex: validation.sex,
      street: input.street?.trim() || '',
      streetNumber: normalizeStreetNumber(input.streetNumber),
      neighborhood: input.neighborhood?.trim() || '',
      city: input.city?.trim() || '',
      state: (input.state?.trim() || 'PE').toUpperCase().slice(0, 2),
      addressReference: input.addressReference?.trim() || '',
      interestId: interest.id,
      interestLabel: interest.id ? interest.label : '',
      ...ametropiaData(input),
      ...pathologyData(input),
      diabetesLevel: validation.diabetes.diabetesLevel,
      diabetesNeedsMedicalAlert: validation.diabetes.diabetesNeedsMedicalAlert,
      eyeSurgeryStatus: validation.triage.eyeSurgeryStatus,
      eyeSurgeryType: validation.triage.eyeSurgeryType,
      eyeSurgeryDetails: validation.triage.eyeSurgeryDetails,
      careRoute: validation.triage.careRoute,
      careRouteOverride: validation.triage.careRouteOverride,
      careRouteReasons: Array.isArray(input.careRouteReasons) ? input.careRouteReasons : [],
      examPaymentType: validation.pricing.examPaymentType,
      examPaymentMethods: validation.examPaymentMethods,
      examPrice: validation.pricing.examPrice,
      needsTransport: validation.needsTransport,
      hasCompanion: validation.hasCompanion,
      companionCount: validation.companionCount,
      transportSeats: validation.transportSeats,
      appointmentDate: input.appointmentDate?.trim() || '',
      appointmentTime: input.appointmentTime?.trim() || '',
      funnelStage: input.appointmentDate?.trim() ? 'scheduled' : 'awaiting_appointment',
      funnelReasonCode: '',
      funnelUpdatedAtClient: now.toISOString(),
      appointmentCycle: input.appointmentDate?.trim() ? 1 : 0,
      appointmentSchedulingMode: input.schedulingMode === 'free' ? 'free' : 'controlled',
      appointmentDurationMinutes: Number(input.appointmentDurationMinutes) || 20,
      ...(input.appointmentDate?.trim() ? { appointmentAttendance: 'pending' } : {}),
      ...(input.appointmentServiceId ? {
        appointmentServiceId: String(input.appointmentServiceId),
        appointmentServiceName: String(input.appointmentServiceName || 'Exame de vista').trim().slice(0, 80)
      } : {}),
      notes: input.notes?.trim() || '',
      source: 'street',
      capturedAtClient: now.toISOString(),
      capturedByUid: profile.uid,
      capturedByName: profile.displayName,
      storeId: profile.storeId,
      installationId,
      appVersion: '0.1.0',
      schemaVersion: 1
    }
  };
}

export function createLeadUpdate(input) {
  const validation = validateLeadInput(input, { requireBirthDate: false });
  if (!validation.isValid) return { ...validation, data: null };

  const interest = INTERESTS.find((item) => item.id === input.interestId) || INTERESTS[0];
  return {
    errors: {},
    isValid: true,
    data: {
      fullName: input.fullName.trim(),
      preferredName: input.preferredName?.trim() || '',
      phone: validation.phone.e164,
      phoneSearch: validation.phone.search,
      customerCpf: validation.customerCpf,
      customerRg: validation.customerRg,
      birthDate: validation.birthDate,
      birthMonthDay: birthMonthDay(validation.birthDate),
      sex: validation.sex,
      street: input.street?.trim() || '',
      streetNumber: normalizeStreetNumber(input.streetNumber),
      neighborhood: input.neighborhood?.trim() || '',
      city: input.city?.trim() || '',
      state: (input.state?.trim() || 'PE').toUpperCase().slice(0, 2),
      addressReference: input.addressReference?.trim() || '',
      interestId: interest.id,
      interestLabel: interest.id ? interest.label : '',
      ...ametropiaData(input),
      ...pathologyData(input),
      diabetesLevel: validation.diabetes.diabetesLevel,
      diabetesNeedsMedicalAlert: validation.diabetes.diabetesNeedsMedicalAlert,
      eyeSurgeryStatus: validation.triage.eyeSurgeryStatus,
      eyeSurgeryType: validation.triage.eyeSurgeryType,
      eyeSurgeryDetails: validation.triage.eyeSurgeryDetails,
      careRoute: validation.triage.careRoute,
      careRouteOverride: validation.triage.careRouteOverride,
      examPaymentType: validation.pricing.examPaymentType,
      examPaymentMethods: validation.examPaymentMethods,
      examPrice: validation.pricing.examPrice,
      needsTransport: validation.needsTransport,
      hasCompanion: validation.hasCompanion,
      companionCount: validation.companionCount,
      transportSeats: validation.transportSeats,
      appointmentDate: input.appointmentDate?.trim() || '',
      appointmentTime: input.appointmentTime?.trim() || '',
      appointmentSchedulingMode: input.schedulingMode === 'free' ? 'free' : 'controlled',
      appointmentDurationMinutes: Number(input.appointmentDurationMinutes) || 20,
      ...(input.appointmentServiceId ? {
        appointmentServiceId: String(input.appointmentServiceId),
        appointmentServiceName: String(input.appointmentServiceName || 'Exame de vista').trim().slice(0, 80)
      } : {}),
      notes: input.notes?.trim() || ''
    }
  };
}
