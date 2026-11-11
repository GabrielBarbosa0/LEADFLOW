import { describe, expect, it } from 'vitest';
import { appShellView, currentPageTitle, loginView } from '../../src/app/shell/app-shell-view.js';
import { homeView } from '../../src/app/shell/home-view.js';
import { bottomNavigation } from '../../src/app/shell/navigation.js';

const profile = { displayName: 'Ana Silva', role: 'manager', roleProfileId: 'system-manager', roleProfileName: 'Gestor loja', storeId: 'loja-06', storeIds: ['loja-06'] };
const state = { route: 'home', leads: [{ id: 'lead-1' }], profile };
const hasAccess = (permission) => ['leads.create', 'leads.view_own', 'followups.own', 'goals.view_own'].includes(permission);

describe('application shell modules', () => {
  it('renders the login shell with its authentication actions', () => {
    const markup = loginView({ state: { authError: '', authMessage: '' }, firebaseConfigured: true });
    expect(markup).toContain('email-login-form');
    expect(markup).toContain('data-action="google-login"');
    expect(markup).toContain('Entrar com Google');
    expect(markup).not.toContain('Abrir modo de desenvolvimento');
  });

  it('renders the home actions according to permissions', () => {
    const markup = homeView({ state, hasAccess, canManage: () => true, canManageGoals: () => false, isAdmin: () => false, pendingFollowUps: () => [{ id: 'follow-up' }] });
    expect(markup).toContain('Nova abordagem');
    expect(markup).toContain('Meus cadastros');
    expect(markup).toContain('1 cliente(s) em acompanhamento');
    expect(markup).not.toContain('Acessos da equipe');
  });

  it('shows walk-ins to the consolidated internal collaborator', () => {
    const internalMarkup = homeView({
      state,
      hasAccess: (permission) => permission === 'walkins.manage',
      canManage: () => false,
      canManageGoals: () => false,
      isAdmin: () => false,
      pendingFollowUps: () => []
    });
    const externalMarkup = homeView({
      state,
      hasAccess: (permission) => ['leads.create', 'external.operations.read'].includes(permission),
      canManage: () => false,
      canManageGoals: () => false,
      isAdmin: () => false,
      pendingFollowUps: () => []
    });

    expect(internalMarkup).toContain('Novo encaixe rápido');
    expect(externalMarkup).not.toContain('Novo encaixe rápido');
    expect(externalMarkup).not.toContain('Painel de gestão');
  });

  it('shows external operations only with the dedicated permission', () => {
    const leaderMarkup = homeView({
      state,
      hasAccess: (permission) => permission === 'external.operations.read',
      canManage: () => false,
      canManageGoals: () => false,
      isAdmin: () => false,
      pendingFollowUps: () => []
    });
    const collaboratorMarkup = homeView({
      state,
      hasAccess,
      canManage: () => false,
      canManageGoals: () => false,
      isAdmin: () => false,
      pendingFollowUps: () => []
    });

    expect(leaderMarkup).toContain('Operação externa');
    expect(leaderMarkup).toContain('action-card-external');
    expect(collaboratorMarkup).not.toContain('Operação externa');
    expect(currentPageTitle({ route: 'external-operations' }, () => false)).toBe('Operação externa');
  });

  it('shows a read-only agenda to external collaborators without confirmations', () => {
    const externalMarkup = homeView({
      state,
      hasAccess: (permission) => [
        'leads.create', 'leads.view_own', 'followups.own', 'goals.view_own',
        'external.operations.read', 'appointments.view'
      ].includes(permission),
      canManage: () => false,
      canManageGoals: () => false,
      isAdmin: () => false,
      pendingFollowUps: () => []
    });

    expect(externalMarkup).toContain('Agenda de exames');
    expect(externalMarkup).not.toContain('Confirmações');
    expect(externalMarkup).not.toContain('Novo encaixe rápido');
    expect(externalMarkup).not.toContain('Acessos da equipe');
    expect(externalMarkup).not.toContain('Configurações');
  });

  it('shows the external features plus operational actions to internal collaborators', () => {
    const internalMarkup = homeView({
      state,
      hasAccess: (permission) => [
        'leads.create', 'leads.view_own', 'followups.own', 'goals.view_own',
        'external.operations.read', 'appointments.view', 'appointments.confirmations',
        'appointments.attendance', 'walkins.manage'
      ].includes(permission),
      canManage: () => true,
      canManageGoals: () => false,
      isAdmin: () => false,
      pendingFollowUps: () => []
    });

    expect(internalMarkup).toContain('Operação externa');
    expect(internalMarkup).toContain('Agenda de exames');
    expect(internalMarkup).toContain('Confirmações');
    expect(internalMarkup).toContain('Novo encaixe rápido');
    expect(internalMarkup).not.toContain('Acessos da equipe');
    expect(internalMarkup).not.toContain('Configurações');
  });

  it('keeps navigation active state and management grouping', () => {
    const navigation = bottomNavigation({ state: { ...state, route: 'dashboard' }, hasAccess, canManage: () => true, pendingFollowUps: () => [] });
    expect(navigation).toContain('Gestão');
    expect(navigation).toContain('data-route="search"');
    expect(navigation.indexOf('Cadastros')).toBeLessThan(navigation.indexOf('Pesquisa'));
    expect(navigation).toContain('aria-current="page"');
    expect(currentPageTitle({ route: 'follow-ups' }, () => true)).toBe('Retornos da equipe');
  });

  it('composes header, page and navigation through the shell', () => {
    const markup = appShellView({ state, page: '<section>Conteúdo</section>', canManage: () => true, hasAccess, pendingFollowUps: () => [] });
    expect(markup).toContain('LEADFLOW');
    expect(markup).toContain('Conteúdo');
    expect(markup).toContain('bottom-nav');
  });

  it('uses the full-width layout only for the Kanban route', () => {
    const kanbanMarkup = appShellView({ state: { ...state, route: 'kanban' }, page: '<section>Kanban</section>', canManage: () => true, hasAccess, pendingFollowUps: () => [] });
    const managementMarkup = appShellView({ state: { ...state, route: 'management' }, page: '<section>Management</section>', canManage: () => true, hasAccess, pendingFollowUps: () => [] });

    expect(kanbanMarkup).toContain('app-main layout-wide layout-kanban');
    expect(managementMarkup).not.toContain('layout-kanban');
  });
});
