import { describe, expect, it, vi } from 'vitest';
import { dashboardDistributionRows, performanceTableRows, reportDistributionPanel, statusRows } from '../../src/app/features/dashboard/dashboard-components.js';
import { filterDashboardRecords, loadDashboardUpcomingRecords } from '../../src/app/features/dashboard/dashboard-data.js';
import { appointmentDistribution, dashboardCaptorStats, dashboardGroupStats, dashboardMetrics, salesStatsSummary } from '../../src/app/features/dashboard/dashboard-metrics.js';
import { dashboardView } from '../../src/app/features/dashboard/dashboard-view.js';

const records = [
  { id: '1', fullName: 'Maria', capturedAtClient: '2026-10-20T10:00:00-03:00', capturedByUid: 'captor-1', capturedByName: 'Ana', storeId: 'loja-06', appointmentDate: '2026-10-30', appointmentTime: '08:00', appointmentAttendance: 'attended', careRoute: 'optometrist', examPaymentType: 'paid', needsTransport: true, transportSeats: 2, interestId: 'complete-glasses', birthDate: '1980-01-01' },
  { id: '2', fullName: 'João', capturedAtClient: '2026-10-21T11:00:00-03:00', capturedByUid: 'captor-2', capturedByName: 'Bruno', storeId: 'loja-02', appointmentDate: '2026-10-31', appointmentTime: '14:00', appointmentAttendance: 'missed', careRoute: 'ophthalmologist', examPaymentType: 'courtesy', interestId: 'eye-exam', birthDate: '1960-01-01' }
];

