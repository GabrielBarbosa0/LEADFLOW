import { managementFiltersFromForm } from './management-filters.js';

export function initializeManagementFilters(form, handlers) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submit(managementFiltersFromForm(form));
  });
  const search = form.elements.search;
  search?.addEventListener('input', () => handlers.search(search.value, search.selectionStart, search.selectionEnd));
  ['storeId', 'capturedByUid', 'archiveStatus'].forEach((name) => {
    form.elements[name]?.addEventListener('change', (event) => handlers.change(name, event.target.value));
  });
}

export function handleManagementClick(event, handlers) {
  const leadButton = event.target.closest('[data-management-lead-id]');
  if (leadButton) { handlers.openLead(leadButton.dataset.managementLeadId); return true; }
  const pageButton = event.target.closest('[data-management-page]');
  if (pageButton && !pageButton.disabled) { handlers.changePage(Number(pageButton.dataset.managementPage)); return true; }
  return false;
}
