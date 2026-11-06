import { describe, expect, it } from 'vitest';
import {
  addDaysToDateInput,
  escapeHtml,
  formatAppointmentDate,
  formatDateTimeValue,
  formatGoalDate,
  offlineSyncDetail,
  profileAccessSignature,
  profileInitials,
  roleLabel,
  storeDisplayLabel,
  storeLabel,
  syncLabel,
  toLocalDateInput
} from '../../src/app/shared/formatters.js';

describe('shared formatters', () => {
  it('formats local dates without shifting the calendar day', () => {
    expect(toLocalDateInput(new Date(2026, 9, 29, 23, 30))).toBe('2026-10-29');
    expect(addDaysToDateInput('2026-10-31', 1)).toBe('2026-11-01');
    expect(formatGoalDate('2026-10-29')).toBe('29/10/2026');
    expect(formatAppointmentDate('2026-10-29')).toContain('29 de outubro');
  });

  it('formats Firestore-like and native date-time values', () => {
    const date = new Date(2026, 9, 29, 14, 30);
    expect(formatDateTimeValue(date)).toContain('29/10/2026');
    expect(formatDateTimeValue({ toDate: () => date })).toContain('14:30');
    expect(formatDateTimeValue('invalid')).toBe('');
  });

  it('formats labels and profile presentation values', () => {
    expect(roleLabel('manager')).toBe('Gestor');
    expect(roleLabel('unknown')).toBe('Colaborador');
    expect(profileInitials('  Gabriel Gomes Barbosa  ')).toBe('GG');
    expect(profileInitials('')).toBe('?');
    expect(storeLabel('loja-06')).toBe('Loja 06');
    expect(storeDisplayLabel('loja-06')).toBeTruthy();
  });

  it('escapes values rendered inside HTML templates', () => {
    expect(escapeHtml(`<script data-name="test">'unsafe' & value</script>`))
      .toBe('&lt;script data-name=&quot;test&quot;&gt;&#039;unsafe&#039; &amp; value&lt;/script&gt;');
  });

  it('creates a stable signature from access-relevant profile fields', () => {
    const profile = {
      displayName: 'Maria', role: 'captor', permissions: ['leads.create'],
      storeId: 'loja-06', storeIds: ['loja-06'], active: true, ignored: 'value'
    };
    expect(profileAccessSignature(profile)).toBe(profileAccessSignature({ ...profile, ignored: 'changed' }));
    expect(profileAccessSignature(null)).toBe('');
  });

  it('describes synchronization state without changing lead data', () => {
    expect(syncLabel({ syncState: 'pending' })).toEqual(['Pendente de sincronização', 'warning']);
    expect(syncLabel({ appointmentDate: '', appointmentTime: '' })).toEqual(['Aguardando agendamento', 'warning']);
    expect(syncLabel({ appointmentDate: '2026-10-29', appointmentTime: '08:00' })).toEqual(['Agendado', 'success']);
    expect(syncLabel({
      appointmentDate: '2026-10-29', appointmentTime: '08:00', appointmentStatus: 'cancelled'
    })).toEqual(['Cancelado', 'warning']);
    expect(syncLabel({
      appointmentDate: '2026-10-29', appointmentTime: '08:00', appointmentAttendance: 'cancelled'
    })).toEqual(['Cancelado', 'warning']);
    expect(offlineSyncDetail({ syncState: 'error' })).toContain('continua salvo');
    expect(offlineSyncDetail({ syncState: 'synced' })).toBe('');
  });
});
