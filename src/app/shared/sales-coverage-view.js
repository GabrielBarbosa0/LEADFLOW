import { salesCoverageSummary } from '../../utils/sales-stats.js';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

function formatCalendarDate(value) {
  return value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : '-';
}

export function salesCoverageMarkup(records = [], now = new Date()) {
  const coverage = salesCoverageSummary(records, now);
  if (!coverage || !coverage.lastSuccessfulSyncAt) {
    return '<div class="sales-coverage is-unknown"><i data-lucide="clock-3"></i><div><strong>Cobertura ainda n&atilde;o informada</strong><span>A origem n&atilde;o publicou a &uacute;ltima sincroniza&ccedil;&atilde;o.</span></div></div>';
  }
  const freshness = {
    current: ['Dados atualizados', 'is-current', 'refresh-cw'],
    attention: ['Sincroniza&ccedil;&atilde;o requer aten&ccedil;&atilde;o', 'is-attention', 'clock-3'],
    stale: ['Dados desatualizados', 'is-stale', 'circle-alert']
  }[coverage.freshness];
  const completeness = coverage.completeness === 'partial'
    ? '<span class="sales-coverage-warning">Cobertura parcial</span>'
    : '<span>Cobertura completa</span>';
  return `<div class="sales-coverage ${freshness[1]}" aria-label="Cobertura dos dados de vendas">
    <i data-lucide="${freshness[2]}"></i>
    <div><strong>${freshness[0]}</strong><span>&Uacute;ltima sincroniza&ccedil;&atilde;o: ${dateTimeFormatter.format(coverage.lastSuccessfulSyncAt)}</span></div>
    <div class="sales-coverage-period"><strong>${formatCalendarDate(coverage.coverageStartDate)} a ${formatCalendarDate(coverage.coverageEndDate)}</strong>${completeness}</div>
    <dl><div><dt>Recebidas</dt><dd>${coverage.salesReceived}</dd></div><div><dt>Eleg&iacute;veis</dt><dd>${coverage.salesEligible}</dd></div><div><dt>Conciliadas</dt><dd>${coverage.salesReconciled}</dd></div></dl>
  </div>`;
}
