const { createHash, createHmac } = require('node:crypto');

const MATCHED_STATUSES = new Set(['matched', 'matched_same_store']);
const ALLOWED_MATCH_STATUSES = new Set([
  ...MATCHED_STATUSES,
  'no_lead',
  'ambiguous',
  'missing_cpf',
  'invalid_cpf',
  'sale_before_capture',
  'outside_window',
  'reconciliation_divergent'
]);

class SavwinPersistencePlanError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SavwinPersistencePlanError';
  }
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function saleDocumentId(storeCode, osNumber) {
  const store = String(storeCode || '').trim().padStart(4, '0');
  const os = String(osNumber || '').trim();
  if (!/^\d{4}$/.test(store) || !os) {
    throw new SavwinPersistencePlanError('Loja e OS sao obrigatorias para gerar o identificador.');
  }
  return `sw_${sha256(`${store}\u0000${os}`)}`;
}

function customerCpfHash(customerCpf, hashKey) {
  const cpf = String(customerCpf || '').replace(/\D/g, '');
  if (!cpf) return '';
  if (!/^\d{11}$/.test(cpf)) {
    throw new SavwinPersistencePlanError('CPF invalido no plano de persistencia.');
  }
  if (String(hashKey || '').length < 32) {
    throw new SavwinPersistencePlanError('A chave de hash deve possuir ao menos 32 caracteres.');
  }
  return createHmac('sha256', hashKey).update(cpf).digest('hex');
}

function asDate(value, field) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new SavwinPersistencePlanError(`${field} deve ser uma data valida.`);
  }
  return date;
}

function asMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new SavwinPersistencePlanError('O valor liquido da venda deve ser positivo ou zero.');
  }
  return Math.round(number * 100) / 100;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function canonicalFingerprint(document) {
  return sha256(JSON.stringify([
    document.storeCode,
    document.osNumber,
    document.saleDate,
    document.customerCpfHash,
    document.netValue,
    document.reconciliationStatus,
    document.matchStatus
  ]));
}

