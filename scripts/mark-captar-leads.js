import { execSync } from 'node:child_process';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'fascinlead';
const APPLY = process.argv.includes('--apply');
const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const CAPTAR_IMPORT_ORIGIN = 'captar_import';

function firebaseAccessToken() {
  const raw = execSync('npx firebase-tools login:list --json', {
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const login = JSON.parse(raw).result?.[0];
  if (!login?.tokens?.access_token) throw new Error('Execute firebase login antes de marcar os leads.');
  return login.tokens.access_token;
}

async function listLeads(accessToken) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(`${FIRESTORE_ROOT}/leads`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Firestore respondeu ${response.status} ao consultar leads.`);
    const data = await response.json();
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function documentId(document) {
  return document.name.split('/').at(-1);
}

function stringField(document, name) {
  return document.fields?.[name]?.stringValue || '';
}

function isCaptarLead(document) {
  return documentId(document).startsWith('captar-')
    || stringField(document, 'installationId') === 'captar-migration';
}

function markerWrites(documents) {
  return documents
    .filter(isCaptarLead)
    .filter((document) => stringField(document, 'recordOrigin') !== CAPTAR_IMPORT_ORIGIN)
    .map((document) => ({
      update: {
        name: document.name,
        fields: { recordOrigin: { stringValue: CAPTAR_IMPORT_ORIGIN } }
      },
      updateMask: { fieldPaths: ['recordOrigin'] },
      currentDocument: { exists: true }
    }));
}

async function commitWrites(writes, accessToken) {
  for (let index = 0; index < writes.length; index += 400) {
    const response = await fetch(`${FIRESTORE_ROOT}:commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ writes: writes.slice(index, index + 400) })
    });
    if (!response.ok) throw new Error(`Firestore respondeu ${response.status} ao marcar os leads.`);
  }
}

async function main() {
  const accessToken = firebaseAccessToken();
  const leads = await listLeads(accessToken);
  const writes = markerWrites(leads);
  const alreadyMarked = leads.filter((document) => isCaptarLead(document)).length - writes.length;

  console.log(`Leads encontrados: ${leads.length}.`);
  console.log(`Leads do Captar ja marcados: ${alreadyMarked}.`);
  console.log(`Leads do Captar a marcar: ${writes.length}.`);

  if (!APPLY) {
    console.log('Nenhuma alteracao foi gravada. Revise o resumo e execute novamente com --apply para confirmar.');
    return;
  }
  if (!writes.length) {
    console.log('Nenhum lead precisa ser marcado.');
    return;
  }

  await commitWrites(writes, accessToken);
  console.log(`Marcacao concluida: ${writes.length} lead(s) identificados como importados do Captar.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
