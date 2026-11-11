const DAY_MS = 24 * 60 * 60 * 1000;

const SAVWIN_STORE_IDS = Object.freeze({
  '0002': 'loja-02',
  '0004': 'loja-04',
  '0005': 'loja-05',
  '0006': 'loja-06'
});

class SavwinDryRunInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SavwinDryRunInputError';
  }
}

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function asFiniteMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function parseSaleDate(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day) return null;
  const timestamp = Date.parse(`${date}T23:59:59.999-03:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function leadCaptureTimestamp(lead) {
  const value = lead.capturedAtClient || lead.createdAtServer;
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (value && Number.isFinite(value.seconds)) return value.seconds * 1000;
  if (value && Number.isFinite(value._seconds)) return value._seconds * 1000;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDryRunPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SavwinDryRunInputError('Envie um objeto JSON valido.');
  }
  if (payload.mode !== 'dry_run') {
    throw new SavwinDryRunInputError('Somente o modo dry_run e permitido nesta integracao.');
  }
  if (!Array.isArray(payload.sales) || payload.sales.length === 0) {
    throw new SavwinDryRunInputError('Envie ao menos uma venda consolidada.');
  }
  if (payload.sales.length > 200) {
    throw new SavwinDryRunInputError('O dry-run aceita no maximo 200 vendas por requisicao.');
  }

  const attributionWindowDays = Number(payload.attributionWindowDays ?? 90);
  if (!Number.isInteger(attributionWindowDays) || attributionWindowDays < 1 || attributionWindowDays > 365) {
    throw new SavwinDryRunInputError('A janela de atribuicao deve estar entre 1 e 365 dias.');
  }

  const seenKeys = new Set();
  const sales = payload.sales.map((rawSale, index) => {
    const saleKey = String(rawSale?.saleKey || '').trim();
    const rawStoreCode = String(rawSale?.storeCode || '').trim();
    const storeCode = rawStoreCode.padStart(4, '0');
    const osNumber = String(rawSale?.osNumber || '').trim();
    const saleDate = String(rawSale?.saleDate || '');
    if (!saleKey || !rawStoreCode || !SAVWIN_STORE_IDS[storeCode] || !osNumber || parseSaleDate(saleDate) === null) {
      throw new SavwinDryRunInputError(`Venda ${index + 1}: informe saleKey, storeCode, osNumber e saleDate validos.`);
    }
    if (seenKeys.has(saleKey)) {
      throw new SavwinDryRunInputError(`Venda ${index + 1}: saleKey duplicada.`);
    }
    seenKeys.add(saleKey);
    return {
      saleKey,
      storeCode,
      storeId: SAVWIN_STORE_IDS[storeCode] || '',
      osNumber,
      saleDate,
      customerCpf: normalizeCpf(rawSale.customerCpf),
      reconciliationStatus: String(rawSale.reconciliationStatus || ''),
      reportedSaleNetValue: asFiniteMoney(rawSale.reportedSaleNetValue)
    };
  });
  return { attributionWindowDays, sales };
}

function classifySale(sale, leads, attributionWindowDays) {
  const base = { saleKey: sale.saleKey, status: '' };
  if (sale.reconciliationStatus !== 'matched') {
    return { ...base, status: 'reconciliation_divergent' };
  }
  if (!sale.customerCpf) return { ...base, status: 'missing_cpf' };
  if (!isValidCpf(sale.customerCpf)) return { ...base, status: 'invalid_cpf' };
  const activeLeads = leads.filter((lead) => lead.archived !== true);
  if (activeLeads.length === 0) return { ...base, status: 'no_lead' };

  const saleTimestamp = parseSaleDate(sale.saleDate);
  const capturedBeforeSale = activeLeads
    .map((lead) => ({ ...lead, captureTimestamp: leadCaptureTimestamp(lead) }))
    .filter((lead) => lead.captureTimestamp !== null && lead.captureTimestamp <= saleTimestamp);
  if (capturedBeforeSale.length === 0) return { ...base, status: 'sale_before_capture' };
  const withinWindow = capturedBeforeSale.filter(
    (lead) => saleTimestamp - lead.captureTimestamp < (attributionWindowDays + 1) * DAY_MS
  );
  if (withinWindow.length === 0) return { ...base, status: 'outside_window' };

  const sameStore = sale.storeId
    ? withinWindow.filter((lead) => String(lead.storeId || '') === sale.storeId)
    : [];
  const candidates = sameStore.length > 0 ? sameStore : withinWindow;
  if (candidates.length !== 1) {
    return { ...base, status: 'ambiguous', candidateCount: candidates.length };
  }

  const match = candidates[0];
  return {
    ...base,
    status: sameStore.length === 1 ? 'matched_same_store' : 'matched',
    leadId: String(match.id || ''),
    capturedByUid: String(match.capturedByUid || ''),
    leadStoreId: String(match.storeId || ''),
    saleStoreId: sale.storeId,
    daysToConversion: Math.max(0, Math.floor((saleTimestamp - match.captureTimestamp) / DAY_MS)),
    saleNetValue: sale.reportedSaleNetValue
  };
}

function buildDryRunResult(sales, leadsByCpf, attributionWindowDays) {
  const results = sales.map((sale) => classifySale(
    sale,
    leadsByCpf.get(sale.customerCpf) || [],
    attributionWindowDays
  ));
  const count = (statuses) => results.filter((result) => statuses.includes(result.status)).length;
  return {
    ok: true,
    mode: 'dry_run',
    summary: {
      salesReceived: sales.length,
      matched: count(['matched', 'matched_same_store']),
      matchedSameStore: count(['matched_same_store']),
      noLead: count(['no_lead']),
      ambiguous: count(['ambiguous']),
      missingCpf: count(['missing_cpf']),
      invalidCpf: count(['invalid_cpf']),
      saleBeforeCapture: count(['sale_before_capture']),
      outsideWindow: count(['outside_window']),
      reconciliationDivergent: count(['reconciliation_divergent'])
    },
    results
  };
}

module.exports = {
  SAVWIN_STORE_IDS,
  SavwinDryRunInputError,
  buildDryRunResult,
  isValidCpf,
  normalizeCpf,
  validateDryRunPayload
};
