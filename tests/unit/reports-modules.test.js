import { describe, expect, it } from 'vitest';
import { paginateReportRecords, reportResultsView } from '../../src/app/features/reports/report-components.js';
import { reportCaptors, reportFiltersView } from '../../src/app/features/reports/report-filters.js';
import { reportsView } from '../../src/app/features/reports/reports-view.js';

const records = [
  { id: 'lead-1', fullName: 'Maria Silva', phoneSearch: '81999991234', capturedByUid: 'captor-2', capturedByName: 'Bruno Lima', storeId: 'loja-06', interestLabel: 'Óculos completo', capturedAtClient: '2026-10-20T10:00:00-03:00' },
  { id: 'lead-2', fullName: 'João Santos', phoneSearch: '81988887777', capturedByUid: 'captor-1', capturedByName: 'Ana Souza', storeId: 'loja-02', interestLabel: 'Exame de vista', capturedAtClient: '2026-10-21T11:00:00-03:00' }
];

const filters = { startDate: '2026-10-01', endDate: '2026-10-29', storeId: '', capturedByUid: '', search: '', archiveStatus: 'active' };

describe('reports feature modules', () => {
  it('builds a unique alphabetical captor list', () => {
    expect(reportCaptors([...records, records[0]])).toEqual([
      ['captor-1', 'Ana Souza'],
      ['captor-2', 'Bruno Lima']
    ]);
  });

  it('keeps pagination inside the available report pages', () => {
    expect(paginateReportRecords(records, 4, 1)).toMatchObject({ currentPage: 2, totalPages: 2, pageRecords: [records[1]] });
    expect(paginateReportRecords([], 0, 20)).toMatchObject({ currentPage: 1, totalPages: 1, pageRecords: [] });
  });

  it('renders filters and escaped report values', () => {
    const filterMarkup = reportFiltersView({
      filters,
      records,
      allowedStores: [{ id: 'loja-02', displayLabel: 'Loja 02' }, { id: 'loja-06', displayLabel: 'Loja <06>' }],
      loading: false
    });
    expect(filterMarkup).toContain('Ana Souza');
    expect(filterMarkup).toContain('Loja &lt;06&gt;');

    const results = reportResultsView({ records: [records[0]], loaded: true, canOpenLead: true, currentPage: 1, totalPages: 2, totalRecords: 2 });
    expect(results).toContain('data-management-lead-id="lead-1"');
    expect(results).toContain('1 de 2');
  });

  it('composes the operational report without dashboard panels', () => {
    const markup = reportsView({
      management: { filters, loaded: true, loading: false, error: '', records, truncated: false, page: 1, pageSize: 20, archiveOpen: true, archiveSelection: ['lead-1'], archiveSaving: false },
      allowedStores: [{ id: 'loja-02', displayLabel: 'Loja 02' }, { id: 'loja-06', displayLabel: 'Loja 06' }],
      adminView: true,
      canOpenLead: true,
      permissions: { appointments: true, followUps: true, dashboard: true, export: true, archive: true },
      queryLimit: 500
    });
    expect(markup).toContain('Leads encontrados');
    expect(markup).toContain('Exportar CSV');
    expect(markup).toContain('Arquivar leads');
    expect(markup).toContain('Arquivar selecionados');
    expect(markup).not.toContain('dashboard-panel');
  });
});
