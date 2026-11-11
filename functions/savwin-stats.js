const { createHash } = require('node:crypto');
const { assertEmulatorOnlyEnvironment } = require('./savwin-persistence-executor');

const STATS_COLLECTION = 'captorSalesStats';
const STORE_STATS_COLLECTION = 'storeCaptorSalesStats';
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

class SavwinStatsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SavwinStatsError';
  }
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function periodForDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : '';
}

function statsDocumentId(captorUid, period) {
  const uid = String(captorUid || '').trim();
  if (!uid || !/^\d{4}-\d{2}$/.test(period)) {
    throw new SavwinStatsError('Captador e periodo sao obrigatorios para o agregado.');
  }
  const hash = createHash('sha256').update(`${uid}\u0000${period}`).digest('hex');
  return `cs_${hash}`;
}

function storeStatsDocumentId(storeId, captorUid, period) {
  const normalizedStoreId = String(storeId || '').trim();
  const uid = String(captorUid || '').trim();
  if (!normalizedStoreId || !uid || !/^\d{4}-\d{2}$/.test(period)) {
    throw new SavwinStatsError('Loja, captador e periodo sao obrigatorios para o agregado por unidade.');
  }
  const hash = createHash('sha256')
    .update(`${normalizedStoreId}\u0000${uid}\u0000${period}`)
    .digest('hex');
  return `scs_${hash}`;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function dateFromLead(lead) {
  const value = lead.capturedAtClient || lead.createdAtServer;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  return new Date(value);
}

function validateInputs({ period, leads, sales, attributions, calculatedAt }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) {
    throw new SavwinStatsError('Periodo invalido; use YYYY-MM.');
  }
  if (![leads, sales, attributions].every(Array.isArray)) {
    throw new SavwinStatsError('Leads, vendas e atribuicoes devem ser listas.');
  }
  const date = calculatedAt instanceof Date ? calculatedAt : new Date(calculatedAt);
  if (!Number.isFinite(date.getTime())) throw new SavwinStatsError('calculatedAt invalido.');
  return date;
}

function coverageForScope(inputs, sales, activeAttributions, scopeStoreId, calculationDate) {
  const metadata = scopeStoreId
    ? inputs.syncCoverage?.byStore?.[scopeStoreId] || {}
    : inputs.syncCoverage || {};
  const saleStoreById = new Map(activeAttributions.map((item) => [item.saleId, String(item.saleStoreId || '')]));
  const periodSales = sales.filter((sale) => String(sale.saleDate).startsWith(`${inputs.period}-`)
    && (!scopeStoreId || String(sale.storeId || saleStoreById.get(sale.id) || '') === scopeStoreId));
  const periodAttributions = activeAttributions.filter((item) => {
    const sale = sales.find((candidate) => candidate.id === item.saleId);
    return sale && String(sale.saleDate).startsWith(`${inputs.period}-`)
      && (!scopeStoreId || String(item.saleStoreId || '') === scopeStoreId);
  });
  const dates = periodSales.map((sale) => String(sale.saleDate)).sort();
  const synchronizedAt = metadata.lastSuccessfulSyncAt || inputs.syncCoverage?.lastSuccessfulSyncAt || calculationDate;
  const synchronizedDate = synchronizedAt instanceof Date ? synchronizedAt : new Date(synchronizedAt);
  if (!Number.isFinite(synchronizedDate.getTime())) throw new SavwinStatsError('Data da ultima sincronizacao invalida.');
  return {
    coverageStartDate: metadata.coverageStartDate || inputs.syncCoverage?.coverageStartDate || dates[0] || '',
    coverageEndDate: metadata.coverageEndDate || inputs.syncCoverage?.coverageEndDate || dates.at(-1) || '',
    salesReceived: Number.isInteger(metadata.salesReceived) ? metadata.salesReceived : periodSales.length,
    salesEligible: Number.isInteger(metadata.salesEligible) ? metadata.salesEligible : periodSales.length,
    salesReconciled: Number.isInteger(metadata.salesReconciled) ? metadata.salesReconciled : periodAttributions.length,
    lastSuccessfulSyncAt: synchronizedDate
  };
}

