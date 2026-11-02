import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const TENANT_ID = process.env.CAPTAR_TENANT_ID || 'fb9196b0-738d-4b8c-8f4b-01bb36442654';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'fascinlead';
const APPLY = process.argv.includes('--apply');
const CAPTAR_URL = `https://captar.rstecnologias.com.br/${TENANT_ID}/schedule`;
const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_RESOURCE_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Defina ${name} antes de executar a migracao.`);
  return value;
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(value) {
  let digits = normalizeDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length === 8 || digits.length === 9) digits = `81${digits}`;
  if (![10, 11].includes(digits.length)) return null;
  return { e164: `+55${digits}`, search: digits };
}

function normalizedCpf(value) {
  const digits = normalizeDigits(value);
  return digits.length === 11 ? digits : '';
}

function datePart(value) {
  return String(value || '').slice(0, 10);
}

function timePart(value) {
  return String(value || '').slice(11, 16);
}

function timestamp(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function text(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function buildNotes(appointment, client, salesperson) {
  const details = [
    text(appointment.notes),
    text(client.notes),
    client.visual_need ? `Necessidade visual informada: ${text(client.visual_need, 120)}` : '',
    `Importado do Captar. Captador original: ${text(salesperson?.name || 'Não informado', 120)}.`
  ].filter(Boolean);
  return details.join('\n').slice(0, 500);
}

function stringValue(value) {
  return { stringValue: String(value ?? '') };
}

function integerValue(value) {
  return { integerValue: String(Math.trunc(value)) };
}

function timestampValue(value) {
  return { timestampValue: timestamp(value) };
}

function arrayValue(values = []) {
  return { arrayValue: { values: values.map(stringValue) } };
}

function fields(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    if (Array.isArray(value)) return [key, arrayValue(value)];
    if (value?.type === 'integer') return [key, integerValue(value.value)];
    if (value?.type === 'timestamp') return [key, timestampValue(value.value)];
    return [key, stringValue(value)];
  }));
}

async function loadCaptarData(email, password) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const captured = {};

  page.on('response', async (response) => {
    const match = new URL(response.url()).pathname.match(/\/rest\/v1\/(appointments|clients|units|users)$/);
    if (!match || response.status() !== 200 || captured[match[1]]) return;
    try {
      captured[match[1]] = await response.json();
    } catch {
      // A página pode repetir requisições durante a hidratação; a próxima resposta será usada.
    }
  });

  try {
    const loginUrl = `https://captar.rstecnologias.com.br/login?redirect_to=${encodeURIComponent(`/${TENANT_ID}/schedule`)}`;
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(new RegExp(`/${TENANT_ID}/schedule`), { timeout: 30000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Carregando...'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
  } finally {
    await browser.close();
  }

  for (const collection of ['appointments', 'clients', 'units', 'users']) {
    if (!Array.isArray(captured[collection])) throw new Error(`O Captar não retornou ${collection}.`);
  }
  return captured;
}

