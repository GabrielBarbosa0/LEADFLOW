import { describe, expect, it } from 'vitest';
import { birthMonthDay, calculateAge, createLeadDocument, createLeadUpdate, createQuickLeadDocument, examPricing, ophthalmologyTriage, validateLeadInput, validateQuickLeadInput } from '../../src/utils/lead.js';

const validInput = {
  fullName: 'Cliente Exemplo',
  phone: '(81) 99999-1234',
  customerRg: '12.345.678-x',
  customerCpf: '529.982.247-25',
  birthDate: '1985-04-12',
  sex: 'female',
  preferredName: '',
  street: 'Rua das Flores',
  streetNumber: 'SN',
  neighborhood: '',
  city: '',
  state: 'PE',
  addressReference: 'Em frente à praça',
  interestId: 'complete-glasses',
  ametropiaIds: ['myopia', 'astigmatism'],
  pathologyIds: ['glaucoma', 'diabetes'],
  diabetesLevel: '150',
  eyeSurgeryStatus: 'no',
  eyeSurgeryType: '',
  eyeSurgeryDetails: '',
  appointmentDate: '2026-10-02',
  appointmentTime: '14:30',
  appointmentServiceId: 'service-eye-exam',
  appointmentServiceName: 'Exame de vista',
  appointmentDurationMinutes: 30,
  schedulingMode: 'controlled',
  examPaymentMethods: ['pix', 'cash'],
  notes: ''
};

const profile = {
  uid: 'user-test',
  displayName: 'Usuario de Teste',
  storeId: 'store-test'
};

