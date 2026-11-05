import { upcomingDateRange } from '../../../utils/dashboard.js';

export function filterDashboardRecords(records, filters) {
  const startDate = filters.startDate || '';
  const endDate = filters.endDate || '';
  return records.filter((lead) => {
    const capturedDate = String(lead.capturedAtClient || '').slice(0, 10);
    if (startDate && capturedDate < startDate) return false;
    if (endDate && capturedDate > endDate) return false;
    if (filters.storeId && lead.storeId !== filters.storeId) return false;
    if (filters.capturedByUid && lead.capturedByUid !== filters.capturedByUid) return false;
    return true;
  });
}

export async function loadDashboardUpcomingRecords({ profile, filters, loadAppointments, now = new Date() }) {
  try {
    const { startDate, endDate } = upcomingDateRange(now);
    const result = await loadAppointments(profile, startDate, endDate, filters.storeId);
    return {
      records: filters.capturedByUid
        ? result.records.filter((lead) => lead.capturedByUid === filters.capturedByUid)
        : result.records,
      truncated: result.truncated
    };
  } catch (error) {
    return { error: error?.code === 'permission-denied' ? 'Seu perfil não possui permissão para consultar a demanda futura.' : 'Não foi possível consultar a demanda futura.' };
  }
}
