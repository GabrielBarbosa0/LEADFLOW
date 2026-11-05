import { describe, expect, it } from 'vitest';
import {
  appointmentRescheduleReasonLabel,
  hasAppointmentScheduleChanged,
  validateAppointmentReschedule,
  validateRescheduleSchedule
} from '../../src/utils/appointment-reschedule.js';
import { appointmentRescheduleDialog } from '../../src/app/features/appointments/appointment-reschedule-dialog.js';

describe('appointment reschedule', () => {
  it('requires a new complete schedule', () => {
    expect(validateRescheduleSchedule({ appointmentDate: '', appointmentTime: '' }).errors)
      .toMatchObject({ appointmentDate: expect.any(String), appointmentTime: expect.any(String) });
    expect(validateRescheduleSchedule({ appointmentDate: '2026-11-06', appointmentTime: '10:00' }).isValid)
      .toBe(true);
    expect(hasAppointmentScheduleChanged(
      { appointmentDate: '2026-11-05', appointmentTime: '08:00' },
      { appointmentDate: '2026-11-05', appointmentTime: '08:20' }
    )).toBe(true);
  });

  it('requires a reason and details for the other option', () => {
    expect(validateAppointmentReschedule({ reason: '', details: '' }).errors.reason).toBeDefined();
    expect(validateAppointmentReschedule({ reason: 'client_request', details: '' }).isValid).toBe(true);
    expect(validateAppointmentReschedule({ reason: 'other', details: '' }).errors.details).toBeDefined();
    expect(validateAppointmentReschedule({ reason: 'other', details: 'Mudanca solicitada.' }).isValid).toBe(true);
    expect(appointmentRescheduleReasonLabel('schedule_conflict')).toBe('Conflito de horário');
  });

  it('shows the previous and new schedule in the confirmation modal', () => {
    const markup = appointmentRescheduleDialog({
      lead: { fullName: 'Maria Silva', appointmentDate: '2026-11-05', appointmentTime: '08:00' },
      draft: { appointmentDate: '2026-11-06', appointmentTime: '10:20' }
    });
    expect(markup).toContain('Reagendar cliente?');
    expect(markup).toContain('05 de novembro');
    expect(markup).toContain('08:00');
    expect(markup).toContain('06 de novembro');
    expect(markup).toContain('10:20');
    expect(markup).toContain('Outro motivo');
  });
});
