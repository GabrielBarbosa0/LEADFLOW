import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const projectId = 'demo-fascinlead-goals';
let testEnvironment;

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
    const batch = writeBatch(db);
    const users = [
      ['admin-uid', 'admin@example.com', 'admin', 'loja-06'],
      ['manager-06', 'manager06@example.com', 'manager', 'loja-06'],
      ['manager-05', 'manager05@example.com', 'manager', 'loja-05'],
      ['captor-06-a', 'captor06a@example.com', 'captor', 'loja-06'],
      ['captor-06-b', 'captor06b@example.com', 'captor', 'loja-06'],
      ['captor-05', 'captor05@example.com', 'captor', 'loja-05']
    ];
    users.forEach(([uid, email, role, storeId]) => batch.set(doc(db, 'users', uid), {
      email, displayName: uid, photoUrl: '', role, storeId, active: true
    }));
    await batch.commit();
  });
});

afterAll(async () => testEnvironment.cleanup());

function authenticatedDb(uid, email, role) {
  return testEnvironment.authenticatedContext(uid, { email, email_verified: true, role }).firestore();
}

function goalData(assigneeUid, storeId, createdByUid) {
  return {
    title: 'Meta mensal', metric: 'leads_captured', targetCount: 20,
    startDate: '2026-10-01', endDate: '2026-10-31', storeId,
    assigneeUid, assigneeName: assigneeUid, createdByUid,
    createdByName: createdByUid, createdAt: serverTimestamp(),
    groupId: 'group-test', schemaVersion: 1
  };
}

describe('goal security rules', () => {
  it('lets a manager list users and create goals only for captors from the same store', async () => {
    const db = authenticatedDb('manager-06', 'manager06@example.com', 'manager');
    await assertSucceeds(getDocs(query(collection(db, 'users'), where('storeId', '==', 'loja-06'))));
    await assertFails(getDocs(collection(db, 'users')));
    await assertSucceeds(setDoc(doc(db, 'goals', 'same-store'), goalData('captor-06-a', 'loja-06', 'manager-06')));
    await assertFails(setDoc(doc(db, 'goals', 'other-store'), goalData('captor-05', 'loja-05', 'manager-06')));
  });

  it('lets an administrator create and list goals from every store', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com', 'admin');
    await assertSucceeds(setDoc(doc(db, 'goals', 'admin-goal'), goalData('captor-05', 'loja-05', 'admin-uid')));
    await assertSucceeds(getDocs(collection(db, 'goals')));
  });

  it('lets a captor read only personal goals', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'goals', 'own'), goalData('captor-06-a', 'loja-06', 'admin-uid'));
      await setDoc(doc(context.firestore(), 'goals', 'other'), goalData('captor-06-b', 'loja-06', 'admin-uid'));
    });
    const db = authenticatedDb('captor-06-a', 'captor06a@example.com', 'captor');
    await assertSucceeds(getDocs(query(collection(db, 'goals'), where('assigneeUid', '==', 'captor-06-a'))));
    await assertFails(getDocs(collection(db, 'goals')));
    await assertFails(setDoc(doc(db, 'goals', 'forbidden'), goalData('captor-06-a', 'loja-06', 'captor-06-a')));
  });

  it('allows a manager to delete a same-store goal but not another store goal', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'goals', 'same'), goalData('captor-06-a', 'loja-06', 'admin-uid'));
      await setDoc(doc(context.firestore(), 'goals', 'other'), goalData('captor-05', 'loja-05', 'admin-uid'));
    });
    const db = authenticatedDb('manager-06', 'manager06@example.com', 'manager');
    await assertSucceeds(deleteDoc(doc(db, 'goals', 'same')));
    await assertFails(deleteDoc(doc(db, 'goals', 'other')));
  });

  it('allows managers and administrators to edit goals within their scope', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'goals', 'same'), goalData('captor-06-a', 'loja-06', 'admin-uid'));
      await setDoc(doc(context.firestore(), 'goals', 'other'), goalData('captor-05', 'loja-05', 'admin-uid'));
    });
    const managerDb = authenticatedDb('manager-06', 'manager06@example.com', 'manager');
    const adminDb = authenticatedDb('admin-uid', 'admin@example.com', 'admin');

    await assertSucceeds(updateDoc(doc(managerDb, 'goals', 'same'), { title: 'Meta revisada', targetCount: 30 }));
    await assertFails(updateDoc(doc(managerDb, 'goals', 'other'), { title: 'Alteracao indevida' }));
    await assertSucceeds(updateDoc(doc(adminDb, 'goals', 'other'), { title: 'Meta da loja 05' }));
  });

  it('does not allow changing the assignee of an existing goal', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'goals', 'same'), goalData('captor-06-a', 'loja-06', 'admin-uid'));
    });
    const db = authenticatedDb('manager-06', 'manager06@example.com', 'manager');
    await assertFails(updateDoc(doc(db, 'goals', 'same'), {
      assigneeUid: 'captor-06-b',
      assigneeName: 'captor-06-b'
    }));
  });
});
