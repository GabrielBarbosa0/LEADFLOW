import { loadGoalsDashboard } from '../../../services/goal-service.js';
import { loadOwnSalesStats } from '../../../services/sales-stats-service.js';
import { monthKeyFromDate } from '../../../utils/calendar.js';
import { hasPermission } from '../../../utils/role-profile.js';
import { STORES } from '../../../utils/stores.js';

export function groupGoalRecords(records) {
  const groups = new Map();
  records.forEach((goal) => {
    const groupId = goal.groupId || goal.id;
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(goal);
  });
  return [...groups.entries()].map(([id, goals]) => {
    const first = goals[0];
    const completed = goals.reduce((total, goal) => total + goal.completed, 0);
    const targetCount = goals.reduce((total, goal) => total + goal.targetCount, 0);
    return {
      id,
      goals: goals.sort((a, b) => a.assigneeName.localeCompare(b.assigneeName, 'pt-BR')),
      title: first.title,
      storeId: first.storeId,
      startDate: first.startDate,
      endDate: first.endDate,
      targetPerPerson: first.targetCount,
      completed,
      targetCount,
      remaining: Math.max(0, targetCount - completed),
      percentage: targetCount ? Math.min(100, Math.round((completed / targetCount) * 100)) : 0
    };
  });
}

export async function loadGoalsData(state, { render }) {
  if (!state.profile || state.goals.loading) return;
  const canLoadSalesStats = hasPermission(state.profile, 'goals.view_own');
  const salesStats = state.goals.salesStats || {
    enabled: false, loading: false, loaded: false, error: '', record: null, period: ''
  };
  state.goals.salesStats = salesStats;
  salesStats.enabled = canLoadSalesStats;
  salesStats.loading = canLoadSalesStats;
  salesStats.error = '';
  salesStats.period = monthKeyFromDate();
  state.goals.loading = true;
  state.goals.error = '';
  render();
  try {
    const result = await loadGoalsDashboard(state.profile);
    state.goals.records = result.goals;
    state.goals.members = result.members;
    state.goals.truncated = result.truncated;
    state.goals.loaded = true;
    if (!state.goals.draft.storeId) {
      state.goals.draft.storeId = state.profile.role === 'manager'
        ? state.profile.storeId
        : STORES[0]?.id || '';
    }
  } catch (error) {
    state.goals.error = error?.code === 'permission-denied'
      ? 'Seu perfil não possui permissão para consultar estas metas.'
      : 'Não foi possível carregar as metas. Verifique a conexão e tente novamente.';
  } finally {
    if (canLoadSalesStats) {
      try {
        salesStats.record = await loadOwnSalesStats(state.profile, salesStats.period);
        salesStats.loaded = true;
      } catch (error) {
        salesStats.record = null;
        salesStats.error = error?.code === 'permission-denied'
          ? 'Seu perfil nao pode consultar estes resultados.'
          : 'Nao foi possivel carregar seus resultados de vendas.';
      }
    }
    salesStats.loading = false;
    state.goals.loading = false;
    state.goals.saving = false;
    render();
  }
}

export function ensureGoalsData(state, { render }) {
  if (state.route === 'goals' && state.profile && !state.goals.loaded) {
    return loadGoalsData(state, { render });
  }
  return undefined;
}
