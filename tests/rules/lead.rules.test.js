import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { createLeadDocument } from '../../src/utils/lead.js';

const projectId = 'demo-fascinlead-leads';
let testEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8180,
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'captor-uid'), {
        email: 'captor@example.com',
        displayName: 'Captador Teste',
        role: 'captor',
        storeId: 'loja-06',
        active: true
      }),
      setDoc(doc(db, 'users', 'mei-uid'), {
        email: 'mei@example.com',
        displayName: 'Captador MEI',
        role: 'captor',
        roleProfileId: 'system-mei',
        permissions: ['leads.create', 'leads.view_own', 'leads.edit_own'],
        storeId: 'loja-02',
        storeIds: ['loja-02', 'loja-05'],
        active: true
      }),
      setDoc(doc(db, 'users', 'outro-uid'), {
        email: 'outro@example.com',
        displayName: 'Outro Captador',
        role: 'captor',
        storeId: 'loja-06',
        active: true
      }),
      setDoc(doc(db, 'users', 'admin-uid'), {
        email: 'admin@example.com',
        displayName: 'Administrador Teste',
        role: 'admin',
        storeId: 'loja-02',
        active: true
      }),
      setDoc(doc(db, 'users', 'manager-uid'), {
        email: 'manager@example.com',
        displayName: 'Gestor Teste',
        role: 'manager',
        storeId: 'loja-06',
        storeIds: ['loja-06', 'loja-02'],
        active: true
      }),
      setDoc(doc(db, 'leads', 'lead-test'), {
        fullName: 'Cliente Exemplo',
        phone: '+5581999991234',
        phoneSearch: '81999991234',
        notes: '',
        appointmentDate: '2026-10-15',
        appointmentTime: '09:30',
        consentGiven: true,
        source: 'street',
        schemaVersion: 1,
        capturedByUid: 'captor-uid',
        capturedByName: 'Captador Teste',
        storeId: 'loja-06',
        capturedAtClient: '2026-09-28T12:00:00.000Z',
        createdAtServer: Timestamp.fromDate(new Date('2026-09-28T12:00:00.000Z')),
        updatedAtServer: Timestamp.fromDate(new Date('2026-09-28T12:00:00.000Z'))
      })
    ]);
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

