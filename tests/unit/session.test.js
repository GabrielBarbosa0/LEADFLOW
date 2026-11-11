import { describe, expect, it } from 'vitest';
import { resetSessionState } from '../../src/app/core/session.js';

function dirtyState() {
  return {
    profile: { uid: 'old-user' },
    leads: [{ id: 'lead-1' }],
    management: { loaded: true },
    savwin: { result: { id: 'sale-1' } },
    salesStats: { loaded: true, records: [{ id: 'stats-1' }] },
    savwinReview: { loaded: true, saving: true, records: [{ id: 'review-1' }], activeId: 'review-1' },
    appointments: { loaded: true },
    confirmations: { loaded: true },
    appointmentCreate: { saving: true },
    newLeadSchedule: { loaded: true },
    leadDetailSchedule: { loading: true },
    leadHistory: { leadId: 'lead-1', profileUid: 'old-user', records: [{ id: 'event-1' }] },
    leadDetailDialog: { leadId: 'lead-1' },
    leadHistoryDialogOpen: true,
    offlineCapture: { loaded: true, enabled: true },
    followUps: { loaded: true },
    settings: { loaded: true },
    access: { loaded: true },
    goals: { loaded: true }
  };
}

describe('core session', () => {
  it('resets the user-scoped data when the session ends', () => {
    const state = dirtyState();
    resetSessionState(state, {
      createDefaultManagementFilters: () => ({ startDate: '2026-10-01' }),
      createDefaultGoalDraft: () => ({ title: 'Meta de captações' }),
      createDefaultRoleDraft: () => ({ name: '', scope: 'own', permissions: ['leads.create'] })
    });

    expect(state.profile).toBeNull();
    expect(state.leads).toEqual([]);
    expect(state.management).toMatchObject({ loaded: false, records: [] });
    expect(state.salesStats).toMatchObject({ loaded: false, records: [], period: '', storeId: '' });
    expect(state.savwinReview).toMatchObject({
      loaded: false, saving: false, records: [], activeId: '',
      filters: { storeId: '', status: 'pending' }
    });
    expect(state.appointments).toMatchObject({ loaded: false, records: [] });
    expect(state.externalOperations.transportMode).toBe('with');
    expect(state.leadHistory).toEqual({
      leadId: '', profileUid: '', loading: false, error: '', records: [], stage: ''
    });
    expect(state.leadDetailDialog).toEqual({ leadId: '' });
    expect(state.leadHistoryDialogOpen).toBe(false);
    expect(state.settings).toMatchObject({ loaded: false, services: [] });
    expect(state.settings.roleDraft).toEqual({ name: '', scope: 'own', permissions: ['leads.create'] });
    expect(state.goals).toMatchObject({ loaded: false, records: [], draft: { title: 'Meta de captações' } });
    expect(state.goals.salesStats).toMatchObject({ enabled: false, loaded: false, record: null, period: '' });
  });
});
