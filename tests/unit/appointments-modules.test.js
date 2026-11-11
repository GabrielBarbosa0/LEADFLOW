import { describe, expect, it, vi } from 'vitest';
import { appointmentCreateDialog, appointmentCreateSchedule, appointmentCreateTimeField } from '../../src/app/features/appointments/appointment-dialog.js';
import { bindAppointmentListScroll, handleAppointmentClick, nextAppointmentAttendance, updateAppointmentAttendanceControls } from '../../src/app/features/appointments/appointment-events.js';
import { startAppointmentsLiveSubscription, startConfirmationsLiveSubscription } from '../../src/app/features/appointments/appointment-subscriptions.js';
import { appointmentsView } from '../../src/app/features/appointments/appointments-view.js';
import { handleConfirmationClick } from '../../src/app/features/appointments/confirmation-events.js';
import { confirmationEndDate, normalizeConfirmationDays } from '../../src/app/features/appointments/confirmation-period.js';
import { confirmationsView } from '../../src/app/features/appointments/confirmations-view.js';
import { DEFAULT_STORE_SCHEDULE } from '../../src/utils/schedule.js';

const store = { id: 'loja-06', label: 'Loja 06', displayLabel: 'Loja 06' };
const lead = {
  id: 'lead-1', fullName: 'Maria Silva', preferredName: 'Maria', phone: '81999991234', phoneSearch: '81999991234',
  storeId: 'loja-06', capturedByName: 'Ana', appointmentDate: '2026-10-30', appointmentTime: '08:00',
  appointmentServiceName: 'Exame de vista', appointmentDurationMinutes: 20
};

function createState(overrides = {}) {
  return {
    loading: false, saving: false, error: '', storeId: 'loja-06',
    schedules: [{ ...DEFAULT_STORE_SCHEDULE, id: 'loja-06' }],
    services: [{ id: 'exam', name: 'Exame de vista', durationMinutes: 20, storeIds: ['loja-06'], active: true }],
    serviceId: 'exam', draft: {}, ...overrides
  };
}

function clickEvent(selector, dataset = {}) {
  const element = { dataset, disabled: false, closest: () => null };
  return { target: { closest: (candidate) => candidate === selector ? element : null } };
}

