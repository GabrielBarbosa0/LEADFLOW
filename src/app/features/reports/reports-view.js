import { filterManagementRecords } from '../management/management-filters.js';
import {
  paginateReportRecords,
  reportMetricsView,
  reportNoticesView,
  reportResultsView,
  reportToolbar,
  managementArchiveDialog
} from './report-components.js';
import { reportFiltersView } from './report-filters.js';

export function reportsView({ management, allowedStores, adminView, canOpenLead, permissions, queryLimit }) {
  const { filters, loaded, loading, error, records, truncated, pageSize } = management;
  const filtered = filterManagementRecords(records, filters);
  const pagination = paginateReportRecords(filtered, management.page, pageSize);

  const archivedView = filters.archiveStatus === 'archived';
  return `${reportToolbar({ permissions, adminView, recordCount: filtered.length, canArchive: permissions.archive, archivedView })}
    ${reportFiltersView({ filters, records, allowedStores, loading })}
    ${reportNoticesView({ error, truncated, queryLimit })}
    ${reportMetricsView(filtered)}
    <section class="management-results" aria-busy="${loading}">${reportResultsView({
      records: pagination.pageRecords,
      loaded,
      canOpenLead,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      totalRecords: filtered.length
    })}</section>${managementArchiveDialog({ open: management.archiveOpen, records: filtered, selectedIds: management.archiveSelection, saving: management.archiveSaving })}`;
}
