import systemRoleConfig from '../../functions/system-role-profiles.json';

export const PERMISSION_SCHEMA_VERSION = systemRoleConfig.permissionSchemaVersion;

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
      { id: 'appointments.attendance', label: 'Registrar comparecimento e falta', scopes: ['stores'] },
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
  name: profile.id === 'system-receptionist' ? 'Atendente Balcão' : profile.name,
  permissions: profile.baseRole === 'admin' ? [...ALL_PERMISSION_IDS] : [...profile.permissions],
  permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
  system: true,
  active: true
}));

export function systemRoleProfileForRole(role) {
  return SYSTEM_ROLE_PROFILES.find((profile) => profile.baseRole === role) || SYSTEM_ROLE_PROFILES[0];
}

export function systemRoleProfileForId(profileId) {
  return SYSTEM_ROLE_PROFILES.find((profile) => profile.id === profileId) || null;
}

export function permissionsForProfile(profile) {
  if (profile?.role === 'admin') return [...ALL_PERMISSION_IDS];
  if (Array.isArray(profile?.permissions)) return profile.permissions;
  return [...systemRoleProfileForRole(profile?.role).permissions];
}

export function hasPermission(profile, permission) {
  if (profile?.role === 'admin') return true;
  const profileId = profile?.roleProfileId || profile?.id;
  if (profileId === 'system-telemarketing') {
    return [
      'leads.create', 'leads.view_own', 'leads.edit_own', 'followups.own',
      'leads.view_stores', 'appointments.view', 'followups.team'
    ].includes(permission);
  }
  if (permission === 'walkins.manage') {
    return ['system-manager', 'system-receptionist'].includes(profileId)
      || (profile?.role === 'manager' && !profileId);
  }
  if (permission === 'appointments.cancel') {
    return ['system-captor', 'system-mei', 'system-manager', 'system-receptionist', 'system-external-leader'].includes(profileId)
      || (['captor', 'manager'].includes(profile?.role) && !profileId);
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
