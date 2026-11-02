import { formatAccessStoreSummary } from '../../utils/access.js';
import { profileStoreIds } from '../../utils/permissions.js';
import { STORES } from '../../utils/stores.js';
import { escapeHtml } from '../shared/formatters.js';
import { bottomNavigation } from './navigation.js';

export function loginView({ state, firebaseConfigured, devMode }) {
  const configNotice = firebaseConfigured ? '' : '<div class="notice notice-warning"><i data-lucide="wrench"></i><div><strong>Firebase ainda não configurado</strong><span>Use o modo de desenvolvimento sem dados reais.</span></div></div>';
  const disabled = firebaseConfigured ? '' : 'disabled';
  return `<main class="login-page"><section class="login-panel" aria-labelledby="login-title"><img class="brand-logo brand-logo-login" src="${import.meta.env.BASE_URL}leadflow-logo.png" alt="" aria-hidden="true" /><p class="eyebrow">GESTÃO DE RELACIONAMENTO</p><h1 id="login-title">LeadFlow</h1><p class="login-copy">Cadastro rápido para quem encontra clientes onde eles estão.</p>${configNotice}${state.authError ? `<div class="notice notice-danger" role="alert"><i data-lucide="circle-alert"></i><span>${escapeHtml(state.authError)}</span></div>` : ''}${state.authMessage ? `<div class="notice notice-success" role="status"><i data-lucide="circle-check"></i><span>${escapeHtml(state.authMessage)}</span></div>` : ''}<button class="button button-primary button-block login-google-button" type="button" data-action="google-login" ${disabled}><i data-lucide="log-in"></i><span>Entrar com Google</span></button><div class="login-divider" role="separator"><span>ou use e-mail e senha</span></div><form id="email-login-form" class="email-login-form" novalidate><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="email" placeholder="nome@exemplo.com" required /></div><div class="field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Sua senha" required /></div><button class="button button-secondary button-block" type="submit" ${disabled}><i data-lucide="log-in"></i><span>Entrar com e-mail</span></button><div class="login-secondary-actions"><button type="button" data-action="email-register">Criar primeiro acesso</button><button type="button" data-action="password-reset">Esqueci minha senha</button></div></form>${devMode ? '<button class="button button-secondary button-block" type="button" data-action="demo-login"><i data-lucide="flask-conical"></i><span>Abrir modo de desenvolvimento</span></button>' : ''}</section></main>`;
}

export function currentPageTitle(state, canManage) {
  if (state.route === 'walk-ins') return 'Encaixes do dia';
  const titles = { home: 'Início', new: 'Cadastro', leads: 'Meus cadastros', search: 'Pesquisa', lead: 'Detalhes do cadastro', management: 'Painel de leads', 'management-lead': 'Detalhes do lead', dashboard: 'Dashboard', appointments: 'Agenda de exames', confirmations: 'Confirmações', access: 'Acessos da equipe', goals: 'Metas', settings: 'Configurações' };
  if (state.route === 'kanban') return 'Funil de leads';
  if (state.route === 'follow-ups') return canManage() ? 'Retornos da equipe' : 'Retornos pendentes';
  return titles[state.route] || 'Início';
}

export function headerView({ state, canManage }) {
  const online = navigator.onLine;
  const storeSummary = formatAccessStoreSummary(state.profile);
  const labels = STORES.filter((store) => profileStoreIds(state.profile).includes(store.id)).map((store) => store.label);
  const indicator = storeSummary.short === 'TODAS' ? 'Todas' : labels.join(' · ') || storeSummary.short;
  const multiple = labels.length > 1 && storeSummary.short !== 'TODAS';
  return `<header class="app-header"><div class="header-inner layout-wide"><div class="header-brand"><img class="brand-logo brand-logo-header" src="${import.meta.env.BASE_URL}leadflow-logo.png" alt="" aria-hidden="true" /><div><p class="eyebrow">LEADFLOW</p><h1 class="header-page-title">${escapeHtml(currentPageTitle(state, canManage))}</h1></div></div><div class="header-actions">${state.demoMode ? '<span class="mode-badge">DEMO</span>' : ''}<span class="store-indicator ${multiple ? 'is-multiple' : ''}" title="${escapeHtml(storeSummary.full)}" aria-label="Lojas: ${escapeHtml(storeSummary.full)}"><i data-lucide="building-2"></i><span>${escapeHtml(indicator)}</span></span><span class="connectivity ${online ? 'is-online' : 'is-offline'}"><i data-lucide="${online ? 'wifi' : 'wifi-off'}"></i>${online ? 'Online' : 'Offline'}</span><button class="icon-button" type="button" data-action="logout" title="Sair"><i data-lucide="log-out"></i></button></div></div></header>`;
}

export function appShellView({ state, page, canManage, hasAccess, pendingFollowUps }) {
  const wideLayout = ['management', 'kanban', 'dashboard', 'appointments', 'confirmations', 'walk-ins', 'access', 'goals', 'settings'].includes(state.route);
  const routeLayout = state.route === 'kanban' ? 'layout-kanban' : '';
  return `${headerView({ state, canManage })}<main class="app-main ${wideLayout ? 'layout-wide' : ''} ${routeLayout}">${page}</main>${bottomNavigation({ state, hasAccess, canManage, pendingFollowUps })}`;
}