function buildStats(inputs, scopeStoreId = '') {
  const { period, leads, sales, attributions, calculatedAt } = inputs;
  const calculationDate = validateInputs({ period, leads, sales, attributions, calculatedAt });
  const salesById = new Map();
  for (const sale of sales) {
    const id = String(sale?.id || '').trim();
    if (!id || salesById.has(id) || !isCalendarDate(String(sale.saleDate || ''))
      || !Number.isFinite(Number(sale.netValue)) || Number(sale.netValue) < 0) {
      throw new SavwinStatsError('Venda invalida ou duplicada no calculo de agregados.');
    }
    salesById.set(id, sale);
  }

  const activeAttributions = attributions.filter((attribution) => attribution?.active === true);
  const seenAttributionSales = new Set();
  for (const attribution of activeAttributions) {
    const saleId = String(attribution.saleId || '').trim();
    if (!saleId || seenAttributionSales.has(saleId) || !salesById.has(saleId)
      || !String(attribution.leadId || '').trim()
      || !String(attribution.capturedByUid || '').trim()
      || !Number.isInteger(attribution.daysToConversion)
      || attribution.daysToConversion < 0) {
      throw new SavwinStatsError('Atribuicao ativa invalida ou duplicada.');
    }
    seenAttributionSales.add(saleId);
  }

  const cohortLeads = leads.filter((lead) => {
    const captureDate = dateFromLead(lead);
    return String(lead?.id || '').trim()
      && String(lead?.capturedByUid || '').trim()
      && Number.isFinite(captureDate.getTime())
      && periodForDate(captureDate) === period
      && (!scopeStoreId || String(lead.storeId || '') === scopeStoreId)
      && lead.archived !== true;
  });
  const captorUids = new Set(cohortLeads.map((lead) => String(lead.capturedByUid)));
  for (const attribution of activeAttributions) {
    const sale = salesById.get(attribution.saleId);
    if (String(sale.saleDate).startsWith(`${period}-`)
      && (!scopeStoreId || String(attribution.saleStoreId || '') === scopeStoreId)) {
      captorUids.add(String(attribution.capturedByUid));
    }
  }

  const firstSaleByLead = new Map();
  for (const attribution of activeAttributions) {
    const sale = salesById.get(attribution.saleId);
    const current = firstSaleByLead.get(attribution.leadId);
    if (!current || sale.saleDate < current.sale.saleDate) {
      firstSaleByLead.set(attribution.leadId, { attribution, sale });
    }
  }

  return [...captorUids].sort().map((captorUid) => {
    const captorCohort = cohortLeads.filter((lead) => String(lead.capturedByUid) === captorUid);
    const cohortLeadIds = new Set(captorCohort.map((lead) => String(lead.id)));
    const convertedCohortLeadIds = new Set(activeAttributions
      .filter((attribution) => attribution.capturedByUid === captorUid
        && cohortLeadIds.has(attribution.leadId)
        && (!scopeStoreId || String(attribution.captureStoreId || '') === scopeStoreId))
      .map((attribution) => attribution.leadId));

    const periodAttributions = activeAttributions.filter((attribution) => {
      const sale = salesById.get(attribution.saleId);
      return attribution.capturedByUid === captorUid
        && String(sale.saleDate).startsWith(`${period}-`)
        && (!scopeStoreId || String(attribution.saleStoreId || '') === scopeStoreId);
    });
    const periodLeadIds = new Set(periodAttributions.map((attribution) => attribution.leadId));
    const netRevenue = round(periodAttributions.reduce(
      (total, attribution) => total + Number(salesById.get(attribution.saleId).netValue),
      0
    ));
    const firstConversions = [...firstSaleByLead.values()].filter(({ attribution, sale }) => (
      attribution.capturedByUid === captorUid
      && String(sale.saleDate).startsWith(`${period}-`)
      && (!scopeStoreId || String(attribution.saleStoreId || '') === scopeStoreId)
    ));
    const averageDaysToFirstConversion = firstConversions.length
      ? round(firstConversions.reduce(
        (total, entry) => total + entry.attribution.daysToConversion,
        0
      ) / firstConversions.length)
      : null;
    const capturedLeads = captorCohort.length;
    const convertedCapturedLeads = convertedCohortLeadIds.size;
    const storeIds = new Set([
      ...captorCohort.map((lead) => String(lead.storeId || '')).filter(Boolean),
      ...periodAttributions.flatMap((attribution) => [
        String(attribution.captureStoreId || ''),
        String(attribution.saleStoreId || '')
      ]).filter(Boolean)
    ]);

    const document = {
      captorUid,
      period,
      timeZone: SAO_PAULO_TIME_ZONE,
      captureCohortBasis: 'lead_capture_month',
      capturedLeads,
      convertedCapturedLeads,
      conversionRate: capturedLeads ? round((convertedCapturedLeads / capturedLeads) * 100) : null,
      salesBasis: 'sale_month',
      convertedLeads: periodLeadIds.size,
      salesCount: periodAttributions.length,
      netRevenue,
      averageTicket: periodAttributions.length ? round(netRevenue / periodAttributions.length) : null,
      averageDaysToFirstConversion,
      firstConversionsMeasured: firstConversions.length,
      lastCalculatedAt: calculationDate,
      ...coverageForScope(inputs, sales, activeAttributions, scopeStoreId, calculationDate),
      schemaVersion: 2
    };
    if (scopeStoreId) {
      document.storeId = scopeStoreId;
      document.captureStoreBasis = 'capture_store';
      document.salesStoreBasis = 'sale_store';
    } else {
      document.storeIds = [...storeIds].sort();
    }

    return {
      collection: scopeStoreId ? STORE_STATS_COLLECTION : STATS_COLLECTION,
      id: scopeStoreId
        ? storeStatsDocumentId(scopeStoreId, captorUid, period)
        : statsDocumentId(captorUid, period),
      document
    };
  });
}

