import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreNewLeadDraft } from '../../src/app/features/capture/capture-form.js';
import { captureAppointmentTimeField, careRouteAppointmentSchedule } from '../../src/app/features/capture/capture-schedule.js';
import { creditDetailsFields, enrichLeadTriage, eyeTriageFields, triageConfigFields } from '../../src/app/features/capture/capture-triage.js';
import { transportFields } from '../../src/app/features/capture/capture-transport.js';
import { productPaymentFields } from '../../src/app/features/capture/product-payment.js';
import { purchaseHolderFields } from '../../src/app/features/capture/purchase-holder.js';
import { captureView } from '../../src/app/features/capture/capture-view.js';
import { DEFAULT_STORE_SCHEDULE } from '../../src/utils/schedule.js';
import { leadDetailAppointmentTimeField } from '../../src/app/features/leads/lead-appointment.js';
import {
  bindCpfAppointmentWarning,
  cpfAppointmentConfirmationDialog,
  hasActiveAppointment
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
    expect(triageMarkup).toContain('name="examPrice" type="number"');
    expect(triageMarkup).toContain('value="260" data-exam-price');
    expect(triageMarkup).not.toContain('>Automático<');
    expect(triageConfigFields(settings)).toContain('name="ophthalmologistExamPrice"');
  });

  it('turns a manually zeroed exam price into courtesy', () => {
    const enriched = enrichLeadTriage({
      pathologyIds: [],
      examPaymentType: 'paid',
      examPrice: '0',
      examPaymentMethods: ['pix']
    }, DEFAULT_STORE_SCHEDULE);
    const markup = eyeTriageFields(enriched, DEFAULT_STORE_SCHEDULE);

    expect(enriched).toMatchObject({ examPaymentType: 'courtesy', examPrice: 0 });
    expect(markup).toContain('<option value="courtesy" selected>Cortesia</option>');
    expect(markup).toContain('data-exam-payment-method-row hidden');
  });

  it('shows a configured zero price as courtesy from the start', () => {
    const markup = eyeTriageFields({ pathologyIds: [], examPaymentType: 'paid' }, {
      ...DEFAULT_STORE_SCHEDULE,
      optometristExamPrice: 0
    });

    expect(markup).toContain('<option value="courtesy" selected>Cortesia</option>');
    expect(markup).toContain('value="0" data-exam-price');
  });

  it('renders family contact fields independently from payment methods', () => {
    const markup = creditDetailsFields({
      creditFatherName: 'João da Silva',
      creditMotherName: 'Maria da Silva',
      creditAuxiliaryPhone: '(81) 98888-7777'
    }, 'test-credit');

    expect(markup).toContain('name="creditFatherName"');
    expect(markup).toContain('value="João da Silva"');
    expect(markup).toContain('name="creditMotherName"');
    expect(markup).toContain('name="creditAuxiliaryPhone"');
    expect(markup).not.toContain('hidden');
    expect(markup).not.toContain('disabled');
    expect(eyeTriageFields({ examPaymentMethods: ['bank-slip'] })).not.toContain('name="creditFatherName"');
  });

  it('shows product payment methods only for product interests', () => {
    const productMarkup = productPaymentFields({ interestId: 'complete-glasses', productPaymentMethods: ['pix'] });
    const examMarkup = productPaymentFields({ interestId: 'eye-exam', productPaymentMethods: [] });

    expect(productMarkup).toContain('Forma de pagamento do produto de interesse');
    expect(productMarkup).toContain('value="pix" checked');
    expect(productMarkup).not.toContain('data-product-payment data-field="productPaymentMethods" hidden');
    expect(examMarkup).toContain('data-product-payment data-field="productPaymentMethods" hidden');
  });

  it('shows purchase holder details only for another person', () => {
    const customerMarkup = purchaseHolderFields({ purchaseHolderType: 'customer' });
    const otherMarkup = purchaseHolderFields({
      purchaseHolderType: 'other',
      purchaseHolderName: 'Maria Responsável',
      purchaseHolderCpf: '52998224725'
    });

    expect(customerMarkup).toContain('data-purchase-holder-details hidden');
    expect(customerMarkup).toContain('value="customer" selected');
    expect(otherMarkup).not.toContain('data-purchase-holder-details hidden');
    expect(otherMarkup).toContain('name="purchaseHolderName"');
    expect(otherMarkup).toContain('529.982.247-25');
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

  it('does not report missing transport while the store schedule is loading', () => {
    const markup = transportFields({ needsTransport: true }, undefined, 'transport', true, true);

    expect(markup).toContain('Carregando a disponibilidade do transporte...');
    expect(markup).not.toContain('O transporte ainda não está configurado para esta loja.');
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
        leadId: 'lead-1',
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
    expect(markup).toContain('name="savwinCode"');
    expect(markup).toContain('name="score"');
    expect(markup).toContain('name="score" type="text" inputmode="numeric" pattern="[0-9]*"');
    expect(markup).toContain('name="postalCode"');
    expect(markup).toContain('name="strategyType" required');
    expect(markup).toContain('Tipo de estratégia <span aria-hidden="true">*</span>');
    expect(markup).toContain('value="external">Externa</option>');
    expect(markup).toContain('value="after-sales">Pós-venda</option>');
    expect(markup).toContain('value="spontaneous-visit">Visita espontânea</option>');
    expect(markup).not.toContain('Os serviços, horários e limites serão carregados para esta unidade.');
    expect(markup).not.toContain('Unidade definida no acesso deste colaborador.');
    expect(markup).not.toContain('Informacao obrigatoria para todos os clientes.');
    expect(markup).toContain('class="field-row document-fields"');
    expect(markup).toContain('class="field-row demographic-fields"');
    expect(markup).toContain('class="field-row credit-details-fields"');
    expect(markup).toContain('class="field-row preferred-postal-fields"');
    expect(markup.indexOf('demographic-fields')).toBeLessThan(markup.indexOf('credit-details-fields'));
    expect(markup.indexOf('credit-details-fields')).toBeLessThan(markup.indexOf('preferred-postal-fields'));
    expect(markup).not.toContain('name="pathologyIds" value="unknown"');
    expect(markup).toContain('Exame de vista - 20 min');
    expect(markup).toContain('data-time-field');
  });

  it('detects only active appointments', () => {
    const cpf = '529.982.247-25';
    const leads = [
      { customerCpf: cpf, appointmentDate: '2026-10-29', appointmentTime: '08:00', appointmentAttendance: 'pending' },
      { customerCpf: cpf, appointmentDate: '2026-10-31', appointmentTime: '09:00', appointmentAttendance: 'missed' },
      { customerCpf: cpf, appointmentDate: '2026-11-01', appointmentTime: '10:00', appointmentAttendance: 'pending' }
    ];

    expect(hasActiveAppointment(leads[0], '2026-10-30')).toBe(false);
    expect(hasActiveAppointment(leads[1], '2026-10-30')).toBe(false);
    expect(hasActiveAppointment(leads[2], '2026-10-30')).toBe(true);
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
