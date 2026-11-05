import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/goal-service.js', () => ({
  GOALS_LEAD_LIMIT: 500,
  loadGoalsDashboard: vi.fn().mockResolvedValue({ goals: [], members: [], truncated: false })
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
      profile: { role: 'manager', storeId: 'loja-06' },
      goals: { loading: false, saving: true, error: '', records: [], members: [], truncated: false, loaded: false, draft: { storeId: '' } }
    };
    const render = vi.fn();
    await loadGoalsData(state, { render });
    expect(state.goals.loading).toBe(false);
    expect(state.goals.saving).toBe(false);
    expect(render).toHaveBeenCalled();
  });

  it('renders manager controls and grouped progress', () => {
    const state = {
      profile: { storeId: 'loja-06' },
      goals: { records, members: [{ uid: 'ana', displayName: 'Ana', storeId: 'loja-06' }], loading: false, saving: false, error: '', truncated: false, draft: { storeId: 'loja-06', assigneeUids: ['ana'] }, editorOpen: false, editingGroupId: '', duplicatingGroupId: '', pendingDeleteGroupId: '' }
    };
    const markup = goalsView({ state, isAdmin: () => true, canManageGoals: () => true });
    expect(markup).toContain('Metas da equipe');
    expect(markup).toContain('Meta de outubro');
    expect(markup).toContain('data-goal-new');
    expect(markup).toContain('10 de 20 leads');
  });
});
