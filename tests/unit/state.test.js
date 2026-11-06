import { describe, expect, it } from 'vitest';
import { createAppState } from '../../src/app/core/state.js';

function createState() {
  return createAppState({
    route: 'home',
    createDefaultManagementFilters: () => ({ startDate: '2026-10-01', endDate: '2026-10-29' }),
    createDefaultGoalDraft: () => ({ title: 'Meta de captações', assigneeUids: [] }),
    createDefaultRoleDraft: () => ({ name: '', scope: 'own', permissions: ['leads.create'] })
  });
}

describe('core state', () => {
  it('creates the complete initial state for the selected route', () => {
    const state = createState();

    expect(state.route).toBe('home');
    expect(state.loading).toBe(true);
    expect(state.profile).toBeNull();
    expect(state.management.filters).toEqual({ startDate: '2026-10-01', endDate: '2026-10-29' });
    expect(state.management).toMatchObject({ archiveOpen: false, archiveSelection: [], archiveSaving: false });
    expect(state.dashboardFilters).toEqual({ storeId: '' });
    expect(state.leadSearch).toEqual({ query: '', loading: false, searched: false, error: '', results: [] });
    expect(state.externalOperations.transportMode).toBe('with');
    expect(state.settings.roleDraft).toEqual({ name: '', scope: 'own', permissions: ['leads.create'] });
    expect(state.access).toMatchObject({ loaded: false, accesses: [] });
  });

  it('does not share mutable state across separate sessions', () => {
    const first = createState();
    const second = createState();

    first.leads.push({ id: 'lead-1' });
    first.settings.roleProfiles[0].permissions.pop();
    first.newLeadSchedule.settings.transportEnabled = true;

    expect(second.leads).toEqual([]);
    expect(second.settings.roleProfiles[0].permissions).not.toEqual(first.settings.roleProfiles[0].permissions);
    expect(second.newLeadSchedule.settings.transportEnabled).not.toBe(true);
  });
});
