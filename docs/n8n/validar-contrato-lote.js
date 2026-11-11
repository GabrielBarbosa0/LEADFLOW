const ALLOWED_SALE_FIELDS = [
  'customerCpf',
  'osNumber',
  'reconciliationStatus',
  'reportedSaleNetValue',
  'saleDate',
  'saleKey',
  'storeCode'
];

const items = $input.all();
if (items.length !== 1) throw new Error(`Esperado 1 lote; recebidos ${items.length}.`);

const payload = items[0].json;
if (payload.mode !== 'dry_run') throw new Error('O lote nao esta em modo dry_run.');
if (!Array.isArray(payload.sales) || payload.sales.length === 0) {
  throw new Error('O lote nao possui vendas.');
}

for (const [index, sale] of payload.sales.entries()) {
  const fields = Object.keys(sale).sort();
  if (JSON.stringify(fields) !== JSON.stringify(ALLOWED_SALE_FIELDS)) {
    throw new Error(`OS ${index + 1}: campos diferentes do contrato minimo.`);
  }
}

return [{
  json: {
    payloadReady: true,
    mode: payload.mode,
    attributionWindowDays: payload.attributionWindowDays,
    salesPrepared: payload.sales.length,
    salesWithCpf: payload.sales.filter((sale) => String(sale.customerCpf || '').length === 11).length,
    reconciliationMatched: payload.sales.filter((sale) => sale.reconciliationStatus === 'matched').length,
    containsOnlyAllowedFields: true,
    externalRequestSent: false
  }
}];
