import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
process.env.NO_GCE_CHECK = 'true';
process.env.METADATA_SERVER_DETECTION = 'none';
const { deleteApp, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  buildCaptorSalesStats,
  buildStoreCaptorSalesStats,
  rebuildCaptorSalesStats,
  rebuildStoreCaptorSalesStats
} = require('../../functions/savwin-stats');

const environment = {
  GCLOUD_PROJECT: 'demo-leadflow',
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  SAVWIN_PERSISTENCE_APPLY_MODE: 'emulator_only'
};
let app;
let firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Execute este teste somente com o Firestore Emulator.');
  app = initializeApp({ projectId: 'demo-leadflow' }, 'savwin-stats-integration');
  firestore = getFirestore(app);
});

beforeEach(async () => {
  for (const collection of ['captorSalesStats', 'storeCaptorSalesStats']) {
    const snapshot = await firestore.collection(collection).get();
    await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
  }
});

afterAll(async () => {
  if (getApps().includes(app)) await deleteApp(app);
});

describe('SavWin emulator-only stats rebuild', () => {
  it('rebuilds the same period twice without duplicating stats', async () => {
    const writes = buildCaptorSalesStats({
      period: '2026-11',
      calculatedAt: new Date('2026-12-01T03:00:00.000Z'),
      leads: [
        { id: 'lead-ficticio', capturedByUid: 'captor-ficticio', storeId: 'loja-04', capturedAtClient: '2026-11-01T10:00:00-03:00' }
      ],
      sales: [{ id: 'sale-ficticia', saleDate: '2026-11-05', netValue: 350 }],
      attributions: [{
        saleId: 'sale-ficticia', leadId: 'lead-ficticio', capturedByUid: 'captor-ficticio',
        captureStoreId: 'loja-04', saleStoreId: 'loja-04', daysToConversion: 4, active: true
      }]
    });

    expect(await rebuildCaptorSalesStats(firestore, '2026-11', writes, { environment }))
      .toEqual({ written: 1, deleted: 0 });
    await firestore.collection('captorSalesStats').doc('obsolete').set({
      captorUid: 'captor-obsoleto',
      period: '2026-11'
    });
    await firestore.collection('captorSalesStats').doc('other-period').set({
      captorUid: 'captor-preservado',
      period: '2026-10'
    });
    expect(await rebuildCaptorSalesStats(firestore, '2026-11', writes, { environment }))
      .toEqual({ written: 1, deleted: 1 });
    const periodSnapshot = await firestore.collection('captorSalesStats').where('period', '==', '2026-11').get();
    expect(periodSnapshot.size).toBe(1);
    expect(periodSnapshot.docs[0].data()).toMatchObject({
      captorUid: 'captor-ficticio',
      salesCount: 1,
      netRevenue: 350,
      conversionRate: 100
    });
    expect((await firestore.collection('captorSalesStats').doc('other-period').get()).exists).toBe(true);
  });

  it('rebuilds store-partitioned stats without mixing another unit', async () => {
    const input = {
      period: '2026-11',
      calculatedAt: new Date('2026-12-01T03:00:00.000Z'),
      leads: [
        { id: 'lead-ficticio', capturedByUid: 'captor-ficticio', storeId: 'loja-04', capturedAtClient: '2026-11-01T10:00:00-03:00' }
      ],
      sales: [{ id: 'sale-ficticia', saleDate: '2026-11-05', netValue: 350 }],
      attributions: [{
        saleId: 'sale-ficticia', leadId: 'lead-ficticio', capturedByUid: 'captor-ficticio',
        captureStoreId: 'loja-04', saleStoreId: 'loja-05', daysToConversion: 4, active: true
      }]
    };
    const writes = buildStoreCaptorSalesStats(input);
    expect(await rebuildStoreCaptorSalesStats(firestore, '2026-11', writes, { environment }))
      .toEqual({ written: 2, deleted: 0 });
    const store04 = await firestore.collection('storeCaptorSalesStats')
      .where('storeId', '==', 'loja-04').get();
    const store05 = await firestore.collection('storeCaptorSalesStats')
      .where('storeId', '==', 'loja-05').get();
    expect(store04.docs[0].data()).toMatchObject({ capturedLeads: 1, salesCount: 0, netRevenue: 0 });
    expect(store05.docs[0].data()).toMatchObject({ capturedLeads: 0, salesCount: 1, netRevenue: 350 });
  });
});
