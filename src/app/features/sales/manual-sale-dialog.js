import { escapeHtml, toLocalDateInput } from '../../shared/formatters.js';

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function purchaseCard(purchase) {
  const cancelled = purchase.status === 'cancelled';
  const purchaseId = escapeHtml(purchase.id);
  const actions = purchase.legacy
    ? `<button class="icon-button purchase-delete-button" type="button" data-delete-purchase="${purchaseId}" title="Excluir compra" aria-label="Excluir compra"><i data-lucide="trash-2"></i></button>`
    : `<button class="icon-button" type="button" data-edit-purchase="${purchaseId}" title="Editar compra" aria-label="Editar compra"><i data-lucide="pencil"></i></button>
      ${cancelled
        ? `<button class="icon-button purchase-reactivate-button" type="button" data-reactivate-purchase="${purchaseId}" title="Reativar compra" aria-label="Reativar compra"><i data-lucide="rotate-ccw"></i></button>`
        : `<button class="icon-button purchase-cancel-button" type="button" data-cancel-purchase="${purchaseId}" title="Cancelar compra" aria-label="Cancelar compra"><i data-lucide="circle-minus"></i></button>`}
      <button class="icon-button purchase-delete-button" type="button" data-delete-purchase="${purchaseId}" title="Excluir compra" aria-label="Excluir compra"><i data-lucide="trash-2"></i></button>`;
  return `<article class="manual-purchase-card ${cancelled ? 'is-cancelled' : ''}">
    <div class="manual-purchase-card-main">
      <span class="status-badge status-${cancelled ? 'danger' : 'success'}">${cancelled ? 'Cancelada' : 'Confirmada'}</span>
      <strong>${escapeHtml(currency(purchase.saleValue))}</strong>
      <span>${escapeHtml(purchase.saleDate.split('-').reverse().join('/'))}${purchase.orderNumber ? ` · OS ${escapeHtml(purchase.orderNumber)}` : ''}</span>
      <small><i data-lucide="user-round"></i>${escapeHtml(purchase.responsibleName || 'Colaborador não informado')}</small>
    </div>
    <div class="manual-purchase-card-actions">${actions}</div>
  </article>`;
}

function purchaseActionDialog({ state, bundle }) {
  if (!state.action || !state.actionPurchaseId) return '';
  const purchase = bundle.purchases.find((item) => item.id === state.actionPurchaseId);
  if (!purchase) return '';
  const configs = {
    cancel: {
      eyebrow: 'CANCELAR COMPRA', title: 'Cancelar esta compra?', icon: 'circle-minus', tone: 'danger',
      description: 'A compra deixará de entrar nos totais, mas continuará no histórico e poderá ser reativada.',
      confirmLabel: 'Cancelar compra', buttonClass: 'button-danger-solid'
    },
    reactivate: {
      eyebrow: 'REATIVAR COMPRA', title: 'Reativar esta compra?', icon: 'rotate-ccw', tone: 'success',
      description: 'A compra voltará a entrar na quantidade e no valor total registrado para este cliente.',
      confirmLabel: 'Reativar compra', buttonClass: 'button-primary'
    },
    delete: {
      eyebrow: 'EXCLUIR COMPRA', title: 'Excluir esta compra?', icon: 'trash-2', tone: 'danger',
      description: 'A compra será removida do histórico visível e dos totais. A auditoria da exclusão continuará preservada.',
      confirmLabel: 'Excluir compra', buttonClass: 'button-danger-solid'
    }
  };
  const config = configs[state.action];
  if (!config) return '';
  const order = purchase.orderNumber ? ` · OS ${escapeHtml(purchase.orderNumber)}` : '';
  const error = state.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(state.error)}</span></div>` : '';
  return `<dialog id="manual-sale-action-dialog" class="confirmation-dialog manual-sale-action-dialog is-${config.tone}" aria-labelledby="manual-sale-action-title" aria-describedby="manual-sale-action-description">
    <div class="confirmation-dialog-icon"><i data-lucide="${config.icon}"></i></div>
    <div class="confirmation-dialog-copy"><p class="eyebrow">${config.eyebrow}</p><h2 id="manual-sale-action-title">${config.title}</h2><p><strong>${escapeHtml(currency(purchase.saleValue))}${order}</strong></p><p id="manual-sale-action-description">${config.description}</p></div>
    ${error}
    <div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-close-purchase-action>Manter compra</button><button class="button ${config.buttonClass}" type="button" data-confirm-purchase-action="${state.action}" ${state.saving ? 'disabled' : ''}><i data-lucide="${config.icon}"></i><span>${state.saving ? 'Salvando...' : config.confirmLabel}</span></button></div>
  </dialog>`;
}

function purchaseFormDialog({ state, bundle, editing }) {
  if (!state.formOpen) return '';
  const selectedResponsible = editing?.responsibleUid || state.profileUid || bundle.members[0]?.uid || '';
  const memberOptions = bundle.members.map((member) => `<option value="${escapeHtml(member.uid)}" ${member.uid === selectedResponsible ? 'selected' : ''}>${escapeHtml(member.displayName)}</option>`).join('');
  const error = state.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(state.error)}</span></div>` : '';
  return `<dialog id="manual-sale-form-dialog" class="confirmation-dialog manual-sale-form-dialog" aria-labelledby="manual-sale-form-title">
    <div class="manual-sale-heading"><div class="confirmation-dialog-icon manual-sale-icon"><i data-lucide="badge-dollar-sign"></i></div><div class="confirmation-dialog-copy"><p class="eyebrow">VENDA MANUAL</p><h2 id="manual-sale-form-title">${editing ? 'Editar compra' : 'Registrar nova compra'}</h2></div><button class="icon-button manual-sale-close" type="button" data-close-purchase-form title="Fechar" aria-label="Fechar formulário de compra"><i data-lucide="x"></i></button></div>
    <form id="manual-sale-form" novalidate>
      ${error}
      <div class="field-row manual-sale-primary-fields">
        <div class="field" data-field="saleDate"><label for="manual-sale-date">Data da compra <span aria-hidden="true">*</span></label><input id="manual-sale-date" name="saleDate" type="date" max="${toLocalDateInput(new Date())}" value="${escapeHtml(editing?.saleDate || toLocalDateInput(new Date()))}" required /><small class="field-error"></small></div>
        <div class="field" data-field="responsibleUid"><label for="manual-sale-responsible">Responsável pela venda <span aria-hidden="true">*</span></label><select id="manual-sale-responsible" name="responsibleUid" required><option value="">Selecione</option>${memberOptions}</select><small class="field-error"></small></div>
      </div>
      <div class="field-row manual-sale-fields"><div class="field" data-field="orderNumber"><label for="manual-sale-order">OS ou pedido</label><input id="manual-sale-order" name="orderNumber" maxlength="40" value="${escapeHtml(editing?.orderNumber || '')}" /><small class="field-error"></small></div><div class="field" data-field="saleValue"><label for="manual-sale-value">Valor da venda <span aria-hidden="true">*</span></label><input id="manual-sale-value" name="saleValue" inputmode="decimal" value="${editing?.saleValue ? escapeHtml(Number(editing.saleValue).toFixed(2).replace('.', ',')) : ''}" required /><small class="field-error"></small></div></div>
      <div class="field" data-field="notes"><label for="manual-sale-notes">Observação</label><textarea id="manual-sale-notes" name="notes" maxlength="500" rows="3">${escapeHtml(editing?.notes || '')}</textarea><small class="field-error"></small></div>
      <div class="confirmation-dialog-actions manual-sale-actions"><button class="button button-primary" type="submit" ${state.saving ? 'disabled' : ''}><i data-lucide="badge-check"></i><span>${state.saving ? 'Salvando...' : editing ? 'Atualizar compra' : 'Registrar compra'}</span></button></div>
    </form>
  </dialog>`;
}

