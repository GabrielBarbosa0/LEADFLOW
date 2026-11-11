const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeSalesStatsPeriod(value) {
  const period = String(value || '').trim();
  if (!PERIOD_PATTERN.test(period)) {
    const error = new Error('Periodo invalido; use YYYY-MM.');
    error.code = 'invalid-argument';
    throw error;
  }
  return period;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calendarDate(value) {
  const date = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function timestampDate(value) {
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function normalizeSalesStatsDocument(id, value = {}) {
  return {
    id: String(id || ''),
    captorUid: String(value.captorUid || ''),
    period: String(value.period || ''),
    storeId: value.storeId ? String(value.storeId) : '',
    capturedLeads: finiteNumber(value.capturedLeads),
    convertedCapturedLeads: finiteNumber(value.convertedCapturedLeads),
    conversionRate: nullableNumber(value.conversionRate),
    convertedLeads: finiteNumber(value.convertedLeads),
    salesCount: finiteNumber(value.salesCount),
    netRevenue: finiteNumber(value.netRevenue),
    averageTicket: nullableNumber(value.averageTicket),
    averageDaysToFirstConversion: nullableNumber(value.averageDaysToFirstConversion),
    firstConversionsMeasured: finiteNumber(value.firstConversionsMeasured),
    lastCalculatedAt: value.lastCalculatedAt || null,
    coverageStartDate: calendarDate(value.coverageStartDate),
    coverageEndDate: calendarDate(value.coverageEndDate),
    salesReceived: finiteNumber(value.salesReceived),
    salesEligible: finiteNumber(value.salesEligible),
    salesReconciled: finiteNumber(value.salesReconciled),
    lastSuccessfulSyncAt: value.lastSuccessfulSyncAt || null,
    schemaVersion: finiteNumber(value.schemaVersion, 1)
  };
}


export function salesCoverageSummary(records = [], now = new Date()) {
  const source = records.filter(Boolean);
  if (!source.length) return null;
  const syncDates = source.map((record) => timestampDate(record.lastSuccessfulSyncAt)).filter(Boolean);
  const lastSuccessfulSyncAt = syncDates.sort((a, b) => b - a)[0] || null;
  const starts = source.map((record) => calendarDate(record.coverageStartDate)).filter(Boolean).sort();
  const ends = source.map((record) => calendarDate(record.coverageEndDate)).filter(Boolean).sort();
  const salesReceived = Math.max(0, ...source.map((record) => finiteNumber(record.salesReceived)));
  const salesEligible = Math.max(0, ...source.map((record) => finiteNumber(record.salesEligible)));
  const salesReconciled = Math.max(0, ...source.map((record) => finiteNumber(record.salesReconciled)));
  const ageHours = lastSuccessfulSyncAt
    ? Math.max(0, (timestampDate(now).getTime() - lastSuccessfulSyncAt.getTime()) / 3600000)
    : null;
  const freshness = ageHours === null ? 'unknown' : ageHours <= 24 ? 'current' : ageHours <= 72 ? 'attention' : 'stale';
  return {
    coverageStartDate: starts[0] || '',
    coverageEndDate: ends.at(-1) || '',
    salesReceived,
    salesEligible,
    salesReconciled,
    lastSuccessfulSyncAt,
    freshness,
    completeness: salesEligible < salesReceived ? 'partial' : 'complete'
  };
}
