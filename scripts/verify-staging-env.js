import { loadEnv } from 'vite';

const EXPECTED_PROJECT_ID = 'leadflowtest-d32c2';
const env = loadEnv('staging', process.cwd(), '');
const configuredProjectId = String(env.VITE_FIREBASE_PROJECT_ID || '').trim();

if (configuredProjectId !== EXPECTED_PROJECT_ID) {
  console.error('\nAmbiente de homologacao bloqueado.');
  console.error(`Projeto esperado: ${EXPECTED_PROJECT_ID}`);
  console.error(`Projeto configurado: ${configuredProjectId || '(nao informado)'}`);
  console.error('Revise o arquivo .env.staging.local antes de continuar.\n');
  process.exit(1);
}

console.log(`Ambiente de homologacao confirmado: ${configuredProjectId}`);

