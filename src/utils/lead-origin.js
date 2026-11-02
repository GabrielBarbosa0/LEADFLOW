export const CAPTAR_IMPORT_ORIGIN = 'captar_import';

export function isCaptarImportedLead(lead = {}) {
  return lead.recordOrigin === CAPTAR_IMPORT_ORIGIN
    || lead.installationId === 'captar-migration'
    || String(lead.id || '').startsWith('captar-');
}

export function leadOriginLabel(lead = {}) {
  return isCaptarImportedLead(lead) ? 'Importado do Captar' : '';
}
