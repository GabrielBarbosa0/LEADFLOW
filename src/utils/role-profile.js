import systemRoleConfig from '../../functions/system-role-profiles.json';

export const PERMISSION_SCHEMA_VERSION = systemRoleConfig.permissionSchemaVersion;
export const LEGACY_ROLE_PROFILE_ALIASES = Object.freeze({ ...(systemRoleConfig.legacyProfileAliases || {}) });

export const ROLE_SCOPES = [
  { id: 'own', label: 'Dados próprios', baseRole: 'captor' },
  { id: 'stores', label: 'Unidades permitidas', baseRole: 'manager' }
];

export const PERMISSION_GROUPS = [
  {
    label: 'Captação',
    permissions: [
      { id: 'leads.create', label: 'Cadastrar leads', scopes: ['own', 'stores'] },
      { id: 'leads.view_own', label: 'Visualizar os próprios cadastros', scopes: ['own', 'stores'] },
      { id: 'leads.edit_own', label: 'Editar os próprios cadastros', scopes: ['own', 'stores'] },
      { id: 'appointments.cancel', label: 'Cancelar agendamentos permitidos', scopes: ['own', 'stores'] },
      { id: 'followups.own', label: 'Realizar os próprios retornos', scopes: ['own', 'stores'] },
      { id: 'goals.view_own', label: 'Visualizar as próprias metas', scopes: ['own', 'stores'] }
    ]
  },
  {
    label: 'Equipe e unidades',
    permissions: [
      { id: 'leads.view_stores', label: 'Consultar cadastros das unidades', scopes: ['stores'] },
      { id: 'management.view', label: 'Acessar a gestão de leads', scopes: ['stores'] },
      { id: 'leads.clinical_update', label: 'Atualizar dados clinicos do lead', scopes: ['stores'] },
      { id: 'appointments.view', label: 'Visualizar a agenda de exames', scopes: ['stores'] },
      { id: 'appointments.confirmations', label: 'Gerenciar confirmações de agendamentos', scopes: ['stores'] },
      { id: 'appointments.attendance', label: 'Registrar comparecimento e falta', scopes: ['stores'] },
      { id: 'sales.confirm_manual', label: 'Confirmar compras manualmente', scopes: ['stores'] },
      { id: 'walkins.manage', label: 'Gerenciar encaixes do consultório', scopes: ['stores'] },
      { id: 'followups.team', label: 'Acompanhar retornos da equipe', scopes: ['stores'] },
      { id: 'goals.manage', label: 'Criar e editar metas da equipe', scopes: ['stores'] },
      { id: 'dashboard.view', label: 'Visualizar dashboard', scopes: ['stores'] },
      { id: 'external.operations.read', label: 'Visualizar operação externa', scopes: ['stores'] },
      { id: 'leads.export', label: 'Exportar leads em CSV', scopes: ['stores'] }
    ]
  },
  {
    label: 'Administração',
    permissions: [
      { id: 'leads.edit_all', label: 'Editar qualquer lead permitido', scopes: ['stores', 'admin'] },
      { id: 'leads.delete', label: 'Excluir leads', scopes: ['own', 'stores', 'admin'] },
      { id: 'schedule.manage', label: 'Configurar agendas', scopes: ['admin'] },
      { id: 'access.manage', label: 'Gerenciar acessos', scopes: ['admin'] },
      { id: 'roles.manage', label: 'Gerenciar perfis e permissões', scopes: ['admin'] }
    ]
  }
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id));

export const SYSTEM_ROLE_PROFILES = systemRoleConfig.profiles.map((profile) => ({
  ...profile,
  permissions: profile.baseRole === 'admin' ? [...ALL_PERMISSION_IDS] : [...profile.permissions],
  permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
  system: true,
  active: true
}));

const DEFAULT_ROLE_PROFILE_IDS = {
  captor: 'system-external-leader',
  manager: 'system-manager',
  admin: 'system-admin'
};

export function canonicalRoleProfileId(profileId = '') {
  const id = String(profileId);
  return LEGACY_ROLE_PROFILE_ALIASES[id] || id;
}

export function isCollaboratorProfile(profile) {
  return profile?.role === 'captor' || canonicalRoleProfileId(profile?.roleProfileId) === 'system-captor';
}

export function systemRoleProfileForRole(role) {
  return systemRoleProfileForId(DEFAULT_ROLE_PROFILE_IDS[role]) || SYSTEM_ROLE_PROFILES[0];
}

export function systemRoleProfileForId(profileId) {
  const canonicalId = canonicalRoleProfileId(profileId);
  return SYSTEM_ROLE_PROFILES.find((profile) => profile.id === canonicalId) || null;
}

export function permissionsForProfile(profile) {
  if (profile?.role === 'admin') return [...ALL_PERMISSION_IDS];
  const systemProfile = systemRoleProfileForId(profile?.roleProfileId);
  if (systemProfile && Number(profile?.permissionSchemaVersion || 0) < PERMISSION_SCHEMA_VERSION) {
    return [...systemProfile.permissions];
  }
  if (Array.isArray(profile?.permissions)) return profile.permissions;
  return [...systemRoleProfileForRole(profile?.role).permissions];
}

export function hasPermission(profile, permission) {
  if (profile?.role === 'admin') return true;
  if (permission === 'walkins.manage') {
    return ['system-manager', 'system-captor', 'system-receptionist', 'system-telemarketing'].includes(profile?.roleProfileId)
      || (profile?.role === 'manager' && !profile?.roleProfileId);
  }
  if (permission === 'appointments.cancel') {
    return ['system-captor', 'system-external-leader', 'system-mei', 'system-manager', 'system-receptionist', 'system-telemarketing'].includes(profile?.roleProfileId)
      || (['captor', 'manager'].includes(profile?.role) && !profile?.roleProfileId);
  }
  return permissionsForProfile(profile).includes(permission);
}

export function permissionsForScope(scope) {
  if (scope === 'admin') return [...ALL_PERMISSION_IDS];
  return PERMISSION_GROUPS.flatMap((group) => group.permissions)
    .filter((permission) => permission.scopes.includes(scope))
    .map((permission) => permission.id);
}

export function normalizeRolePermissions(scope, values = []) {
  const allowed = new Set(permissionsForScope(scope));
  const requested = Array.isArray(values) ? values.map(String) : [];
  const permissions = [...new Set(requested.filter((permission) => allowed.has(permission)))];
  const managementDependents = ['leads.clinical_update', 'goals.manage', 'dashboard.view', 'leads.export'];
  if (permissions.some((permission) => managementDependents.includes(permission)) && allowed.has('management.view') && !permissions.includes('management.view')) {
    permissions.push('management.view');
  }
  return permissions;
}

export function validateRoleProfile(values) {
  const name = String(values.name || '').trim();
  const scope = String(values.scope || 'own');
  const permissions = normalizeRolePermissions(scope, values.permissions);
  const errors = {};

  if (name.length < 3 || name.length > 60) errors.name = 'Informe um nome entre 3 e 60 caracteres.';
  if (!['own', 'stores'].includes(scope)) errors.scope = 'Escolha um alcance válido.';
  if (!permissions.length) errors.permissions = 'Ative pelo menos uma permissão.';

  const baseRole = ROLE_SCOPES.find((item) => item.id === scope)?.baseRole || 'captor';
  return { isValid: Object.keys(errors).length === 0, errors, data: { name, scope, baseRole, permissions } };
}