describe('lead correction rules', () => {
  it('lets an authorized manager archive a lead and preserve the archive event', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'leads', 'lead-test'), {
      archived: true,
      archivedAtServer: serverTimestamp(),
      archivedByUid: 'manager-uid',
      archivedByName: 'Gestor Teste',
      updatedAtServer: serverTimestamp()
    });
    batch.set(doc(db, 'leads', 'lead-test', 'history', 'lead-archived'), {
      leadId: 'lead-test', storeId: 'loja-06', eventType: 'lead_archived', funnelStage: 'captured',
      reasonCode: '', description: 'Lead arquivado na gestão.', actorUid: 'manager-uid',
      actorName: 'Gestor Teste', actorRole: 'manager', occurredAtClient: '2026-11-03T12:00:00.000Z',
      occurredAtServer: serverTimestamp(), schemaVersion: 1
    });
    await assertSucceeds(batch.commit());
  });

  it('lets the owner cancel an appointment while releasing its reserved slot and preserving history', async () => {
    const slotId = 'slot-consultorio-surubim-2026-10-15-09:30';
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'appointmentSlots', slotId), {
        storeId: 'loja-06', appointmentDate: '2026-10-15', appointmentTime: '09:30', blockTime: '09:30',
        durationMinutes: 20, leadId: 'lead-test', capturedByUid: 'captor-uid', createdAt: Timestamp.now()
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'leads', 'lead-test'), {
      appointmentStatus: 'cancelled',
      appointmentAttendance: 'cancelled',
      appointmentCancelledAtServer: serverTimestamp(),
      appointmentCancelledByUid: 'captor-uid',
      appointmentCancelledByName: 'Captador Teste',
      appointmentCancellationReason: 'client_withdrew',
      appointmentCancellationDetails: '',
      funnelStage: 'cancelled',
      funnelReasonCode: 'client_withdrew',
      funnelUpdatedAtClient: '2026-11-03T12:00:00.000Z',
      funnelUpdatedAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp()
    });
    batch.delete(doc(db, 'appointmentSlots', slotId));
    batch.set(doc(db, 'leads', 'lead-test', 'history', 'appointment-cancelled'), {
      leadId: 'lead-test', storeId: 'loja-06', eventType: 'appointment_cancelled', funnelStage: 'cancelled',
      reasonCode: 'client_withdrew', description: 'Cliente desistiu.', actorUid: 'captor-uid',
      actorName: 'Captador Teste', actorRole: 'captor', occurredAtClient: '2026-11-03T12:00:00.000Z',
      occurredAtServer: serverTimestamp(), schemaVersion: 1
    });
    await assertSucceeds(batch.commit());
  });

  it('lets an agenda-only manager read appointments without management access', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'manager-uid'), {
        roleProfileId: 'custom-agenda-only',
        permissions: ['appointments.view']
      });
    });
    const restrictedDb = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(getDoc(doc(restrictedDb, 'leads', 'lead-test')));

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'manager-uid'), {
        permissions: []
      });
    });
    const noAgendaDb = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(getDoc(doc(noAgendaDb, 'leads', 'lead-test')));
  });

  it('lets an agenda profile complete only the current appointment reminder as itself', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'manager-uid'), {
        roleProfileId: 'custom-agenda-only',
        permissions: ['appointments.view']
      });
    });
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const reminder = {
      leadId: 'lead-test',
      storeId: 'loja-06',
      appointmentDate: '2026-10-15',
      appointmentTime: '09:30',
      appointmentKey: '2026-10-15|09:30',
      completedAt: Timestamp.now(),
      completedByUid: 'manager-uid',
      completedByName: 'Gestor Teste',
      schemaVersion: 1
    };
    const reminderRef = doc(db, 'appointmentReminders', 'lead-test__2026-10-15__09-30');
    await assertSucceeds(setDoc(reminderRef, reminder));
    await assertSucceeds(getDocs(query(
      collection(db, 'appointmentReminders'),
      where('storeId', '==', 'loja-06'),
      where('appointmentDate', '>=', '2026-10-15'),
      where('appointmentDate', '<=', '2026-10-21')
    )));
    const captorDb = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(deleteDoc(doc(captorDb, 'appointmentReminders', 'lead-test__2026-10-15__09-30')));
    await assertSucceeds(deleteDoc(reminderRef));
    await assertFails(setDoc(doc(db, 'appointmentReminders', 'forged-reminder'), {
      ...reminder,
      completedByUid: 'outro-uid',
      completedByName: 'Outro Captador'
    }));
  });

  it('lets the captor create a lead without consent fields', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(setDoc(doc(db, 'leads', 'lead-without-consent'), {
      fullName: 'Novo Cliente',
      phone: '+5581999995678',
      phoneSearch: '81999995678',
      customerCpf: '52998224725',
      customerRg: '12.345.678-X',
      birthDate: '1985-04-12',
      sex: 'female',
      street: 'Rua das Flores',
      streetNumber: 'S/N',
      notes: '',
      ametropiaIds: ['myopia', 'astigmatism'],
      ametropiaLabels: ['Miopia', 'Astigmatismo'],
      pathologyIds: ['glaucoma', 'diabetes'],
      pathologyLabels: ['Glaucoma', 'Diabetes'],
      source: 'street',
      schemaVersion: 1,
      capturedByUid: 'captor-uid',
      capturedByName: 'Captador Teste',
      storeId: 'loja-06',
      capturedAtClient: '2026-09-28T13:00:00.000Z',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets a MEI create leads only for permitted destination stores', async () => {
    const db = authenticatedDb('mei-uid', 'mei@example.com');
    const lead = {
      fullName: 'Cliente do MEI',
      phone: '+5581999995678',
      phoneSearch: '81999995678',
      birthDate: '1985-04-12',
      notes: '',
      source: 'street',
      schemaVersion: 1,
      capturedByUid: 'mei-uid',
      capturedByName: 'Captador MEI',
      capturedAtClient: '2026-09-28T13:00:00.000Z',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    };

    await assertSucceeds(setDoc(doc(db, 'leads', 'mei-permitted-store'), { ...lead, storeId: 'loja-05' }));
    await assertFails(setDoc(doc(db, 'leads', 'mei-blocked-store'), { ...lead, storeId: 'loja-06' }));
  });

  it('accepts the complete lead and appointment currently produced by the registration form', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const result = createLeadDocument({
      fullName: 'Cliente do formulário',
      phone: '(81) 99999-5678',
      customerRg: '',
      customerCpf: '',
      birthDate: '1985-04-12',
      sex: '',
      preferredName: '',
      street: '',
      streetNumber: '',
      neighborhood: '',
      city: '',
      state: 'PE',
      interestId: '',
      ametropiaIds: [],
      pathologyIds: [],
      eyeSurgeryStatus: 'no',
      eyeSurgeryType: '',
      eyeSurgeryDetails: '',
      careRouteOverride: 'automatic',
      careRouteReasons: [],
      needsTransport: 'false',
      hasCompanion: 'false',
      appointmentDate: '2026-10-26',
      appointmentTime: '08:00',
      appointmentServiceId: 'eye-exam',
      appointmentServiceName: 'Exame de vista',
      appointmentDurationMinutes: 20,
      schedulingMode: 'controlled',
      notes: ''
    }, {
      uid: 'captor-uid',
      displayName: 'Captador Teste',
      storeId: 'loja-06'
    }, 'installation-test', new Date('2026-10-25T12:00:00.000Z'));

    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', 'form-generated-lead'), {
      ...result.data,
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-26-08:00'), {
      storeId: 'loja-06',
      appointmentDate: '2026-10-26',
      appointmentTime: '08:00',
      blockTime: '08:00',
      durationMinutes: 20,
      leadId: 'form-generated-lead',
      capturedByUid: 'captor-uid',
      createdAt: Timestamp.now()
    });
    await assertSucceeds(batch.commit());
  });

  it('creates an immutable history event together with the lead', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const result = createLeadDocument({
      fullName: 'Cliente com historico',
      phone: '(81) 99999-5678',
      birthDate: '1985-04-12',
      sex: '',
      eyeSurgeryStatus: 'no',
      eyeSurgeryType: '',
      eyeSurgeryDetails: '',
      careRouteOverride: 'automatic',
      appointmentDate: '',
      appointmentTime: '',
      notes: ''
    }, {
      uid: 'captor-uid',
      displayName: 'Captador Teste',
      storeId: 'loja-06'
    }, 'installation-test', new Date('2026-10-25T12:00:00.000Z'));
    const leadId = 'lead-with-history';
    const historyReference = doc(db, 'leads', leadId, 'history', 'created');
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', leadId), {
      ...result.data,
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now(),
      funnelUpdatedAtServer: Timestamp.now()
    });
    batch.set(historyReference, {
      leadId,
      storeId: 'loja-06',
      eventType: 'lead_created',
      funnelStage: 'captured',
      reasonCode: '',
      actorUid: 'captor-uid',
      actorName: 'Captador Teste',
      actorRole: 'captor',
      occurredAtClient: '2026-10-25T12:00:00.000Z',
      occurredAtServer: Timestamp.now(),
      schemaVersion: 1
    });

    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(historyReference));
    await assertFails(updateDoc(historyReference, { reasonCode: 'forged' }));
    const otherCaptorDb = authenticatedDb('outro-uid', 'outro@example.com');
    await assertFails(getDoc(doc(otherCaptorDb, 'leads', leadId, 'history', 'created')));
  });

  it('lets the captor upload an offline lead without reading a missing document first', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const leadReference = doc(db, 'leads', 'offline-form-generated-lead');
    const result = createLeadDocument({
      fullName: 'Cliente cadastrado offline',
      phone: '(81) 99569-9479',
      customerRg: '99382738',
      customerCpf: '12612562478',
      birthDate: '1960-10-27',
      sex: 'male',
      preferredName: '',
      street: 'Rua José Ferreira Souto Maior',
      streetNumber: '171',
      neighborhood: 'Diogo',
      city: 'Surubim',
      state: 'PE',
      interestId: 'complete-glasses',
      ametropiaIds: [],
      pathologyIds: ['cataract', 'retinopathy'],
      eyeSurgeryStatus: 'yes',
      eyeSurgeryType: 'cataract',
      eyeSurgeryDetails: '',
      careRouteOverride: 'ophthalmologist',
      careRouteReasons: ['pathology', 'surgery', 'manual'],
      examPaymentType: 'paid',
      needsTransport: 'true',
      hasCompanion: 'true',
      transportEnabled: true,
      appointmentDate: '',
      appointmentTime: '',
      appointmentServiceId: 'eye-exam',
      appointmentServiceName: 'Exame de Vista - 20 min',
      appointmentDurationMinutes: 20,
      schedulingMode: 'controlled',
      notes: 'Sem obrigado'
    }, {
      uid: 'captor-uid',
      displayName: 'Captador Teste',
      storeId: 'loja-06'
    }, 'installation-offline-test', new Date('2026-10-27T14:16:00.000Z'));

    await assertFails(getDoc(leadReference));
    await assertSucceeds(setDoc(leadReference, {
      ...result.data,
      appointmentDate: '',
      appointmentTime: '',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    }));
    await assertSucceeds(getDoc(leadReference));
  });

  it('rejects a new lead without a birth date', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(setDoc(doc(db, 'leads', 'lead-without-birth-date'), {
      fullName: 'Novo Cliente',
      phone: '+5581999995678',
      phoneSearch: '81999995678',
      notes: '',
      source: 'street',
      schemaVersion: 1,
      capturedByUid: 'captor-uid',
      capturedByName: 'Captador Teste',
      storeId: 'loja-06',
      capturedAtClient: '2026-09-28T13:00:00.000Z',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets a manager schedule a lead in an additional permitted store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', 'manager-scheduled-lead'), {
      fullName: 'Cliente do Gestor',
      phone: '+5581999995678',
      phoneSearch: '81999995678',
      birthDate: '1985-04-12',
      notes: '',
      appointmentDate: '2026-10-20',
      appointmentTime: '10:00',
      appointmentSchedulingMode: 'controlled',
      appointmentDurationMinutes: 20,
      source: 'street',
      schemaVersion: 1,
      capturedByUid: 'manager-uid',
      capturedByName: 'Gestor Teste',
      storeId: 'loja-02',
      capturedAtClient: '2026-10-16T12:00:00.000Z',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-10:00'), {
      storeId: 'loja-02',
      appointmentDate: '2026-10-20',
      appointmentTime: '10:00',
      blockTime: '10:00',
      durationMinutes: 20,
      leadId: 'manager-scheduled-lead',
      capturedByUid: 'manager-uid',
      createdAt: Timestamp.now()
    });
    await assertSucceeds(batch.commit());
  });

  it('lets the captor correct editable fields in their own lead', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      fullName: 'Cliente Corrigido',
      notes: 'Prefere contato pela tarde',
      ametropiaIds: ['presbyopia'],
      ametropiaLabels: ['Presbiopia'],
      pathologyIds: ['hypertension'],
      pathologyLabels: ['Pressao alta'],
      updatedAtServer: Timestamp.now()
    }));
  });

  it('accepts a transport request with at most one companion', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      needsTransport: true,
      hasCompanion: true,
      transportSeats: 2,
      updatedAtServer: Timestamp.now()
    }));
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      needsTransport: true,
      hasCompanion: true,
      transportSeats: 3,
      updatedAtServer: Timestamp.now()
    }));
  });

  it('rejects an RG longer than the supported field', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      customerRg: '1'.repeat(21),
      updatedAtServer: Timestamp.now()
    }));
  });

  it('accepts the additional eye conditions', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      pathologyIds: ['macular-degeneration', 'retinal-detachment'],
      pathologyLabels: ['Degeneracao macular', 'Descolamento de retina'],
      updatedAtServer: Timestamp.now()
    }));
  });

  it('rejects contradictory ametropia answers', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      ametropiaIds: ['myopia', 'none'],
      ametropiaLabels: ['Miopia', 'Não possui'],
      updatedAtServer: Timestamp.now()
    }));
  });

  it('rejects contradictory pathology answers', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      pathologyIds: ['glaucoma', 'none'],
      pathologyLabels: ['Glaucoma', 'Não possui'],
      updatedAtServer: Timestamp.now()
    }));
  });

  it('rejects correction by another captor', async () => {
    const db = authenticatedDb('outro-uid', 'outro@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      fullName: 'Alteracao indevida',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('does not let the captor change the original store', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      storeId: 'loja-02',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('does not let a non-administrator change the record origin', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      recordOrigin: 'captar_import',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('accepts new mutable lead fields without requiring a rules allowlist update', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      futureWorkflowField: 'ready',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('keeps lead identity fields protected from non-administrative profiles', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      capturedByUid: 'manager-uid',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('gives administrators a direct bypass for legacy and future fields', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      futureWorkflowField: { status: 'migrated' },
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets an administrator reschedule while updating the lead funnel', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      careRoute: 'optometrist',
      careRouteOverride: 'optometrist',
      pathologyIds: ['cataract'],
      pathologyLabels: ['Catarata'],
      needsTransport: false,
      hasCompanion: false,
      companionCount: 0,
      transportSeats: 0,
      appointmentDate: '2026-10-30',
      appointmentTime: '08:20',
      appointmentSchedulingMode: 'controlled',
      appointmentDurationMinutes: 20,
      appointmentAttendance: 'pending',
      funnelStage: 'scheduled',
      funnelReasonCode: '',
      funnelUpdatedAtClient: '2026-10-29T21:00:00.000Z',
      funnelUpdatedAtServer: Timestamp.now(),
      appointmentCycle: 1,
      updatedAtServer: Timestamp.now()
    }));
  });

  it('requires full lead editing permission for clinical lead corrections', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'manager-uid'), {
        permissions: ['management.view', 'leads.clinical_update']
      });
    });
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      careRoute: 'optometrist',
      careRouteOverride: 'optometrist',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('accepts a concise address reference and rejects values above the limit', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      addressReference: 'Próximo à praça central',
      updatedAtServer: Timestamp.now()
    }));
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      addressReference: 'a'.repeat(161),
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets an administrator correct a lead from another store', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      fullName: 'Cliente Corrigido pelo Admin',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('accepts valid exam billing data and rejects invalid payment values', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      careRoute: 'optometrist',
      careRouteOverride: 'automatic',
      examPaymentType: 'paid',
      examPaymentMethods: ['pix', 'booklet'],
      examPrice: 275,
      updatedAtServer: Timestamp.now()
    }));
    const result = createLeadDocument({
      fullName: 'Preço inválido',
      phone: '(81) 99999-5678',
      birthDate: '1985-04-12',
      sex: '',
      careRouteOverride: 'optometrist',
      examPaymentType: 'paid',
      notes: ''
    }, {
      uid: 'captor-uid',
      displayName: 'Captador Teste',
      storeId: 'loja-06'
    }, 'installation-test');
    await assertFails(setDoc(doc(db, 'leads', 'invalid-exam-price'), {
      ...result.data,
      examPaymentType: 'discounted',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    }));
    await assertFails(setDoc(doc(db, 'leads', 'invalid-exam-payment-method'), {
      ...result.data,
      examPaymentMethods: ['pix', 'crypto'],
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    }));
    await assertFails(setDoc(doc(db, 'leads', 'courtesy-with-payment-method'), {
      ...result.data,
      examPaymentType: 'courtesy',
      examPaymentMethods: ['cash'],
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    }));
  });

  it('accepts companion quantities and rejects inconsistent seat totals', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      needsTransport: true,
      hasCompanion: true,
      companionCount: 2,
      transportSeats: 3,
      updatedAtServer: Timestamp.now()
    }));
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      companionCount: 2,
      transportSeats: 2,
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets an administrator normalize and correct a legacy lead through the full form', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      fullName: 'Cliente Importado Corrigido',
      preferredName: '',
      phone: '+5581999991234',
      phoneSearch: '81999991234',
      customerCpf: '',
      customerRg: '',
      birthDate: '',
      sex: '',
      street: '',
      streetNumber: 'S/N',
      neighborhood: '',
      city: '',
      state: 'PE',
      interestId: '',
      interestLabel: '',
      ametropiaIds: [],
      ametropiaLabels: [],
      pathologyIds: [],
      pathologyLabels: [],
      eyeSurgeryStatus: '',
      eyeSurgeryType: '',
      eyeSurgeryDetails: '',
      careRoute: 'optometrist',
      careRouteOverride: 'automatic',
      examPaymentType: 'paid',
      needsTransport: false,
      hasCompanion: false,
      transportSeats: 0,
      appointmentDate: '2026-10-15',
      appointmentTime: '09:30',
      appointmentSchedulingMode: 'controlled',
      appointmentDurationMinutes: 20,
      notes: '',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets an administrator delete any lead', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(deleteDoc(doc(db, 'leads', 'lead-test')));
  });

  it('lets a manager delete a lead in an authorized store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(deleteDoc(doc(db, 'leads', 'lead-test')));
  });

  it('lets a manager with deletion permission remove an allowed lead and its slot', async () => {
    const slotId = 'slot-consultorio-surubim-2026-10-15-09:30';
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'users', 'manager-uid'), {
        permissions: ['management.view', 'leads.delete']
      });
      await setDoc(doc(db, 'appointmentSlots', slotId), {
        storeId: 'loja-06',
        appointmentDate: '2026-10-15',
        appointmentTime: '09:30',
        blockTime: '09:30',
        durationMinutes: 10,
        leadId: 'lead-test',
        capturedByUid: 'captor-uid',
        createdAt: Timestamp.now()
      });
    });

    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'appointmentSlots', slotId));
    batch.delete(doc(db, 'leads', 'lead-test'));
    await assertSucceeds(batch.commit());
  });
});

