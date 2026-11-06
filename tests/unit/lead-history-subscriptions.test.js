import { beforeEach, describe, expect, it, vi } from 'vitest';

const { subscribeToLeadHistory } = vi.hoisted(() => ({
  subscribeToLeadHistory: vi.fn()
}));

vi.mock('../../src/services/lead-history-service.js', () => ({ subscribeToLeadHistory }));

import { ensureLeadHistory } from '../../src/app/features/funnel/lead-history-subscriptions.js';

describe('lead history subscriptions', () => {
  beforeEach(() => {
    subscribeToLeadHistory.mockReset();
  });

  it('reloads the same lead when the authenticated profile changes', () => {
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();
    subscribeToLeadHistory
      .mockReturnValueOnce(firstUnsubscribe)
      .mockReturnValueOnce(secondUnsubscribe);
    const state = {
      profile: { uid: 'external-uid' },
      leadHistory: { leadId: '', profileUid: '', loading: false, error: '', records: [], stage: '' },
      unsubscribeLeadHistory: null
    };
    const lead = { id: 'lead-1', funnelStage: 'cancelled' };
    const render = vi.fn();

    ensureLeadHistory({ state, lead, render });
    state.profile = { uid: 'mei-uid' };
    ensureLeadHistory({ state, lead, render });

    expect(firstUnsubscribe).toHaveBeenCalledOnce();
    expect(subscribeToLeadHistory).toHaveBeenNthCalledWith(
      2,
      state.profile,
      lead.id,
      expect.any(Function),
      expect.any(Function)
    );
    expect(state.leadHistory).toMatchObject({ leadId: 'lead-1', profileUid: 'mei-uid', loading: true });
    expect(state.unsubscribeLeadHistory).toBe(secondUnsubscribe);
  });
});
