import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SavwinPersistenceExecutorError,
  assertEmulatorOnlyEnvironment
} = require('../../functions/savwin-persistence-executor');

describe('SavWin persistence executor guard', () => {
  it('accepts only the explicit demo emulator environment', () => {
    expect(() => assertEmulatorOnlyEnvironment({
      GCLOUD_PROJECT: 'demo-leadflow',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280',
      SAVWIN_PERSISTENCE_APPLY_MODE: 'emulator_only'
    })).not.toThrow();
  });

  it('rejects remote, production and implicit environments', () => {
    const environments = [
      {},
      { GCLOUD_PROJECT: 'leadflow-production', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280', SAVWIN_PERSISTENCE_APPLY_MODE: 'emulator_only' },
      { GCLOUD_PROJECT: 'demo-leadflow', SAVWIN_PERSISTENCE_APPLY_MODE: 'emulator_only' },
      { GCLOUD_PROJECT: 'demo-leadflow', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280' }
    ];
    for (const environment of environments) {
      expect(() => assertEmulatorOnlyEnvironment(environment)).toThrow(SavwinPersistenceExecutorError);
    }
  });
});
