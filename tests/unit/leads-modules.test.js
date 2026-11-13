import { afterEach, describe, expect, it, vi } from 'vitest';
import { leadDetailHasNonAppointmentChanges, leadDetailSubmissionValues } from '../../src/app/features/leads/lead-detail-events.js';
import { leadDetailAppointmentTimeField, selectedLeadDetailService } from '../../src/app/features/leads/lead-appointment.js';
import { leadDetailView } from '../../src/app/features/leads/lead-detail-view.js';
import { filterLeadRecords, leadsView } from '../../src/app/features/leads/leads-view.js';
import { DEFAULT_STORE_SCHEDULE } from '../../src/utils/schedule.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function sampleLead(overrides = {}) {
  return {
    id: 'lead-1',
    fullName: 'Maria Silva',
    phone: '81999991234',
    phoneSearch: '81999991234',
    customerCpf: '',
    customerRg: '',
    birthDate: '1985-04-12',
    sex: 'female',
    preferredName: 'Maria',
    savwinCode: 'CLI-1234',
    score: 850,
    postalCode: '50000123',
    street: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    state: 'PE',
    addressReference: '',
    interestId: 'eye-exam',
    interestLabel: 'Exame de vista',
    ametropiaIds: [],
    pathologyIds: [],
    examPaymentMethods: [],
    appointmentDate: '',
    appointmentTime: '',
    appointmentDurationMinutes: 20,
    appointmentServiceId: 'exam',
    notes: '',
    storeId: 'loja-06',
    capturedAtClient: '2026-10-29T12:00:00-03:00',
    syncState: 'synced',
    ...overrides
  };
}

function scheduleState(overrides = {}) {
  return {
    storeId: 'loja-06',
    settings: { ...DEFAULT_STORE_SCHEDULE },
    services: [{ id: 'exam', name: 'Exame de vista', durationMinutes: 20, storeIds: ['loja-06'], active: true }],
    serviceId: 'exam',
    appointmentDate: '',
    appointments: [],
    appointmentLoading: false,
    error: '',
    ...overrides
  };
}

