import { subscribeToLeadHistory } from '../../../services/lead-history-service.js';

export function stopLeadHistorySubscription(state) {
  state.unsubscribeLeadHistory?.();
  state.unsubscribeLeadHistory = null;
}

export function ensureLeadHistory({ state, lead, render }) {
  if (!lead?.id) {
    stopLeadHistorySubscription(state);
    state.leadHistory = { leadId: '', loading: false, error: '', records: [], stage: '' };
    return;
  }
  if (state.leadHistory.leadId === lead.id) return;
  stopLeadHistorySubscription(state);
  state.leadHistory = { leadId: lead.id, loading: true, error: '', records: [], stage: lead.funnelStage || '' };
  render();
  state.unsubscribeLeadHistory = subscribeToLeadHistory(state.profile, lead.id, (records) => {
    state.leadHistory = { ...state.leadHistory, records, loading: false, error: '', stage: lead.funnelStage || '' };
    render();
  }, () => {
    state.leadHistory = { ...state.leadHistory, loading: false, error: 'Não foi possível carregar o histórico.' };
    render();
  });
}
