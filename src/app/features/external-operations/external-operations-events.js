export function bindExternalOperationsEvents({ state, render, reload, showToast }) {
  const operations = state.externalOperations;
  const dialog = document.querySelector('#external-operation-detail-dialog');
  if (dialog) {
    requestAnimationFrame(() => {
      if (!dialog.open) dialog.showModal();
    });
    const close = () => {
      operations.detailLeadId = '';
      render();
    };
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.querySelectorAll('[data-external-detail-close]').forEach((button) => button.addEventListener('click', close));
  }

  document.querySelector('[data-external-operations-apply]')?.addEventListener('click', () => {
    const startDate = document.querySelector('#external-operations-start-date')?.value || '';
    const endDate = document.querySelector('#external-operations-end-date')?.value || '';
    if (!startDate || !endDate || startDate > endDate) {
      showToast('Informe um período válido para consultar a operação.', 'danger', 'circle-alert');
      return;
    }
    const days = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000);
    if (days > 30) {
      showToast('Consulte no máximo 31 dias por vez.', 'danger', 'circle-alert');
      return;
    }
    operations.startDate = startDate;
    operations.endDate = endDate;
    operations.loaded = false;
    operations.detailLeadId = '';
    reload();
  });

  document.querySelector('#external-operations-store')?.addEventListener('change', (event) => {
    operations.storeId = event.target.value;
    operations.loaded = false;
    operations.detailLeadId = '';
    reload();
  });
  document.querySelector('#external-operations-transport')?.addEventListener('change', (event) => {
    operations.transportMode = event.target.value;
    render();
  });
  document.querySelector('#external-operations-companion')?.addEventListener('change', (event) => {
    operations.companionMode = event.target.value;
    render();
  });
  document.querySelector('#external-operations-search')?.addEventListener('input', (event) => {
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    operations.query = event.target.value;
    render();
    const input = document.querySelector('#external-operations-search');
    input?.focus();
    input?.setSelectionRange(selectionStart, selectionEnd);
  });
  document.querySelectorAll('[data-external-detail-open]').forEach((button) => button.addEventListener('click', () => {
    operations.detailLeadId = button.dataset.externalDetailOpen;
    render();
  }));
}