describe('appointment calendar queries', () => {
  it('lets an administrator list registrations from every user', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(getDocs(query(
      collection(db, 'leads'),
      orderBy('capturedAtClient', 'desc')
    )));
  });

  it('requires a captor to scope the registration list to their own uid', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(getDocs(query(
      collection(db, 'leads'),
      orderBy('capturedAtClient', 'desc')
    )));
    await assertSucceeds(getDocs(query(
      collection(db, 'leads'),
      where('capturedByUid', '==', 'captor-uid'),
      orderBy('capturedAtClient', 'desc')
    )));
  });

  it('lets a manager query appointments only from their own store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const appointments = query(
      collection(db, 'leads'),
      where('storeId', '==', 'loja-06'),
      where('appointmentDate', '>=', '2026-10-01'),
      where('appointmentDate', '<=', '2026-10-31')
    );
    await assertSucceeds(getDocs(appointments));
  });

  it('lets a manager query overdue follow-ups from their own store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const followUps = query(
      collection(db, 'leads'),
      where('storeId', '==', 'loja-06'),
      where('appointmentDate', '<=', '2026-10-15')
    );
    await assertSucceeds(getDocs(followUps));
  });

  it('rejects an unscoped appointment query by a manager', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const appointments = query(
      collection(db, 'leads'),
      where('appointmentDate', '>=', '2026-10-01'),
      where('appointmentDate', '<=', '2026-10-31')
    );
    await assertFails(getDocs(appointments));
  });

  it('lets a manager query an additional permitted store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(getDocs(query(
      collection(db, 'leads'),
      where('storeId', '==', 'loja-02'),
      where('appointmentDate', '>=', '2026-10-01'),
      where('appointmentDate', '<=', '2026-10-31')
    )));
  });

  it('lets a manager query all permitted stores together', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(getDocs(query(
      collection(db, 'leads'),
      where('storeId', 'in', ['loja-06', 'loja-02']),
      where('appointmentDate', '>=', '2026-10-01'),
      where('appointmentDate', '<=', '2026-10-31')
    )));
  });

  it('rejects a manager query for a store outside the permitted list', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(getDocs(query(
      collection(db, 'leads'),
      where('storeId', '==', 'loja-04'),
      where('appointmentDate', '>=', '2026-10-01'),
      where('appointmentDate', '<=', '2026-10-31')
    )));
  });

  it('lets an administrator query appointments from all stores', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    const appointments = query(
      collection(db, 'leads'),
      where('appointmentDate', '>=', '2026-10-01'),
      where('appointmentDate', '<=', '2026-10-31')
    );
    await assertSucceeds(getDocs(appointments));
  });

  it('lets an administrator query overdue follow-ups from all stores', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    const followUps = query(
      collection(db, 'leads'),
      where('appointmentDate', '<=', '2026-10-15')
    );
    await assertSucceeds(getDocs(followUps));
  });

  it('lets a manager register attendance for an appointment in their store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentAttendance: 'attended',
      appointmentAttendanceUpdatedAt: Timestamp.now(),
      appointmentAttendanceUpdatedByUid: 'manager-uid',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('does not let a manager edit customer data while registering attendance', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', 'manager-uid'), {
        permissions: ['appointments.attendance']
      });
    });
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      fullName: 'Alteracao indevida pelo gestor',
      appointmentAttendance: 'attended',
      appointmentAttendanceUpdatedAt: Timestamp.now(),
      appointmentAttendanceUpdatedByUid: 'manager-uid',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('does not let a captor change attendance directly', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentAttendance: 'missed',
      appointmentAttendanceUpdatedAt: Timestamp.now(),
      appointmentAttendanceUpdatedByUid: 'captor-uid',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets the owning captor register that follow-up contact started', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      followUpContactedAt: Timestamp.now(),
      followUpContactedByUid: 'captor-uid',
      followUpContactedByName: 'Captador Teste',
      followUpContactedAppointmentKey: '2026-10-15|09:30',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('does not let another captor register contact for the lead', async () => {
    const db = authenticatedDb('outro-uid', 'outro@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      followUpContactedAt: Timestamp.now(),
      followUpContactedByUid: 'outro-uid',
      followUpContactedByName: 'Outro Captador',
      followUpContactedAppointmentKey: '2026-10-15|09:30',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets a store-scoped profile register only its own follow-up', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'users', 'manager-uid'), {
        roleProfileId: 'system-receptionist',
        permissions: [
          'leads.create', 'leads.view_own', 'leads.edit_own',
          'appointments.view', 'appointments.attendance'
        ]
      });
      await setDoc(doc(db, 'leads', 'receptionist-lead'), {
        fullName: 'Cliente do Balcão',
        phone: '+5581999995678',
        phoneSearch: '81999995678',
        notes: '',
        appointmentDate: '2026-10-16',
        appointmentTime: '10:00',
        consentGiven: true,
        source: 'store',
        schemaVersion: 1,
        capturedByUid: 'manager-uid',
        capturedByName: 'Gestor Teste',
        storeId: 'loja-06',
        capturedAtClient: '2026-09-28T12:00:00.000Z',
        createdAtServer: Timestamp.now(),
        updatedAtServer: Timestamp.now()
      });
    });

    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'receptionist-lead'), {
      followUpContactedAt: Timestamp.now(),
      followUpContactedByUid: 'manager-uid',
      followUpContactedByName: 'Gestor Teste',
      followUpContactedAppointmentKey: '2026-10-16|10:00',
      updatedAtServer: Timestamp.now()
    }));
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      followUpContactedAt: Timestamp.now(),
      followUpContactedByUid: 'manager-uid',
      followUpContactedByName: 'Gestor Teste',
      followUpContactedAppointmentKey: '2026-10-15|09:30',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets a manager register contact for a captor in an authorized store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      followUpContactedAt: Timestamp.now(),
      followUpContactedByUid: 'manager-uid',
      followUpContactedByName: 'Gestor Teste',
      followUpContactedAppointmentKey: '2026-10-15|09:30',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets a manager edit a lead in an authorized store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentDate: '2026-10-20',
      appointmentTime: '10:30',
      updatedAtServer: Timestamp.now()
    }));
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentDate: '2026-10-21',
      fullName: 'Alteracao indevida',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets the owning captor clear a missed status only while rescheduling', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'leads', 'lead-test'), {
        appointmentAttendance: 'missed'
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentDate: '2026-10-20',
      appointmentTime: '10:00',
      appointmentAttendance: 'pending',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('does not let the owning captor clear a missed status without rescheduling', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'leads', 'lead-test'), {
        appointmentAttendance: 'missed'
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentAttendance: 'pending',
      updatedAtServer: Timestamp.now()
    }));
  });
});

