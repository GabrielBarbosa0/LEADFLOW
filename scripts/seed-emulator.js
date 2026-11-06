import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_STORE_SCHEDULE, appointmentBlockTimes } from '../src/utils/schedule.js';
import { appointmentResourceId } from '../src/utils/stores.js';

const PROJECT_ID = 'demo-leadflow';
const SEED_VERSION = 3;
const TEST_PASSWORD = 'LeadFlow@123';
const resetRequested = process.argv.includes('--reset');
const authHost = String(process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099');
const firestoreHost = String(process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8180');
const configuredProjectId = String(process.env.GCLOUD_PROJECT || PROJECT_ID);

function assertLocalEnvironment() {
  if (configuredProjectId !== PROJECT_ID) {
    throw new Error(`Seed bloqueado para o projeto ${configuredProjectId}.`);
  }
  const localHostPattern = /^(127\.0\.0\.1|localhost|emulators):\d+$/;
  if (!localHostPattern.test(authHost) || !localHostPattern.test(firestoreHost)) {
    throw new Error('Seed bloqueado: os hosts informados nao sao emuladores locais.');
  }
}

function dateInSaoPaulo(offsetDays = 0) {
  const current = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const [year, month, day] = current.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays, 12));
  return date.toISOString().slice(0, 10);
}

function timestampAt(offsetDays = 0, hour = 9, minute = 0) {
  const dateText = dateInSaoPaulo(offsetDays);
  return Timestamp.fromDate(new Date(`${dateText}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`));
}

