import { loadEnv } from 'vite';

const EXPECTED_PROJECT_ID = 'demo-leadflow';
const FORBIDDEN_PROJECT_IDS = new Set(['fascinlead', 'leadflowtest-d32c2']);
const env = loadEnv('emulator', process.cwd(), '');
const configuredProjectId = String(env.VITE_FIREBASE_PROJECT_ID || '').trim();
const useEmulators = String(env.VITE_USE_FIREBASE_EMULATORS || '').trim();

if (
  configuredProjectId !== EXPECTED_PROJECT_ID ||
  FORBIDDEN_PROJECT_IDS.has(configuredProjectId) ||
  useEmulators !== 'true'
) {
  console.error('\nAmbiente descartavel bloqueado.');
  console.error(`Projeto esperado: ${EXPECTED_PROJECT_ID}`);
  console.error(`Projeto configurado: ${configuredProjectId || '(nao informado)'}`);
  console.error(`Emuladores ativados: ${useEmulators || '(nao informado)'}`);
  console.error('Este modo nunca pode apontar para um projeto Firebase remoto.\n');
  process.exit(1);
}

console.log(`Ambiente descartavel confirmado: ${configuredProjectId}`);