describe('leads feature modules', () => {
  it('distinguishes schedule-only edits from changes to lead data', () => {
    const input = (name, value, defaultValue = value) => ({
      name, value, defaultValue, disabled: false, type: 'text', tagName: 'INPUT'
    });
    const appointmentDate = input('appointmentDate', '2026-11-14', '');
    const fullName = input('fullName', 'Maria Silva');
    expect(leadDetailHasNonAppointmentChanges({ elements: [fullName, appointmentDate] })).toBe(false);

    fullName.value = 'Maria Silva Santos';
    expect(leadDetailHasNonAppointmentChanges({ elements: [fullName, appointmentDate] })).toBe(true);
  });

  it('filters the lead list by name and phone', () => {
    const leads = [sampleLead(), sampleLead({ id: 'lead-2', fullName: 'João Santos', phoneSearch: '81988887777' })];
    expect(filterLeadRecords(leads, { query: 'maria' }).map((lead) => lead.id)).toEqual(['lead-1']);
    expect(filterLeadRecords(leads, { query: '988887777' }).map((lead) => lead.id)).toEqual(['lead-2']);
  });

  it('filters the lead list by store and capture period', () => {
    const leads = [
      sampleLead(),
      sampleLead({ id: 'lead-2', storeId: 'loja-02', capturedAtClient: '2026-11-03T10:00:00-03:00' })
    ];
    expect(filterLeadRecords(leads, { storeId: 'loja-02', startDate: '2026-11-01', endDate: '2026-11-05' }).map((lead) => lead.id)).toEqual(['lead-2']);
    const markup = leadsView({ leads, filters: { storeId: 'loja-02' }, allowedStores: [{ id: 'loja-02', label: 'Loja 02' }] });
    expect(markup).toContain('id="lead-start-date"');
    expect(markup).toContain('id="lead-end-date"');
    expect(markup).toContain('<option value="">Todas as lojas</option>');
    expect(markup).toContain('data-lead-filters-clear');
  });

  it('filters and labels customers with a confirmed purchase', () => {
    const leads = [sampleLead(), sampleLead({ id: 'lead-2', saleStatus: 'confirmed', saleDate: '2026-11-11' })];
    expect(filterLeadRecords(leads, { saleStatus: 'confirmed' }).map((lead) => lead.id)).toEqual(['lead-2']);
    expect(filterLeadRecords(leads, { saleStatus: 'pending' }).map((lead) => lead.id)).toEqual(['lead-1']);
    const markup = leadsView({ leads, filters: { saleStatus: 'confirmed' } });
    expect(markup).toContain('id="lead-sale-filter"');
    expect(markup).toContain('Compra confirmada');
  });

  it('shows a marker for a Captar import', () => {
    const markup = leadsView({ leads: [sampleLead({ recordOrigin: 'captar_import' })] });
    expect(markup).toContain('Importado do Captar');
  });

  it('selects the configured service and renders free appointment time', () => {
    const lead = sampleLead();
    const state = scheduleState({
      settings: { ...DEFAULT_STORE_SCHEDULE, schedulingMode: 'free' },
      appointmentDate: '2026-10-30'
    });
    expect(selectedLeadDetailService(lead, state).id).toBe('exam');
    expect(leadDetailAppointmentTimeField({ lead, scheduleState: state, profile: {}, online: true })).toContain('type="time"');
  });

  it('renders an editable lead detail without application-global state', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const lead = sampleLead();
    const markup = leadDetailView({
      lead,
      managementMode: false,
      canManage: false,
      profileRole: 'captor',
      scheduleState: scheduleState(),
      appointmentTimeMarkup: '<div id="edit-appointment-time-field"></div>',
      canDelete: true
    });
    expect(markup).toContain('id="edit-lead-form"');
    expect(markup).toContain('Maria Silva');
    expect(markup).toContain('CLI-1234');
    expect(markup).toContain('value="850"');
    expect(markup).toContain('name="score" type="text" inputmode="numeric" pattern="[0-9]*"');
    expect(markup).toContain('value="50000-123"');
    expect(markup).toContain('name="strategyType" required');
    expect(markup).toContain('Excluir lead');
    expect(markup).toContain('edit-appointment-time-field');
    expect(markup).toContain('class="lead-detail-actions"');
    expect(markup).toContain('class="field-row credit-details-fields"');
    expect(markup.indexOf('demographic-fields')).toBeLessThan(markup.indexOf('credit-details-fields'));
    expect(markup.indexOf('credit-details-fields')).toBeLessThan(markup.indexOf('preferred-postal-fields'));
  });

  it('shows the Captar origin in the lead detail summary', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const markup = leadDetailView({
      lead: sampleLead({ recordOrigin: 'captar_import' }),
      managementMode: false,
      canManage: false,
      profileRole: 'captor',
      scheduleState: scheduleState(),
      appointmentTimeMarkup: '<div id="edit-appointment-time-field"></div>',
      canDelete: false
    });
    expect(markup).toContain('Origem do registro');
    expect(markup).toContain('Importado do Captar');
  });

  it('shows the purchase summary to everyone and the action only to authorized staff', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const options = {
      lead: sampleLead({ saleStatus: 'confirmed', saleDate: '2026-11-11' }),
      managementMode: true, canManage: true, profileRole: 'manager', scheduleState: scheduleState(),
      appointmentTimeMarkup: '<div></div>', canDelete: false
    };
    expect(leadDetailView(options)).toContain('1 confirmada');
    expect(leadDetailView(options)).not.toContain('data-open-manual-sale');
    const authorizedMarkup = leadDetailView({ ...options, canConfirmSale: true });
    expect(authorizedMarkup).toContain('data-open-manual-sale="lead-1"');
    expect(authorizedMarkup).toContain('class="lead-sale-summary lead-sale-summary-button"');
    expect(authorizedMarkup).toContain('aria-label="Ver compras do cliente"');
  });

  it('warns and offers ownership of a cancelled lead in read-only mode', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const markup = leadDetailView({
      lead: sampleLead({ appointmentStatus: 'cancelled', appointmentAttendance: 'cancelled' }),
      managementMode: false,
      canManage: false,
      profileRole: 'captor',
      scheduleState: scheduleState(),
      appointmentTimeMarkup: '<div id="edit-appointment-time-field"></div>',
      canDelete: false,
      canClaimLead: true,
      readOnly: true
    });
    expect(markup).toContain('Este agendamento foi cancelado');
    expect(markup).toContain('data-claim-lead');
    expect(markup).toContain('Assumir este lead');
    expect(markup).not.toContain('type="submit"');
  });

  it('lets the current owner choose a new schedule for a cancelled lead', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const markup = leadDetailView({
      lead: sampleLead({ appointmentStatus: 'cancelled', appointmentAttendance: 'cancelled' }),
      managementMode: false,
      canManage: false,
      profileRole: 'captor',
      scheduleState: scheduleState(),
      appointmentTimeMarkup: '<select id="edit-appointment-time-field"></select>',
      canDelete: false,
      readOnly: false
    });
    expect(markup).toContain('Escolha uma nova data ou horário e salve para reagendar');
    expect(markup).not.toMatch(/id="edit-appointmentDate"[^>]*disabled/);
    expect(markup).not.toMatch(/id="edit-appointment-time-field"[^>]*disabled/);
    expect(markup).toContain('type="submit"');
  });

  it('preserves original data when a manager only reschedules', () => {
    class FormDataStub {
      constructor(form) {
        this.values = form.values;
      }

      *[Symbol.iterator]() {
        yield* Object.entries(this.values);
      }

      getAll(name) {
        const value = this.values[name];
        return Array.isArray(value) ? value : value ? [value] : [];
      }
    }
    vi.stubGlobal('FormData', FormDataStub);
    const existing = sampleLead({ fullName: 'Nome original', appointmentDate: '2026-10-30', appointmentTime: '08:00' });
    const form = {
      values: { appointmentDate: '2026-11-02', appointmentTime: '09:00' },
      elements: {
        schedulingMode: { value: 'controlled' },
        appointmentDurationMinutes: { value: '20' },
        appointmentServiceId: { value: 'exam' },
        appointmentServiceName: { value: 'Exame de vista' },
        appointmentDate: { value: '2026-11-02' },
        appointmentTime: { value: '09:00' }
      },
      querySelector: () => null
    };
    const values = leadDetailSubmissionValues(form, existing, DEFAULT_STORE_SCHEDULE, { managerReschedule: true });
    expect(values).toMatchObject({
      fullName: 'Nome original',
      appointmentDate: '2026-11-02',
      appointmentTime: '09:00',
      schedulingMode: 'controlled',
      appointmentServiceId: 'exam'
    });
  });

  it('keeps appointment date editable for manager rescheduling', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const markup = leadDetailView({
      lead: sampleLead({ appointmentDate: '2026-10-30', appointmentTime: '08:00' }),
      managementMode: true,
      canManage: true,
      profileRole: 'manager',
      scheduleState: scheduleState(),
      appointmentTimeMarkup: '<div id="edit-appointment-time-field"></div>',
      canDelete: false
    });
    const appointmentDate = markup.match(/<input id="edit-appointmentDate"[^>]+>/)?.[0] || '';
    expect(appointmentDate).not.toContain('disabled');
    expect(markup).toContain('Salvar reagendamento');
  });
});
