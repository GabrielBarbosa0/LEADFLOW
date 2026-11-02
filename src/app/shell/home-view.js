import { escapeHtml, profileInitials, roleLabel } from '../shared/formatters.js';

function profileCard(profile) {
  return `<section class="profile-card"><div class="avatar">${escapeHtml(profileInitials(profile.displayName))}</div><div><strong>${escapeHtml(profile.displayName)}</strong><span>${escapeHtml(profile.roleProfileName || roleLabel(profile.role))}</span></div><i data-lucide="shield-check" class="profile-status"></i></section>`;
}

function actionCard(route, icon, title, description, extra = '') {
  return `<button class="action-card" type="button" data-route="${route}"><span class="action-icon"><i data-lucide="${icon}"></i></span><span><strong>${title}</strong><small>${description}</small></span>${extra || '<i data-lucide="chevron-right"></i>'}</button>`;
}

export function homeView({ state, hasAccess, canManage, canManageGoals, isAdmin, pendingFollowUps }) {
  const followUps = pendingFollowUps();
  const cards = [];
  if (hasAccess('leads.create')) cards.push(actionCard('new', 'user-plus', 'Nova abordagem', 'Cadastrar novo contato', '<i data-lucide="chevron-right"></i>').replace('class="action-card"', 'class="action-card action-card-primary"'));
  if (hasAccess('walkins.manage')) cards.push(actionCard('walk-ins', 'clock-3', 'Novo encaixe rapido', 'Adicionar cliente presencial a fila do dia', '<i data-lucide="chevron-right"></i>').replace('class="action-card"', 'class="action-card action-card-walk-in"'));
  if (hasAccess('leads.view_own')) cards.push(actionCard('leads', 'clipboard-list', 'Meus cadastros', `${state.leads.length} registro(s) neste acesso`));
  if (hasAccess('followups.own') || hasAccess('followups.team')) {
    const title = hasAccess('followups.team') ? 'Retornos da equipe' : 'Retornos pendentes';
    const description = followUps.length ? `${followUps.length} cliente(s) em acompanhamento` : 'Nenhum retorno pendente';
    const extra = followUps.length ? `<span class="notification-count" aria-label="${followUps.length} pendencia(s)">${followUps.length}</span>` : '';
    cards.push(actionCard('follow-ups', 'bell-ring', title, description, extra));
  }
  if (canManage()) {
    cards.push(actionCard('management', 'bar-chart-3', 'Painel de gestao', 'Consultar e exportar captacoes'));
  }
  if (hasAccess('appointments.view')) {
    cards.push(actionCard('appointments', 'calendar-days', 'Agenda de exames', 'Visualizar os pre-agendamentos'));
    cards.push(actionCard('confirmations', 'message-circle', 'Confirmacoes', 'Enviar lembretes aos clientes'));
  }
  if (hasAccess('goals.view_own') || canManageGoals()) cards.push(actionCard('goals', 'target', 'Metas', canManageGoals() ? 'Definir e acompanhar a equipe' : 'Acompanhar meu desempenho'));
  if (isAdmin()) {
    cards.push(actionCard('access', 'user-round-cog', 'Acessos da equipe', 'Autorizar colaboradores e administradores'));
    cards.push(actionCard('settings', 'settings', 'Configuracoes', 'Agenda e preferencias do sistema'));
  }

  const demoNotice = state.demoMode
    ? '<div class="notice notice-warning"><i data-lucide="flask-conical"></i><div><strong>Modo de desenvolvimento</strong><span>Nao utilize dados reais. Os registros ficam somente neste navegador.</span></div></div>'
    : '';
  return `${profileCard(state.profile)}${demoNotice}<section class="action-grid" aria-label="Acoes principais">${cards.join('')}</section>`;
}
