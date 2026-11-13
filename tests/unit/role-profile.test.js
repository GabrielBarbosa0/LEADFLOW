import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSION_IDS,
  PERMISSION_SCHEMA_VERSION,
  SYSTEM_ROLE_PROFILES,
  hasPermission,
  normalizeRolePermissions,
  systemRoleProfileForId,
  validateRoleProfile
} from '../../src/utils/role-profile.js';

describe('role profiles', () => {
  it('uses a versioned permission schema shared with Firebase Functions', () => {
    expect(PERMISSION_SCHEMA_VERSION).toBe(7);
    expect(SYSTEM_ROLE_PROFILES.every((profile) => profile.permissionSchemaVersion === 7)).toBe(true);
    expect(SYSTEM_ROLE_PROFILES.map((profile) => profile.name)).toEqual([
      'Colaborador Interno',
      'Colaborador Externo',
      'MEI',
      'Gestor',
      'Administrador'
    ]);
  });

  it('keeps the administrator profile with every permission', () => {
    const admin = SYSTEM_ROLE_PROFILES.find((profile) => profile.baseRole === 'admin');
    expect(admin.permissions).toEqual(ALL_PERMISSION_IDS);
    expect(hasPermission({ role: 'admin', permissions: [] }, 'roles.manage')).toBe(true);
  });

  it('gives MEI the same permissions as an external collaborator', () => {
    const external = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-external-leader');
    const mei = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-mei');
    expect(mei).toMatchObject({ name: 'MEI', scope: 'stores', baseRole: 'captor', system: true });
    expect(mei.permissions).toEqual(external.permissions);
    expect(mei.permissions).toContain('external.operations.read');
  });

  it('provides a store-scoped external collaborator with logistical access', () => {
    const external = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-external-leader');

    expect(external).toMatchObject({ name: 'Colaborador Externo', scope: 'stores', baseRole: 'captor', system: true });
    expect(external.permissions).toContain('external.operations.read');
    expect(external.permissions).toContain('appointments.view');
    expect(external.permissions).not.toContain('appointments.confirmations');
    expect(external.permissions).not.toContain('appointments.attendance');
    expect(external.permissions).not.toContain('walkins.manage');
    expect(external.permissions).not.toContain('management.view');
    expect(external.permissions).not.toContain('leads.view_stores');
  });

  it('consolidates collaborator, receptionist and telemarketing into the internal profile', () => {
    const internal = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-captor');

    expect(internal).toMatchObject({
      name: 'Colaborador Interno',
      scope: 'stores',
      baseRole: 'manager',
      system: true
    });
    expect(internal.permissions).toEqual(expect.arrayContaining([
      'leads.create', 'leads.view_stores', 'management.view', 'appointments.view',
      'appointments.confirmations', 'appointments.attendance', 'appointments.cancel',
      'walkins.manage', 'followups.team', 'external.operations.read'
    ]));
    expect(internal.permissions).not.toContain('dashboard.view');
    expect(internal.permissions).not.toContain('leads.export');
    expect(internal.permissions).not.toContain('leads.delete');
    expect(systemRoleProfileForId('system-receptionist')).toBe(internal);
    expect(systemRoleProfileForId('system-telemarketing')).toBe(internal);
    expect(systemRoleProfileForId('missing-profile')).toBeNull();
  });

  it('upgrades stale legacy profiles to the consolidated permissions', () => {
    const legacyTelemarketing = {
      role: 'manager',
      roleProfileId: 'system-telemarketing',
      permissionSchemaVersion: 5,
      permissions: ['appointments.view']
    };

    expect(hasPermission(legacyTelemarketing, 'management.view')).toBe(true);
    expect(hasPermission(legacyTelemarketing, 'walkins.manage')).toBe(true);
    expect(hasPermission(legacyTelemarketing, 'external.operations.read')).toBe(true);
  });

  it('uses canonical permissions when a system profile has a current but incomplete list', () => {
    const partiallySynchronizedManager = {
      role: 'manager',
      roleProfileId: 'system-manager',
      permissionSchemaVersion: PERMISSION_SCHEMA_VERSION,
      permissions: ['appointments.view', 'appointments.cancel']
    };

    expect(hasPermission(partiallySynchronizedManager, 'leads.edit_own')).toBe(true);
    expect(hasPermission(partiallySynchronizedManager, 'leads.edit_all')).toBe(true);
    expect(hasPermission(partiallySynchronizedManager, 'leads.delete')).toBe(true);
  });

  it('gives managers visibility into external operations', () => {
    const manager = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-manager');
    expect(manager).toMatchObject({ name: 'Gestor', baseRole: 'manager' });
    expect(manager.permissions).toContain('external.operations.read');
    expect(manager.permissions).toContain('appointments.confirmations');
  });

  it('keeps internal permissions as a superset of the external profile', () => {
    const external = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-external-leader');
    const internal = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-captor');
    const manager = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-manager');

    expect(external.permissions.every((permission) => internal.permissions.includes(permission))).toBe(true);
    expect(internal.permissions.every((permission) => manager.permissions.includes(permission))).toBe(true);
  });

  it('creates an own-data profile without team permissions', () => {
    const result = validateRoleProfile({
      name: 'Captador externo',
      scope: 'own',
      permissions: ['leads.create', 'appointments.view']
    });

    expect(result.isValid).toBe(true);
    expect(result.data.baseRole).toBe('captor');
    expect(result.data.permissions).toEqual(['leads.create']);
  });

  it('allows deletion permission in own-data and store profiles', () => {
    expect(normalizeRolePermissions('own', ['leads.delete'])).toEqual(['leads.delete']);
    expect(normalizeRolePermissions('stores', ['leads.delete'])).toEqual(['leads.delete']);
  });

  it('allows store-scoped profiles to edit any permitted lead', () => {
    expect(normalizeRolePermissions('stores', ['leads.edit_all'])).toEqual(['leads.edit_all']);
  });

  it('adds management access when a dependent team feature is enabled', () => {
    const result = validateRoleProfile({
      name: 'Analista regional',
      scope: 'stores',
      permissions: ['dashboard.view']
    });

    expect(result.isValid).toBe(true);
    expect(result.data.permissions).toEqual(['dashboard.view', 'management.view']);
  });

  it('normalizes editable system permissions and permits an empty selection', () => {
    expect(normalizeRolePermissions('stores', [])).toEqual([]);
    expect(normalizeRolePermissions('stores', ['dashboard.view'])).toEqual(['dashboard.view', 'management.view']);
    expect(normalizeRolePermissions('own', ['leads.create', 'unknown.permission'])).toEqual(['leads.create']);
  });

  it('requires a name and at least one permission', () => {
    const result = validateRoleProfile({ name: 'A', scope: 'own', permissions: [] });
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(expect.objectContaining({ name: expect.any(String), permissions: expect.any(String) }));
  });
});
