import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((database, name) => ({ database, name })),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ type: 'limit', value })),
  query: vi.fn((reference, ...constraints) => ({ reference, constraints })),
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value }))
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../../src/firebase/client.js', () => ({
  db: { id: 'test-db' },
  isFirebaseConfigured: true
}));

import { loadOwnSalesStats, loadStoreSalesStats } from '../../src/services/sales-stats-service.js';
import { normalizeSalesStatsDocument, normalizeSalesStatsPeriod, salesCoverageSummary } from '../../src/utils/sales-stats.js';

function snapshot(id, data) {
  return { docs: [{ id, data: () => data }] };
}

describe('sales stats service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads personal stats with mandatory UID and period filters', async () => {
    firestoreMocks.getDocs.mockResolvedValue(snapshot('personal-1', {
      captorUid: 'captor-1', period: '2026-11', salesCount: 2, netRevenue: 450,
      unexpectedCpf: '00000000000'
    }));
    const result = await loadOwnSalesStats({
      uid: 'captor-1', role: 'captor', permissions: ['goals.view_own']
    }, '2026-11');

    expect(result).toMatchObject({ id: 'personal-1', captorUid: 'captor-1', salesCount: 2, netRevenue: 450 });
    expect(result).not.toHaveProperty('unexpectedCpf');
    expect(firestoreMocks.where).toHaveBeenCalledWith('captorUid', '==', 'captor-1');
    expect(firestoreMocks.where).toHaveBeenCalledWith('period', '==', '2026-11');
    expect(firestoreMocks.limit).toHaveBeenCalledWith(1);
  });

  it('loads team stats only for an explicitly authorized store', async () => {
    firestoreMocks.getDocs.mockResolvedValue(snapshot('store-1', {
      captorUid: 'captor-1', storeId: 'loja-04', period: '2026-11', salesCount: 1
    }));
    const profile = {
      uid: 'manager-1', role: 'manager', storeId: 'loja-04', storeIds: ['loja-04'],
      permissions: ['dashboard.view']
    };
    const result = await loadStoreSalesStats(profile, '2026-11', 'loja-04');

    expect(result).toHaveLength(1);
    expect(firestoreMocks.where).toHaveBeenCalledWith('storeId', '==', 'loja-04');
    expect(firestoreMocks.where).toHaveBeenCalledWith('period', '==', '2026-11');
  });

  it('rejects another store before contacting Firestore', async () => {
    const profile = {
      uid: 'manager-1', role: 'manager', storeId: 'loja-04', storeIds: ['loja-04'],
      permissions: ['dashboard.view']
    };
    await expect(loadStoreSalesStats(profile, '2026-11', 'loja-05'))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('rejects a non-manager even with an isolated dashboard permission', async () => {
    await expect(loadStoreSalesStats({
      uid: 'captor-1', role: 'captor', storeId: 'loja-04',
      permissions: ['dashboard.view']
    }, '2026-11', 'loja-04')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });
});

describe('sales stats normalization', () => {
  it('rejects malformed periods', () => {
    expect(() => normalizeSalesStatsPeriod('2026-13')).toThrow(/Periodo invalido/);
    expect(() => normalizeSalesStatsPeriod('11/2026')).toThrow(/Periodo invalido/);
  });

  it('returns only the public aggregate contract', () => {
    expect(normalizeSalesStatsDocument('stats-1', {
      captorUid: 'captor-1', period: '2026-11', netRevenue: '125.50', customerCpf: 'secret'
    })).toEqual(expect.objectContaining({ id: 'stats-1', netRevenue: 125.5 }));
    expect(normalizeSalesStatsDocument('stats-1', { customerCpf: 'secret' }))
      .not.toHaveProperty('customerCpf');
  });

  it('summarizes freshness and partial coverage without exposing sale details', () => {
    const coverage = salesCoverageSummary([{
      coverageStartDate: '2026-11-01', coverageEndDate: '2026-11-08',
      salesReceived: 8, salesEligible: 7, salesReconciled: 4,
      lastSuccessfulSyncAt: new Date('2026-11-08T12:00:00.000Z')
    }], new Date('2026-11-08T18:00:00.000Z'));
    expect(coverage).toMatchObject({
      freshness: 'current', completeness: 'partial', salesReceived: 8,
      salesEligible: 7, salesReconciled: 4
    });
  });

  it('flags synchronization data older than three days', () => {
    expect(salesCoverageSummary([{
      salesReceived: 4, salesEligible: 4,
      lastSuccessfulSyncAt: new Date('2026-11-01T12:00:00.000Z')
    }], new Date('2026-11-05T12:00:00.000Z'))).toMatchObject({
      freshness: 'stale', completeness: 'complete'
    });
  });
});
