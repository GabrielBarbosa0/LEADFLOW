import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

const projectId = 'demo-fascinlead-appointment-permissions';
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
    batch.set(doc(db, 'users', 'external-uid'), {
      email: 'externa@example.com',
      displayName: 'Externa Teste',
      role: 'captor',
      roleProfileId: 'system-external-leader',
      permissionSchemaVersion: 7,
      permissions: [
        'leads.create', 'leads.view_own', 'leads.edit_own', 'appointments.cancel',
        'followups.own', 'goals.view_own', 'appointments.view', 'external.operations.read'
      ],
      storeId: 'loja-02',
      storeIds: ['loja-02'],
      active: true
    });
    batch.set(doc(db, 'users', 'internal-uid'), {
      email: 'interna@example.com',
      displayName: 'Interna Teste',
      role: 'manager',
      roleProfileId: 'system-captor',
      permissionSchemaVersion: 7,
      permissions: [
        'leads.create', 'leads.view_own', 'leads.edit_own', 'appointments.cancel',
        'followups.own', 'goals.view_own', 'leads.view_stores', 'management.view',
        'leads.edit_all', 'leads.clinical_update', 'appointments.view',
        'appointments.confirmations', 'appointments.attendance', 'walkins.manage',
        'followups.team', 'external.operations.read'
      ],
      storeId: 'loja-02',
      storeIds: ['loja-02'],
      active: true
    });
    batch.set(doc(db, 'leads', 'appointment-1'), {
      fullName: 'Cliente Agenda',
      storeId: 'loja-02',
      capturedByUid: 'another-uid',
      capturedByName: 'Outro Colaborador',
      appointmentDate: '2026-11-14',
      appointmentTime: '08:00',
      appointmentStatus: 'scheduled',
      appointmentAttendance: 'pending'
    });
    batch.set(doc(db, 'leads', 'appointment-other-store'), {
      fullName: 'Cliente Outra Loja',
      storeId: 'loja-04',
      capturedByUid: 'another-uid',
      appointmentDate: '2026-11-14',
      appointmentTime: '08:20',
      appointmentStatus: 'scheduled',
      appointmentAttendance: 'pending'
    });
    batch.set(doc(db, 'appointmentReminders', 'reminder-1'), {
      leadId: 'appointment-1',
      storeId: 'loja-02',
      appointmentDate: '2026-11-14',
      appointmentTime: '08:00',
      appointmentKey: '2026-11-14|08:00',
      completedAt: new Date('2026-11-11T12:00:00Z'),
      completedByUid: 'internal-uid',
      completedByName: 'Interna Teste',
      schemaVersion: 1
    });
    await batch.commit();
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

function authenticatedDb(uid, email) {
  return testEnvironment.authenticatedContext(uid, {
    email,
    email_verified: true
  }).firestore();
}

describe('appointment permissions', () => {
  it('lets an external profile read only the agenda of an authorized store', async () => {
    const db = authenticatedDb('external-uid', 'externa@example.com');

    await assertSucceeds(getDoc(doc(db, 'leads', 'appointment-1')));
    const snapshot = await assertSucceeds(getDocs(query(
      collection(db, 'leads'),
      where('storeId', '==', 'loja-02')
    )));
    expect(snapshot.docs.map((item) => item.id)).toEqual(['appointment-1']);
    await assertFails(getDoc(doc(db, 'leads', 'appointment-other-store')));
    await assertFails(getDoc(doc(db, 'appointmentReminders', 'reminder-1')));
  });

  it('does not let an external collaborator register attendance', async () => {
    const db = authenticatedDb('external-uid', 'externa@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'appointment-1'), {
      appointmentAttendance: 'attended'
    }));
  });

  it('allows attendance and confirmation access for an internal profile', async () => {
    const db = authenticatedDb('internal-uid', 'interna@example.com');

    await assertSucceeds(updateDoc(doc(db, 'leads', 'appointment-1'), {
      appointmentAttendance: 'attended'
    }));
    await assertSucceeds(getDoc(doc(db, 'appointmentReminders', 'reminder-1')));
  });

  it('allows cancellation access for an internal profile', async () => {
    const db = authenticatedDb('internal-uid', 'interna@example.com');

    await assertSucceeds(updateDoc(doc(db, 'leads', 'appointment-1'), {
      appointmentStatus: 'cancelled',
      appointmentAttendance: 'cancelled',
      appointmentCancelledAtServer: serverTimestamp(),
      appointmentCancelledByUid: 'internal-uid',
      appointmentCancelledByName: 'Interna Teste',
      appointmentCancellationReason: 'schedule_conflict',
      appointmentCancellationDetails: '',
      funnelStage: 'cancelled',
      funnelReasonCode: 'schedule_conflict',
      funnelUpdatedAtClient: '2026-11-11T12:00:00.000Z',
      funnelUpdatedAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp()
    }));
  });

  it('requires the dedicated confirmation permission for reminder writes', async () => {
    const externalDb = authenticatedDb('external-uid', 'externa@example.com');
    const internalDb = authenticatedDb('internal-uid', 'interna@example.com');
    const reminder = {
      leadId: 'appointment-1',
      storeId: 'loja-02',
      appointmentDate: '2026-11-14',
      appointmentTime: '08:00',
      appointmentKey: '2026-11-14|08:00',
      completedAt: serverTimestamp(),
      completedByUid: 'external-uid',
      completedByName: 'Externa Teste',
      schemaVersion: 1
    };

    await assertFails(setDoc(doc(externalDb, 'appointmentReminders', 'external-write'), reminder));
    await assertSucceeds(setDoc(doc(internalDb, 'appointmentReminders', 'internal-write'), {
      ...reminder,
      completedByUid: 'internal-uid',
      completedByName: 'Interna Teste'
    }));
  });
});