export function manualSaleDialog({ state, lead }) {
  if (!state?.leadId || !lead) return '';
  const bundle = state.record || { purchases: [], members: [] };
  const purchases = bundle.purchases || [];
  const active = purchases.filter((purchase) => purchase.status === 'confirmed');
  const editing = purchases.find((purchase) => purchase.id === state.editingId && !purchase.legacy) || null;
  const total = active.reduce((sum, purchase) => sum + Number(purchase.saleValue || 0), 0);
  const errorContent = state.error && !state.formOpen && !state.action ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(state.error)}</span></div>` : '';
  const historyContent = state.loading
    ? '<div class="manual-sale-loading">Carregando compras...</div>'
    : `<div class="manual-purchase-summary"><div><span>Compras confirmadas</span><strong>${active.length}</strong></div><div><span>Valor registrado</span><strong>${escapeHtml(currency(total))}</strong></div></div>
      ${errorContent}
      <section class="manual-purchase-list" aria-label="Compras do cliente">
        <header><h3>Histórico de compras</h3><button class="button button-secondary" type="button" data-new-purchase><i data-lucide="plus"></i><span>Nova compra</span></button></header>
        <div class="manual-purchase-scroll">${purchases.length ? purchases.map(purchaseCard).join('') : '<div class="manual-purchase-empty"><i data-lucide="shopping-bag"></i><span>Nenhuma compra registrada.</span></div>'}</div>
      </section>`;
  return `<dialog id="manual-sale-dialog" class="confirmation-dialog manual-sale-dialog" aria-labelledby="manual-sale-title">
    <div class="manual-sale-heading"><div class="confirmation-dialog-icon manual-sale-icon"><i data-lucide="badge-dollar-sign"></i></div><div class="confirmation-dialog-copy"><p class="eyebrow">VENDAS DO CLIENTE</p><h2 id="manual-sale-title">Compras de ${escapeHtml(lead.fullName)}</h2><p>Cada compra mantém sua própria OS, valor e colaborador responsável.</p></div><button class="icon-button manual-sale-close" type="button" data-close-manual-sale title="Fechar" aria-label="Fechar compras"><i data-lucide="x"></i></button></div>
    ${historyContent}
  </dialog>${purchaseFormDialog({ state, bundle, editing })}${purchaseActionDialog({ state, bundle })}`;
}