function buildCaptorSalesStats(inputs) {
  return buildStats(inputs);
}

function buildStoreCaptorSalesStats(inputs) {
  const stores = new Set();
  for (const lead of inputs.leads || []) {
    const storeId = String(lead?.storeId || '').trim();
    if (storeId) stores.add(storeId);
  }
  for (const attribution of inputs.attributions || []) {
    for (const value of [attribution?.captureStoreId, attribution?.saleStoreId]) {
      const storeId = String(value || '').trim();
      if (storeId) stores.add(storeId);
    }
  }
  return [...stores].sort().flatMap((storeId) => buildStats(inputs, storeId));
}

async function rebuildCaptorSalesStats(firestore, period, writes, options = {}) {
  return rebuildStatsCollection(firestore, period, writes, STATS_COLLECTION, options);
}

async function rebuildStoreCaptorSalesStats(firestore, period, writes, options = {}) {
  return rebuildStatsCollection(firestore, period, writes, STORE_STATS_COLLECTION, options);
}

async function rebuildStatsCollection(firestore, period, writes, collectionName, options = {}) {
  assertEmulatorOnlyEnvironment(options.environment);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || '')) || !Array.isArray(writes)) {
    throw new SavwinStatsError('Periodo ou plano de agregados invalido.');
  }
  const ids = new Set();
  for (const write of writes) {
    if (write?.collection !== collectionName || !write.id || ids.has(write.id)
      || write.document?.period !== period) {
      throw new SavwinStatsError('Escrita de agregado invalida ou duplicada.');
    }
    ids.add(write.id);
  }

  const existing = await firestore.collection(collectionName).where('period', '==', period).get();
  const batch = firestore.batch();
  let deleted = 0;
  for (const document of existing.docs) {
    if (!ids.has(document.id)) {
      batch.delete(document.ref);
      deleted += 1;
    }
  }
  for (const write of writes) {
    batch.set(firestore.collection(collectionName).doc(write.id), write.document);
  }
  await batch.commit();
  return { written: writes.length, deleted };
}

module.exports = {
  SavwinStatsError,
  buildCaptorSalesStats,
  buildStoreCaptorSalesStats,
  periodForDate,
  rebuildCaptorSalesStats,
  rebuildStoreCaptorSalesStats,
  statsDocumentId,
  storeStatsDocumentId
};
