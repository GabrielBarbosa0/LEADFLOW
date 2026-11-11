import { escapeHtml, storeLabel } from '../../shared/formatters.js';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const matchLabels = {
  no_lead: 'Lead nao encontrado',
  ambiguous: 'Correspondencia ambigua',
  missing_cpf: 'CPF ausente',
  invalid_cpf: 'CPF invalido',
  sale_before_capture: 'Venda anterior a captacao',
  outside_window: 'Fora da janela de atribuicao',
  reconciliation_divergent: 'Valor divergente'
};

const reviewLabels = { pending: 'Pendente', resolved: 'Resolvido', dismissed: 'Descartado' };

function saleDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFormatter.format(new Date(`${value}T12:00:00`)) : '-';
}

function reviewCaseRows(records) {
  return records.map((item) => {
    const code = item.id.slice(-8).toUpperCase();
    const action = item.reviewStatus === 'pending'
      ? `<button class="button button-secondary" type="button" data-review-case="${escapeHtml(item.id)}"><i data-lucide="clipboard-check"></i><span>Revisar</span></button>`
      : `<span class="status-badge status-${item.reviewStatus === 'resolved' ? 'success' : 'neutral'}">${reviewLabels[item.reviewStatus]}</span>`;
    return `<tr><td><strong>${escapeHtml(code)}</strong><small>${saleDate(item.saleDate)}</small></td><td>${escapeHtml(storeLabel(item.storeId))}</td><td>${escapeHtml(matchLabels[item.matchStatus] || item.matchStatus)}</td><td>${currencyFormatter.format(item.netValue)}</td><td>${action}</td></tr>`;
  }).join('');
}

function reviewCaseCards(records) {
  return records.map((item) => {
    const code = item.id.slice(-8).toUpperCase();
    return `<article class="savwin-review-card"><header><div><span>Caso ${escapeHtml(code)}</span><strong>${escapeHtml(matchLabels[item.matchStatus] || item.matchStatus)}</strong></div><span class="status-badge status-${item.reviewStatus === 'pending' ? 'warning' : item.reviewStatus === 'resolved' ? 'success' : 'neutral'}">${reviewLabels[item.reviewStatus]}</span></header><dl><div><dt>Unidade</dt><dd>${escapeHtml(storeLabel(item.storeId))}</dd></div><div><dt>Data</dt><dd>${saleDate(item.saleDate)}</dd></div><div><dt>Valor</dt><dd>${currencyFormatter.format(item.netValue)}</dd></div></dl>${item.reviewStatus === 'pending' ? `<button class="button button-secondary" type="button" data-review-case="${escapeHtml(item.id)}"><i data-lucide="clipboard-check"></i><span>Revisar pendencia</span></button>` : `<p>${escapeHtml(item.reviewReason)}</p>`}</article>`;
  }).join('');
}

function reviewDialog(item, saving) {
  if (!item) return '';
  return `<dialog id="savwin-review-dialog" class="savwin-review-dialog" aria-labelledby="savwin-review-dialog-title"><form id="savwin-review-decision-form"><header><div><span>CASO ${escapeHtml(item.id.slice(-8).toUpperCase())}</span><h2 id="savwin-review-dialog-title">Revisar conciliacao</h2><p>${escapeHtml(matchLabels[item.matchStatus] || item.matchStatus)} · ${currencyFormatter.format(item.netValue)}</p></div><button class="icon-button" type="button" data-review-close aria-label="Fechar"><i data-lucide="x"></i></button></header><div class="savwin-review-dialog-body"><fieldset class="savwin-review-decision"><legend>Decisao</legend><label><input type="radio" name="reviewStatus" value="resolved" checked /><span><i data-lucide="circle-check"></i>Resolvido</span></label><label><input type="radio" name="reviewStatus" value="dismissed" /><span><i data-lucide="circle-x"></i>Descartado</span></label></fieldset><div class="field"><label for="savwin-review-reason">Justificativa</label><textarea id="savwin-review-reason" name="reviewReason" minlength="5" maxlength="500" required placeholder="Registre o criterio utilizado na decisao"></textarea><small>Entre 5 e 500 caracteres.</small></div></div><footer><button class="button button-secondary" type="button" data-review-close>Cancelar</button><button class="button button-primary" type="submit" ${saving ? 'disabled' : ''}><i data-lucide="save"></i><span>${saving ? 'Salvando...' : 'Registrar decisao'}</span></button></footer></form></dialog>`;
}