describe('dashboard feature modules', () => {
  it('filters dashboard records by period, store and captor', () => {
    expect(filterDashboardRecords(records, { startDate: '2026-10-21', endDate: '2026-10-31', storeId: '', capturedByUid: '' })).toEqual([records[1]]);
    expect(filterDashboardRecords(records, { startDate: '', endDate: '', storeId: 'loja-06', capturedByUid: 'captor-1' })).toEqual([records[0]]);
  });

  it('loads and filters upcoming records independently', async () => {
    const loadAppointments = vi.fn().mockResolvedValue({ records, truncated: false });
    const result = await loadDashboardUpcomingRecords({
      profile: {}, filters: { storeId: 'loja-06', capturedByUid: 'captor-1' }, loadAppointments,
      now: new Date('2026-10-29T12:00:00-03:00')
    });
    expect(loadAppointments).toHaveBeenCalledWith({}, '2026-10-29', '2026-11-04', 'loja-06');
    expect(result.records).toEqual([records[0]]);
  });

  it('calculates appointment periods and grouped performance', () => {
    expect(appointmentDistribution(records)).toMatchObject({ predominantPeriod: '' });
    const groups = dashboardGroupStats(records, (lead) => lead.storeId, (lead) => lead.storeId);
    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'loja-06', attended: 1, attendanceRate: 100 }),
      expect.objectContaining({ label: 'loja-02', missed: 1, attendanceRate: 0 })
    ]));
    const metrics = dashboardMetrics(records, records, (id) => id, new Date('2026-10-29T12:00:00-03:00'));
    expect(metrics).toMatchObject({ attended: 1, missed: 1, attendanceRate: 50 });
    expect(metrics.captors).toHaveLength(2);
    const filteredMetrics = dashboardMetrics([records[0]], [records[0]], (id) => id, new Date('2026-10-29T12:00:00-03:00'), records);
    expect(filteredMetrics.summary.total).toBe(1);
    expect(filteredMetrics.stores).toHaveLength(2);
    expect(filteredMetrics.activeStoreCount).toBe(1);
    expect(dashboardCaptorStats(records, 'loja-06')).toEqual([
      expect.objectContaining({ label: 'Ana', total: 1 })
    ]);
  });

  it('summarizes store sales without averaging averages', () => {
    expect(salesStatsSummary([
      { capturedLeads: 2, convertedCapturedLeads: 1, salesCount: 2, netRevenue: 300, averageDaysToFirstConversion: 4, firstConversionsMeasured: 1 },
      { capturedLeads: 3, convertedCapturedLeads: 2, salesCount: 1, netRevenue: 300, averageDaysToFirstConversion: 10, firstConversionsMeasured: 2 }
    ])).toMatchObject({
      capturedLeads: 5,
      convertedCapturedLeads: 3,
      conversionRate: 60,
      salesCount: 3,
      netRevenue: 600,
      averageTicket: 200,
      averageDaysToFirstConversion: 8
    });
  });

  it('renders reusable distribution and table components', () => {
    const items = [{ label: 'Optometrista', count: 1, percentage: 50 }];
    expect(dashboardDistributionRows(items)).toContain('50% dos cadastros');
    expect(reportDistributionPanel('Horários', 'Resumo', 'clock-3', items, 2)).toContain('report-analysis-panel');
    expect(statusRows([['Compareceram', 1, 'success']], 2)).toContain('50% dos agendamentos');
    expect(performanceTableRows([{ label: 'Loja 06', total: 2, scheduled: 1, attended: 1, missed: 0, attendanceRate: 100 }])).toContain('Loja 06');
  });

  it('composes the complete dashboard without global application state', () => {
    const metrics = dashboardMetrics(records, records, (id) => id === 'loja-06' ? 'Loja 06' : 'Loja 02', new Date('2026-10-29T12:00:00-03:00'));
    const markup = dashboardView({
      allowed: true,
      records,
      metrics,
      management: { filters: { startDate: '2026-10-01', endDate: '2026-10-29', storeId: 'loja-06' }, loading: false, error: '', truncated: false },
      allowedStores: [{ id: 'loja-02', displayLabel: 'Loja 02 - Carpina' }, { id: 'loja-06', displayLabel: 'Loja 06 - Surubim' }],
      ranking: {
        open: true,
        storeId: 'loja-06',
        captors: dashboardCaptorStats(records, 'loja-06'),
        stores: [{ id: 'loja-06', displayLabel: 'Loja 06 - Surubim' }]
      },
      upcoming: { loading: false, loaded: true, error: '', truncated: false },
      salesStats: {
        loading: false,
        loaded: true,
        error: '',
        period: '2026-10',
        storeId: 'loja-06',
        records: [{
          capturedLeads: 2,
          convertedCapturedLeads: 1,
          salesCount: 2,
          netRevenue: 500,
          firstConversionsMeasured: 1,
          averageDaysToFirstConversion: 5,
          coverageStartDate: '2026-10-01', coverageEndDate: '2026-10-29',
          salesReceived: 3, salesEligible: 3, salesReconciled: 2,
          lastSuccessfulSyncAt: new Date()
        }]
      },
      savwin: { loading: false, error: '', result: null },
      savwinEnabled: false,
      managementLimit: 500,
      appointmentsLimit: 500
    });
    expect(markup).toContain('Taxa de agendamento');
    expect(markup).toContain('Resultados de vendas');
    expect(markup).toContain('HOMOLOGACAO');
    expect(markup).toContain('Vendas conciliadas');
    expect(markup).toContain('Cobertura completa');
    expect(markup).toContain('Recebidas');
    expect(markup).toContain('500,00');
    expect(markup).toContain('50%');
    expect(markup).toContain('id="dashboard-store"');
    expect(markup).toContain('value="loja-06" selected');
    expect(markup).toContain('Desempenho por unidade');
    expect(markup).not.toContain('Resultados por captador');
    expect(markup).toContain('Agendamentos por dia da semana');
    expect(markup).toContain('Sexo dos clientes');
    expect(markup).toContain('Cancelamentos');
    expect(markup).toContain('Reagendamentos');
    expect(markup).toContain('Pagamento do exame');
    expect(markup).toContain('Pagamento do produto');
    expect(markup).toContain('Formas mais usadas');
    expect(markup).toContain('Tipos de estratégia');
    expect(markup).toContain('dashboard-panel dashboard-panel-wide');
    expect(markup).toContain('aria-label="Voltar para gestão"');
    expect(markup).not.toContain('<span>Voltar para gestão</span>');
    expect(markup).toContain('data-dashboard-ranking-open');
    expect(markup).toContain('data-lucide="trophy"');
    expect(markup).not.toContain('data-lucide="list-ordered"');
    expect(markup).toContain('id="dashboard-ranking-dialog"');
    expect(markup).toContain('data-dashboard-ranking-store');
    expect(markup).toContain('data-dashboard-ranking-sort="total"');
    expect(markup).toContain('data-dashboard-ranking-sort="attendanceRate"');
    expect(markup).toContain('aria-pressed="true" class="is-active">Cadastros</button>');
    expect(markup).toContain('dashboard-ranking-progress');
    expect(markup).toContain('dashboard-ranking-preview-total');
    expect(markup).toContain('dashboard-ranking-close');
    expect(markup).not.toContain('data-dashboard-ranking-close>Fechar</button>');
    expect(markup).toContain('<dt>Cadastros</dt><dd>1</dd>');
    expect(markup).toContain('Loja 06 - Surubim');
  });

  it('does not imply a broad query when no dashboard store is selected', () => {
    const metrics = dashboardMetrics([], [], (id) => id);
    const markup = dashboardView({
      allowed: true,
      records: [],
      metrics,
      management: { filters: { startDate: '2026-10-01', endDate: '2026-10-31', storeId: '' }, loading: false, error: '', truncated: false },
      upcoming: { loading: false, loaded: true, error: '', truncated: false },
      savwin: { loading: false, error: '', result: null },
      salesStats: { loading: false, loaded: true, error: '', records: [], period: '2026-10', storeId: '' },
      savwinEnabled: false
    });
    expect(markup).toContain('Selecione uma loja');
  });
});