describe('store schedule settings', () => {
  it('lets an administrator configure a store schedule', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(setDoc(doc(db, 'stores', 'loja-06'), {
      schedulingMode: 'controlled',
      appointmentDurationMinutes: 20,
      noShowGraceMinutes: 30,
      automaticPendingFollowUp: true,
      openingTime: '08:00',
      closingTime: '18:00'
    }, { merge: true }));
  });

  it('lets a captor read the schedule of their own store', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'stores', 'loja-06'), {
        schedulingMode: 'controlled',
        appointmentDurationMinutes: 20,
        openingTime: '08:00',
        closingTime: '18:00'
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(getDoc(doc(db, 'stores', 'loja-06')));
  });

  it('lets a Surubim captor read the shared transport configuration', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'stores', 'loja-02'), {
        transportEnabled: true,
        transportHoursRules: [{ weekday: 3, openingTime: '13:00', closingTime: '17:00' }]
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(getDoc(doc(db, 'stores', 'loja-02')));
    await assertFails(getDoc(doc(db, 'stores', 'loja-04')));
  });

  it('rejects store schedule changes by a captor', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(setDoc(doc(db, 'stores', 'loja-06'), {
      appointmentDurationMinutes: 5
    }, { merge: true }));
  });
});

describe('appointment service catalog', () => {
  const service = {
    name: 'Exame de vista',
    storeIds: ['loja-02', 'loja-06'],
    durationMinutes: 30,
    active: true,
    schemaVersion: 2,
    createdAt: Timestamp.now(),
    createdByUid: 'admin-uid',
    updatedAt: Timestamp.now(),
    updatedByUid: 'admin-uid'
  };

  it('lets an administrator create and edit a service', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    const reference = doc(db, 'appointmentServices', 'eye-exam');
    await assertSucceeds(setDoc(reference, service));
    await assertSucceeds(updateDoc(reference, {
      durationMinutes: 40,
      updatedAt: Timestamp.now(),
      updatedByUid: 'admin-uid'
    }));
    await assertSucceeds(deleteDoc(reference));
  });

  it('lets a captor list active services from their own store', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'appointmentServices', 'eye-exam'), service);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(getDocs(query(
      collection(db, 'appointmentServices'),
      where('storeIds', 'array-contains', 'loja-06'),
      where('active', '==', true)
    )));
  });

  it('does not let a captor read inactive services or manage the catalog', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'appointmentServices', 'inactive-service'), {
        ...service,
        active: false
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(getDoc(doc(db, 'appointmentServices', 'inactive-service')));
    await assertFails(setDoc(doc(db, 'appointmentServices', 'new-service'), {
      ...service,
      createdByUid: 'captor-uid',
      updatedByUid: 'captor-uid'
    }));
    await assertFails(deleteDoc(doc(db, 'appointmentServices', 'inactive-service')));
  });
});

