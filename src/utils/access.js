import { STORE_IDS } from './stores.js';

const VALID_ROLES = new Set(['captor', 'manager', 'admin']);
export const DEFAULT_TEAM_PASSWORD = 'mudar123';

export function normalizeAccessEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function storeLabel(storeId = '') {
  return String(storeId).replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatAccessStoreSummary(access = {}) {
  const allStoreIds = [...STORE_IDS];
  const storeIds = access.role === 'admin'
    ? allStoreIds
    : [...new Set(access.storeIds || [access.storeId].filter(Boolean))];
  const allStores = allStoreIds.every((storeId) => storeIds.includes(storeId));

  if (allStores) return { short: 'TODAS', full: 'Todas as unidades' };
  if (storeIds.length === 1) return { short: storeLabel(storeIds[0]), full: storeLabel(storeIds[0]) };

  return {
    short: storeIds.map((storeId) => storeLabel(storeId).replace(/^Loja\s+/i, '')).join(', '),
    full: storeIds.map(storeLabel).join(', ')
  };
}

export function validateAccess(values, roleProfiles = [], options = {}) {
  const displayName = String(values.displayName || '').trim();
  const email = normalizeAccessEmail(values.email);
  const requestedPassword = String(values.password || '');
  const phone = String(values.phone || '').replace(/\D/g, '');
  const savwinCode = String(values.savwinCode || '').trim();
  const roleProfileId = String(values.roleProfileId || '');
  const selectedProfile = roleProfiles.find((profile) => profile.id === roleProfileId && profile.active !== false);
  const isTelemarketing = selectedProfile?.id === 'system-telemarketing';
  const role = selectedProfile?.baseRole || String(values.role || '');
  const isCaptor = selectedProfile?.baseRole === 'captor';
  const password = options.requirePassword && role !== 'admin'
    ? DEFAULT_TEAM_PASSWORD
    : requestedPassword;
  let storeId = String(values.storeId || '').trim().toLowerCase();
  const requestedStoreIds = Array.isArray(values.storeIds) ? values.storeIds : [values.storeIds].filter(Boolean);
  const normalizedRequestedStoreIds = [...new Set(requestedStoreIds.map((item) => String(item).trim().toLowerCase()))];
  if (isCaptor) storeId = normalizedRequestedStoreIds[0] || '';
  if (role === 'manager' && normalizedRequestedStoreIds.length && !normalizedRequestedStoreIds.includes(storeId)) {
    storeId = normalizedRequestedStoreIds[0];
  }
  const errors = {};

  if (displayName.length < 2 || displayName.length > 120) {
    errors.displayName = 'Informe um nome entre 2 e 120 caracteres.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.email = 'Informe um e-mail válido.';
  }

  if ((options.requirePassword || requestedPassword) && (password.length < 6 || password.length > 72)) {
    errors.password = options.requirePassword
      ? 'Crie uma senha inicial entre 6 e 72 caracteres.'
      : 'A nova senha deve ter entre 6 e 72 caracteres.';
  }

  if (phone && (phone.length < 10 || phone.length > 11)) {
    errors.phone = 'Informe um telefone com DDD.';
  }

  if (savwinCode.length > 30) {
    errors.savwinCode = 'Use no máximo 30 caracteres.';
  }

  if (!VALID_ROLES.has(role) || (roleProfileId && !selectedProfile)) {
    errors.role = 'Escolha um perfil válido.';
  }

  if (!STORE_IDS.has(storeId)) {
    if (isCaptor) errors.storeIds = 'Escolha ao menos uma unidade permitida.';
    else errors.storeId = 'Escolha uma loja válida.';
  }

  const storeIds = role === 'admin' || isTelemarketing
    ? [...STORE_IDS]
    : role === 'manager' || isCaptor
      ? [...new Set([storeId, ...normalizedRequestedStoreIds].filter(Boolean))]
      : [storeId];
  if (isCaptor && !storeIds.length) errors.storeIds = 'Escolha ao menos uma unidade permitida.';
  if (storeIds.some((item) => !STORE_IDS.has(item))) errors.storeIds = 'Escolha apenas unidades válidas.';

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: { displayName, email, password, phone, savwinCode, role, roleProfileId: selectedProfile?.id || '', storeId, storeIds }
  };
}
