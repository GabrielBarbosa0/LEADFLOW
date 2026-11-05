import { describe, expect, it } from 'vitest';
import { resetSessionState } from '../../src/app/core/session.js';

function dirtyState() {
  return {
    profile: { uid: 'old-user' },
    leads: [{ id: 'lead-1' }],
    management: { loaded: true },
    savwin: { result: { id: 'sale-1' } },
    appointments: { loaded: true },
    confirmations: { loaded: true },
    appointmentCreate: { saving: true },
    newLeadSchedule: { loaded: true },
    leadDetailSchedule: { loading: true },
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
    expect(state.appointments).toMatchObject({ loaded: false, records: [] });
    expect(state.settings).toMatchObject({ loaded: false, services: [] });
    expect(state.settings.roleDraft).toEqual({ name: '', scope: 'own', permissions: ['leads.create'] });
    expect(state.goals).toMatchObject({ loaded: false, records: [], draft: { title: 'Meta de captações' } });
  });
});
