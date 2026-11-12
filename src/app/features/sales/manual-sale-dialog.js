import { escapeHtml, toLocalDateInput } from '../../shared/formatters.js';

export function manualSaleDialog({ state, lead }) {
  if (!state?.leadId || !lead) return '';
  const record = state.record || {};
  const confirmed = lead.saleStatus === 'confirmed';
  const value = Number(record.manualSaleValue || 0);
  const error = state.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(state.error)}</span></div>` : '';
  const content = state.loading
    ? '<div class="manual-sale-loading">Carregando confirmacao...</div>'
    : `<form id="manual-sale-form" novalidate>
        ${error}
        <div class="field" data-field="saleDate"><label for="manual-sale-date">Data da compra <span aria-hidden="true">*</span></label><input id="manual-sale-date" name="saleDate" type="date" max="${toLocalDateInput(new Date())}" value="${escapeHtml(record.manualSaleDate || lead.saleDate || toLocalDateInput(new Date()))}" required /><small class="field-error"></small></div>
        <div class="field-row manual-sale-fields"><div class="field" data-field="orderNumber"><label for="manual-sale-order">OS ou pedido</label><input id="manual-sale-order" name="orderNumber" maxlength="40" value="${escapeHtml(record.manualOrderNumber || '')}" placeholder="Opcional" /><small class="field-error"></small></div><div class="field" data-field="saleValue"><label for="manual-sale-value">Valor da venda</label><input id="manual-sale-value" name="saleValue" inputmode="decimal" value="${value ? escapeHtml(value.toFixed(2).replace('.', ',')) : ''}" placeholder="Opcional" /><small class="field-error"></small></div></div>
        <div class="field" data-field="notes"><label for="manual-sale-notes">Observacao</label><textarea id="manual-sale-notes" name="notes" maxlength="500" rows="3" placeholder="Opcional">${escapeHtml(record.manualNotes || '')}</textarea><small class="field-error"></small></div>
        <div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-close-manual-sale>Voltar</button>${confirmed ? '<button class="button button-danger" type="button" data-remove-manual-sale><i data-lucide="undo-2"></i><span>Desfazer confirmacao</span></button>' : ''}<button class="button button-primary" type="submit" ${state.saving ? 'disabled' : ''}><i data-lucide="badge-check"></i><span>${state.saving ? 'Salvando...' : confirmed ? 'Atualizar compra' : 'Confirmar compra'}</span></button></div>
      </form>`;
  return `<dialog id="manual-sale-dialog" class="confirmation-dialog manual-sale-dialog" aria-labelledby="manual-sale-title">
    <div class="confirmation-dialog-icon manual-sale-icon"><i data-lucide="badge-dollar-sign"></i></div>
    <div class="confirmation-dialog-copy"><p class="eyebrow">VENDA MANUAL</p><h2 id="manual-sale-title">${confirmed ? 'Compra confirmada' : 'Confirmar compra'}</h2><p><strong>${escapeHtml(lead.fullName)}</strong>. Os detalhes ficam visiveis apenas para a equipe autorizada.</p></div>
    ${content}
  </dialog>`;
}
