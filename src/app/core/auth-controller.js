import { completeRedirectSignIn, createEmailPasswordAccess, loadAuthorizedProfile, observeAuth, observeAuthorizedProfile, requestPasswordReset, signInWithEmail, signInWithGoogle, signOutUser } from '../../firebase/auth.js';
import { profileAccessSignature } from '../shared/formatters.js';
import { resetSessionState } from './session.js';

function readableAuthError(error, fallback) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const blockedDomain = code.startsWith('auth/requests-from-referer-')
    || code === 'auth/unauthorized-domain'
    || message.includes('requests-from-referer-')
    || message.includes('auth/unauthorized-domain');

  if (blockedDomain) {
    return 'O acesso por este endereço ainda está sendo configurado. Avise o administrador e tente novamente mais tarde.';
  }
  return message || fallback;
}

export function bindAuthenticationForm({ state, render }) {
  const form = document.querySelector('#email-login-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    state.authError = '';
    state.authMessage = '';
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      await signInWithEmail(values.email, values.password);
    } catch (error) {
      state.authError = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error?.code)
        ? 'E-mail ou senha incorretos.'
        : readableAuthError(error, 'Não foi possível entrar.');
      render();
    }
  });
}

export async function handleAuthenticationAction(action, dependencies) {
  const {
    state,
    render,
    navigate,
    subscribeProfileLeads,
    startOfflineCaptureSubscription,
    startFollowUpScheduleSubscription,
    stopOfflineCaptureSubscription,
    stopFollowUpScheduleSubscription,
    stopAppointmentsSubscription,
    stopConfirmationsSubscription,
    stopWalkInsSubscription,
    stopNewLeadScheduleSubscriptions,
    stopLeadHistorySubscription,
    createDefaultManagementFilters,
    createDefaultGoalDraft,
    createDefaultRoleDraft
  } = dependencies;

  if (action === 'google-login') {
    state.authError = '';
    state.authMessage = '';
    state.loading = true;
    render();
    try {
      await signInWithGoogle();
    } catch (error) {
      state.loading = false;
      state.authError = readableAuthError(error, 'Não foi possível entrar com o Google.');
      render();
    }
    return true;
  }

  if (action === 'email-register') {
    const form = document.querySelector('#email-login-form');
    const values = form ? Object.fromEntries(new FormData(form)) : {};
    state.authError = '';
    state.authMessage = '';
    try {
      await createEmailPasswordAccess(values.email, values.password);
      state.authMessage = 'Primeiro acesso criado. Confirme o link enviado ao seu e-mail e depois entre com sua senha.';
    } catch (error) {
      if (error?.code === 'auth/email-already-in-use') {
        try {
          await requestPasswordReset(values.email);
          state.authMessage = 'Este acesso já estava preparado. Enviamos um link para você definir sua senha.';
        } catch (resetError) {
          state.authError = readableAuthError(resetError, 'Não foi possível enviar a definição de senha.');
        }
      } else {
        state.authError = readableAuthError(error, 'Não foi possível criar o primeiro acesso.');
      }
    }
    render();
    return true;
  }

  if (action === 'password-reset') {
    const email = document.querySelector('#login-email')?.value || '';
    state.authError = '';
    state.authMessage = '';
    try {
      await requestPasswordReset(email);
      state.authMessage = 'Enviamos as instruções de recuperação para o e-mail informado.';
    } catch (error) {
      state.authError = readableAuthError(error, 'Não foi possível enviar a recuperação de senha.');
    }
    render();
    return true;
  }

  if (action !== 'logout') return false;

  state.unsubscribeProfile?.();
  state.unsubscribeProfile = null;
  state.unsubscribeLeads?.();
  state.unsubscribeLeads = null;
  stopAppointmentsSubscription();
  stopConfirmationsSubscription();
  stopWalkInsSubscription?.();
  stopNewLeadScheduleSubscriptions();
  stopLeadHistorySubscription?.();
  stopOfflineCaptureSubscription();
  stopFollowUpScheduleSubscription();
  await signOutUser();
  resetSessionState(state, { createDefaultManagementFilters, createDefaultGoalDraft, createDefaultRoleDraft });
  render();
  return true;
}

export async function startAuthenticationController(dependencies) {
  const {
    state,
    render,
    subscribeProfileLeads,
    startOfflineCaptureSubscription,
    stopOfflineCaptureSubscription,
    startFollowUpScheduleSubscription,
    synchronizePendingRegistrations,
    refreshAuthorizedData,
    hasAccess,
    stopAppointmentsSubscription,
    stopConfirmationsSubscription,
    stopWalkInsSubscription,
    stopLeadHistorySubscription
  } = dependencies;

  try {
    await completeRedirectSignIn();
  } catch (error) {
    state.authError = readableAuthError(error, 'Não foi possível concluir o acesso.');
  }

  observeAuth(async (firebaseUser) => {
    state.unsubscribeProfile?.();
    state.unsubscribeProfile = null;
    stopLeadHistorySubscription?.();
    state.leadHistory = { leadId: '', profileUid: '', loading: false, error: '', records: [], stage: '' };
    state.leadDetailDialog = { leadId: '' };
    state.leadHistoryDialogOpen = false;
    stopOfflineCaptureSubscription();
    state.loading = true;
    render();
    if (!firebaseUser) {
      state.profile = null;
      state.loading = false;
      render();
      return;
    }

    try {
      state.profile = await loadAuthorizedProfile(firebaseUser);
      state.authError = '';
      subscribeProfileLeads();
      if (navigator.onLine) synchronizePendingRegistrations();
      startOfflineCaptureSubscription();
      startFollowUpScheduleSubscription();
      state.unsubscribeProfile = observeAuthorizedProfile(firebaseUser, (profile) => {
        if (profileAccessSignature(profile) === profileAccessSignature(state.profile)) return;
        state.profile = profile;
        state.management.loaded = false;
        state.management.records = [];
        state.management.activeLead = null;
        state.dashboardUpcoming.loaded = false;
        state.dashboardUpcoming.records = [];
        state.externalOperations.loaded = false;
        state.externalOperations.records = [];
        state.access.loaded = false;
        state.goals.loaded = false;
        state.settings.loaded = false;
        if (!hasAccess('appointments.view')) {
          stopAppointmentsSubscription();
          stopWalkInsSubscription?.();
        }
        if (!hasAccess('appointments.confirmations')) stopConfirmationsSubscription();
        subscribeProfileLeads();
        startOfflineCaptureSubscription();
        startFollowUpScheduleSubscription();
        render();
        refreshAuthorizedData();
      }, (error) => {
        state.dataError = error?.message || 'Não foi possível atualizar as permissões deste acesso.';
        render();
      });
    } catch (error) {
      state.profile = null;
      state.authError = error.message || 'Acesso não autorizado.';
    } finally {
      state.loading = false;
      render();
      refreshAuthorizedData();
    }
  });
}
