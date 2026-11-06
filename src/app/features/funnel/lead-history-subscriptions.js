import { subscribeToLeadHistory } from '../../../services/lead-history-service.js';

export function stopLeadHistorySubscription(state) {
  state.unsubscribeLeadHistory?.();
  state.unsubscribeLeadHistory = null;
}

export function ensureLeadHistory({ state, lead, render }) {
  if (!lead?.id) {
    stopLeadHistorySubscription(state);
    state.leadHistory = { leadId: '', profileUid: '', loading: false, error: '', records: [], stage: '' };
    return;
  }
  const profileUid = state.profile?.uid || '';
  if (state.leadHistory.leadId === lead.id && state.leadHistory.profileUid === profileUid) return;
  stopLeadHistorySubscription(state);
  state.leadHistory = { leadId: lead.id, profileUid, loading: true, error: '', records: [], stage: lead.funnelStage || '' };
  render();
  state.unsubscribeLeadHistory = subscribeToLeadHistory(state.profile, lead.id, (records) => {
    state.leadHistory = { ...state.leadHistory, records, loading: false, error: '', stage: lead.funnelStage || '' };
    render();
  }, () => {
    state.leadHistory = { ...state.leadHistory, loading: false, error: 'Não foi possível carregar o histórico.' };
    render();
  });
}