describe('appointments feature modules', () => {
  it('renders the monthly agenda and selected appointment', () => {
    const markup = appointmentsView({
      allowed: true,
      appointments: { loading: false, error: '', truncated: false, month: '2026-10', storeId: 'loja-06', selectedDate: '2026-10-30', updatingId: '' },
      records: [lead], allowedStores: [store], backRoute: 'management', canCreate: true, canMarkAttendance: true, canCancel: true,
      adminView: true, createDialog: '<dialog id="appointment-create-dialog"></dialog>', queryLimit: 500,
      now: new Date('2026-10-29T12:00:00-03:00')
    });
    expect(markup).toContain('Maria Silva');
    expect(markup).toContain('data-attendance-status="attended"');
    expect(markup).toContain('data-create-appointment');
    expect(markup).not.toContain('data-cancel-appointment="lead-1"');
    expect(markup).toContain('appointment-create-dialog');
  });

  it('renders the appointment dialog with controlled slots', () => {
    const appointmentCreate = createState();
    expect(appointmentCreateSchedule(appointmentCreate).id).toBe('loja-06');
    const timeField = appointmentCreateTimeField({ appointmentCreate, selectedDate: '2026-10-30', records: [], profile: { role: 'admin' } });
    expect(timeField).toContain('08:00 - 08:20');
    const markup = appointmentCreateDialog({ allowedStores: [store], appointmentCreate, selectedDate: '2026-10-30', records: [], profile: { role: 'admin' }, now: new Date('2026-10-29') });
    expect(markup).toContain('id="appointment-create-form"');
    expect(markup).toContain('name="savwinCode"');
    expect(markup).toContain('name="score"');
    expect(markup).toContain('name="score" type="text" inputmode="numeric" pattern="[0-9]*"');
    expect(markup).toContain('name="postalCode"');
    expect(markup).toContain('name="strategyType" required');
    expect(markup).toContain('value="social-media"');
    expect(markup).toContain('Exame de vista - 20 min');
  });

  it('renders the external agenda without attendance actions', () => {
    const markup = appointmentsView({
      allowed: true,
      appointments: { loading: false, error: '', truncated: false, month: '2026-10', storeId: 'loja-06', selectedDate: '2026-10-30', updatingId: '' },
      records: [lead], allowedStores: [store], backRoute: 'home', canCreate: true,
      canMarkAttendance: false, adminView: false, queryLimit: 500,
      now: new Date('2026-10-29T12:00:00-03:00')
    });

    expect(markup).toContain('Maria Silva');
    expect(markup).not.toContain('data-attendance-status');
    expect(markup).not.toContain('Compareceu');
    expect(markup).not.toContain('Não compareceu');
  });

  it('delegates appointment and confirmation actions', async () => {
    const selectDate = vi.fn();
    await expect(handleAppointmentClick(clickEvent('[data-appointment-date]', { appointmentDate: '2026-10-30' }), {
      requestCancellation: vi.fn(), openLead: vi.fn(), markAttendance: vi.fn(), selectDate, create: vi.fn(), shiftMonth: vi.fn()
    })).resolves.toBe(true);
    expect(selectDate).toHaveBeenCalledWith('2026-10-30');
    const selectFilter = vi.fn();
    await handleConfirmationClick(clickEvent('[data-confirmation-filter]', { confirmationFilter: 'done' }), { selectFilter, markDone: vi.fn(), undo: vi.fn() });
    expect(selectFilter).toHaveBeenCalledWith('done');
  });

  it('removes cancelled appointments from the active agenda', () => {
    const markup = appointmentsView({
      allowed: true,
      appointments: { loading: false, error: '', truncated: false, month: '2026-10', storeId: 'loja-06', selectedDate: '2026-10-30', updatingId: '' },
      records: [{ ...lead, appointmentStatus: 'cancelled', appointmentAttendance: 'cancelled' }],
      allowedStores: [store], backRoute: 'management', canCreate: true, canMarkAttendance: true, canCancel: true,
      adminView: true, queryLimit: 500, now: new Date('2026-10-29T12:00:00-03:00')
    });
    expect(markup).not.toContain('Maria Silva');
    expect(markup).toContain('Nenhum exame neste dia');
  });

  it('returns attendance to pending when the active option is selected again', () => {
    expect(nextAppointmentAttendance('pending', 'attended')).toBe('attended');
    expect(nextAppointmentAttendance('attended', 'attended')).toBe('pending');
    expect(nextAppointmentAttendance('missed', 'missed')).toBe('pending');
    expect(nextAppointmentAttendance('attended', 'missed')).toBe('missed');
  });

  it('restores and tracks the appointment list scroll position', () => {
    let scrollHandler;
    const list = {
      scrollTop: 0,
      addEventListener: vi.fn((eventName, handler) => {
        if (eventName === 'scroll') scrollHandler = handler;
      })
    };
    const appointments = { listScrollTop: 240 };

    bindAppointmentListScroll(list, appointments, (callback) => callback());
    expect(list.scrollTop).toBe(240);

    list.scrollTop = 410;
    scrollHandler();
    expect(appointments.listScrollTop).toBe(410);
  });

  it('updates attendance controls without replacing the appointment list', () => {
    const controls = ['attended', 'missed'].map((status) => ({
      dataset: { attendanceLead: 'lead-1', attendanceStatus: status },
      classList: { toggle: vi.fn() },
      setAttribute: vi.fn(),
      disabled: false
    }));
    const root = { querySelectorAll: vi.fn(() => controls) };

    updateAppointmentAttendanceControls('lead-1', 'attended', true, root);

    expect(controls[0].classList.toggle).toHaveBeenCalledWith('is-active', true);
    expect(controls[0].setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(controls[1].classList.toggle).toHaveBeenCalledWith('is-active', false);
    expect(controls.every((control) => control.disabled)).toBe(true);
  });

  it('renders pending and completed confirmation states', () => {
    const pending = confirmationsView({
      allowed: true, source: [lead], confirmations: { filter: 'pending', updatingId: '', loading: false, error: '', truncated: false },
      profileName: 'Gestor', queryLimit: 500, now: new Date('2026-10-29T12:00:00-03:00')
    });
    expect(pending).toContain('Marcar como feito');
    expect(pending).toContain('class="icon-button reminder-back-button"');
    expect(pending).toContain('aria-label="Voltar ao início"');
    expect(pending).not.toContain('<span>Voltar ao início</span>');
    const completedLead = { ...lead, appointmentReminderSentAt: '2026-10-29T12:00:00-03:00', appointmentReminderSentByName: 'Gestor', appointmentReminderAppointmentKey: '2026-10-30|08:00' };
    const completed = confirmationsView({
      allowed: true, source: [completedLead], confirmations: { filter: 'done', updatingId: '', loading: false, error: '', truncated: false },
      profileName: 'Gestor', queryLimit: 500, now: new Date('2026-10-29T12:00:00-03:00')
    });
    expect(completed).toContain('Desfazer');
    expect(completed).toContain('Marcado por Gestor');
  });

  it('uses a configurable confirmation period with seven days by default', () => {
    const futureLead = { ...lead, id: 'lead-future', fullName: 'Cliente Futuro', appointmentDate: '2026-11-07' };
    const defaultPeriod = confirmationsView({
      allowed: true, source: [lead, futureLead], confirmations: { filter: 'all', updatingId: '', loading: false, error: '', truncated: false },
      profileName: 'Gestor', queryLimit: 500, now: new Date('2026-10-29T12:00:00-03:00')
    });
    const extendedPeriod = confirmationsView({
      allowed: true, source: [lead, futureLead], confirmations: { days: 10, filter: 'all', updatingId: '', loading: false, error: '', truncated: false },
      profileName: 'Gestor', queryLimit: 500, now: new Date('2026-10-29T12:00:00-03:00')
    });

    expect(defaultPeriod).toContain('value="7"');
    expect(defaultPeriod).not.toContain('Cliente Futuro');
    expect(extendedPeriod).toContain('value="10"');
    expect(extendedPeriod).toContain('Cliente Futuro');
    expect(normalizeConfirmationDays(0)).toBe(1);
    expect(normalizeConfirmationDays(200)).toBe(90);
    expect(normalizeConfirmationDays('')).toBe(7);
    expect(confirmationEndDate('2026-10-29', 7)).toBe('2026-11-04');
  });

  it('stops appointment and confirmation subscriptions', () => {
    const unsubscribeAppointments = vi.fn();
    const unsubscribeConfirmations = vi.fn();
    const subscribeAppointments = vi.fn(() => unsubscribeAppointments);
    const subscribeConfirmations = vi.fn(() => unsubscribeConfirmations);
    const stopAppointments = startAppointmentsLiveSubscription({ subscribe: subscribeAppointments, profile: {}, month: '2026-10', storeId: '', onData: vi.fn(), onError: vi.fn() });
    const stopConfirmations = startConfirmationsLiveSubscription({ subscribe: subscribeConfirmations, profile: {}, startDate: '2026-10-29', endDate: '2026-11-04', onData: vi.fn(), onError: vi.fn() });
    stopAppointments();
    stopConfirmations();
    expect(unsubscribeAppointments).toHaveBeenCalledOnce();
    expect(unsubscribeConfirmations).toHaveBeenCalledOnce();
  });
});
