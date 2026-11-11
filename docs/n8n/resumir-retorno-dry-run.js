const items = $input.all();

if (items.length !== 1) {
  throw new Error(`Esperada 1 resposta do dry-run; recebidas ${items.length}.`);
}

const response = items[0].json;
if (response.ok !== true || response.mode !== 'dry_run') {
  throw new Error('Resposta recusada: o retorno nao confirma um dry-run valido.');
}

if (!response.summary || typeof response.summary !== 'object') {
  throw new Error('Resposta recusada: resumo ausente.');
}

if (!Array.isArray(response.results)) {
  throw new Error('Resposta recusada: resultados ausentes.');
}

const countFields = [
  'salesReceived',
  'matched',
  'matchedSameStore',
  'noLead',
  'ambiguous',
  'missingCpf',
  'invalidCpf',
  'saleBeforeCapture',
  'outsideWindow',
  'reconciliationDivergent'
];

const counts = {};
for (const field of countFields) {
  const value = response.summary[field];
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Resposta recusada: contador invalido em ${field}.`);
  }
  counts[field] = value;
}

if (response.results.length !== counts.salesReceived) {
  throw new Error('Resposta recusada: quantidade de resultados divergente.');
}

const allowedStatuses = new Set([
  'matched',
  'matched_same_store',
  'no_lead',
  'ambiguous',
  'missing_cpf',
  'invalid_cpf',
  'sale_before_capture',
  'outside_window',
  'reconciliation_divergent'
]);

const statusCounts = {};
for (const result of response.results) {
  const status = String(result?.status || '');
  if (!allowedStatuses.has(status)) {
    throw new Error(`Resposta recusada: status desconhecido ${status || '(vazio)'}.`);
  }
  statusCounts[status] = (statusCounts[status] || 0) + 1;
}

const eligibleMatches = counts.matched + counts.matchedSameStore;

return [{
  json: {
    responseAccepted: true,
    mode: 'dry_run',
    salesReceived: counts.salesReceived,
    eligibleMatches,
    unmatchedSales: counts.salesReceived - eligibleMatches,
    noLead: counts.noLead,
    ambiguous: counts.ambiguous,
    missingCpf: counts.missingCpf,
    invalidCpf: counts.invalidCpf,
    saleBeforeCapture: counts.saleBeforeCapture,
    outsideWindow: counts.outsideWindow,
    reconciliationDivergent: counts.reconciliationDivergent,
    statusCounts,
    containsIndividualResults: false
  }
}];
