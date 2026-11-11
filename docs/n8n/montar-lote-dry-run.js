const MAX_SALES = 200;
const ATTRIBUTION_WINDOW_DAYS = 90;
const ALLOWED_STORE_CODES = new Set(['0002', '0004', '0005', '0006']);

const rows = $input.all().map((item) => item.json);
if (rows.length === 0) throw new Error('Nenhuma OS consolidada foi recebida.');
if (rows.length > MAX_SALES) {
  throw new Error(`O lote possui ${rows.length} OSs; o limite do dry-run e ${MAX_SALES}.`);
}

const saleKeys = new Set();
const sales = rows.map((row, index) => {
  const saleKey = String(row.saleKey || '').trim();
  const storeCode = String(row.storeCode || '').trim().padStart(4, '0');
  const osNumber = String(row.osNumber || '').trim();
  const saleDate = String(row.saleDate || '').trim();
  const customerCpf = String(row.customerCpf || '').replace(/\D/g, '');
  const reconciliationStatus = String(row.reconciliationStatus || 'unknown');
  const reportedSaleNetValue = Number(row.reportedSaleNetValue);

  if (!saleKey || !osNumber || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
    throw new Error(`OS ${index + 1}: saleKey, osNumber ou saleDate invalido.`);
  }
  if (!ALLOWED_STORE_CODES.has(storeCode)) {
    throw new Error(`OS ${saleKey}: loja ${storeCode} nao permitida.`);
  }
  if (saleKeys.has(saleKey)) throw new Error(`OS duplicada no lote: ${saleKey}.`);
  if (!Number.isFinite(reportedSaleNetValue)) {
    throw new Error(`OS ${saleKey}: reportedSaleNetValue invalido.`);
  }
  saleKeys.add(saleKey);

  return {
    saleKey,
    storeCode,
    osNumber,
    saleDate,
    customerCpf,
    reconciliationStatus,
    reportedSaleNetValue: Math.round(reportedSaleNetValue * 100) / 100
  };
});

return [{
  json: {
    mode: 'dry_run',
    attributionWindowDays: ATTRIBUTION_WINDOW_DAYS,
    sales,
    preflight: {
      salesPrepared: sales.length,
      salesWithCpf: sales.filter((sale) => sale.customerCpf.length === 11).length,
      reconciliationMatched: sales.filter((sale) => sale.reconciliationStatus === 'matched').length,
      externalRequestSent: false
    }
  }
}];
