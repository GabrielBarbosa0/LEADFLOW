import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { createQuickLeadDocument } from '../../src/utils/lead.js';

const projectId = 'demo-fascinlead-walk-ins';
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
    await Promise.all([
      setDoc(doc(db, 'users', 'manager-uid'), {
        displayName: 'Gestor Teste', email: 'manager@example.com', role: 'manager',
        permissions: ['appointments.view', 'leads.create'], storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'system-manager-uid'), {
        displayName: 'Gestor Sistema', email: 'system-manager@example.com', role: 'manager',
        roleProfileId: 'system-manager', permissions: ['appointments.view', 'leads.create'],
        storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'internal-uid'), {
        displayName: 'Colaborador Interno', email: 'internal@example.com', role: 'captor',
        roleProfileId: 'system-captor', permissions: ['appointments.view', 'leads.create'],
        storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'external-uid'), {
        displayName: 'Colaborador Externo', email: 'external@example.com', role: 'captor',
        roleProfileId: 'system-external-leader', permissions: ['appointments.view', 'leads.create'],
        storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'mei-uid'), {
        displayName: 'Parceiro MEI', email: 'mei@example.com', role: 'captor',
        roleProfileId: 'system-mei', permissions: ['appointments.view', 'leads.create'],
        storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'captor-uid'), {
        displayName: 'Captador Teste', email: 'captor@example.com', role: 'captor',
        permissions: ['appointments.view'], storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'walk-in-captor-uid'), {
        displayName: 'Captador do Encaixe', email: 'walkin-captor@example.com', role: 'captor',
        permissions: ['appointments.view'], storeId: 'loja-06', storeIds: ['loja-06'], active: true
      }),
      setDoc(doc(db, 'users', 'telemarketing-uid'), {
        displayName: 'Colaborador Interno Teste', email: 'telemarketing@example.com', role: 'manager',
        roleProfileId: 'system-telemarketing',
        permissions: [
          'leads.create', 'leads.view_own', 'leads.edit_own', 'followups.own',
          'leads.view_stores', 'appointments.view', 'followups.team',
          'management.view', 'leads.delete', 'walkins.manage'
        ],
        storeId: 'loja-06', storeIds: ['loja-02', 'loja-04', 'loja-05', 'loja-06'], active: true
      }),
      setDoc(doc(db, 'leads', 'lead-1'), {
        fullName: 'Maria Silva', storeId: 'loja-06', capturedByUid: 'captor-uid'
      })
    ]);
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

function authenticatedDb(uid, email) {
  return testEnvironment.authenticatedContext(uid, { email, email_verified: true }).firestore();
}

function validWalkIn() {
  return {
    leadId: 'lead-1', storeId: 'loja-06', queueDate: '2026-10-30',
    serviceId: 'eye-exam', serviceName: 'Exame de vista', professionalType: 'optometrist',
    broughtByUid: 'walk-in-captor-uid', broughtByName: 'Captador do Encaixe',
    reason: 'Cliente presencial solicitou exame imediato', notes: '', status: 'waiting',
    priority: 0, priorityReason: '', arrivedAt: serverTimestamp(), calledAt: null,
    startedAt: null, completedAt: null, closedReason: '', convertedAppointmentLeadId: '',
    createdAt: serverTimestamp(), createdByUid: 'manager-uid', createdByName: 'Gestor Teste',
    updatedAt: serverTimestamp(), updatedByUid: 'manager-uid', schemaVersion: 1
  };
}