function buildSavwinPersistencePlan({
  runId,
  importedAt,
  hashKey,
  sales,
  results
}) {
  const normalizedRunId = String(runId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(normalizedRunId)) {
    throw new SavwinPersistencePlanError('runId invalido.');
  }
  if (!Array.isArray(sales) || sales.length === 0 || !Array.isArray(results)) {
    throw new SavwinPersistencePlanError('Vendas e resultados sao obrigatorios.');
  }
  if (String(hashKey || '').length < 32) {
    throw new SavwinPersistencePlanError('A chave de hash deve possuir ao menos 32 caracteres.');
  }
  if (sales.length !== results.length) {
    throw new SavwinPersistencePlanError('A quantidade de vendas diverge dos resultados.');
  }

  const importedDate = asDate(importedAt, 'importedAt');
  const resultsByKey = new Map();
  for (const result of results) {
    const saleKey = String(result?.saleKey || '').trim();
    const status = String(result?.status || '').trim();
    if (!saleKey || resultsByKey.has(saleKey) || !ALLOWED_MATCH_STATUSES.has(status)) {
      throw new SavwinPersistencePlanError('Resultado duplicado, sem chave ou com status desconhecido.');
    }
    resultsByKey.set(saleKey, result);
  }

  const saleWrites = [];
  const attributionWrites = [];
  const reviewWrites = [];
  const seenSaleIds = new Set();
  const saleDates = [];

  for (const sale of sales) {
    const saleKey = String(sale?.saleKey || '').trim();
    const result = resultsByKey.get(saleKey);
    if (!result) throw new SavwinPersistencePlanError(`Resultado ausente para ${saleKey || '(sem chave)'}.`);

    const id = saleDocumentId(sale.storeCode, sale.osNumber);
    if (seenSaleIds.has(id)) throw new SavwinPersistencePlanError('A mesma loja e OS apareceu mais de uma vez.');
    seenSaleIds.add(id);

    const saleDate = String(sale.saleDate || '');
    if (!isCalendarDate(saleDate)) {
      throw new SavwinPersistencePlanError(`Data de venda invalida em ${saleKey}.`);
    }
    saleDates.push(saleDate);

    const document = {
      source: 'savwin',
      sourceSaleKey: saleKey,
      storeCode: String(sale.storeCode).padStart(4, '0'),
      storeId: String(sale.storeId || ''),
      osNumber: String(sale.osNumber),
      saleDate,
      customerCpfHash: customerCpfHash(sale.customerCpf, hashKey),
      netValue: asMoney(sale.reportedSaleNetValue),
      reconciliationStatus: String(sale.reconciliationStatus || ''),
      matchStatus: String(result.status),
      lastImportedAt: importedDate,
      schemaVersion: 1
    };
    document.sourceFingerprint = canonicalFingerprint(document);
    saleWrites.push({ collection: 'savwinSales', id, document });

    if (MATCHED_STATUSES.has(result.status)) {
      const required = ['leadId', 'capturedByUid', 'leadStoreId', 'saleStoreId'];
      if (required.some((field) => !String(result[field] || '').trim())
        || !Number.isInteger(result.daysToConversion)
        || result.daysToConversion < 0) {
        throw new SavwinPersistencePlanError(`Atribuicao incompleta para ${saleKey}.`);
      }
      attributionWrites.push({
        collection: 'leadSaleAttributions',
        id,
        document: {
          saleId: id,
          leadId: String(result.leadId),
          capturedByUid: String(result.capturedByUid),
          captureStoreId: String(result.leadStoreId),
          saleStoreId: String(result.saleStoreId),
          saleStoreCode: String(sale.storeCode).padStart(4, '0'),
          attributionStatus: 'automatic',
          attributionRule: result.status === 'matched_same_store'
            ? 'same_cpf_same_store_unique_before_sale'
            : 'same_cpf_unique_before_sale',
          daysToConversion: result.daysToConversion,
          attributedAt: importedDate,
          reviewedByUid: '',
          reviewReason: '',
          schemaVersion: 1
        }
      });
    } else {
      reviewWrites.push({
        collection: 'savwinReviewCases',
        id,
        document: {
          storeId: String(sale.storeId || ''),
          period: saleDate.slice(0, 7),
          saleDate,
          netValue: asMoney(sale.reportedSaleNetValue),
          matchStatus: String(result.status),
          reconciliationStatus: String(sale.reconciliationStatus || ''),
          reviewStatus: 'pending',
          reviewReason: '',
          reviewedByUid: '',
          reviewedAt: null,
          sourceUpdatedAt: importedDate,
          schemaVersion: 1
        }
      });
    }
  }

  if (resultsByKey.size !== saleWrites.length) {
    throw new SavwinPersistencePlanError('Existem resultados sem uma venda correspondente.');
  }

  const count = (statuses) => results.filter((result) => statuses.includes(result.status)).length;
  const sortedDates = [...saleDates].sort();
  const planFingerprint = sha256(JSON.stringify({
    sales: saleWrites.map((write) => [write.id, write.document.sourceFingerprint]),
    attributions: attributionWrites.map((write) => [
      write.id,
      write.document.leadId,
      write.document.attributionRule,
      write.document.daysToConversion
    ])
  }));
  const runWrite = {
    collection: 'savwinSyncRuns',
    id: normalizedRunId,
    document: {
      mode: 'homologation_plan',
      periodStart: sortedDates[0],
      periodEnd: sortedDates.at(-1),
      groupedSales: saleWrites.length,
      matchedSales: attributionWrites.length,
      unmatchedSales: saleWrites.length - attributionWrites.length,
      ambiguousSales: count(['ambiguous']),
      reconciliationErrors: count(['reconciliation_divergent']),
      startedAt: importedDate,
      finishedAt: importedDate,
      status: 'planned',
      planFingerprint,
      schemaVersion: 1
    }
  };

  return { runWrite, saleWrites, attributionWrites, reviewWrites };
}

module.exports = {
  SavwinPersistencePlanError,
  buildSavwinPersistencePlan,
  customerCpfHash,
  saleDocumentId
};
