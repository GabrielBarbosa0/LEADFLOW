import { describe, expect, it, vi } from 'vitest';
import { ensureAppointmentData, startAppointmentsSubscription, startConfirmationsSubscription, stopAppointmentsSubscription, stopConfirmationsSubscription } from '../../src/app/features/scheduling/appointment-subscriptions.js';
import { stopNewLeadScheduleSubscriptions } from '../../src/app/features/scheduling/new-lead-schedule-controller.js';

describe('scheduling controllers', () => {
  it('starts only the live subscription for the active scheduling route', () => {
    const startAppointments = vi.fn();
    const startConfirmations = vi.fn();
    ensureAppointmentData({ state: { route: 'appointments', unsubscribeAppointments: null, unsubscribeConfirmations: null }, hasAccess: () => true, startAppointments, startConfirmations });
    expect(startAppointments).toHaveBeenCalledOnce();
    expect(startConfirmations).not.toHaveBeenCalled();

    ensureAppointmentData({ state: { route: 'confirmations', unsubscribeAppointments: null, unsubscribeConfirmations: null }, hasAccess: () => true, startAppointments, startConfirmations });
    expect(startConfirmations).toHaveBeenCalledOnce();
  });

  it('cleans up appointment, confirmation and new-lead subscriptions', () => {
    const appointments = vi.fn();
    const confirmations = vi.fn();
    const store = vi.fn();
    const day = vi.fn();
    const state = { unsubscribeAppointments: appointments, unsubscribeConfirmations: confirmations, unsubscribeStoreSchedule: store, unsubscribeDayAppointments: day };
    stopAppointmentsSubscription(state);
    stopConfirmationsSubscription(state);
    stopNewLeadScheduleSubscriptions(state);
    expect(appointments).toHaveBeenCalledOnce();
    expect(confirmations).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledOnce();
    expect(day).toHaveBeenCalledOnce();
    expect(state).toMatchObject({ unsubscribeAppointments: null, unsubscribeConfirmations: null, unsubscribeStoreSchedule: null, unsubscribeDayAppointments: null });
  });

  it('subscribes to the selected number of confirmation days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00-03:00'));
    const subscribe = vi.fn(() => vi.fn());
    const state = {
      route: 'confirmations',
      profile: { uid: 'manager-1' },
      confirmations: { days: 14, loading: false, loaded: false, error: '' },
      unsubscribeConfirmations: null
    };

    startConfirmationsSubscription({ state, render: vi.fn(), hasAccess: () => true, subscribe });

    expect(subscribe).toHaveBeenCalledWith(state.profile, '2026-10-29', '2026-11-11', expect.any(Function), expect.any(Function));
    vi.useRealTimers();
  });

  it('keeps the current appointment list mounted during an attendance update', () => {
    let emitAppointments;
    const render = vi.fn();
    const subscribe = vi.fn((profile, month, storeId, onData) => {
      emitAppointments = onData;
      return vi.fn();
    });
    const shouldRender = vi.fn(() => false);
    const state = {
      route: 'appointments',
      profile: { uid: 'manager-1' },
      appointments: {
        month: '2026-10', storeId: '', updatingId: 'lead-1', loading: false, loaded: true,
        error: '', records: [], truncated: false, backfilledMonths: [], backfillingMonth: ''
      },
      unsubscribeAppointments: null
    };

    startAppointmentsSubscription({ state, render, hasAccess: () => true, isAdmin: () => false, subscribe, shouldRender });
    emitAppointments({ records: [{ id: 'lead-1', appointmentAttendance: 'attended' }], truncated: false });

    expect(render).toHaveBeenCalledOnce();
    expect(shouldRender).toHaveBeenCalledWith(state.appointments.records);
    expect(state.appointments.records[0].appointmentAttendance).toBe('attended');
  });
});