function firebaseAccessToken() {
  const raw = execSync('npx firebase-tools login:list --json', {
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const login = JSON.parse(raw).result?.[0];
  if (!login?.tokens?.access_token) throw new Error('Execute firebase login antes da migracao.');
  return login.tokens.access_token;
}

async function listDocuments(collectionName, accessToken) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(`${FIRESTORE_ROOT}/${collectionName}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Firestore respondeu ${response.status} ao consultar ${collectionName}.`);
    const data = await response.json();
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function documentId(document) {
  return document.name.split('/').at(-1);
}

function buildWrites(data, existingLeadIds, existingSlotIds) {
  const clients = new Map(data.clients.map((client) => [client.id, client]));
  const users = new Map(data.users.map((user) => [user.id, user]));
  const writes = [];
  const summary = { imported: 0, skipped: 0, attended: 0, pending: 0, invalidPhones: 0 };

  for (const appointment of data.appointments) {
    const leadId = `captar-${appointment.id}`;
    if (existingLeadIds.has(leadId)) {
      summary.skipped += 1;
      continue;
    }

    const client = clients.get(appointment.client_id) || {};
    const salesperson = users.get(appointment.salesperson_id) || {};
    const phone = normalizePhone(appointment.phone || client.phone);
    if (!phone) {
      summary.invalidPhones += 1;
      continue;
    }

    const appointmentDate = datePart(appointment.start);
    const appointmentTime = timePart(appointment.start);
    const attendance = appointment.status === 'completed' ? 'attended' : 'pending';
    const createdAt = appointment.created_at || client.created_at || new Date().toISOString();
    const capturedByUid = `captar-${appointment.salesperson_id || 'nao-informado'}`;
    const capturedByName = text(salesperson.name || 'Captador do Captar', 120);
    const duration = Math.max(5, Math.min(180, Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60000) || 30));
    const leadName = `${FIRESTORE_RESOURCE_ROOT}/leads/${leadId}`;

    const leadFields = {
      fullName: text(client.name || appointment.title, 120),
      preferredName: text(client.nickname, 60),
      phone: phone.e164,
      phoneSearch: phone.search,
      customerCpf: normalizedCpf(client.cpf),
      neighborhood: text(client.neighborhood, 80),
      city: text(client.city, 80),
      state: text(client.uf || client.state || 'PE', 2).toUpperCase(),
      interestId: '',
      interestLabel: '',
      ametropiaIds: [],
      ametropiaLabels: [],
      pathologyIds: [],
      pathologyLabels: [],
      appointmentDate,
      appointmentTime,
      appointmentAttendance: attendance,
      appointmentSchedulingMode: 'controlled',
      appointmentDurationMinutes: { type: 'integer', value: duration },
      notes: buildNotes(appointment, client, salesperson),
      source: 'street',
      recordOrigin: 'captar_import',
      capturedAtClient: timestamp(createdAt),
      createdAtServer: { type: 'timestamp', value: createdAt },
      updatedAtServer: { type: 'timestamp', value: appointment.updated_at || createdAt },
      capturedByUid,
      capturedByName,
      storeId: 'loja-06',
      installationId: 'captar-migration',
      appVersion: '0.1.0',
      schemaVersion: { type: 'integer', value: 1 }
    };
    if (attendance === 'attended') {
      leadFields.appointmentAttendanceUpdatedAt = { type: 'timestamp', value: appointment.attended_at || appointment.updated_at };
      leadFields.appointmentAttendanceUpdatedByUid = capturedByUid;
    }

    writes.push({
      update: { name: leadName, fields: fields(leadFields) },
      currentDocument: { exists: false }
    });

    const slotId = `slot-consultorio-surubim-${appointmentDate}-${appointmentTime}`;
    if (!existingSlotIds.has(slotId)) {
      writes.push({
        update: {
          name: `${FIRESTORE_RESOURCE_ROOT}/appointmentSlots/${slotId}`,
          fields: fields({
            storeId: 'loja-06',
            appointmentDate,
            appointmentTime,
            durationMinutes: { type: 'integer', value: duration },
            leadId,
            capturedByUid,
            createdAt: { type: 'timestamp', value: createdAt }
          })
        },
        currentDocument: { exists: false }
      });
    }

    summary.imported += 1;
    summary[attendance] += 1;
  }
  return { writes, summary };
}

async function commitWrites(writes, accessToken) {
  for (let index = 0; index < writes.length; index += 400) {
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ writes: writes.slice(index, index + 400) })
    });
    if (!response.ok) throw new Error(`Firestore respondeu ${response.status} ao gravar: ${await response.text()}`);
  }
}

async function main() {
  const email = requiredEnv('CAPTAR_EMAIL');
  const password = requiredEnv('CAPTAR_PASSWORD');
  const data = await loadCaptarData(email, password);
  const accessToken = firebaseAccessToken();
  const [existingLeads, existingSlots] = await Promise.all([
    listDocuments('leads', accessToken),
    listDocuments('appointmentSlots', accessToken)
  ]);
  const { writes, summary } = buildWrites(
    data,
    new Set(existingLeads.map(documentId)),
    new Set(existingSlots.map(documentId))
  );

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', sourceAppointments: data.appointments.length, ...summary }, null, 2));
  if (!APPLY) {
    console.log('Nenhum dado foi gravado. Use --apply para confirmar a importacao.');
    return;
  }
  await commitWrites(writes, accessToken);
  console.log(`Migracao concluida: ${summary.imported} agendamento(s) importado(s).`);
}

main().catch((error) => {
  console.error(`Falha na migracao: ${error.message}`);
  process.exitCode = 1;
});
