import { dashboardSummary } from '../../../utils/dashboard.js';
import { hasActiveAppointment } from '../../../utils/appointment-cancellation.js';

export function appointmentDistribution(records) {
  const appointments = records.filter((lead) => hasActiveAppointment(lead));
  const weekdays = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [0, 'Domingo']]
    .map(([index, label]) => ({ label, count: appointments.filter((lead) => new Date(`${lead.appointmentDate}T12:00:00`).getDay() === index).length }));
  const periods = [['Madrugada', 0, 6], ['Manhã', 6, 12], ['Tarde', 12, 18], ['Noite', 18, 24]].map(([label, start, end]) => ({
    label,
    count: appointments.filter((lead) => { const hour = Number(String(lead.appointmentTime).slice(0, 2)); return Number.isFinite(hour) && hour >= start && hour < end; }).length
  }));
  const highest = Math.max(0, ...periods.map((item) => item.count));
  const leaders = periods.filter((item) => item.count === highest && highest > 0);
  return { appointments, weekdays, periods, predominantPeriod: leaders.length === 1 ? leaders[0].label : '' };
}

export function dashboardGroupStats(records, keyFor, labelFor) {
  return [...records.reduce((groups, lead) => {
    const key = keyFor(lead) || 'not-informed';
    if (!groups.has(key)) groups.set(key, { label: labelFor(lead), records: [] });
    groups.get(key).records.push(lead);
    return groups;
  }, new Map()).values()].map((group) => {
    const scheduled = group.records.filter((lead) => hasActiveAppointment(lead)).length;
    const attended = group.records.filter((lead) => lead.appointmentAttendance === 'attended').length;
    const missed = group.records.filter((lead) => lead.appointmentAttendance === 'missed').length;
    return { label: group.label, total: group.records.length, scheduled, attended, missed, attendanceRate: attended + missed ? Math.round((attended / (attended + missed)) * 100) : 0 };
  });
}

export function dashboardCaptorStats(records, storeId = '') {
  const source = storeId ? records.filter((lead) => lead.storeId === storeId) : records;
  return dashboardGroupStats(
    source,
    (lead) => lead.capturedByUid || lead.capturedByName,
    (lead) => lead.capturedByName || 'Não informado'
  ).sort((a, b) => b.total - a.total || b.attendanceRate - a.attendanceRate || a.label.localeCompare(b.label, 'pt-BR'));
}

export function dashboardMetrics(records, upcomingRecords, storeLabel, now = new Date(), comparisonRecords = records) {
  const summary = dashboardSummary(records, upcomingRecords, now);
  const attended = records.filter((lead) => lead.appointmentAttendance === 'attended').length;
  const missed = records.filter((lead) => lead.appointmentAttendance === 'missed').length;
  const pending = Math.max(0, summary.scheduled - attended - missed);
  const attendanceRate = attended + missed ? Math.round((attended / (attended + missed)) * 100) : 0;
  const daily = [...records.reduce((days, lead) => { const date = String(lead.capturedAtClient || '').slice(0, 10); if (date) days.set(date, (days.get(date) || 0) + 1); return days; }, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const stores = dashboardGroupStats(comparisonRecords, (lead) => lead.storeId, (lead) => storeLabel(lead.storeId)).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
  const captors = dashboardCaptorStats(records);
  const activeStoreCount = new Set(records.map((lead) => lead.storeId).filter(Boolean)).size;
  return { summary, attended, missed, pending, attendanceRate, daily, stores, captors, activeStoreCount, appointmentDistribution: appointmentDistribution(records) };
}