describe('lead validation', () => {
  it('requires name and phone', () => {
    const result = validateLeadInput({ fullName: '', phone: '' });

    expect(result.isValid).toBe(false);
    expect(result.errors).toMatchObject({
      fullName: expect.any(String),
      phone: expect.any(String)
    });
  });

  it('rejects notes longer than 500 characters', () => {
    const result = validateLeadInput({ ...validInput, notes: 'a'.repeat(501) });
    expect(result.errors.notes).toBeDefined();
  });

  it('accepts an empty CPF and rejects an invalid one', () => {
    expect(validateLeadInput({ ...validInput, customerCpf: '' }).isValid).toBe(true);
    const result = validateLeadInput({ ...validInput, customerCpf: '111.111.111-11' });
    expect(result.errors.customerCpf).toBeDefined();
  });

  it('normalizes an optional RG and limits its length', () => {
    expect(createLeadUpdate(validInput).data.customerRg).toBe('12.345.678-X');
    expect(validateLeadInput({ ...validInput, customerRg: '1'.repeat(21) }).errors.customerRg).toBeDefined();
  });

  it('creates an explicitly incomplete quick walk-in registration without inventing clinical data', () => {
    const input = {
      fullName: 'Cliente de Encaixe',
      phone: '(81) 99999-4321',
      customerCpf: '529.982.247-25',
      professionalType: 'optometrist',
      serviceId: 'eye-exam',
      serviceName: 'Exame de vista',
      notes: 'Chegou sem agendamento'
    };
    expect(validateQuickLeadInput(input).isValid).toBe(true);
    const result = createQuickLeadDocument(input, profile, 'installation-test', new Date('2026-10-30T12:00:00Z'));
    expect(result.data).toMatchObject({
      fullName: 'Cliente de Encaixe',
      customerCpf: '52998224725',
      birthDate: '',
      sex: '',
      registrationMode: 'quick_walk_in',
      registrationCompleted: false,
      appointmentDate: '',
      appointmentTime: ''
    });
    expect(result.data.pathologyIds).toEqual(['unknown']);
  });

  it('limits the address reference to 160 characters', () => {
    expect(validateLeadInput({ ...validInput, addressReference: 'a'.repeat(161) }).errors.addressReference).toBeDefined();
  });

  it('allows an omitted diabetes measurement and flags values above 150 mg/dL', () => {
    expect(validateLeadInput({ ...validInput, diabetesLevel: '' }).errors.diabetesLevel).toBeUndefined();
    const result = createLeadDocument({ ...validInput, diabetesLevel: '151' }, profile, 'installation-test');
    expect(result.data).toMatchObject({ diabetesLevel: 151, diabetesNeedsMedicalAlert: true });
    expect(createLeadDocument({ ...validInput, pathologyIds: [], diabetesLevel: '151' }, profile, 'installation-test').data)
      .toMatchObject({ diabetesLevel: null, diabetesNeedsMedicalAlert: false });
  });

  it('routes refractive and corneal transplant surgeries to ophthalmology', () => {
    expect(ophthalmologyTriage({ ...validInput, eyeSurgeryStatus: 'yes', eyeSurgeryType: 'refractive' }).careRoute)
      .toBe('ophthalmologist');
    expect(ophthalmologyTriage({ ...validInput, eyeSurgeryStatus: 'yes', eyeSurgeryType: 'corneal-transplant' }).careRoute)
      .toBe('ophthalmologist');
  });

  it('defaults the route to optometry and allows a manual optometry override', () => {
    expect(ophthalmologyTriage(validInput).careRoute).toBe('optometrist');
    const manualOverride = ophthalmologyTriage({
      ...validInput,
      pathologyIds: ['cataract'],
      careRouteOverride: 'optometrist'
    });
    expect(manualOverride).toMatchObject({
      careRoute: 'optometrist',
      careRouteOverride: 'optometrist',
      careRouteReasons: ['pathology', 'manual']
    });
  });

  it('requires a valid birth date and rejects a future date', () => {
    expect(calculateAge('2000-11-10', new Date(2026, 9, 21))).toBe(25);
    expect(calculateAge('2000-10-10', new Date(2026, 9, 21))).toBe(26);
    expect(validateLeadInput({ ...validInput, birthDate: '2999-01-01' }).errors.birthDate).toBeDefined();
    expect(validateLeadInput({ ...validInput, birthDate: '' }).errors.birthDate).toBe('Informe a data de nascimento.');
    expect(createLeadUpdate({ ...validInput, birthDate: '' }).isValid).toBe(true);
  });

  it('accepts known sex options and rejects unknown values', () => {
    expect(validateLeadInput({ ...validInput, sex: 'male' }).isValid).toBe(true);
    expect(validateLeadInput({ ...validInput, sex: '' }).isValid).toBe(true);
    expect(validateLeadInput({ ...validInput, sex: 'invalid' }).errors.sex).toBeDefined();
  });

  it('requires date and time together for a pre-appointment', () => {
    const result = validateLeadInput({
      ...validInput,
      appointmentTime: ''
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.appointmentDate).toBeDefined();
    expect(result.errors.appointmentTime).toBeDefined();
  });

  it('stores the birthday month and day without exposing the birth year', () => {
    expect(birthMonthDay('1985-04-12')).toBe('04-12');
    expect(createLeadDocument(validInput, profile, 'installation-test').data.birthMonthDay).toBe('04-12');
  });

  it('requires a service when scheduling a registration', () => {
    const result = validateLeadInput({
      ...validInput,
      appointmentServiceId: '',
      appointmentServiceName: ''
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.appointmentServiceId).toBe('Selecione o serviço do agendamento.');
  });

  it('creates the expected versioned document', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const result = createLeadDocument(validInput, profile, 'installation-test', now);

    expect(result.isValid).toBe(true);
    expect(result.data).toMatchObject({
      fullName: 'Cliente Exemplo',
      phone: '+5581999991234',
      phoneSearch: '81999991234',
      customerCpf: '52998224725',
      customerRg: '12.345.678-X',
      birthDate: '1985-04-12',
      sex: 'female',
      street: 'Rua das Flores',
      streetNumber: 'S/N',
      addressReference: 'Em frente à praça',
      appointmentDate: '2026-10-02',
      appointmentTime: '14:30',
      funnelStage: 'scheduled',
      appointmentCycle: 1,
      appointmentAttendance: 'pending',
      appointmentServiceId: 'service-eye-exam',
      appointmentServiceName: 'Exame de vista',
      appointmentDurationMinutes: 30,
      ametropiaIds: ['myopia', 'astigmatism'],
      ametropiaLabels: ['Miopia', 'Astigmatismo'],
      pathologyIds: ['glaucoma', 'diabetes'],
      pathologyLabels: ['Glaucoma', 'Diabetes'],
      diabetesLevel: 150,
      diabetesNeedsMedicalAlert: false,
      examPaymentType: 'paid',
      examPaymentMethods: ['pix', 'cash'],
      examPrice: 150,
      source: 'street',
      capturedAtClient: '2026-09-28T12:00:00.000Z',
      capturedByUid: 'user-test',
      storeId: 'store-test',
      installationId: 'installation-test',
      schemaVersion: 1
    });
    expect(result.data).not.toHaveProperty('consentGiven');
    expect(result.data).not.toHaveProperty('consentAtClient');
  });

  it('stores transport customers and companions as separate seat counts', () => {
    const result = createLeadDocument({
      ...validInput,
      needsTransport: 'true',
      hasCompanion: 'true',
      transportEnabled: true,
      transportAllowedWeekdays: [5]
    }, profile, 'installation-test');

    expect(result.isValid).toBe(true);
    expect(result.data).toMatchObject({
      needsTransport: true,
      hasCompanion: true,
      companionCount: 1,
      transportSeats: 2
    });
  });

  it('stores the configured consultation price as a lead snapshot', () => {
    const result = createLeadDocument({
      ...validInput,
      pathologyIds: [],
      optometristExamPrice: 300,
      examPrice: 300
    }, profile, 'installation-test');

    expect(result.data.examPrice).toBe(300);
    expect(createLeadUpdate({ ...validInput, pathologyIds: [], examPrice: 200 }).data.examPrice).toBe(200);
  });

  it('supports more than one companion within the store limit', () => {
    const result = createLeadDocument({
      ...validInput,
      needsTransport: 'true',
      companionCount: '2',
      maxCompanions: 2,
      transportEnabled: true,
      transportAllowedWeekdays: [5]
    }, profile, 'installation-test');

    expect(result.data).toMatchObject({ companionCount: 2, hasCompanion: true, transportSeats: 3 });
    expect(validateLeadInput({ ...validInput, needsTransport: true, companionCount: 2, maxCompanions: 1 }).errors.companionCount).toBeDefined();
  });

  it('blocks transport on dates without configured availability', () => {
    const result = validateLeadInput({
      ...validInput,
      needsTransport: 'true',
      hasCompanion: 'false',
      transportEnabled: true,
      transportAllowedWeekdays: [3]
    });

    expect(result.errors.appointmentDate).toBe('Escolha um dia com transporte disponível.');
  });

  it('blocks appointments outside the configured transport hours', () => {
    const result = validateLeadInput({
      ...validInput,
      needsTransport: 'true',
      hasCompanion: 'false',
      transportEnabled: true,
      transportAllowedWeekdays: [5],
      transportHoursRules: [{ weekday: 5, openingTime: '08:00', closingTime: '14:00' }]
    });

    expect(result.errors.appointmentTime).toBe('Escolha um horário dentro da disponibilidade do transporte.');
  });

  it('creates an update with editable fields only', () => {
    const result = createLeadUpdate({
      ...validInput,
      fullName: 'Cliente Corrigido',
      customerRg: '12.345.678-X',
      city: 'Recife'
    });

    expect(result.isValid).toBe(true);
    expect(result.data).toMatchObject({
      fullName: 'Cliente Corrigido',
      birthDate: '1985-04-12',
      sex: 'female',
      street: 'Rua das Flores',
      streetNumber: 'S/N',
      city: 'Recife',
      phone: '+5581999991234'
    });
    expect(result.data).not.toHaveProperty('capturedByUid');
    expect(result.data).not.toHaveProperty('storeId');
    expect(result.data).not.toHaveProperty('capturedAtClient');
  });

  it('keeps exclusive ametropia answers consistent', () => {
    const result = createLeadUpdate({
      ...validInput,
      ametropiaIds: ['myopia', 'none']
    });

    expect(result.data.ametropiaIds).toEqual(['none']);
    expect(result.data.ametropiaLabels).toEqual(['Não possui']);
  });

  it('keeps exclusive pathology answers consistent', () => {
    const result = createLeadUpdate({
      ...validInput,
      pathologyIds: ['glaucoma', 'none']
    });

    expect(result.data.pathologyIds).toEqual(['none']);
    expect(result.data.pathologyLabels).toEqual(['Não possui']);
  });

  it('ignores pathology options removed from the registration form', () => {
    const result = createLeadUpdate({
      ...validInput,
      pathologyIds: ['dry-eye', 'macular-degeneration', 'retinal-detachment']
    });

    expect(result.data.pathologyIds).toEqual([]);
    expect(result.data.pathologyLabels).toEqual([]);
  });

  it('requires the eye surgery answer at every age', () => {
    const result = validateLeadInput({
      ...validInput,
      birthDate: '1960-01-01',
      ophthalmologyRoutingEnabled: true,
      ophthalmologyMinimumAge: 55,
      eyeSurgeryStatus: ''
    });

    expect(result.errors.eyeSurgeryStatus).toBeDefined();
  });

  it('requires which surgery was performed and supports another description', () => {
    expect(validateLeadInput({
      ...validInput,
      birthDate: '1960-01-01',
      ophthalmologyRoutingEnabled: true,
      ophthalmologyMinimumAge: 55,
      eyeSurgeryStatus: 'yes',
      eyeSurgeryType: ''
    }).errors.eyeSurgeryType).toBeDefined();
    expect(validateLeadInput({
      ...validInput,
      birthDate: '1960-01-01',
      ophthalmologyRoutingEnabled: true,
      ophthalmologyMinimumAge: 55,
      eyeSurgeryStatus: 'yes',
      eyeSurgeryType: 'other',
      eyeSurgeryDetails: ''
    }).errors.eyeSurgeryDetails).toBeDefined();
  });

  it('routes cataract pathology or surgery to ophthalmology', () => {
    const settings = {
      ophthalmologyRoutingEnabled: true,
      ophthalmologyMinimumAge: 55,
      ophthalmologyPathologyIds: ['cataract'],
      ophthalmologySurgeryIds: ['cataract']
    };
    expect(ophthalmologyTriage({ ...validInput, pathologyIds: ['cataract'] }, settings).careRoute).toBe('ophthalmologist');
    expect(ophthalmologyTriage({ ...validInput, pathologyIds: [], eyeSurgeryStatus: 'yes', eyeSurgeryType: 'cataract' }, settings).careRoute).toBe('ophthalmologist');
    expect(ophthalmologyTriage({ ...validInput, pathologyIds: ['glaucoma'] }, settings).careRoute).toBe('optometrist');
  });

  it('calculates paid and courtesy exam prices from the care route', () => {
    expect(examPricing('optometrist', 'paid')).toEqual({ examPaymentType: 'paid', examPrice: 150 });
    expect(examPricing('ophthalmologist', 'paid')).toEqual({ examPaymentType: 'paid', examPrice: 200 });
    expect(examPricing('ophthalmologist', 'courtesy')).toEqual({ examPaymentType: 'courtesy', examPrice: 0 });

    const result = createLeadUpdate({
      ...validInput,
      careRouteOverride: 'ophthalmologist',
      examPaymentType: 'courtesy',
      examPaymentMethods: ['credit-card', 'cash']
    });
    expect(result.data).toMatchObject({
      careRoute: 'ophthalmologist',
      examPaymentType: 'courtesy',
      examPaymentMethods: []
    });
  });

  it('accepts known exam payment methods and rejects unknown values', () => {
    expect(createLeadUpdate({ ...validInput, examPaymentMethods: ['cash', 'pix'] }).data.examPaymentMethods).toEqual(['cash', 'pix']);
    expect(createLeadUpdate({ ...validInput, examPaymentMethods: ['pix', 'bank-slip'] }).data.examPaymentMethods).toEqual(['pix', 'bank-slip']);
    expect(validateLeadInput({ ...validInput, examPaymentMethods: ['pix', 'crypto'] }).errors.examPaymentMethods).toBeDefined();
  });

  it('rejects ophthalmology appointments outside configured weekdays', () => {
    const result = validateLeadInput({
      ...validInput,
      appointmentDate: '2026-10-22',
      careRouteOverride: 'ophthalmologist',
      ophthalmologyAllowedWeekdays: [6]
    });
    expect(result.errors.appointmentDate).toBeDefined();
  });
});
