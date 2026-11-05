import { describe, expect, it } from 'vitest';
import { hasActiveAppointment, validateAppointmentCancellation } from '../../src/utils/appointment-cancellation.js';
import { appointmentCancellationDialog } from '../../src/app/features/appointments/appointment-cancellation-dialog.js';

describe('appointment cancellation', () => {
  it('requires a reason and a description for the other option', () => {
    expect(validateAppointmentCancellation({ reason: '', details: '' }).errors.reason).toBeDefined();
    expect(validateAppointmentCancellation({ reason: 'client_withdrew', details: '' }).isValid).toBe(true);
    expect(validateAppointmentCancellation({ reason: 'other', details: '' }).errors.details).toBeDefined();
    expect(validateAppointmentCancellation({ reason: 'other', details: 'Mudou de cidade.' }).isValid).toBe(true);
  });

  it('does not consider cancelled appointments active', () => {
    expect(hasActiveAppointment({ appointmentDate: '2026-11-05', appointmentTime: '08:00' }, '2026-11-03')).toBe(true);
    expect(hasActiveAppointment({ appointmentDate: '2026-11-05', appointmentTime: '08:00', appointmentStatus: 'cancelled' }, '2026-11-03')).toBe(false);
    expect(hasActiveAppointment({ appointmentDate: '2026-11-05', appointmentTime: '08:00', appointmentAttendance: 'cancelled' }, '2026-11-03')).toBe(false);
  });

  it('renders the standardized reasons and preservation warning', () => {
    const markup = appointmentCancellationDialog({ lead: { id: 'lead-1', fullName: 'Maria Silva', appointmentDate: '2026-11-05', appointmentTime: '08:00' } });
    expect(markup).toContain('Cancelar agendamento?');
    expect(markup).toContain('Cliente desistiu');
    expect(markup).toContain('Outro motivo');
    expect(markup).toContain('será preservado');
  });
});