async function clearEmulators() {
  const endpoints = [
    `http://${firestoreHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    `http://${authHost}/emulator/v1/projects/${PROJECT_ID}/accounts`
  ];
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Nao foi possivel limpar o emulador: ${endpoint} (${response.status}).`);
    }
  }
}

function cloneSchedule(overrides = {}) {
  return {
    ...JSON.parse(JSON.stringify(DEFAULT_STORE_SCHEDULE)),
    ...overrides
  };
}

function historyEvent(lead, eventType = 'lead_created', description = 'Cadastro ficticio criado pelo seed local.') {
  return {
    leadId: lead.id,
    storeId: lead.storeId,
    eventType,
    funnelStage: lead.funnelStage,
    reasonCode: lead.funnelReasonCode || '',
    description,
    actorUid: lead.capturedByUid,
    actorName: lead.capturedByName,
    actorRole: 'captor',
    occurredAtClient: lead.capturedAtClient,
    occurredAtServer: lead.createdAtServer,
    schemaVersion: 1
  };
}

function leadRecord({
  id,
  fullName,
  phoneSearch,
  storeId = 'loja-02',
  capturedByUid = 'test-collaborator',
  capturedByName = 'Colaborador Teste',
  appointmentDate = '',
  appointmentTime = '',
  appointmentAttendance,
  appointmentStatus,
  funnelStage,
  funnelReasonCode = '',
  createdOffset = -3,
  notes = '',
  preferredName = '',
  addressReference = '',
  needsTransport = false,
  companionCount = 0
}) {
  const createdAt = timestampAt(createdOffset, 10);
  const scheduled = Boolean(appointmentDate && appointmentTime);
  return {
    id,
    fullName,
    preferredName,
    phone: `+55${phoneSearch}`,
    phoneSearch,
    customerCpf: '',
    customerRg: '',
    savwinCode: `TEST-${id.toUpperCase()}`.slice(0, 40),
    score: 750,
    birthDate: '1985-04-12',
    birthMonthDay: '04-12',
    sex: 'female',
    postalCode: '50000123',
    street: 'Rua de Teste',
    streetNumber: '100',
    neighborhood: 'Centro',
    city: 'Cidade de Teste',
    state: 'PE',
    addressReference,
    interestId: 'eye-exam',
    interestLabel: 'Exame de vista',
    ametropiaIds: ['unknown'],
    ametropiaLabels: ['Nao sabe informar'],
    pathologyIds: ['none'],
    pathologyLabels: ['Nao possui'],
    diabetesLevel: null,
    diabetesNeedsMedicalAlert: false,
    eyeSurgeryStatus: 'no',
    eyeSurgeryType: '',
    eyeSurgeryDetails: '',
    careRoute: 'optometrist',
    careRouteOverride: 'automatic',
    careRouteReasons: [],
    examPaymentType: 'paid',
    examPaymentMethods: ['pix'],
    creditFatherName: '',
    creditMotherName: '',
    creditAuxiliaryPhone: '',
    creditAuxiliaryPhoneSearch: '',
    examPrice: 150,
    needsTransport,
    hasCompanion: companionCount > 0,
    companionCount,
    transportSeats: needsTransport ? companionCount + 1 : 0,
    appointmentDate,
    appointmentTime,
    funnelStage: funnelStage || (scheduled ? 'scheduled' : 'awaiting_appointment'),
    funnelReasonCode,
    funnelUpdatedAtClient: createdAt.toDate().toISOString(),
    funnelUpdatedAtServer: createdAt,
    appointmentCycle: scheduled ? 1 : 0,
    appointmentSchedulingMode: 'controlled',
    appointmentDurationMinutes: 20,
    ...(scheduled ? {
      appointmentServiceId: 'default-eye-exam',
      appointmentServiceName: 'Exame de vista',
      appointmentAttendance: appointmentAttendance || 'pending',
      ...(appointmentStatus ? { appointmentStatus } : {})
    } : {}),
    notes,
    source: 'street',
    capturedAtClient: createdAt.toDate().toISOString(),
    capturedByUid,
    capturedByName,
    storeId,
    installationId: 'seed-local',
    appVersion: '0.1.0',
    schemaVersion: 1,
    createdAtServer: createdAt,
    updatedAtServer: createdAt
  };
}

async function loadRoleProfiles() {
  const content = await readFile(new URL('../functions/system-role-profiles.json', import.meta.url), 'utf8');
  const config = JSON.parse(content);
  return {
    permissionSchemaVersion: config.permissionSchemaVersion,
    profiles: new Map(config.profiles.map((profile) => [profile.id, profile]))
  };
}

async function createAuthUsers(auth, users) {
  for (const user of users) {
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: TEST_PASSWORD,
      displayName: user.displayName,
      emailVerified: true,
      disabled: user.active === false
    });
  }
}

async function writeSeed(db, roleConfig, users) {
  const batch = db.batch();
  const now = Timestamp.now();
  const allStoreIds = ['loja-02', 'loja-04', 'loja-05', 'loja-06'];
  const stores = [
    ['loja-02', 'LOJA_02', 'Loja 02', 'Surubim'],
    ['loja-04', 'LOJA_04', 'Loja 04', 'Carpina'],
    ['loja-05', 'LOJA_05', 'Loja 05', 'Limoeiro'],
    ['loja-06', 'LOJA_06', 'Loja 06', 'Surubim']
  ];

  for (const user of users) {
    const profile = roleConfig.profiles.get(user.roleProfileId);
    const permissions = profile?.permissions || [];
    const data = {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      roleProfileId: user.roleProfileId,
      roleProfileName: profile?.name || user.role,
      permissions,
      permissionSchemaVersion: roleConfig.permissionSchemaVersion,
      storeId: user.storeId,
      storeIds: user.storeIds,
      active: user.active !== false,
      createdAt: now,
      createdBy: 'seed-local',
      updatedAt: now,
      updatedBy: 'seed-local'
    };
    batch.set(db.doc(`allowedEmails/${user.email}`), data);
    batch.set(db.doc(`users/${user.uid}`), {
      ...data,
      photoUrl: '',
      createdAt: now,
      lastLoginAt: now
    });
  }

  for (const [id, code, name, city] of stores) {
    batch.set(db.doc(`stores/${id}`), {
      code,
      name,
      city,
      active: true,
      ...cloneSchedule({ offlineCaptureEnabled: id === 'loja-02' }),
      updatedAt: now,
      updatedByUid: 'test-admin'
    });
  }

  batch.set(db.doc('appointmentServices/default-eye-exam'), {
    name: 'Exame de vista',
    storeIds: allStoreIds,
    durationMinutes: 20,
    active: true,
    schemaVersion: 2,
    createdAt: now,
    createdByUid: 'test-admin',
    updatedAt: now,
    updatedByUid: 'test-admin'
  });

  const leads = [
    leadRecord({ id: 'lead-pending-today', fullName: 'Cliente Pendente Hoje', phoneSearch: '81990000001', appointmentDate: dateInSaoPaulo(0), appointmentTime: '08:00' }),
    leadRecord({ id: 'lead-attended-today', fullName: 'Cliente Compareceu Hoje', phoneSearch: '81990000002', appointmentDate: dateInSaoPaulo(0), appointmentTime: '08:20', appointmentAttendance: 'attended' }),
    leadRecord({ id: 'lead-missed-yesterday', fullName: 'Cliente Faltou Ontem', phoneSearch: '81990000003', appointmentDate: dateInSaoPaulo(-1), appointmentTime: '09:00', appointmentAttendance: 'missed' }),
    leadRecord({ id: 'lead-unscheduled', fullName: 'Cliente Sem Agendamento', phoneSearch: '81990000004' }),
    leadRecord({ id: 'lead-other-store', fullName: 'Cliente Outra Unidade', phoneSearch: '81990000005', storeId: 'loja-05', capturedByUid: 'test-receptionist-05', capturedByName: 'Balcao Loja 05', appointmentDate: dateInSaoPaulo(1), appointmentTime: '10:00' }),
    leadRecord({ id: 'lead-rescheduled', fullName: 'Cliente Reagendado', phoneSearch: '81990000006', appointmentDate: dateInSaoPaulo(1), appointmentTime: '10:40', funnelReasonCode: 'schedule_conflict', notes: 'Reagendado pelo seed para validar o historico.' }),
    leadRecord({ id: 'lead-cancelled', fullName: 'Cliente Cancelado', phoneSearch: '81990000007', appointmentDate: dateInSaoPaulo(1), appointmentTime: '11:20', appointmentAttendance: 'cancelled', appointmentStatus: 'cancelled', funnelStage: 'cancelled', funnelReasonCode: 'client_request', notes: 'Registro de teste para o funil cancelado.' }),
    leadRecord({ id: 'lead-mei', fullName: 'Cliente Captado por MEI', phoneSearch: '81990000008', storeId: 'loja-05', capturedByUid: 'test-mei', capturedByName: 'MEI Teste' }),
    leadRecord({ id: 'lead-walkin-waiting', fullName: 'Cliente Encaixe Aguardando', phoneSearch: '81990000009' }),
    leadRecord({ id: 'lead-walkin-called', fullName: 'Cliente Encaixe Chamado', phoneSearch: '81990000010' }),
    leadRecord({ id: 'lead-external-store-02', fullName: 'Cliente Rota Loja 02', preferredName: 'Dona Lucia', phoneSearch: '81990000012', appointmentDate: dateInSaoPaulo(0), appointmentTime: '09:00', needsTransport: true, companionCount: 1, addressReference: 'Portao azul, ao lado da farmacia' }),
    leadRecord({ id: 'lead-external-store-06', fullName: 'Cliente Rota Loja 06', preferredName: 'Seu Jose', phoneSearch: '81990000011', storeId: 'loja-06', capturedByUid: 'test-external-leader', capturedByName: 'Colaborador Externo Teste', appointmentDate: dateInSaoPaulo(0), appointmentTime: '09:20', needsTransport: true, companionCount: 2, addressReference: 'Casa em frente ao posto de saude' })
  ];

  for (const lead of leads) {
    const { id, ...data } = lead;
    batch.set(db.doc(`leads/${id}`), data);
    batch.set(db.doc(`leads/${id}/history/seed-created`), historyEvent(lead));
    if (id === 'lead-rescheduled') {
      batch.set(db.doc(`leads/${id}/history/seed-rescheduled`), historyEvent(
        lead,
        'appointment_rescheduled',
        'Reagendado pelo seed para validar motivo e historico.'
      ));
    }
    if (id === 'lead-cancelled') {
      batch.set(db.doc(`leads/${id}/history/seed-cancelled`), historyEvent(
        lead,
        'appointment_cancelled',
        'Cancelado pelo seed para validar o funil.'
      ));
    }
    if (lead.appointmentDate && lead.appointmentTime && lead.appointmentStatus !== 'cancelled') {
      for (const blockTime of appointmentBlockTimes(lead.appointmentTime, lead.appointmentDurationMinutes)) {
        const slotId = `slot-${appointmentResourceId(lead.storeId)}-${lead.appointmentDate}-${blockTime}`;
        batch.set(db.doc(`appointmentSlots/${slotId}`), {
          storeId: lead.storeId,
          appointmentDate: lead.appointmentDate,
          appointmentTime: lead.appointmentTime,
          blockTime,
          durationMinutes: lead.appointmentDurationMinutes,
          leadId: id,
          capturedByUid: lead.capturedByUid,
          createdAt: lead.createdAtServer
        });
      }
    }
  }

  const walkIns = [
    { id: 'waiting', leadId: 'lead-walkin-waiting', status: 'waiting', calledAt: null },
    { id: 'called', leadId: 'lead-walkin-called', status: 'called', calledAt: timestampAt(0, 9, 15) }
  ];
  for (const walkIn of walkIns) {
    batch.set(db.doc(`appointmentWalkIns/${dateInSaoPaulo(0)}__${walkIn.leadId}`), {
      leadId: walkIn.leadId,
      storeId: 'loja-02',
      queueDate: dateInSaoPaulo(0),
      serviceId: 'default-eye-exam',
      serviceName: 'Exame de vista',
      professionalType: 'optometrist',
      reason: 'Encaixe ficticio para teste local',
      notes: '',
      status: walkIn.status,
      priority: 0,
      priorityReason: '',
      arrivedAt: timestampAt(0, 9),
      calledAt: walkIn.calledAt,
      startedAt: null,
      completedAt: null,
      closedReason: '',
      convertedAppointmentLeadId: '',
      createdAt: timestampAt(0, 9),
      createdByUid: 'test-receptionist-02',
      createdByName: 'Atendente Balcao Teste',
      updatedAt: walkIn.calledAt || timestampAt(0, 9),
      updatedByUid: 'test-receptionist-02',
      schemaVersion: 1
    });
  }

  batch.set(db.doc('system/seed'), {
    projectId: PROJECT_ID,
    seedVersion: SEED_VERSION,
    passwordHint: 'Senha documentada em docs/DADOS-HOMOLOGACAO-LOCAL.md',
    generatedAt: now,
    generatedDate: dateInSaoPaulo(0)
  });
  await batch.commit();
}

async function main() {
  assertLocalEnvironment();
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
  process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
  process.env.GCLOUD_PROJECT = configuredProjectId;
  const app = initializeApp({ projectId: PROJECT_ID }, 'leadflow-seed');
  const db = getFirestore(app);
  const auth = getAuth(app);

  try {
    const marker = await db.doc('system/seed').get();
    if (marker.exists && marker.data().seedVersion === SEED_VERSION && !resetRequested) {
      console.log(`Seed local v${SEED_VERSION} ja esta pronto. Nenhum dado foi alterado.`);
      return;
    }

    await clearEmulators();
    const roleConfig = await loadRoleProfiles();
    const users = [
      { uid: 'test-admin', email: 'admin@leadflow.test', displayName: 'Administrador Teste', role: 'admin', roleProfileId: 'system-admin', storeId: 'loja-02', storeIds: ['loja-02', 'loja-04', 'loja-05', 'loja-06'] },
      { uid: 'test-manager', email: 'gestor@leadflow.test', displayName: 'Gestor Teste', role: 'manager', roleProfileId: 'system-manager', storeId: 'loja-02', storeIds: ['loja-02', 'loja-06'] },
      { uid: 'test-receptionist-02', email: 'balcao@leadflow.test', displayName: 'Colaborador Interno Teste', role: 'manager', roleProfileId: 'system-captor', storeId: 'loja-02', storeIds: ['loja-02'] },
      { uid: 'test-receptionist-05', email: 'balcao.loja05@leadflow.test', displayName: 'Colaborador Interno Loja 05', role: 'manager', roleProfileId: 'system-captor', storeId: 'loja-05', storeIds: ['loja-05'] },
      { uid: 'test-telemarketing', email: 'telemarketing@leadflow.test', displayName: 'Colaborador Interno Multi-loja', role: 'manager', roleProfileId: 'system-captor', storeId: 'loja-02', storeIds: ['loja-02', 'loja-04', 'loja-05', 'loja-06'] },
      { uid: 'test-collaborator', email: 'colaborador@leadflow.test', displayName: 'Colaborador Teste', role: 'manager', roleProfileId: 'system-captor', storeId: 'loja-02', storeIds: ['loja-02'] },
      { uid: 'test-mei', email: 'mei@leadflow.test', displayName: 'MEI Teste', role: 'captor', roleProfileId: 'system-mei', storeId: 'loja-02', storeIds: ['loja-02', 'loja-05'] },
      { uid: 'test-external-leader', email: 'externa@leadflow.test', displayName: 'Colaborador Externo Teste', role: 'captor', roleProfileId: 'system-external-leader', storeId: 'loja-02', storeIds: ['loja-02', 'loja-06'] },
      { uid: 'test-blocked', email: 'bloqueado@leadflow.test', displayName: 'Usuario Bloqueado', role: 'manager', roleProfileId: 'system-captor', storeId: 'loja-02', storeIds: ['loja-02'], active: false }
    ];

    await createAuthUsers(auth, users);
    await writeSeed(db, roleConfig, users);
    console.log(`Seed local v${SEED_VERSION} criado com ${users.length} usuarios e senha ${TEST_PASSWORD}.`);
  } finally {
    await deleteApp(app);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
