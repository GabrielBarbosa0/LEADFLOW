import { describe, expect, it } from 'vitest';
import { isCaptarImportedLead, leadOriginLabel } from '../../src/utils/lead-origin.js';

describe('lead origin', () => {
  it('identifies newly marked Captar imports', () => {
    expect(isCaptarImportedLead({ recordOrigin: 'captar_import' })).toBe(true);
    expect(leadOriginLabel({ recordOrigin: 'captar_import' })).toBe('Importado do Captar');
  });

  it('recognizes legacy Captar records before the marker migration runs', () => {
    expect(isCaptarImportedLead({ id: 'captar-123' })).toBe(true);
    expect(isCaptarImportedLead({ installationId: 'captar-migration' })).toBe(true);
  });

  it('does not label regular registrations as imported', () => {
    expect(isCaptarImportedLead({ id: 'lead-123', installationId: 'browser-id' })).toBe(false);
    expect(leadOriginLabel({ id: 'lead-123' })).toBe('');
  });
});
