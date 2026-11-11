import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/goal-service.js', () => ({
  GOALS_LEAD_LIMIT: 500,
  loadGoalsDashboard: vi.fn().mockResolvedValue({ goals: [], members: [], truncated: false })
}));

vi.mock('../../src/services/sales-stats-service.js', () => ({
  loadOwnSalesStats: vi.fn().mockResolvedValue({
    captorUid: 'captor-1', period: '2026-11', capturedLeads: 8,
    convertedCapturedLeads: 3, conversionRate: 37.5, salesCount: 3,
    netRevenue: 2400, averageTicket: 800
  })
}));

import { groupGoalRecords, loadGoalsData } from '../../src/app/features/goals/goals-data.js';
import { goalsView } from '../../src/app/features/goals/goals-view.js';

const records = [
  { id: 'goal-1', groupId: 'team-october', title: 'Meta de outubro', storeId: 'loja-06', assigneeUid: 'ana', assigneeName: 'Ana', targetCount: 10, completed: 4, startDate: '2026-10-01', endDate: '2026-10-31', percentage: 40 },
  { id: 'goal-2', groupId: 'team-october', title: 'Meta de outubro', storeId: 'loja-06', assigneeUid: 'bruno', assigneeName: 'Bruno', targetCount: 10, completed: 6, startDate: '2026-10-01', endDate: '2026-10-31', percentage: 60 }
];

describe('goals feature modules', () => {
  it('groups individual collaborator goals into one team goal', () => {
    expect(groupGoalRecords(records)).toEqual([expect.objectContaining({
      id: 'team-october',
      completed: 10,
      targetCount: 20,
      remaining: 10,
      percentage: 50
    })]);
  });

  it('loads dashboard records and assigns an initial store to the draft', async () => {
    const state = {
      profile: { uid: 'captor-1', role: 'manager', storeId: 'loja-06', permissions: ['goals.view_own'] },
      goals: { loading: false, saving: true, error: '', records: [], members: [], truncated: false, loaded: false, salesStats: { enabled: false, loading: false, loaded: false, error: '', record: null, period: '' }, draft: { storeId: '' } }
    };
    const render = vi.fn();
    await loadGoalsData(state, { render });
    expect(state.goals.loading).toBe(false);
    expect(state.goals.saving).toBe(false);
    expect(state.goals.salesStats).toMatchObject({ enabled: true, loaded: true, record: { salesCount: 3 } });
    expect(render).toHaveBeenCalled();
  });

  it('renders manager controls and grouped progress', () => {
    const state = {
      profile: { storeId: 'loja-06' },
      goals: { records, members: [{ uid: 'ana', displayName: 'Ana', storeId: 'loja-06' }], loading: false, saving: false, error: '', truncated: false, draft: { storeId: 'loja-06', assigneeUids: ['ana'] }, editorOpen: false, editingGroupId: '', duplicatingGroupId: '', pendingDeleteGroupId: '' }
    };
    const markup = goalsView({ state, isAdmin: () => true, canManageGoals: () => true });
    expect(markup).not.toContain('Metas da equipe');
    expect(markup).not.toContain('Defina objetivos de captação');
    expect(markup).toContain('Meta de outubro');
    expect(markup).toContain('data-goal-new');
    expect(markup).toContain('10 de 20 leads');
  });

  it('renders only aggregate personal sales results', () => {
    const state = {
      profile: { uid: 'captor-1', storeId: 'loja-02' },
      goals: {
        records: [], members: [], loading: false, saving: false, error: '', truncated: false,
        draft: { storeId: 'loja-02', assigneeUids: [] }, editorOpen: false,
        editingGroupId: '', duplicatingGroupId: '', pendingDeleteGroupId: '',
        salesStats: {
          enabled: true, loading: false, loaded: true, error: '', period: '2026-11',
          record: { capturedLeads: 8, convertedCapturedLeads: 3, conversionRate: 37.5, salesCount: 3, netRevenue: 2400, averageTicket: 800 }
        }
      }
    };
    const markup = goalsView({ state, isAdmin: () => false, canManageGoals: () => false });
    expect(markup).toContain('Meus resultados de vendas');
    expect(markup).toContain('37,5%');
    expect(markup).toContain('2.400,00');
    expect(markup).toContain('800,00');
    expect(markup).toContain('Cobertura ainda n&atilde;o informada');
    expect(markup).not.toContain('customerCpf');
    expect(markup).not.toContain('osNumber');
  });
});
