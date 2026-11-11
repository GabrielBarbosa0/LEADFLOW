export function bottomNavigation({ state, hasAccess, canManage, pendingFollowUps }) {
  const items = [['home', 'house', 'Início']];
  if (hasAccess('leads.create')) items.push(['new', 'circle-plus', 'Novo']);
  if (hasAccess('leads.view_own')) {
    items.push(['leads', 'clipboard-list', 'Cadastros']);
    items.push(['search', 'search', 'Pesquisa']);
  }
  if (hasAccess('followups.own') && !hasAccess('followups.team')) items.push(['follow-ups', 'bell-ring', 'Retornos']);
  if (canManage()) items.push(['management', 'bar-chart-3', 'Gestão']);
  const followUpCount = pendingFollowUps().length;
  const itemCountClass = items.length === 5 ? 'has-five-items' : items.length === 6 ? 'has-six-items' : '';
  return `<nav class="bottom-nav ${itemCountClass}" aria-label="Navegação principal">${items.map(([route, icon, label]) => {
    const active = state.route === route || (route === 'leads' && state.route === 'lead') || (route === 'management' && ['management-lead', 'kanban', 'dashboard', 'savwin-review', 'appointments', 'confirmations', 'settings', 'follow-ups'].includes(state.route));
    return `<button type="button" data-route="${route}" class="${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}><i data-lucide="${icon}"></i><span>${label}</span>${route === 'follow-ups' && followUpCount ? `<strong class="nav-notification-count">${followUpCount > 99 ? '99+' : followUpCount}</strong>` : ''}</button>`;
  }).join('')}</nav>`;
}