export function savwinReviewView({ review, allowedStores = [] }) {
  const visible = review.filters.status === 'all'
    ? review.records
    : review.records.filter((item) => item.reviewStatus === review.filters.status);
  const counts = review.records.reduce((total, item) => ({ ...total, [item.reviewStatus]: (total[item.reviewStatus] || 0) + 1 }), { pending: 0, resolved: 0, dismissed: 0 });
  const storeOptions = allowedStores.map((store) => `<option value="${escapeHtml(store.id)}" ${review.filters.storeId === store.id ? 'selected' : ''}>${escapeHtml(store.displayLabel || store.label)}</option>`).join('');
  const content = review.loading
    ? '<div class="empty-state"><i data-lucide="refresh-cw"></i><strong>Carregando pendencias...</strong></div>'
    : visible.length
      ? `<div class="savwin-review-table-wrap"><table class="savwin-review-table"><thead><tr><th>Caso</th><th>Unidade</th><th>Pendencia</th><th>Valor</th><th>Revisao</th></tr></thead><tbody>${reviewCaseRows(visible)}</tbody></table></div><div class="savwin-review-mobile">${reviewCaseCards(visible)}</div>`
      : '<div class="empty-state"><i data-lucide="clipboard-check"></i><strong>Nenhuma pendencia encontrada</strong><p>Ajuste os filtros ou consulte outro periodo.</p></div>';
  return `<section class="management-heading page-actions-only"><button class="icon-button" type="button" data-route="management" aria-label="Voltar para gestao" title="Voltar para gestao"><i data-lucide="arrow-left"></i></button></section>
    <form id="savwin-review-filters" class="savwin-review-filters"><div><span>HOMOLOGACAO</span><strong>Revisao das conciliacoes</strong></div><div class="field"><label for="savwin-review-store">Unidade</label><select id="savwin-review-store" name="storeId" required>${storeOptions}</select></div><div class="field"><label for="savwin-review-period">Mes</label><input id="savwin-review-period" name="period" type="month" value="${escapeHtml(review.filters.period)}" required /></div><div class="field"><label for="savwin-review-status">Estado</label><select id="savwin-review-status" name="status"><option value="pending" ${review.filters.status === 'pending' ? 'selected' : ''}>Pendentes</option><option value="resolved" ${review.filters.status === 'resolved' ? 'selected' : ''}>Resolvidos</option><option value="dismissed" ${review.filters.status === 'dismissed' ? 'selected' : ''}>Descartados</option><option value="all" ${review.filters.status === 'all' ? 'selected' : ''}>Todos</option></select></div><button class="button button-primary" type="submit" ${review.loading ? 'disabled' : ''}><i data-lucide="search"></i><span>Consultar</span></button></form>
    ${review.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(review.error)}</span></div>` : ''}
    <section class="savwin-review-metrics" aria-label="Resumo das revisoes"><div><span>Pendentes</span><strong>${counts.pending}</strong><i data-lucide="clock-3"></i></div><div><span>Resolvidos</span><strong>${counts.resolved}</strong><i data-lucide="circle-check"></i></div><div><span>Descartados</span><strong>${counts.dismissed}</strong><i data-lucide="circle-x"></i></div></section>
    <section class="savwin-review-results" aria-busy="${review.loading}">${content}</section>${reviewDialog(review.records.find((item) => item.id === review.activeId), review.saving)}`;
}
