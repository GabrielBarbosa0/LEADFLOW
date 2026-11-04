import { toLocalDateInput } from '../../shared/formatters.js';

export function createDefaultManagementFilters(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: toLocalDateInput(monthStart), endDate: toLocalDateInput(now), storeId: '', capturedByUid: '', search: '', archiveStatus: 'active' };
}

export function managementFiltersFromForm(form) {
  const values = Object.fromEntries(new FormData(form));
  return {
    startDate: String(values.startDate || ''),
    endDate: String(values.endDate || ''),
    storeId: String(values.storeId || ''),
    capturedByUid: String(values.capturedByUid || ''),
    search: String(values.search || ''),
    archiveStatus: String(values.archiveStatus || 'active')
  };
}

export function filterManagementRecords(records, filters) {
  const search = String(filters.search || '').trim().toLowerCase();
  const phoneSearch = search.replace(/\D/g, '');
  return records.filter((lead) => {
    if (filters.storeId && lead.storeId !== filters.storeId) return false;
    if (filters.capturedByUid && lead.capturedByUid !== filters.capturedByUid) return false;
    if (!search) return true;
    return String(lead.fullName || '').toLowerCase().includes(search)
      || String(lead.capturedByName || '').toLowerCase().includes(search)
      || (phoneSearch && String(lead.phoneSearch || '').includes(phoneSearch));
  });
}