describe('walk-in queue rules', () => {
  it('lets an authorized store manager create, list and call a walk-in', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const reference = doc(db, 'appointmentWalkIns', '2026-10-30__lead-1');
    await assertSucceeds(setDoc(reference, validWalkIn()));
    const leadSnapshot = await getDoc(doc(db, 'leads', 'lead-1'));
    expect(leadSnapshot.data().capturedByUid).toBe('captor-uid');
    await assertSucceeds(getDocs(query(
      collection(db, 'appointmentWalkIns'),
      where('storeId', '==', 'loja-06'),
      where('queueDate', '==', '2026-10-30')
    )));
    await assertSucceeds(updateDoc(reference, {
      status: 'called', calledAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: 'manager-uid'
    }));
  });

  it.each([
    ['system-manager-uid', 'system-manager@example.com', 'Gestor Sistema'],
    ['internal-uid', 'internal@example.com', 'Colaborador Interno']
  ])('lets %s create a walk-in even while its cached permissions are stale', async (uid, email, displayName) => {
    const db = authenticatedDb(uid, email);
    const walkInId = `entry-${uid}`;
    const batch = writeBatch(db);
    batch.set(doc(db, 'appointmentWalkIns', walkInId), {
      ...validWalkIn(),
      createdByUid: uid,
      createdByName: displayName,
      updatedByUid: uid
    });
    batch.set(doc(db, 'leads', 'lead-1', 'history', `history-${uid}`), {
      leadId: 'lead-1', storeId: 'loja-06', eventType: 'walk_in_created',
      funnelStage: 'awaiting_appointment', reasonCode: 'waiting', description: 'Motivo do encaixe',
      walkInId, actorUid: uid, actorName: displayName,
      actorRole: uid === 'internal-uid' ? 'captor' : 'manager',
      occurredAtClient: '2026-10-30T10:00:00.000Z',
      occurredAtServer: serverTimestamp(), schemaVersion: 1
    });
    await assertSucceeds(batch.commit());
  });

  it.each([
    ['external-uid', 'external@example.com', 'Colaborador Externo'],
    ['mei-uid', 'mei@example.com', 'Parceiro MEI']
  ])('keeps %s blocked from creating walk-ins', async (uid, email, displayName) => {
    const db = authenticatedDb(uid, email);
    await assertFails(setDoc(doc(db, 'appointmentWalkIns', `entry-${uid}`), {
      ...validWalkIn(),
      createdByUid: uid,
      createdByName: displayName,
      updatedByUid: uid
    }));
  });

  it('rejects an invalid or spoofed walk-in captor without changing the lead owner', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(setDoc(doc(db, 'appointmentWalkIns', 'spoofed-captor'), {
      ...validWalkIn(), broughtByName: 'Nome Falso'
    }));
    await assertFails(setDoc(doc(db, 'appointmentWalkIns', 'manager-as-captor'), {
      ...validWalkIn(), broughtByUid: 'manager-uid', broughtByName: 'Gestor Teste'
    }));
    const leadSnapshot = await getDoc(doc(db, 'leads', 'lead-1'));
    expect(leadSnapshot.data().capturedByUid).toBe('captor-uid');
  });

  it('creates a quick incomplete lead and its walk-in atomically', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const batch = writeBatch(db);
    const quickLead = createQuickLeadDocument({
      fullName: 'Cliente de Encaixe', phone: '81999994321', customerCpf: '52998224725'
    }, {
      uid: 'manager-uid', displayName: 'Gestor Teste', role: 'manager',
      storeId: 'loja-06', storeIds: ['loja-06']
    }, 'test-installation');
    expect(quickLead.isValid).toBe(true);
    batch.set(doc(db, 'leads', 'quick-lead'), {
      ...quickLead.data,
      createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
      funnelUpdatedAtServer: serverTimestamp()
    });
    batch.set(doc(db, 'appointmentWalkIns', '2026-10-30__quick-lead'), {
      ...validWalkIn(),
      leadId: 'quick-lead'
    });
    batch.set(doc(db, 'leads', 'quick-lead', 'history', 'lead-created'), {
      leadId: 'quick-lead', storeId: 'loja-06', eventType: 'lead_created',
      funnelStage: 'captured', reasonCode: '', description: 'Cadastro rapido criado.',
      actorUid: 'manager-uid', actorName: 'Gestor Teste', actorRole: 'manager',
      occurredAtClient: '2026-10-30T10:00:00.000Z', occurredAtServer: serverTimestamp(), schemaVersion: 1
    });
    batch.set(doc(db, 'leads', 'quick-lead', 'history', 'walk-in-created'), {
      leadId: 'quick-lead', storeId: 'loja-06', eventType: 'walk_in_created',
      funnelStage: 'awaiting_appointment', reasonCode: 'waiting', description: 'Motivo do encaixe',
      walkInId: '2026-10-30__quick-lead', actorUid: 'manager-uid', actorName: 'Gestor Teste', actorRole: 'manager',
      occurredAtClient: '2026-10-30T10:00:00.000Z', occurredAtServer: serverTimestamp(), schemaVersion: 1
    });
    await assertSucceeds(batch.commit());
  });

  it('does not allow an empty birth date outside quick registration', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(setDoc(doc(db, 'leads', 'invalid-incomplete-lead'), {
      fullName: 'Cadastro Incompleto', phone: '+5581999994321', phoneSearch: '81999994321',
      customerCpf: '', birthDate: '', notes: '', source: 'street', schemaVersion: 1,
      capturedByUid: 'manager-uid', capturedByName: 'Gestor Teste', storeId: 'loja-06'
    }));
  });

  it('blocks unauthorized roles, foreign stores and invalid transitions', async () => {
    const captorDb = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(setDoc(doc(captorDb, 'appointmentWalkIns', 'captor-entry'), {
      ...validWalkIn(), createdByUid: 'captor-uid', createdByName: 'Captador Teste', updatedByUid: 'captor-uid'
    }));

    const managerDb = authenticatedDb('manager-uid', 'manager@example.com');
    const reference = doc(managerDb, 'appointmentWalkIns', '2026-10-30__lead-1');
    await assertSucceeds(setDoc(reference, validWalkIn()));
    await assertFails(updateDoc(reference, {
      status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: 'manager-uid'
    }));
    await assertFails(setDoc(doc(managerDb, 'appointmentWalkIns', 'foreign-entry'), {
      ...validWalkIn(), storeId: 'loja-04'
    }));
  });

  it('upgrades legacy telemarketing to the internal walk-in permissions', async () => {
    const db = authenticatedDb('telemarketing-uid', 'telemarketing@example.com');

    await assertSucceeds(getDoc(doc(db, 'leads', 'lead-1')));
    await assertFails(deleteDoc(doc(db, 'leads', 'lead-1')));
    await assertSucceeds(setDoc(doc(db, 'appointmentWalkIns', 'telemarketing-entry'), {
      ...validWalkIn(),
      createdByUid: 'telemarketing-uid',
      createdByName: 'Colaborador Interno Teste',
      updatedByUid: 'telemarketing-uid'
    }));
  });

  it('allows append-only walk-in details in lead history', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(setDoc(doc(db, 'leads', 'lead-1', 'history', 'event-1'), {
      leadId: 'lead-1', storeId: 'loja-06', eventType: 'walk_in_created',
      funnelStage: 'awaiting_appointment', reasonCode: 'waiting', description: 'Motivo do encaixe',
      walkInId: '2026-10-30__lead-1', actorUid: 'manager-uid', actorName: 'Gestor Teste',
      actorRole: 'manager', occurredAtClient: '2026-10-30T10:00:00.000Z',
      occurredAtServer: serverTimestamp(), schemaVersion: 1
    }));
    await assertFails(updateDoc(doc(db, 'leads', 'lead-1', 'history', 'event-1'), { description: 'Alterado' }));
  });
});
