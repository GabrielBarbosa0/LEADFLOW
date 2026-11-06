import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';

const projectId = 'demo-fascinlead-access';
let testEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8280,
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'allowedEmails', 'admin@example.com'), {
      displayName: 'Administrador Teste',
      role: 'admin',
      storeId: 'loja-06',
      active: true
    });
    batch.set(doc(db, 'users', 'admin-uid'), {
      email: 'admin@example.com',
      displayName: 'Administrador Teste',
      photoUrl: '',
      role: 'admin',
      storeId: 'loja-06',
      active: true
    });
    batch.set(doc(db, 'stores', 'loja-06'), {
      code: 'LOJA_06',
      name: 'Loja 06',
      active: true
    });
    await batch.commit();
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

function authenticatedDb(uid, email, role = 'admin') {
  return testEnvironment.authenticatedContext(uid, {
    email,
    email_verified: true,
    role
  }).firestore();
}

describe('access administration rules', () => {
  it('lets an administrator manage role profiles', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    const profileRef = doc(db, 'roleProfiles', 'regional');
    await assertSucceeds(setDoc(profileRef, {
      name: 'Gestor regional',
      scope: 'stores',
      baseRole: 'manager',
      permissions: ['management.view', 'dashboard.view'],
      active: true
    }));
    await assertSucceeds(getDocs(collection(db, 'roleProfiles')));
  });

  it('lets an administrator list the collections used by the screen', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');

    await assertSucceeds(getDocs(collection(db, 'allowedEmails')));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(getDocs(collection(db, 'stores')));
  });

  it('lets an administrator create another authorized email', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    const email = 'colaborador@example.com';
    const existingPermission = await assertSucceeds(getDoc(doc(db, 'allowedEmails', email)));
    expect(existingPermission.exists()).toBe(false);
    const existingUsers = await assertSucceeds(getDocs(query(collection(db, 'users'), where('email', '==', email))));
    expect(existingUsers.empty).toBe(true);

    const batch = writeBatch(db);
    batch.set(doc(db, 'allowedEmails', email), {
      email,
      displayName: 'Colaborador Teste',
      role: 'captor',
      storeId: 'loja-06',
      active: true,
      createdAt: serverTimestamp(),
      createdBy: 'admin-uid',
      updatedAt: serverTimestamp(),
      updatedBy: 'admin-uid'
    }, { merge: true });

    await assertSucceeds(batch.commit());
  });

  it('keeps the primary administrator able to recover access administration', async () => {
    const db = authenticatedDb('new-primary-uid', 'oticasfascinantes.financeiro@gmail.com');
    const email = 'recuperação@example.com';
    const batch = writeBatch(db);
    batch.set(doc(db, 'allowedEmails', email), {
      email,
      displayName: 'Acesso Recuperado',
      role: 'captor',
      storeId: 'loja-06',
      active: true
    });

    await assertSucceeds(getDocs(collection(db, 'allowedEmails')));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(batch.commit());
  });

  it('rejects access creation by a regular collaborator', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'captor-uid'), {
        email: 'captor@example.com',
        displayName: 'Captador Teste',
        photoUrl: '',
        role: 'captor',
        storeId: 'loja-06',
        active: true
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com', 'captor');
    const batch = writeBatch(db);
    batch.set(doc(db, 'allowedEmails', 'outro@example.com'), {
      displayName: 'Outro Usuario',
      role: 'captor',
      storeId: 'loja-06',
      active: true
    });

    await assertFails(batch.commit());
    await assertFails(setDoc(doc(db, 'roleProfiles', 'indevido'), {
      name: 'Perfil indevido',
      scope: 'own',
      baseRole: 'captor',
      permissions: ['leads.create'],
      active: true
    }));
  });

  it('lets an authorized collaborator create the profile on first login', async () => {
    const email = 'novo-captador@example.com';
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'allowedEmails', email), {
        email,
        displayName: 'Novo Captador',
        role: 'captor',
        storeId: 'loja-06',
        active: true
      });
    });

    const db = authenticatedDb('novo-captador-uid', email, 'captor');
    await assertSucceeds(getDoc(doc(db, 'allowedEmails', email)));
    await assertSucceeds(setDoc(doc(db, 'users', 'novo-captador-uid'), {
      email,
      displayName: 'Novo Captador',
      photoUrl: '',
      role: 'captor',
      storeId: 'loja-06',
      active: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    }));
  });
});