describe('appointment slot reservations', () => {
  const lead = {
    fullName: 'Cliente com horário',
    phone: '+5581999991234',
    phoneSearch: '81999991234',
    birthDate: '1985-04-12',
    notes: '',
    appointmentDate: '2026-10-20',
    appointmentTime: '08:00',
    appointmentAttendance: 'pending',
    appointmentSchedulingMode: 'controlled',
    appointmentDurationMinutes: 20,
    source: 'street',
    schemaVersion: 1,
    capturedByUid: 'captor-uid',
    capturedByName: 'Captador Teste',
    storeId: 'loja-06',
    capturedAtClient: '2026-10-15T13:00:00.000Z',
    createdAtServer: Timestamp.now(),
    updatedAtServer: Timestamp.now()
  };
  const slot = {
    storeId: 'loja-06',
    appointmentDate: '2026-10-20',
    appointmentTime: '08:00',
    blockTime: '08:00',
    durationMinutes: 20,
    leadId: 'lead-slot',
    capturedByUid: 'captor-uid',
    createdAt: Timestamp.now()
  };

  it('lets a captor reserve and read slots without reading colleagues leads', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', 'lead-slot'), lead);
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), slot);
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDocs(query(
      collection(db, 'appointmentSlots'),
      where('storeId', '==', 'loja-06'),
      where('appointmentDate', '==', '2026-10-20')
    )));
  });

  it('rejects replacing an occupied slot', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await Promise.all([
        setDoc(doc(context.firestore(), 'leads', 'lead-slot'), lead),
        setDoc(doc(context.firestore(), 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), slot)
      ]);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(setDoc(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), {
      ...slot,
      leadId: 'second-lead',
      createdAt: Timestamp.now()
    }));
  });

  it('rejects a new appointment when any required block is occupied', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await Promise.all([
        setDoc(doc(context.firestore(), 'leads', 'lead-slot'), lead),
        setDoc(doc(context.firestore(), 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), slot)
      ]);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const overlappingLead = {
      ...lead,
      appointmentTime: '07:50',
      capturedAtClient: '2026-10-15T13:05:00.000Z'
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', 'overlapping-lead'), overlappingLead);
    ['07:50', '08:00'].forEach((blockTime) => {
      batch.set(doc(db, 'appointmentSlots', `slot-consultorio-surubim-2026-10-20-${blockTime}`), {
        ...slot,
        appointmentTime: '07:50',
        blockTime,
        leadId: 'overlapping-lead'
      });
    });
    await assertFails(batch.commit());
  });

  it('rejects an orphan slot without a matching lead', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(setDoc(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), slot));
  });

  it('lets an administrator backfill a slot for an existing lead', async () => {
    const db = authenticatedDb('admin-uid', 'admin@example.com');
    await assertSucceeds(setDoc(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-15-09:30'), {
      storeId: 'loja-06',
      appointmentDate: '2026-10-15',
      appointmentTime: '09:30',
      blockTime: '09:30',
      durationMinutes: 20,
      leadId: 'lead-test',
      capturedByUid: 'captor-uid',
      createdAt: Timestamp.now()
    }));
  });

  it('lets Surubim stores read their shared clinic slots', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(getDocs(query(
      collection(db, 'appointmentSlots'),
      where('storeId', '==', 'loja-02'),
      where('appointmentDate', '==', '2026-10-20')
    )));
  });

  it('lets the captor schedule a previously unscheduled offline lead', async () => {
    const unscheduledLead = {
      ...lead,
      appointmentDate: '',
      appointmentTime: '',
      appointmentSchedulingMode: 'controlled'
    };
    delete unscheduledLead.appointmentAttendance;
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'leads', 'offline-lead'), unscheduledLead);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'leads', 'offline-lead'), {
      appointmentDate: '2026-10-20',
      appointmentTime: '08:00',
      appointmentAttendance: 'pending',
      appointmentDurationMinutes: 20,
      updatedAtServer: Timestamp.now()
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), {
      ...slot,
      leadId: 'offline-lead'
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:10'), {
      ...slot,
      blockTime: '08:10',
      leadId: 'offline-lead'
    });
    await assertSucceeds(batch.commit());
  });

  it('lets the owner complete the first appointment even without general edit permission', async () => {
    const unscheduledLead = {
      ...lead,
      appointmentDate: '',
      appointmentTime: '',
      appointmentSchedulingMode: 'controlled'
    };
    delete unscheduledLead.appointmentAttendance;
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await Promise.all([
        setDoc(doc(adminDb, 'leads', 'offline-limited-lead'), unscheduledLead),
        updateDoc(doc(adminDb, 'users', 'captor-uid'), {
          permissions: ['leads.create', 'leads.view_own']
        })
      ]);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'leads', 'offline-limited-lead'), {
      appointmentDate: '2026-10-20',
      appointmentTime: '08:00',
      appointmentAttendance: 'pending',
      appointmentDurationMinutes: 20,
      appointmentServiceId: 'eye-exam',
      appointmentServiceName: 'Exame de vista',
      funnelStage: 'scheduled',
      funnelReasonCode: '',
      funnelUpdatedAtClient: '2026-10-19T12:00:00.000Z',
      funnelUpdatedAtServer: Timestamp.now(),
      appointmentCycle: 1,
      updatedAtServer: Timestamp.now()
    });
    batch.set(doc(db, 'leads', 'offline-limited-lead', 'history', 'appointment-created'), {
      leadId: 'offline-limited-lead',
      storeId: 'loja-06',
      eventType: 'appointment_scheduled',
      funnelStage: 'scheduled',
      reasonCode: '',
      actorUid: 'captor-uid',
      actorName: 'Captador Teste',
      actorRole: 'captor',
      occurredAtClient: '2026-10-19T12:00:00.000Z',
      occurredAtServer: Timestamp.now(),
      schemaVersion: 1
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), {
      ...slot,
      leadId: 'offline-limited-lead'
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:10'), {
      ...slot,
      blockTime: '08:10',
      leadId: 'offline-limited-lead'
    });
    await assertSucceeds(batch.commit());
  });

  it('lets the owner reschedule an existing appointment without general edit permission', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await Promise.all([
        setDoc(doc(adminDb, 'leads', 'limited-scheduled-lead'), lead),
        setDoc(doc(adminDb, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), {
          ...slot,
          leadId: 'limited-scheduled-lead'
        }),
        setDoc(doc(adminDb, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:10'), {
          ...slot,
          blockTime: '08:10',
          leadId: 'limited-scheduled-lead'
        }),
        updateDoc(doc(adminDb, 'users', 'captor-uid'), {
          permissions: ['leads.create', 'leads.view_own']
        })
      ]);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const batch = writeBatch(db);
    batch.update(doc(db, 'leads', 'limited-scheduled-lead'), {
      appointmentTime: '08:20',
      appointmentAttendance: 'pending',
      updatedAtServer: Timestamp.now()
    });
    batch.delete(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'));
    batch.delete(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:10'));
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:20'), {
      ...slot,
      appointmentTime: '08:20',
      blockTime: '08:20',
      leadId: 'limited-scheduled-lead'
    });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:30'), {
      ...slot,
      appointmentTime: '08:20',
      blockTime: '08:30',
      leadId: 'limited-scheduled-lead'
    });
    await assertSucceeds(batch.commit());
  });

  it('keeps unrelated lead fields protected during an owner reschedule', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await Promise.all([
        setDoc(doc(adminDb, 'leads', 'protected-scheduled-lead'), lead),
        updateDoc(doc(adminDb, 'users', 'captor-uid'), {
          permissions: ['leads.create', 'leads.view_own']
        })
      ]);
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(updateDoc(doc(db, 'leads', 'protected-scheduled-lead'), {
      fullName: 'Nome alterado sem permissao',
      appointmentTime: '08:20',
      appointmentAttendance: 'pending',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets a manager clear an attendance status back to pending', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'leads', 'lead-test'), { appointmentAttendance: 'attended' });
    });
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(updateDoc(doc(db, 'leads', 'lead-test'), {
      appointmentAttendance: 'pending',
      appointmentAttendanceUpdatedAt: Timestamp.now(),
      appointmentAttendanceUpdatedByUid: 'manager-uid',
      updatedAtServer: Timestamp.now()
    }));
  });

  it('lets the captor create and schedule a local-only lead in one batch', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    const localLead = {
      ...lead,
      appointmentDate: '2026-10-21',
      appointmentTime: '08:20',
      createdAtServer: Timestamp.now(),
      updatedAtServer: Timestamp.now()
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', 'local-only-lead'), localLead, { merge: true });
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-21-08:20'), {
      ...slot,
      appointmentDate: '2026-10-21',
      appointmentTime: '08:20',
      blockTime: '08:20',
      leadId: 'local-only-lead'
    });
    await assertSucceeds(batch.commit());
  });

  it('lets a Surubim captor query the combined clinic occupancy', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'appointmentSlots', 'legacy-loja-02-slot'), {
        ...slot,
        storeId: 'loja-02'
      });
    });
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertSucceeds(getDocs(query(
      collection(db, 'appointmentSlots'),
      where('storeId', 'in', ['loja-02', 'loja-06']),
      where('appointmentDate', '==', '2026-10-20')
    )));
  });

  it('prevents Loja 02 and Loja 06 from reserving the same clinic block', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await Promise.all([
        setDoc(doc(context.firestore(), 'leads', 'lead-slot'), lead),
        setDoc(doc(context.firestore(), 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), slot)
      ]);
    });
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    const loja02Lead = {
      ...lead,
      capturedByUid: 'manager-uid',
      capturedByName: 'Gestor Teste',
      storeId: 'loja-02'
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'leads', 'lead-loja-02'), loja02Lead);
    batch.set(doc(db, 'appointmentSlots', 'slot-consultorio-surubim-2026-10-20-08:00'), {
      ...slot,
      storeId: 'loja-02',
      leadId: 'lead-loja-02',
      capturedByUid: 'manager-uid'
    });
    await assertFails(batch.commit());
  });

  it('rejects reading slots from an independent store', async () => {
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(getDocs(query(
      collection(db, 'appointmentSlots'),
      where('storeId', '==', 'loja-04'),
      where('appointmentDate', '==', '2026-10-20')
    )));
  });
});

