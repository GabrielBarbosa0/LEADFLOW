import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SavwinStatsError,
  buildCaptorSalesStats,
  buildStoreCaptorSalesStats,
  statsDocumentId,
  storeStatsDocumentId
} = require('../../functions/savwin-stats');

const calculatedAt = new Date('2026-12-01T03:00:00.000Z');

function inputs(overrides = {}) {
  return {
    period: '2026-11',
    calculatedAt,
    leads: [
      { id: 'lead-a', capturedByUid: 'captor-a', storeId: 'loja-04', capturedAtClient: '2026-10-20T12:00:00-03:00' },
      { id: 'lead-b', capturedByUid: 'captor-a', storeId: 'loja-04', capturedAtClient: '2026-11-02T12:00:00-03:00' },
      { id: 'lead-c', capturedByUid: 'captor-a', storeId: 'loja-04', capturedAtClient: '2026-11-03T12:00:00-03:00' }
    ],
    sales: [
      { id: 'sale-a1', saleDate: '2026-11-04', netValue: 800 },
      { id: 'sale-a2', saleDate: '2026-11-10', netValue: 200 },
      { id: 'sale-b1', saleDate: '2026-11-08', netValue: 500 }
    ],
    attributions: [
      { saleId: 'sale-a1', leadId: 'lead-a', capturedByUid: 'captor-a', captureStoreId: 'loja-04', saleStoreId: 'loja-04', daysToConversion: 15, active: true },
      { saleId: 'sale-a2', leadId: 'lead-a', capturedByUid: 'captor-a', captureStoreId: 'loja-04', saleStoreId: 'loja-04', daysToConversion: 21, active: true },
      { saleId: 'sale-b1', leadId: 'lead-b', capturedByUid: 'captor-a', captureStoreId: 'loja-04', saleStoreId: 'loja-04', daysToConversion: 6, active: true }
    ],
    ...overrides
  };
}

describe('SavWin captor sales stats', () => {
  it('separates capture cohort conversion from sales-period revenue', () => {
    const [write] = buildCaptorSalesStats(inputs());

    expect(write.id).toBe(statsDocumentId('captor-a', '2026-11'));
    expect(write.document).toMatchObject({
      capturedLeads: 2,
      convertedCapturedLeads: 1,
      conversionRate: 50,
      convertedLeads: 2,
      salesCount: 3,
      netRevenue: 1500,
      averageTicket: 500,
      averageDaysToFirstConversion: 10.5,
      firstConversionsMeasured: 2
    });
  });

  it('ignores revoked attributions and returns null averages without a denominator', () => {
    const [write] = buildCaptorSalesStats(inputs({
      leads: [],
      attributions: [
        { saleId: 'sale-a1', leadId: 'lead-a', capturedByUid: 'captor-a', daysToConversion: 15, active: false }
      ]
    }));
    expect(write).toBeUndefined();

    const [cohortOnly] = buildCaptorSalesStats(inputs({ sales: [], attributions: [] }));
    expect(cohortOnly.document).toMatchObject({
      capturedLeads: 2,
      convertedCapturedLeads: 0,
      conversionRate: 0,
      salesCount: 0,
      averageTicket: null,
      averageDaysToFirstConversion: null
    });
  });

  it('rejects active attributions without a valid sale', () => {
    expect(() => buildCaptorSalesStats(inputs({ sales: [] }))).toThrow(SavwinStatsError);
    expect(() => buildCaptorSalesStats(inputs({
      sales: [{ id: 'invalid-date', saleDate: '2026-02-31', netValue: 1 }],
      attributions: []
    }))).toThrow(/Venda invalida/);
  });

  it('partitions management stats by capture and sale store', () => {
    const writes = buildStoreCaptorSalesStats(inputs({
      leads: [
        { id: 'lead-b', capturedByUid: 'captor-a', storeId: 'loja-04', capturedAtClient: '2026-11-02T12:00:00-03:00' }
      ],
      sales: [{ id: 'sale-b1', saleDate: '2026-11-08', netValue: 500 }],
      attributions: [{
        saleId: 'sale-b1', leadId: 'lead-b', capturedByUid: 'captor-a',
        captureStoreId: 'loja-04', saleStoreId: 'loja-05', daysToConversion: 6, active: true
      }]
    }));

    const captureStore = writes.find((write) => write.document.storeId === 'loja-04');
    const saleStore = writes.find((write) => write.document.storeId === 'loja-05');
    expect(captureStore.id).toBe(storeStatsDocumentId('loja-04', 'captor-a', '2026-11'));
    expect(captureStore.document).toMatchObject({
      capturedLeads: 1,
      convertedCapturedLeads: 1,
      salesCount: 0,
      netRevenue: 0,
      captureStoreBasis: 'capture_store',
      salesStoreBasis: 'sale_store'
    });
    expect(saleStore.document).toMatchObject({
      capturedLeads: 0,
      convertedCapturedLeads: 0,
      salesCount: 1,
      netRevenue: 500
    });
  });
});
