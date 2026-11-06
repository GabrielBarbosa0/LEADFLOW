const VALID_ROUTES = new Set(['home', 'new', 'walk-ins', 'external-operations', 'leads', 'search', 'lead', 'follow-ups', 'management', 'management-lead', 'kanban', 'dashboard', 'reports', 'appointments', 'confirmations', 'access', 'goals', 'settings']);

function routeParts() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function currentRoute() {
  const route = routeParts()[0] || 'home';
  return VALID_ROUTES.has(route) ? route : 'home';
}

export function currentRouteParam() {
  const value = routeParts()[1];
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export function navigate(route, param = '') {
  const target = VALID_ROUTES.has(route) ? route : 'home';
  location.hash = `#/${target}${param ? `/${encodeURIComponent(param)}` : ''}`;
}
