import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreNewLeadDraft } from '../../src/app/features/capture/capture-form.js';
import { captureAppointmentTimeField, careRouteAppointmentSchedule } from '../../src/app/features/capture/capture-schedule.js';
import { enrichLeadTriage, eyeTriageFields, triageConfigFields } from '../../src/app/features/capture/capture-triage.js';
import { transportFields } from '../../src/app/features/capture/capture-transport.js';
import { captureView } from '../../src/app/features/capture/capture-view.js';
import { DEFAULT_STORE_SCHEDULE } from '../../src/utils/schedule.js';
import { leadDetailAppointmentTimeField } from '../../src/app/features/leads/lead-appointment.js';
import {
  bindCpfAppointmentWarning,
  cpfAppointmentConfirmationDialog,
  hasActiveAppointment,
  hasDemoCpfAppointment
} from '../../src/app/features/capture/cpf-appointment-warning.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capture feature modules', () => {
  it('restores simple, checkbox and surgery draft fields', () => {
    const fullName = { type: 'text', value: '' };
    const pathology = { type: 'checkbox', value: 'cataract', checked: false };
    const surgeryType = { type: 'select-one', value: '', disabled: true };
    const controls = {
      fullName: [fullName],
      pathologyIds: [pathology],
      eyeSurgeryStatus: [{ type: 'select-one', value: '' }],
      eyeSurgeryType: [surgeryType]
    };
    const form = {
      elements: { eyeSurgeryType: surgeryType },
      querySelectorAll: (selector) => controls[selector.match(/name="([^"]+)"/)?.[1]] || []
    };

    restoreNewLeadDraft(form, {
      fullName: 'Maria Silva',
      pathologyIds: ['cataract'],
      eyeSurgeryStatus: 'yes',
      eyeSurgeryType: 'cataract'
    });

    expect(fullName.value).toBe('Maria Silva');
    expect(pathology.checked).toBe(true);
    expect(surgeryType.disabled).toBe(false);
    expect(surgeryType.value).toBe('cataract');
  });

  it('renders and enriches clinical triage with configured historical pricing', () => {
    const settings = {
      ...DEFAULT_STORE_SCHEDULE,
      ophthalmologyRoutingEnabled: true,
      ophthalmologyPathologyIds: ['cataract'],
      optometristExamPrice: 180,
      ophthalmologistExamPrice: 260
    };
    const values = { pathologyIds: ['cataract'], examPaymentType: 'paid', examPaymentMethods: ['pix'] };
    const enriched = enrichLeadTriage(values, settings);

    expect(enriched).toMatchObject({ careRoute: 'ophthalmologist', examPrice: 260 });
    const triageMarkup = eyeTriageFields(values, settings);
    expect(triageMarkup).toContain('Oftalmologista');
    expect(triageMarkup).toContain('name="careRouteSelection"');
    expect(triageMarkup).not.toContain('>Automático<');
    expect(triageConfigFields(settings)).toContain('name="ophthalmologistExamPrice"');
  });

  it('shows credit fields only when boleto is selected', () => {
    const hiddenMarkup = eyeTriageFields({ examPaymentType: 'paid', examPaymentMethods: ['pix'] });
    const visibleMarkup = eyeTriageFields({
      examPaymentType: 'paid',
      examPaymentMethods: ['bank-slip'],
      creditFatherName: 'João da Silva'
    });

    expect(hiddenMarkup).toContain('data-credit-details-fields hidden');
    expect(visibleMarkup).toContain('Boleto');
    expect(visibleMarkup).toContain('name="creditFatherName"');
    expect(visibleMarkup).not.toContain('data-credit-details-fields hidden');
  });

  it('renders transport limits and availability from store settings', () => {
    const settings = {
      ...DEFAULT_STORE_SCHEDULE,
      transportEnabled: true,
      maxCompanions: 2,
      transportHoursRules: [{ weekday: 4, openingTime: '08:00', closingTime: '12:00' }]
    };
    const markup = transportFields({ needsTransport: true, companionCount: 2, appointmentDate: '2026-10-29' }, settings);

    expect(markup).toContain('2 acompanhantes');
    expect(markup).toContain('Transporte disponível das 08:00 às 12:00.');
  });

  it('uses the care route schedule and supports free scheduling', () => {
    const settings = { ...DEFAULT_STORE_SCHEDULE, schedulingMode: 'free' };
    expect(careRouteAppointmentSchedule(settings, 'optometrist')).toBeTruthy();
    expect(captureAppointmentTimeField({
      scheduleState: { settings, appointmentDate: '', appointments: [], loading: false, error: '', triage: {} },
      service: { durationMinutes: 20 },
      profile: {},
      online: true
    })).toContain('type="time"');
  });

  it('uses the currently selected route when refreshing an existing lead schedule', () => {
    const settings = {
      ...DEFAULT_STORE_SCHEDULE,
      ophthalmologyWeekdays: [6],
      optometristHoursRules: [{ weekday: 5, openingTime: '08:00', closingTime: '17:00' }]
    };
    const lead = {
      id: 'lead-1',
      storeId: 'loja-06',
      appointmentDate: '2026-10-31',
      appointmentTime: '08:00',
      careRouteOverride: 'ophthalmologist'
    };
    const markup = leadDetailAppointmentTimeField({
      lead,
      scheduleState: {
        settings,
        appointmentDate: '2026-10-30',
        appointments: [],
        appointmentLoading: false,
        error: '',
        services: [],
        serviceId: '',
        triage: { careRouteOverride: 'optometrist' }
      },
      profile: { role: 'admin' },
      online: true
    });

    expect(markup).not.toContain('O oftalmologista não atende neste dia');
    expect(markup).toContain('08:00 - 08:20');
  });

  it('renders the capture page without reading application-global state', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const scheduleState = {
      settings: { ...DEFAULT_STORE_SCHEDULE, transportEnabled: false },
      services: [{ id: 'exam', name: 'Exame de vista', durationMinutes: 20, storeIds: ['loja-06'], active: true }],
      serviceId: 'exam',
      appointmentDate: '',
      loaded: true
    };
    const markup = captureView({
      scheduleState,
      offlineCaptureEnabled: true,
      selectedStoreId: 'loja-06',
      allowedStoreIds: ['loja-06'],
      storeChoice: false,
      selectedService: scheduleState.services[0],
      appointmentTimeMarkup: '<div data-time-field></div>'
    });

    expect(markup).toContain('id="lead-form"');
    expect(markup).toContain('Exame de vista - 20 min');
    expect(markup).toContain('data-time-field');
  });

  it('detects only active appointments for the same CPF', () => {
    const cpf = '529.982.247-25';
    const leads = [
      { customerCpf: cpf, appointmentDate: '2026-10-29', appointmentTime: '08:00', appointmentAttendance: 'pending' },
      { customerCpf: cpf, appointmentDate: '2026-10-31', appointmentTime: '09:00', appointmentAttendance: 'missed' },
      { customerCpf: cpf, appointmentDate: '2026-11-01', appointmentTime: '10:00', appointmentAttendance: 'pending' }
    ];

    expect(hasActiveAppointment(leads[0], '2026-10-30')).toBe(false);
    expect(hasActiveAppointment(leads[1], '2026-10-30')).toBe(false);
    expect(hasActiveAppointment(leads[2], '2026-10-30')).toBe(true);
    expect(hasDemoCpfAppointment(leads, cpf, '2026-10-30')).toBe(true);
    expect(hasDemoCpfAppointment(leads, '111.444.777-35', '2026-10-30')).toBe(false);
  });

  it('shows the inline CPF warning and renders a confirmation dialog', async () => {
    const listeners = {};
    const input = {
      value: '529.982.247-25',
      addEventListener: (name, listener) => { listeners[name] = listener; }
    };
    const output = { dataset: {}, textContent: '', hidden: true };
    const form = {
      elements: { customerCpf: input },
      querySelector: () => output
    };
    const controller = bindCpfAppointmentWarning(form, {
      online: () => true,
      lookup: async () => ({ hasAppointment: true })
    });

    await controller.checkNow();

    expect(output.dataset.status).toBe('warning');
    expect(output.hidden).toBe(false);
    expect(output.textContent).toContain('agendamento ativo');
    expect(cpfAppointmentConfirmationDialog()).toContain('Continuar e salvar');
    expect(Object.keys(listeners)).toEqual(expect.arrayContaining(['input', 'blur']));
  });
});
