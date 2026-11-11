export function bindSavwinReviewEvents({ state, render, load, save, showToast }) {
  document.querySelector('#savwin-review-filters')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    state.savwinReview.filters = { storeId: values.storeId, period: values.period, status: values.status };
    state.savwinReview.loaded = false;
    await load();
  });
  document.querySelectorAll('[data-review-case]').forEach((button) => button.addEventListener('click', () => {
    state.savwinReview.activeId = button.dataset.reviewCase;
    render();
  }));
  const dialog = document.querySelector('#savwin-review-dialog');
  if (!dialog) return;
  requestAnimationFrame(() => { if (!dialog.open) dialog.showModal(); });
  const close = () => { state.savwinReview.activeId = ''; render(); };
  dialog.querySelectorAll('[data-review-close]').forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.querySelector('form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const item = state.savwinReview.records.find((record) => record.id === state.savwinReview.activeId);
    if (!item || state.savwinReview.saving) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    state.savwinReview.saving = true;
    render();
    try {
      const updated = await save(item, values);
      state.savwinReview.records = state.savwinReview.records.map((record) => record.id === updated.id ? updated : record);
      state.savwinReview.activeId = '';
      showToast('Revisao registrada com sucesso.');
    } catch (error) {
      showToast(error?.code === 'permission-denied' ? 'Seu perfil nao pode revisar este caso.' : error.message || 'Nao foi possivel registrar a revisao.', 'danger', 'circle-alert');
    } finally {
      state.savwinReview.saving = false;
      render();
    }
  });
}