describe('private lead sale tracking', () => {
  const tracking = {
    leadId: 'lead-test',
    storeId: 'loja-06',
    capturedByUid: 'captor-uid',
    customerCpf: '52998224725',
    purchaseInterest: true,
    matchStatus: 'interest_registered',
    savwinStoreCode: '',
    savwinOsNumber: '',
    savwinSaleCode: '',
    savwinCustomerCode: '',
    savwinSaleDate: '',
    savwinSaleValue: 0,
    createdByUid: 'manager-uid',
    createdAt: Timestamp.now(),
    updatedByUid: 'manager-uid',
    updatedAt: Timestamp.now(),
    schemaVersion: 1
  };

  it('lets an authorized manager register and read purchase interest', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertSucceeds(getDoc(doc(db, 'leadSales', 'lead-test')));
    await assertSucceeds(setDoc(doc(db, 'leadSales', 'lead-test'), tracking));
    await assertSucceeds(getDoc(doc(db, 'leadSales', 'lead-test')));
  });

  it('keeps CPF and sale data hidden from captors', async () => {
    await testEnvironment.withSecurityRulesDisabled((context) => setDoc(
      doc(context.firestore(), 'leadSales', 'lead-test'),
      tracking
    ));
    const db = authenticatedDb('captor-uid', 'captor@example.com');
    await assertFails(getDoc(doc(db, 'leadSales', 'lead-test')));
    await assertFails(setDoc(doc(db, 'leadSales', 'lead-test'), { ...tracking, updatedByUid: 'captor-uid' }));
  });

  it('rejects a manager assigning sale data to another store', async () => {
    const db = authenticatedDb('manager-uid', 'manager@example.com');
    await assertFails(setDoc(doc(db, 'leadSales', 'lead-test'), { ...tracking, storeId: 'loja-05' }));
  });
});
