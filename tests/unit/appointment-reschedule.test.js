import { describe, expect, it } from 'vitest';
import { hasAppointmentScheduleChanged, validateRescheduleSchedule } from '../../src/utils/appointment-reschedule.js';

describe('appointment reschedule helpers', () => {
  it('does not treat equivalent schedule values as a reschedule', () => {
    expect(hasAppointmentScheduleChanged(
      { appointmentDate: '2026-11-07', appointmentTime: '08:00' },
      { appointmentDate: ' 2026-11-07 ', appointmentTime: '08:00 ' }
    )).toBe(false);
  });

  it('detects an actual date or time change', () => {
    expect(hasAppointmentScheduleChanged(
      { appointmentDate: '2026-11-07', appointmentTime: '08:00' },
      { appointmentDate: '2026-11-08', appointmentTime: '08:00' }
    )).toBe(true);
  });

  it('requires the new date and time before opening the confirmation modal', () => {
    expect(validateRescheduleSchedule({ appointmentDate: '2026-11-08', appointmentTime: '' }))
      .toMatchObject({ isValid: false, errors: { appointmentTime: expect.any(String) } });
    expect(validateRescheduleSchedule({ appointmentDate: '2026-11-08', appointmentTime: '09:20' }))
      .toEqual({ isValid: true, errors: {} });
  });
});
