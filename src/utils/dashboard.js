import { calculateAge, EXAM_PAYMENT_METHODS, INTERESTS, PATHOLOGIES, STRATEGY_TYPES } from './lead.js';
import { activeLeads } from './lead-archive.js';
import { APPOINTMENT_CANCELLATION_REASONS, hasActiveAppointment } from './appointment-cancellation.js';
import { APPOINTMENT_RESCHEDULE_REASONS } from './appointment-reschedule.js';

function percentage(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(date, days) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

function transportSeatsFor(lead) {
  if (!lead?.needsTransport) return 0;
  const configuredSeats = Number(lead.transportSeats);
  if (Number.isFinite(configuredSeats) && configuredSeats > 0) return configuredSeats;
  return lead.hasCompanion ? 2 : 1;
}

function companionCountFor(lead) {
  const count = Number(lead?.companionCount);
  if (Number.isInteger(count) && count >= 0) return count;
  return lead?.hasCompanion ? 1 : 0;
}

function distributionItem(id, label, count, total) {
  return { id, label, count, percentage: percentage(count, total) };
}

function reasonDistribution(records, field, options) {
  const informed = records.filter((lead) => lead[field]);
  return options.map((option) => distributionItem(
    option.id,
    option.label,
    informed.filter((lead) => lead[field] === option.id).length,
    informed.length
  )).filter((item) => item.count)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

export function paymentMethodDistribution(records, field, legacyField = '') {
  const validMethods = new Set(EXAM_PAYMENT_METHODS.map((method) => method.id));
  const informedMethods = records.flatMap((lead) => {
    const configured = Array.isArray(lead[field]) ? lead[field] : [lead[field] || (legacyField ? lead[legacyField] : '')].filter(Boolean);
    return [...new Set(configured.map((method) => String(method)).filter((method) => validMethods.has(method)))];
  });
  return EXAM_PAYMENT_METHODS
    .map((method) => distributionItem(method.id, method.label, informedMethods.filter((value) => value === method.id).length, informedMethods.length))
    .filter((item) => item.count)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

function ageRangeFor(birthDate, referenceDate) {
  const age = calculateAge(birthDate, referenceDate);
  if (age === null) return 'not-informed';
  if (age <= 39) return 'up-to-39';
  if (age <= 54) return '40-to-54';
  if (age <= 64) return '55-to-64';
  return '65-plus';
}

export function upcomingDateRange(today = new Date()) {
  return {
    startDate: localDateKey(today),
    endDate: localDateKey(addLocalDays(today, 6))
  };
}

export function dashboardSummary(records = [], upcomingRecords = records, today = new Date()) {
  records = activeLeads(records);
  upcomingRecords = activeLeads(upcomingRecords);
  const total = records.length;
  const scheduled = records.filter((lead) => hasActiveAppointment(lead)).length;
  const ophthalmologist = records.filter((lead) => lead.careRoute === 'ophthalmologist').length;
  const transportRecords = records.filter((lead) => lead.needsTransport);
  const paidExams = records.filter((lead) => lead.examPaymentType === 'paid').length;
  const courtesyExams = records.filter((lead) => lead.examPaymentType === 'courtesy').length;
  const unspecifiedExams = Math.max(0, total - paidExams - courtesyExams);
  const { startDate, endDate } = upcomingDateRange(today);
  const upcoming = upcomingRecords.filter((lead) => (
    hasActiveAppointment(lead, startDate)
    && lead.appointmentDate <= endDate
  ));
  const upcomingTransport = upcoming.filter((lead) => lead.needsTransport);
  const clinicalRoutes = [
    ['optometrist', 'Optometrista'],
    ['ophthalmologist', 'Oftalmologista'],
    ['not-informed', 'Não informado']
  ].map(([id, label]) => distributionItem(
    id,
    label,
    records.filter((lead) => (lead.careRoute || 'not-informed') === id).length,
    total
  ));
  const pathologyCounts = new Map(PATHOLOGIES
    .filter((item) => !['none', 'unknown'].includes(item.id))
    .map((item) => [item.id, 0]));
  records.forEach((lead) => {
    [...new Set(Array.isArray(lead.pathologyIds) ? lead.pathologyIds : [])].forEach((id) => {
      if (pathologyCounts.has(id)) pathologyCounts.set(id, pathologyCounts.get(id) + 1);
    });
  });
  const pathologies = PATHOLOGIES
    .filter((item) => pathologyCounts.has(item.id))
    .map((item) => distributionItem(item.id, item.label, pathologyCounts.get(item.id), total))
    .filter((item) => item.count)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  const ageRangeDefinitions = [
    ['up-to-39', 'Até 39 anos'],
    ['40-to-54', '40 a 54 anos'],
    ['55-to-64', '55 a 64 anos'],
    ['65-plus', '65 anos ou mais'],
    ['not-informed', 'Não informado']
  ];
  const ageRanges = ageRangeDefinitions.map(([id, label]) => distributionItem(
    id,
    label,
    records.filter((lead) => ageRangeFor(lead.birthDate, today) === id).length,
    total
  ));
  const sexes = [
    ['female', 'Feminino'],
    ['male', 'Masculino'],
    ['other', 'Outro'],
    ['not-informed', 'Não informado']
  ].map(([id, label]) => distributionItem(
    id,
    label,
    records.filter((lead) => (lead.sex || 'not-informed') === id).length,
    total
  ));
  const cancellationReasons = reasonDistribution(records, 'appointmentCancellationReason', APPOINTMENT_CANCELLATION_REASONS);
  const rescheduleReasons = reasonDistribution(records, 'appointmentRescheduleReason', APPOINTMENT_RESCHEDULE_REASONS);
  const examPaymentMethods = paymentMethodDistribution(records, 'examPaymentMethods', 'examPaymentMethod');
  const productPaymentMethods = paymentMethodDistribution(records, 'productPaymentMethods');
  const interests = INTERESTS.map((item) => distributionItem(
    item.id || 'not-informed',
    item.label,
    records.filter((lead) => (lead.interestId || 'not-informed') === (item.id || 'not-informed')).length,
    total
  )).filter((item) => item.count)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  const strategyDefinitions = [
    ...STRATEGY_TYPES.filter((item) => item.id),
    ...STRATEGY_TYPES.filter((item) => !item.id)
  ];
  const strategyTypes = strategyDefinitions.map((item) => distributionItem(
    item.id || 'not-informed',
    item.label,
    records.filter((lead) => (lead.strategyType || 'not-informed') === (item.id || 'not-informed')).length,
    total
  ));
  const transportByDay = [...upcomingTransport.reduce((days, lead) => {
    const current = days.get(lead.appointmentDate) || { date: lead.appointmentDate, clients: 0, companions: 0, seats: 0 };
    current.clients += 1;
    current.companions += companionCountFor(lead);
    current.seats += transportSeatsFor(lead);
    days.set(lead.appointmentDate, current);
    return days;
  }, new Map()).values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    total,
    scheduled,
    appointmentRate: percentage(scheduled, total),
    awaitingAppointment: Math.max(0, total - scheduled),
    awaitingAppointmentRate: percentage(Math.max(0, total - scheduled), total),
    ophthalmologist,
    ophthalmologistRate: percentage(ophthalmologist, total),
    transportClients: transportRecords.length,
    transportSeats: transportRecords.reduce((sum, lead) => sum + transportSeatsFor(lead), 0),
    paidExams,
    paidExamRate: percentage(paidExams, total),
    courtesyExams,
    courtesyExamRate: percentage(courtesyExams, total),
    unspecifiedExams,
    unspecifiedExamRate: percentage(unspecifiedExams, total),
    upcomingAppointments: upcoming.length,
    upcomingTransportClients: upcomingTransport.length,
    upcomingTransportSeats: upcomingTransport.reduce((sum, lead) => sum + transportSeatsFor(lead), 0),
    clinicalRoutes,
    pathologies,
    ageRanges,
    sexes,
    cancellationReasons,
    rescheduleReasons,
    examPaymentMethods,
    productPaymentMethods,
    interests,
    strategyTypes,
    transportByDay,
    upcomingStartDate: startDate,
    upcomingEndDate: endDate
  };
}
