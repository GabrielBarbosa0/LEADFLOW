import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

const projectId = 'demo-fascinlead-savwin-persistence';
let testEnvironment;
const privateCollections = ['savwinSales', 'leadSaleAttributions', 'savwinSyncRuns'];

function authenticatedDb(uid, email) {
  return testEnvironment.authenticatedContext(uid, { email, email_verified: true }).firestore();
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8280, rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      ...privateCollections.map((name) => setDoc(doc(db, name, 'protected-test'), {
        storeId: 'loja-04', createdAt: Timestamp.now()
      })),
      setDoc(doc(db, 'users', 'captor-04'), {
        email: 'captor04@example.test', role: 'captor', storeId: 'loja-04',
        permissions: ['goals.view_own'], active: true
      }),
      setDoc(doc(db, 'users', 'captor-05'), {
        email: 'captor05@example.test', role: 'captor', storeId: 'loja-05',
        permissions: ['goals.view_own'], active: true
      }),
      setDoc(doc(db, 'users', 'manager-04'), {
        email: 'manager04@example.test', role: 'manager', storeId: 'loja-04',
        storeIds: ['loja-04'], permissions: ['dashboard.view', 'savwin.review'], active: true
      }),
      setDoc(doc(db, 'users', 'admin-test'), {
        email: 'admin@example.test', role: 'admin', storeId: 'loja-04', active: true
      }),
      setDoc(doc(db, 'captorSalesStats', 'captor-04-nov'), {
        captorUid: 'captor-04', period: '2026-11', storeIds: ['loja-04', 'loja-05'],
        salesCount: 2, netRevenue: 500
      }),
      setDoc(doc(db, 'captorSalesStats', 'captor-05-nov'), {
        captorUid: 'captor-05', period: '2026-11', storeIds: ['loja-05'],
        salesCount: 1, netRevenue: 200
      }),
      setDoc(doc(db, 'storeCaptorSalesStats', 'store-04-captor-04-nov'), {
        captorUid: 'captor-04', storeId: 'loja-04', period: '2026-11', salesCount: 1, netRevenue: 150
      }),
      setDoc(doc(db, 'storeCaptorSalesStats', 'store-05-captor-04-nov'), {
        captorUid: 'captor-04', storeId: 'loja-05', period: '2026-11', salesCount: 1, netRevenue: 350
      }),
      setDoc(doc(db, 'savwinReviewCases', 'review-own-pending'), {
        storeId: 'loja-04', period: '2026-11', saleDate: '2026-11-04', netValue: 150,
        matchStatus: 'no_lead', reconciliationStatus: 'matched', reviewStatus: 'pending',
        reviewReason: '', reviewedByUid: '', reviewedAt: null, sourceUpdatedAt: Timestamp.now(), schemaVersion: 1
      }),
      setDoc(doc(db, 'savwinReviewCases', 'review-own-immutable'), {
        storeId: 'loja-04', period: '2026-11', saleDate: '2026-11-05', netValue: 250,
        matchStatus: 'ambiguous', reconciliationStatus: 'matched', reviewStatus: 'pending',
        reviewReason: '', reviewedByUid: '', reviewedAt: null, sourceUpdatedAt: Timestamp.now(), schemaVersion: 1
      }),
      setDoc(doc(db, 'savwinReviewCases', 'review-foreign-pending'), {
        storeId: 'loja-05', period: '2026-11', saleDate: '2026-11-04', netValue: 350,
        matchStatus: 'missing_cpf', reconciliationStatus: 'matched', reviewStatus: 'pending',
        reviewReason: '', reviewedByUid: '', reviewedAt: null, sourceUpdatedAt: Timestamp.now(), schemaVersion: 1
      })
    ]);
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('protected SavWin persistence collections', () => {
  it('keeps individual sales, attributions and runs private', async () => {
    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = authenticatedDb('admin-test', 'admin@example.test');
    for (const name of privateCollections) {
      await assertFails(getDoc(doc(publicDb, name, 'protected-test')));
      await assertFails(getDoc(doc(adminDb, name, 'protected-test')));
    }
  });

  it('allows a captor to query only personal monthly stats', async () => {
    const ownDb = authenticatedDb('captor-04', 'captor04@example.test');
    const ownQuery = query(collection(ownDb, 'captorSalesStats'),
      where('captorUid', '==', 'captor-04'), where('period', '==', '2026-11'));
    const otherQuery = query(collection(ownDb, 'captorSalesStats'),
      where('captorUid', '==', 'captor-05'), where('period', '==', '2026-11'));
    await assertSucceeds(getDocs(ownQuery));
    await assertSucceeds(getDoc(doc(ownDb, 'captorSalesStats', 'captor-04-nov')));
    await assertFails(getDocs(otherQuery));
    await assertFails(getDoc(doc(ownDb, 'captorSalesStats', 'captor-05-nov')));
    await assertFails(getDocs(collection(ownDb, 'captorSalesStats')));
  });

  it('allows a manager to query only store-partitioned stats for an authorized unit', async () => {
    const managerDb = authenticatedDb('manager-04', 'manager04@example.test');
    const ownStoreQuery = query(collection(managerDb, 'storeCaptorSalesStats'),
      where('storeId', '==', 'loja-04'), where('period', '==', '2026-11'));
    const otherStoreQuery = query(collection(managerDb, 'storeCaptorSalesStats'),
      where('storeId', '==', 'loja-05'), where('period', '==', '2026-11'));
    await assertSucceeds(getDocs(ownStoreQuery));
    await assertSucceeds(getDoc(doc(managerDb, 'storeCaptorSalesStats', 'store-04-captor-04-nov')));
    await assertFails(getDocs(otherStoreQuery));
    await assertFails(getDoc(doc(managerDb, 'storeCaptorSalesStats', 'store-05-captor-04-nov')));
    await assertFails(getDoc(doc(managerDb, 'captorSalesStats', 'captor-04-nov')));
  });

  it('allows managers to read review cases only for an authorized store', async () => {
    const managerDb = authenticatedDb('manager-04', 'manager04@example.test');
    const ownStoreQuery = query(collection(managerDb, 'savwinReviewCases'),
      where('storeId', '==', 'loja-04'), where('period', '==', '2026-11'));
    const otherStoreQuery = query(collection(managerDb, 'savwinReviewCases'),
      where('storeId', '==', 'loja-05'), where('period', '==', '2026-11'));
    const captorDb = authenticatedDb('captor-04', 'captor04@example.test');

    await assertSucceeds(getDocs(ownStoreQuery));
    await assertSucceeds(getDoc(doc(managerDb, 'savwinReviewCases', 'review-own-pending')));
    await assertFails(getDocs(otherStoreQuery));
    await assertFails(getDoc(doc(managerDb, 'savwinReviewCases', 'review-foreign-pending')));
    await assertFails(getDoc(doc(captorDb, 'savwinReviewCases', 'review-own-pending')));
    await assertFails(getDocs(collection(managerDb, 'savwinReviewCases')));
  });

  it('allows one justified decision while keeping source fields immutable', async () => {
    const managerDb = authenticatedDb('manager-04', 'manager04@example.test');
    const pendingRef = doc(managerDb, 'savwinReviewCases', 'review-own-pending');
    const immutableRef = doc(managerDb, 'savwinReviewCases', 'review-own-immutable');

    await assertFails(updateDoc(immutableRef, { netValue: 999 }));
    await assertFails(updateDoc(immutableRef, {
      reviewStatus: 'resolved', reviewReason: 'Nao',
      reviewedByUid: 'manager-04', reviewedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(pendingRef, {
      reviewStatus: 'resolved', reviewReason: 'Conferido no ambiente de homologacao.',
      reviewedByUid: 'manager-04', reviewedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(pendingRef, {
      reviewStatus: 'dismissed', reviewReason: 'Tentativa de segunda decisao.',
      reviewedByUid: 'manager-04', reviewedAt: serverTimestamp()
    }));
  });

  it('allows administrators to read aggregates but denies every client write', async () => {
    const adminDb = authenticatedDb('admin-test', 'admin@example.test');
    await assertSucceeds(getDocs(collection(adminDb, 'captorSalesStats')));
    await assertSucceeds(getDocs(collection(adminDb, 'storeCaptorSalesStats')));
    for (const name of [...privateCollections, 'captorSalesStats', 'storeCaptorSalesStats']) {
      await assertFails(setDoc(doc(adminDb, name, 'new-test'), {
        captorUid: 'captor-04', storeId: 'loja-04', period: '2026-11'
      }));
    }
    await assertSucceeds(getDocs(collection(adminDb, 'savwinReviewCases')));
    await assertFails(setDoc(doc(adminDb, 'savwinReviewCases', 'new-review'), {
      storeId: 'loja-04', period: '2026-11', reviewStatus: 'pending'
    }));
  });
});
