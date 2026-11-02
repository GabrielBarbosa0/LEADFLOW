import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM_PASSWORD, formatAccessStoreSummary, normalizeAccessEmail, validateAccess } from '../../src/utils/access.js';
import { SYSTEM_ROLE_PROFILES } from '../../src/utils/role-profile.js';

describe('access validation', () => {
  it('allows a team access without a phone number', () => {
    const result = validateAccess({
      displayName: 'Maria Silva',
      email: 'maria@example.com',
      phone: '',
      roleProfileId: 'system-captor',
      storeIds: ['loja-04']
    }, SYSTEM_ROLE_PROFILES);

    expect(result.isValid).toBe(true);
    expect(result.data.phone).toBe('');
  });

  it('normalizes an authorized Google email', () => {
    expect(normalizeAccessEmail('  Pessoa@Exemplo.COM ')).toBe('pessoa@exemplo.com');
  });

  it('accepts a complete collaborator access', () => {
    const result = validateAccess({
      displayName: 'Pessoa de Teste',
      email: 'pessoa@exemplo.com',
      phone: '(81) 99999-9999',
      role: 'captor',
      storeId: 'Loja-06'
    });

    expect(result.isValid).toBe(true);
    expect(result.data.storeId).toBe('loja-06');
  });

  it('rejects invalid email, role and unavailable store', () => {
    const result = validateAccess({ displayName: 'A', email: 'invalido', phone: '12', role: 'owner', storeId: 'loja-03' });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(expect.objectContaining({
      displayName: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      role: expect.any(String),
      storeId: expect.any(String)
    }));
  });

  it.each(['loja-02', 'loja-04', 'loja-05', 'loja-06'])('accepts the available store %s', (storeId) => {
    const result = validateAccess({
      displayName: 'Pessoa de Teste',
      email: 'pessoa@exemplo.com',
      phone: '81999999999',
      role: 'captor',
      storeId
    });

    expect(result.isValid).toBe(true);
    expect(result.data.storeId).toBe(storeId);
  });

  it('accepts multiple permitted stores for a manager', () => {
    const result = validateAccess({
      displayName: 'Gestora Regional',
      email: 'gestora@example.com',
      phone: '81999999999',
      role: 'manager',
      storeId: 'loja-06',
      storeIds: ['loja-02', 'loja-06']
    });

    expect(result.isValid).toBe(true);
    expect(result.data.storeIds).toEqual(['loja-06', 'loja-02']);
  });

  it('always grants telemarketing access to every store', () => {
    const result = validateAccess({
      displayName: 'Equipe Telemarketing',
      email: 'telemarketing@example.com',
      roleProfileId: 'system-telemarketing',
      storeId: 'loja-06',
      storeIds: ['loja-06']
    }, SYSTEM_ROLE_PROFILES);

    expect(result.isValid).toBe(true);
    expect(result.data.storeIds).toEqual(['loja-02', 'loja-04', 'loja-05', 'loja-06']);
  });

  it('moves the manager primary store when only another permitted store remains', () => {
    const result = validateAccess({
      displayName: 'Gestor da Loja 06',
      email: 'gestor06@example.com',
      phone: '81999999999',
      role: 'manager',
      storeId: 'loja-02',
      storeIds: ['loja-06']
    });

    expect(result.isValid).toBe(true);
    expect(result.data.storeId).toBe('loja-06');
    expect(result.data.storeIds).toEqual(['loja-06']);
  });

  it('treats MEI as an external captor with multiple permitted stores', () => {
    const roleProfiles = [{ id: 'system-mei', baseRole: 'captor', active: true }];
    const result = validateAccess({
      displayName: 'Captadora MEI',
      email: 'mei@example.com',
      phone: '81999999999',
      roleProfileId: 'system-mei',
      storeId: 'loja-06',
      storeIds: ['loja-02', 'loja-05']
    }, roleProfiles);

    expect(result.isValid).toBe(true);
    expect(result.data.storeId).toBe('loja-02');
    expect(result.data.storeIds).toEqual(['loja-02', 'loja-05']);
  });

  it('gives a collaborator the same permitted-store selection as MEI', () => {
    const roleProfiles = [{ id: 'system-captor', baseRole: 'captor', active: true }];
    const result = validateAccess({
      displayName: 'Colaborador Externo',
      email: 'colaborador@example.com',
      phone: '81999999999',
      roleProfileId: 'system-captor',
      storeId: 'loja-06',
      storeIds: ['loja-04', 'loja-06']
    }, roleProfiles);

    expect(result.isValid).toBe(true);
    expect(result.data.storeId).toBe('loja-04');
    expect(result.data.storeIds).toEqual(['loja-04', 'loja-06']);
  });

  it('uses the standard initial password for new non-admin access', () => {
    const result = validateAccess({
      displayName: 'Pessoa de Teste',
      email: 'pessoa@exemplo.com',
      phone: '81999999999',
      role: 'captor',
      storeId: 'loja-06',
      password: '123'
    }, [], { requirePassword: true });

    expect(result.isValid).toBe(true);
    expect(result.data.password).toBe(DEFAULT_TEAM_PASSWORD);
  });

  it('requires an exclusive initial password for a new administrator', () => {
    const result = validateAccess({
      displayName: 'Nova Administradora',
      email: 'admin-nova@exemplo.com',
      phone: '81999999999',
      role: 'admin',
      storeId: 'loja-06',
      password: '123'
    }, [], { requirePassword: true });

    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBeTruthy();
  });

  it('validates an optional replacement password when editing an access', () => {
    const base = {
      displayName: 'Pessoa de Teste',
      email: 'pessoa@exemplo.com',
      phone: '81999999999',
      role: 'captor',
      storeId: 'loja-06'
    };

    expect(validateAccess({ ...base, password: '' }).isValid).toBe(true);
    expect(validateAccess({ ...base, password: '123' }).errors.password).toBeTruthy();
    expect(validateAccess({ ...base, password: 'novaSenha123' }).isValid).toBe(true);
  });

  it('keeps leading zeros in the optional SavWin code', () => {
    const result = validateAccess({
      displayName: 'Pessoa de Teste',
      email: 'pessoa@exemplo.com',
      phone: '81999999999',
      role: 'captor',
      storeId: 'loja-06',
      savwinCode: '0095'
    });

    expect(result.data.savwinCode).toBe('0095');
  });

  it('summarizes permitted stores without repeating the store name', () => {
    expect(formatAccessStoreSummary({ role: 'admin' }).short).toBe('TODAS');
    expect(formatAccessStoreSummary({ role: 'captor', storeIds: ['loja-02'] }).short).toBe('Loja 02');
    expect(formatAccessStoreSummary({ role: 'manager', storeIds: ['loja-02', 'loja-04', 'loja-06'] })).toEqual({
      short: '02, 04, 06',
      full: 'Loja 02, Loja 04, Loja 06'
    });
  });
});
