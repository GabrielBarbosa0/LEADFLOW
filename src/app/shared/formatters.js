import { STORES } from '../../utils/stores.js';

export function toLocalDateInput(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function addDaysToDateInput(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalDateInput(date);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function roleLabel(role) {
  return { captor: 'Captador', manager: 'Gestor', admin: 'Administrador' }[role] || 'Colaborador';
}

export function profileInitials(displayName = '') {
  return String(displayName)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

export function profileAccessSignature(profile) {
  if (!profile) return '';
  return JSON.stringify({
    displayName: profile.displayName,
    role: profile.role,
    roleProfileId: profile.roleProfileId,
    roleProfileName: profile.roleProfileName,
    permissions: profile.permissions,
    storeId: profile.storeId,
    storeIds: profile.storeIds,
    active: profile.active
  });
}

export function storeLabel(storeId = '') {
  return storeId.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function storeDisplayLabel(storeId = '') {
  return STORES.find((store) => store.id === storeId)?.displayLabel || storeLabel(storeId);
}

export function formatCapturedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function formatGoalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}

export function formatAppointmentDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    .format(new Date(`${value}T12:00:00`));
}

export function formatDateTimeValue(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function syncLabel(lead) {
  if (lead.syncState === 'error') return ['Não sincronizado', 'danger'];
  if (lead.syncState === 'syncing') return ['Sincronizando', 'warning'];
  if (lead.syncState === 'pending') return ['Pendente de sincronização', 'warning'];
  if (lead.appointmentStatus === 'cancelled' || lead.appointmentAttendance === 'cancelled') {
    return ['Cancelado', 'warning'];
  }
  if (!lead.appointmentDate || !lead.appointmentTime) return ['Aguardando agendamento', 'warning'];
  return ['Agendado', 'success'];
}

export function offlineSyncDetail(lead) {
  if (lead.syncState === 'syncing') return 'Enviando cadastro para a nuvem.';
  if (lead.syncState === 'pending') return 'Salvo neste aparelho. Sincronização automática pendente.';
  if (lead.syncState === 'error') return 'Não foi possível sincronizar. O cadastro continua salvo neste aparelho.';
  return '';
}
