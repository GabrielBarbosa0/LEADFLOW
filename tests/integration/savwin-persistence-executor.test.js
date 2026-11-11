import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
process.env.NO_GCE_CHECK = 'true';
process.env.METADATA_SERVER_DETECTION = 'none';
const { deleteApp, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { buildSavwinPersistencePlan } = require('../../functions/savwin-persistence-plan');
const { applySavwinPersistencePlan } = require('../../functions/savwin-persistence-executor');

const projectId = 'demo-leadflow';
const hashKey = 'chave-ficticia-com-mais-de-32-caracteres-para-testes';
const environment = {
  GCLOUD_PROJECT: projectId,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  SAVWIN_PERSISTENCE_APPLY_MODE: 'emulator_only'
};

let app;
let firestore;

function sale(overrides = {}) {
  return {
    saleKey: '0004:TEST-4257',
    storeCode: '0004',
    storeId: 'loja-04',
    osNumber: 'TEST-4257',
    saleDate: '2026-11-04',
    customerCpf: '52998224725',
    reconciliationStatus: 'matched',
    reportedSaleNetValue: 1100,
    ...overrides
  };
}

function result(overrides = {}) {
  return {
    saleKey: '0004:TEST-4257',
    status: 'matched_same_store',
    leadId: 'lead-ficticio-04',
    capturedByUid: 'captor-ficticio',
    leadStoreId: 'loja-04',
    saleStoreId: 'loja-04',
    daysToConversion: 10,
    saleNetValue: 1100,
    ...overrides
  };
}

function plan(runId, overrides = {}) {
  return buildSavwinPersistencePlan({
    runId,
    importedAt: new Date('2026-11-07T18:00:00.000Z'),
    hashKey,
    sales: [sale()],
    results: [result()],
    ...overrides
  });
}

async function clearCollection(name) {
  const snapshot = await firestore.collection(name).get();
  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Execute este teste somente com o Firestore Emulator.');
  app = initializeApp({ projectId }, 'savwin-persistence-integration');
  firestore = getFirestore(app);
});

beforeEach(async () => {
  await Promise.all([
    clearCollection('savwinSales'),
    clearCollection('leadSaleAttributions'),
    clearCollection('savwinReviewCases'),
    clearCollection('savwinSyncRuns')
  ]);
});

afterAll(async () => {
  if (getApps().includes(app)) await deleteApp(app);
});

describe('SavWin emulator-only persistence executor', () => {
  it('applies the same run twice without duplicating documents', async () => {
    const persistencePlan = plan('run-emulator-idempotent');
    const first = await applySavwinPersistencePlan(firestore, persistencePlan, { environment });
    const second = await applySavwinPersistencePlan(firestore, persistencePlan, { environment });

    expect(first).toMatchObject({ alreadyApplied: false, salesWritten: 1, attributionsWritten: 1 });
    expect(second).toEqual({
      alreadyApplied: true,
      salesWritten: 0,
      attributionsWritten: 0,
      attributionsRevoked: 0,
      reviewCasesWritten: 0,
      reviewCasesRemoved: 0
    });
    expect((await firestore.collection('savwinSales').get()).size).toBe(1);
    expect((await firestore.collection('leadSaleAttributions').get()).size).toBe(1);
    expect((await firestore.collection('savwinReviewCases').get()).size).toBe(0);
    expect((await firestore.collection('savwinSyncRuns').get()).size).toBe(1);

    const storedSale = (await firestore.collection('savwinSales').limit(1).get()).docs[0].data();
    expect(JSON.stringify(storedSale)).not.toContain('52998224725');
  });

  it('updates the same OS in a new run and revokes a stale attribution', async () => {
    await applySavwinPersistencePlan(firestore, plan('run-emulator-match'), { environment });
    const unmatchedPlan = plan('run-emulator-unmatched', {
      importedAt: new Date('2026-11-08T18:00:00.000Z'),
      sales: [sale({ reportedSaleNetValue: 1200 })],
      results: [result({ status: 'no_lead' })]
    });
    const applied = await applySavwinPersistencePlan(firestore, unmatchedPlan, { environment });

    expect(applied).toMatchObject({
      salesWritten: 1, attributionsWritten: 0, attributionsRevoked: 1,
      reviewCasesWritten: 1, reviewCasesRemoved: 0
    });
    expect((await firestore.collection('savwinSales').get()).size).toBe(1);
    expect((await firestore.collection('savwinSyncRuns').get()).size).toBe(2);
    const storedSale = (await firestore.collection('savwinSales').limit(1).get()).docs[0].data();
    expect(storedSale.netValue).toBe(1200);
    const attribution = (await firestore.collection('leadSaleAttributions').limit(1).get()).docs[0].data();
    expect(attribution).toMatchObject({
      active: false,
      attributionStatus: 'revoked',
      revocationReason: 'no_lead'
    });
    const reviewCase = (await firestore.collection('savwinReviewCases').limit(1).get()).docs[0].data();
    expect(reviewCase).toMatchObject({
      storeId: 'loja-04', period: '2026-11', matchStatus: 'no_lead', reviewStatus: 'pending'
    });
    expect(reviewCase).not.toHaveProperty('customerCpf');
    expect(reviewCase).not.toHaveProperty('customerCpfHash');
    expect(reviewCase).not.toHaveProperty('osNumber');
  });

  it('preserves a decision for the same issue and removes the case after a match', async () => {
    const firstUnmatched = plan('run-emulator-review-first', {
      results: [result({ status: 'no_lead' })]
    });
    await applySavwinPersistencePlan(firestore, firstUnmatched, { environment });
    const reviewRef = firestore.collection('savwinReviewCases').doc(firstUnmatched.saleWrites[0].id);
    await reviewRef.update({
      reviewStatus: 'resolved', reviewReason: 'Conferido na homologacao.',
      reviewedByUid: 'manager-test', reviewedAt: new Date('2026-11-08T12:00:00.000Z')
    });

    const repeatedUnmatched = plan('run-emulator-review-repeat', {
      importedAt: new Date('2026-11-08T18:00:00.000Z'),
      results: [result({ status: 'no_lead' })]
    });
    await applySavwinPersistencePlan(firestore, repeatedUnmatched, { environment });
    expect((await reviewRef.get()).data()).toMatchObject({
      reviewStatus: 'resolved', reviewReason: 'Conferido na homologacao.', reviewedByUid: 'manager-test'
    });

    const matchedAgain = plan('run-emulator-review-matched', {
      importedAt: new Date('2026-11-09T18:00:00.000Z')
    });
    const resultApplied = await applySavwinPersistencePlan(firestore, matchedAgain, { environment });
    expect(resultApplied).toMatchObject({ reviewCasesWritten: 0, reviewCasesRemoved: 1 });
    expect((await reviewRef.get()).exists).toBe(false);
  });
});
