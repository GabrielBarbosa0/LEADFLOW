import { describe, expect, it } from 'vitest';
import { appointmentChangeEvent, funnelStageLabel, initialFunnelStage, leadCreationEvents } from '../../src/app/features/funnel/funnel-model.js';
import { leadHistoryView } from '../../src/app/features/funnel/lead-history-view.js';

describe('funnel feature modules', () => {
  it('derives the initial funnel stage from the appointment', () => {
    expect(initialFunnelStage()).toBe('awaiting_appointment');
    expect(initialFunnelStage('2026-11-03')).toBe('scheduled');
    expect(funnelStageLabel('scheduled')).toBe('Agendado');
  });

  it('creates immutable creation events for the lead timeline', () => {
    const events = leadCreationEvents({
      id: 'lead-1',
      storeId: 'loja-06',
      appointmentDate: '2026-11-03',
      appointmentTime: '08:00'
    }, {
      uid: 'user-1',
      displayName: 'Maria Captadora',
      role: 'captor'
    }, new Date('2026-10-29T12:00:00.000Z'));

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.eventType)).toEqual(['lead_created', 'appointment_scheduled']);
    expect(events[1]).toMatchObject({ leadId: 'lead-1', funnelStage: 'scheduled', actorUid: 'user-1' });
  });

  it('records the correct event when an offline lead receives its first appointment', () => {
    const event = appointmentChangeEvent({
      id: 'lead-1', storeId: 'loja-06', appointmentDate: '', appointmentTime: ''
    }, {
      id: 'lead-1', storeId: 'loja-06', appointmentDate: '2026-11-03', appointmentTime: '08:00'
    }, {
      uid: 'user-1', displayName: 'Maria Captadora', role: 'captor'
    }, new Date('2026-10-29T12:00:00.000Z'));

    expect(event).toMatchObject({ eventType: 'appointment_scheduled', funnelStage: 'scheduled' });
  });

  it('renders a direct history list without a duplicated funnel heading', () => {
    const markup = leadHistoryView({
      loading: false,
      error: '',
      stage: 'scheduled',
      records: [{
        id: 'event-1',
        eventType: 'appointment_scheduled',
        funnelStage: 'scheduled',
        actorName: 'Maria Captadora',
        occurredAtClient: '2026-10-29T12:00:00.000Z'
      }]
    });

    expect(markup).toContain('Agendamento realizado');
    expect(markup).toContain('Agendado');
    expect(markup).not.toContain('<header>');
    expect(markup).not.toContain('FUNIL');
    expect(markup).not.toContain('<h3>Histórico do lead</h3>');
  });
});
