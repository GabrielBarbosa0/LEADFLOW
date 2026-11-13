import { isFirebaseConfigured } from '../firebase/client.js';
import { saveLead, subscribeToLeads, updateLead } from '../services/lead-service.js';
import { markFollowUpContactStarted, subscribeToTeamFollowUps } from '../services/follow-up-service.js';
import { loadRoleProfiles } from '../services/role-profile-service.js';
import { archiveManagementLeads, deleteManagementLead, loadManagementLeads, MANAGEMENT_QUERY_LIMIT, updateManagementLead } from '../services/management-service.js';
import { APPOINTMENTS_QUERY_LIMIT, canCancelAppointment, cancelAppointment, loadUpcomingAppointments, markAppointmentReminderDone, rescheduleAppointment, setAppointmentAttendance, subscribeToAppointmentConfirmations, subscribeToAppointments, undoAppointmentReminderDone } from '../services/appointment-service.js';
import { canClaimCancelledLead, canTransferLead, claimCancelledLead, loadAssignableLeadOwners, transferLead } from '../services/lead-assignment-service.js';
import { canConfirmManualSale, confirmManualSale, deleteManualSaleConfirmation, loadLeadSaleTracking, reactivateManualSaleConfirmation, removeManualSaleConfirmation, subscribeToManualSaleStatuses, validateManualSale } from '../services/sale-tracking-service.js';
import { createQuickWalkIn, createWalkIn, loadWalkInCaptors, subscribeToWalkIns, transitionWalkIn } from '../services/walk-in-service.js';
import { demoExternalOperations, loadExternalOperations } from '../services/external-operations-service.js';
import { loadStoreSchedules, subscribeToStoreSchedule } from '../services/schedule-service.js';
import { ensureDefaultAppointmentServices, loadAppointmentServices } from '../services/service-catalog-service.js';
import { consultLocalSavwinSales, isLocalSavwinEnabled } from '../services/savwin-service.js';
import { downloadLeadsCsv } from '../utils/lead-export.js';
import { monthKeyFromDate, monthRange, shiftMonth } from '../utils/calendar.js';
import { formatBrazilianPhone } from '../utils/phone.js';
import { examPricing, validateQuickLeadInput } from '../utils/lead.js';
import { buildAppointmentSlots, DEFAULT_STORE_SCHEDULE } from '../utils/schedule.js';
import { followUpAppointmentKey } from '../utils/follow-up.js';
import { STORES } from '../utils/stores.js';
import { profileStoreIds } from '../utils/permissions.js';
import { hasPermission as profileHasPermission } from '../utils/role-profile.js';
import { formatBrazilianCpf } from '../utils/savwin-matching.js';
import { defaultAppointmentService, servicesForStore } from '../utils/service-catalog.js';
import { validateWalkInDraft, WALK_IN_CLOSED_STATUSES } from '../utils/walk-in.js';
import { validateAppointmentCancellation } from '../utils/appointment-cancellation.js';
import { hasAppointmentScheduleChanged, validateAppointmentReschedule, validateRescheduleSchedule } from '../utils/appointment-reschedule.js';
import { isCaptarImportedLead } from '../utils/lead-origin.js';
import { currentRoute, currentRouteParam, navigate } from './router.js';
import {
  escapeHtml,
  formatAppointmentDate,
  formatCapturedAt,
  formatDateTimeValue,
  offlineSyncDetail,
  storeDisplayLabel,
  storeLabel,
  syncLabel,
  toLocalDateInput
} from './shared/formatters.js';
import {
  bindBirthDateInput,
  bindCpfInput,
  bindExclusiveOptions,
  bindPostalCodeInput,
  bindPostalCodeLookup,
  bindScoreInput,
  revealFirstFormError,
  setFieldErrors
} from './shared/form-helpers.js';
import { createToastController } from './shared/ui.js';
import { initializeCaptureForm } from './features/capture/capture-events.js';
import { captureNewLeadDraft, leadFormValues } from './features/capture/capture-form.js';
import { captureAppointmentTimeField, careRouteAppointmentSchedule, isCareRouteDateAllowed } from './features/capture/capture-schedule.js';
import { ametropiaOptions, bindEyeTriage, enrichLeadTriage } from './features/capture/capture-triage.js';
import { bindTransportFields } from './features/capture/capture-transport.js';
import { captureView } from './features/capture/capture-view.js';
import { bindCpfAppointmentWarning, confirmDuplicateCpfAppointment } from './features/capture/cpf-appointment-warning.js';
import { bindProductPaymentFields } from './features/capture/product-payment.js';
import { bindPurchaseHolderFields } from './features/capture/purchase-holder.js';
import { initializeLeadDetailForm, leadDetailHasNonAppointmentChanges, leadDetailSubmissionValues } from './features/leads/lead-detail-events.js';
import { leadDetailAppointmentTimeField as renderLeadDetailAppointmentTimeField, selectedLeadDetailService as resolveLeadDetailService } from './features/leads/lead-appointment.js';
import { leadDetailView as renderLeadDetailView } from './features/leads/lead-detail-view.js';
import { leadAssignmentDialog as renderLeadAssignmentDialog } from './features/leads/lead-assignment-dialog.js';
import { ensureLeadHistory, stopLeadHistorySubscription } from './features/funnel/lead-history-subscriptions.js';
import { leadHistoryView } from './features/funnel/lead-history-view.js';
import { filterLeadRecords, leadsView as renderLeadsView } from './features/leads/leads-view.js';
import { manualSaleDialog as renderManualSaleDialog } from './features/sales/manual-sale-dialog.js';
import { validateLeadSearch } from './features/search/lead-search-data.js';
import { checkCpfActiveAppointment, loadSearchLead, searchLeadAppointments } from './features/search/lead-search-service.js';
import { leadSearchView as renderLeadSearchView } from './features/search/lead-search-view.js';
import { handleFollowUpsClick } from './features/follow-ups/follow-ups-events.js';
import { initialFollowUpsState, startFollowUpsSubscriptions } from './features/follow-ups/follow-ups-subscriptions.js';
import { followUpsView as renderFollowUpsView, pendingFollowUps as selectPendingFollowUps } from './features/follow-ups/follow-ups-view.js';
import { appointmentCreateDialog as renderAppointmentCreateDialog, appointmentCreateSchedule as resolveAppointmentCreateSchedule, appointmentCreateService as resolveAppointmentCreateService, appointmentCreateTimeField as renderAppointmentCreateTimeField } from './features/appointments/appointment-dialog.js';
import { bindAppointmentListScroll, handleAppointmentClick, initializeAppointmentCreateEvents, nextAppointmentAttendance, updateAppointmentAttendanceControls } from './features/appointments/appointment-events.js';
import { appointmentsView as renderAppointmentsView } from './features/appointments/appointments-view.js';
import { appointmentCancellationDialog, initializeAppointmentCancellationDialog } from './features/appointments/appointment-cancellation-dialog.js';
import { appointmentRescheduleDialog, initializeAppointmentRescheduleDialog } from './features/appointments/appointment-reschedule-dialog.js';
import { handleConfirmationClick } from './features/appointments/confirmation-events.js';
import { normalizeConfirmationDays } from './features/appointments/confirmation-period.js';
import { confirmationsView as renderConfirmationsView } from './features/appointments/confirmations-view.js';
import { walkInsView as renderWalkInsView } from './features/walk-ins/walk-ins-view.js';
import { bindExternalOperationsEvents } from './features/external-operations/external-operations-events.js';
import { externalOperationsView as renderExternalOperationsView } from './features/external-operations/external-operations-view.js';
import { findManagementLead as selectManagementLead, loadManagementRecords, validateManagementPeriod } from './features/management/management-data.js';
import { createDefaultManagementFilters as buildDefaultManagementFilters, filterManagementRecords } from './features/management/management-filters.js';
import { handleManagementClick, initializeManagementFilters } from './features/management/management-events.js';
import { managementView as renderManagementView } from './features/management/management-view.js';
import { kanbanView as renderKanbanView } from './features/kanban/kanban-view.js';
import { initializeKanbanScrollbar } from './features/kanban/kanban-scrollbar.js';
import { filterDashboardRecords, loadDashboardUpcomingRecords } from './features/dashboard/dashboard-data.js';
import { dashboardCaptorStats, dashboardMetrics } from './features/dashboard/dashboard-metrics.js';
import { dashboardView as renderDashboardView } from './features/dashboard/dashboard-view.js';
import { loadGoalsData as loadGoalsFeatureData, ensureGoalsData as ensureGoalsFeatureData } from './features/goals/goals-data.js';
import { bindGoalDialog } from './features/goals/goal-dialog.js';
import { handleGoalsClick } from './features/goals/goals-events.js';
import { goalsView as renderGoalsView } from './features/goals/goals-view.js';
import { ensureLeadDetailSchedule as ensureLeadDetailScheduleData, refreshLeadDetailAppointmentTime as refreshLeadDetailAppointmentTimeField, startLeadDetailDayAppointmentsSubscription as startLeadDetailDayAppointments } from './features/scheduling/lead-schedule-controller.js';
import { ensureAppointmentData, openAppointmentCreateDialog as openAppointmentCreate, startAppointmentsSubscription as startAppointmentsLive, startConfirmationsSubscription as startConfirmationsLive, stopAppointmentsSubscription as stopAppointmentsLive, stopConfirmationsSubscription as stopConfirmationsLive } from './features/scheduling/appointment-subscriptions.js';
import { ensureNewLeadSchedule as ensureNewLeadScheduleData, refreshAppointmentTimeControl as refreshNewLeadAppointmentTime, refreshNewLeadAmetropiaField, startDayAppointmentsSubscription as startNewLeadDayAppointments, stopNewLeadScheduleSubscriptions as stopNewLeadSchedules } from './features/scheduling/new-lead-schedule-controller.js';
import { appShellView, loginView as renderLoginView } from './shell/app-shell-view.js';
import { homeView as renderHomeView } from './shell/home-view.js';
import { handleSettingsSectionClick } from './features/settings/schedule-events.js';
import { bindScheduleDialogController } from './features/settings/schedule-dialog-controller.js';
import { scheduleSettingsView as renderScheduleSettingsView } from './features/settings/schedule-settings.js';
import { settingsView as renderSettingsView } from './features/settings/settings-view.js';
import { bindServiceEvents, handleServiceClick } from './features/services/service-events.js';
import { servicesView as renderServicesView } from './features/services/services-view.js';
import { bindAccessEvents, ensureAccessData, handleAccessClick } from './features/access/access-events.js';
import { accessView as renderAccessView } from './features/access/access-view.js';
import { bindRoleProfileEvents, createDefaultRoleDraft, handleRoleProfileClick } from './features/access/role-profiles-events.js';
import { roleProfilesView as renderRoleProfilesView } from './features/access/role-profiles-view.js';
import { bindAuthenticationForm, handleAuthenticationAction, startAuthenticationController } from './core/auth-controller.js';
import { createAppState } from './core/state.js';
import { renderApplication, syncAgendaSidebarHeight } from './core/renderer.js';
import { handleConnectivityChange as handleLifecycleConnectivityChange, startLifecycle, synchronizePendingRegistrations as synchronizeLifecyclePendingRegistrations } from './core/lifecycle.js';

const state = createAppState({
  route: currentRoute(),
  createDefaultManagementFilters,
  createDefaultGoalDraft,
  createDefaultRoleDraft
});

const showToast = createToastController(state);

function createDefaultManagementFilters() {
  return buildDefaultManagementFilters();
}

function createDefaultGoalDraft(storeId = '') {
  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    title: 'Meta de captações',
    targetCount: 20,
    startDate: toLocalDateInput(today),
    endDate: toLocalDateInput(monthEnd),
    storeId,
    assigneeUids: []
  };
}

function canManage() {
  return hasAccess('management.view');
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

function hasAccess(permission) {
  return profileHasPermission(state.profile, permission);
}

function canAccessRoute(route) {
  const accessByRoute = {
    home: () => true,
    new: () => hasAccess('leads.create'),
    leads: () => hasAccess('leads.view_own'),
    search: () => hasAccess('leads.view_own'),
    lead: () => hasAccess('leads.view_own'),
    'follow-ups': () => hasAccess('followups.own') || hasAccess('followups.team'),
    management: () => hasAccess('management.view'),
    'management-lead': () => hasAccess('management.view'),
    kanban: () => hasAccess('management.view'),
    dashboard: () => hasAccess('dashboard.view'),
    appointments: () => hasAccess('appointments.view'),
    confirmations: () => hasAccess('appointments.confirmations'),
    'walk-ins': () => hasAccess('walkins.manage'),
    'external-operations': () => hasAccess('external.operations.read'),
    access: () => isAdmin(),
    goals: () => hasAccess('goals.view_own') || hasAccess('goals.manage'),
    settings: () => isAdmin()
  };
  return Boolean(accessByRoute[route]?.());
}

function canManageGoals() {
  return hasAccess('goals.manage');
}

function pendingFollowUps() {
  return selectPendingFollowUps({
    canViewTeam: hasAccess('followups.team'),
    records: state.followUps.records,
    leads: state.leads,
    profile: state.profile,
    settings: state.followUps.settings,
    settingsByStore: state.followUps.settingsByStore
  });
}

function filteredManagementRecords() {
  return filterManagementRecords(state.management.records, state.management.filters);
}

function loginView() {
  return renderLoginView({ state, firebaseConfigured: isFirebaseConfigured });
}

function homeView() {
  return renderHomeView({ state, hasAccess, canManage, canManageGoals, isAdmin, pendingFollowUps });
}

function appView() {
  const pages = { home: homeView, new: newLeadView, 'walk-ins': walkInsView, 'external-operations': externalOperationsView, leads: leadsView, search: leadSearchView, lead: leadDetailView, 'follow-ups': followUpsView, management: managementView, 'management-lead': leadDetailView, kanban: kanbanView, dashboard: dashboardView, appointments: appointmentsView, confirmations: confirmationsView, access: accessView, goals: goalsView, settings: settingsView };
  const page = pages[state.route] || homeView;
  return appShellView({ state, page: `${page()}${leadDetailDialogView()}${leadHistoryDialogView()}${leadAssignmentDialogView()}${manualSaleDialogView()}${appointmentCancellationDialogView()}${appointmentRescheduleDialogView()}`, canManage, hasAccess, pendingFollowUps });
}

function appointmentTimeField() {
  return captureAppointmentTimeField({
    scheduleState: state.newLeadSchedule,
    service: selectedNewLeadService(),
    profile: state.profile
  });
}

function isMeiProfile(profile = state.profile) {
  return profile?.roleProfileId === 'system-mei';
}

function captureStoreIds(profile = state.profile) {
  return profileStoreIds(profile).filter((storeId) => STORES.some((store) => store.id === storeId));
}

function requiresCaptureStoreChoice(profile = state.profile) {
  return profile?.role === 'admin' || isMeiProfile(profile) || captureStoreIds(profile).length > 1;
}

function selectedNewLeadStoreId() {
  return state.newLeadSchedule.storeId
    || (requiresCaptureStoreChoice() ? '' : state.profile?.storeId || '');
}

function newLeadCaptureProfile() {
  return { ...state.profile, storeId: selectedNewLeadStoreId() };
}

function selectedNewLeadService() {
  const storeId = selectedNewLeadStoreId();
  const available = servicesForStore(state.newLeadSchedule.services, storeId);
  return available.find((service) => service.id === state.newLeadSchedule.serviceId)
    || available[0]
    || defaultAppointmentService(storeId, state.newLeadSchedule.settings.appointmentDurationMinutes);
}

function newLeadView() {
  const selectedStoreId = selectedNewLeadStoreId();
  return captureView({
    scheduleState: state.newLeadSchedule,
    offlineCaptureEnabled: state.offlineCapture.enabled,
    selectedStoreId,
    allowedStoreIds: captureStoreIds(),
    storeChoice: requiresCaptureStoreChoice(),
    selectedService: selectedNewLeadService(),
    appointmentTimeMarkup: appointmentTimeField()
  });
}

function leadsView() {
  return renderLeadsView({
    leads: state.leads.map(withManualSaleStatus),
    filters: state.leadFilters,
    allowedStores: isAdmin() ? STORES : STORES.filter((store) => captureStoreIds().includes(store.id)),
    dataError: state.dataError,
    canCreate: hasAccess('leads.create')
  });
}

function leadSearchView() {
  return renderLeadSearchView({ search: state.leadSearch });
}

function followUpsView() {
  const managerView = hasAccess('followups.team');
  return renderFollowUpsView({
    allowed: hasAccess('followups.own') || managerView,
    managerView,
    adminView: isAdmin(),
    allRecords: pendingFollowUps(),
    activeFilter: state.followUps.filter,
    selectedCaptorId: state.followUps.selectedCaptorId,
    settings: state.followUps.settings,
    settingsByStore: state.followUps.settingsByStore,
    profileName: state.profile?.displayName,
    error: state.followUps.error,
    truncated: state.followUps.truncated
  });
}

function findManagementLead(leadId) {
  const lead = selectManagementLead(leadId, {
    records: state.management.records,
    appointments: state.appointments.records,
    activeLead: state.management.activeLead
  });
  return withManualSaleStatus(lead);
}

function withManualSaleStatus(lead) {
  if (!lead?.id) return lead;
  const status = state.saleStatuses.find((item) => item.id === lead.id);
  return status ? {
    ...lead,
    saleStatus: status.saleStatus,
    saleDate: status.saleDate,
    purchaseCount: Number(status.purchaseCount || (status.saleStatus === 'confirmed' ? 1 : 0)),
    purchaseTotal: Number(status.purchaseTotal || 0)
  } : lead;
}

function selectedLeadDetailService(lead) {
  return resolveLeadDetailService(lead, state.leadDetailSchedule);
}

function leadDetailAppointmentTimeField(lead) {
  return renderLeadDetailAppointmentTimeField({
    lead,
    scheduleState: state.leadDetailSchedule,
    profile: state.profile
  });
}

function leadDetailView() {
  const managementMode = state.route === 'management-lead';
  const leadId = currentRouteParam();
  const lead = managementMode
    ? findManagementLead(leadId)
    : withManualSaleStatus(state.leads.find((item) => item.id === leadId));
  const readOnly = Boolean(lead
    && lead.capturedByUid !== state.profile?.uid
    && !hasAccess('leads.edit_all'));
  return renderLeadDetailView({
    lead,
    managementMode,
    canManage: canManage(),
    profileRole: state.profile?.role,
    scheduleState: state.leadDetailSchedule,
    appointmentTimeMarkup: lead ? leadDetailAppointmentTimeField(lead) : '',
    canDelete: hasAccess('leads.delete'),
    canCancelAppointment: canCancelAppointment(state.profile, lead),
    canEditClinical: hasAccess('leads.clinical_update'),
    canClaimLead: canClaimCancelledLead(state.profile, lead),
    canTransferLead: canTransferLead(state.profile, lead),
    canConfirmSale: canConfirmManualSale(state.profile, lead),
    readOnly,
    history: state.leadHistory
  });
}

function leadDetailDialogView() {
  const leadId = state.leadDetailDialog.leadId;
  if (!leadId) return '';
  const lead = findManagementLead(leadId);
  if (!lead) return '';
  return `<dialog id="lead-detail-dialog" class="lead-detail-dialog">${renderLeadDetailView({
    lead,
    managementMode: true,
    canManage: canManage(),
    profileRole: state.profile?.role,
    scheduleState: state.leadDetailSchedule,
    appointmentTimeMarkup: leadDetailAppointmentTimeField(lead),
    canDelete: hasAccess('leads.delete'),
    canCancelAppointment: canCancelAppointment(state.profile, lead),
    canEditClinical: hasAccess('leads.clinical_update'),
    canClaimLead: canClaimCancelledLead(state.profile, lead),
    canTransferLead: canTransferLead(state.profile, lead),
    canConfirmSale: canConfirmManualSale(state.profile, lead),
    inDialog: true,
    history: state.leadHistory
  })}</dialog>`;
}

function leadHistoryDialogView() {
  if (!state.leadHistoryDialogOpen) return '';
  const lead = existingLeadForDetail(activeLeadDetailId());
  if (!lead) return '';
  return `<dialog id="lead-history-dialog" class="lead-history-dialog" aria-labelledby="lead-history-dialog-title"><header><div><h2 id="lead-history-dialog-title">Histórico do lead</h2><p>${escapeHtml(lead.fullName)}</p></div><div class="lead-history-dialog-actions"><button class="icon-button" type="button" data-close-lead-history title="Fechar" aria-label="Fechar histórico"><i data-lucide="x"></i></button></div></header><div class="lead-history-dialog-body">${leadHistoryView({ ...state.leadHistory, stage: lead.funnelStage || state.leadHistory.stage }, { lead })}</div></dialog>`;
}

function manualSaleLead() {
  const leadId = state.saleConfirmation.leadId;
  const listedLead = [...state.leads, ...state.management.records, ...state.appointments.records]
    .find((item) => item.id === leadId);
  const activeLead = state.management.activeLead?.id === leadId ? state.management.activeLead : null;
  return withManualSaleStatus(listedLead || activeLead);
}

function manualSaleDialogView() {
  return renderManualSaleDialog({ state: { ...state.saleConfirmation, profileUid: state.profile?.uid }, lead: manualSaleLead() });
}

function applyManualSaleUpdate(updated) {
  if (!updated?.id) return;
  const replace = (records = []) => records.map((item) => item.id === updated.id ? { ...item, ...updated } : item);
  state.leads = replace(state.leads);
  state.management.records = replace(state.management.records);
  state.appointments.records = replace(state.appointments.records);
  state.confirmations.records = replace(state.confirmations.records);
  state.followUps.records = replace(state.followUps.records);
  state.saleStatuses = [
    ...state.saleStatuses.filter((item) => item.id !== updated.id),
    { id: updated.id, leadId: updated.id, storeId: updated.storeId, capturedByUid: updated.capturedByUid, saleStatus: updated.saleStatus, saleDate: updated.saleDate, purchaseCount: updated.purchaseCount, purchaseTotal: updated.purchaseTotal }
  ];
  if (state.management.activeLead?.id === updated.id) state.management.activeLead = { ...state.management.activeLead, ...updated };
}

function closeManualSaleDialog() {
  state.saleConfirmation = { leadId: '', loading: false, saving: false, error: '', record: null, editingId: '', formOpen: false };
  render();
}

function closeManualSaleForm() {
  state.saleConfirmation.formOpen = false;
  state.saleConfirmation.editingId = '';
  state.saleConfirmation.error = '';
  render();
}

function isDialogBackdropClick(event, dialog) {
  if (event.target !== dialog) return false;
  const bounds = dialog.getBoundingClientRect();
  return event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;
}

function leadAssignmentDialogView() {
  const lead = existingLeadForDetail(state.leadAssignment.leadId);
  return renderLeadAssignmentDialog({ assignment: state.leadAssignment, lead });
}

function closeLeadAssignmentDialog() {
  state.leadAssignment = {
    leadId: '', mode: '', loading: false, saving: false,
    error: '', members: [], targetUid: ''
  };
  render();
}

function applyLeadOwnerUpdate(updated) {
  const replace = (item) => item.id === updated.id ? { ...item, ...updated } : item;
  state.leads = state.leads.map(replace);
  state.management.records = state.management.records.map(replace);
  state.appointments.records = state.appointments.records.map(replace);
  state.confirmations.records = state.confirmations.records.map(replace);
  state.leadSearch.results = state.leadSearch.results.map(replace);
  if (state.management.activeLead?.id === updated.id) state.management.activeLead = { ...state.management.activeLead, ...updated };
}

function findLeadForAppointmentCancellation(leadId) {
  return [
    ...appointmentRecords(),
    ...state.leads,
    ...state.management.records,
    state.management.activeLead
  ].find((lead) => lead?.id === leadId) || null;
}

function appointmentCancellationDialogView() {
  const lead = findLeadForAppointmentCancellation(state.appointments.cancellationLeadId);
  return appointmentCancellationDialog({ lead, saving: state.appointments.cancellationSaving });
}

function appointmentRescheduleDialogView() {
  const lead = findLeadForAppointmentCancellation(state.appointments.rescheduleLeadId);
  return appointmentRescheduleDialog({
    lead,
    draft: state.appointments.rescheduleDraft,
    saving: state.appointments.rescheduleSaving,
    error: state.appointments.rescheduleError
  });
}

function isLeadDetailOpen() {
  return ['lead', 'management-lead'].includes(state.route) || Boolean(state.leadDetailDialog.leadId);
}

function activeLeadDetailId() {
  return state.leadDetailDialog.leadId || currentRouteParam();
}

function openLeadDetailDialog(lead) {
  if (!lead) return;
  state.management.activeLead = lead;
  state.leadDetailDialog.leadId = lead.id;
  state.leadDetailSchedule.leadId = '';
  render();
  ensureLeadDetailSchedule();
  ensureLeadDetailHistory();
}

function closeLeadDetailDialog() {
  if (!state.leadDetailDialog.leadId) return;
  state.leadDetailDialog.leadId = '';
  state.leadHistoryDialogOpen = false;
  state.leadDetailSchedule.leadId = '';
  state.unsubscribeDayAppointments?.();
  state.unsubscribeDayAppointments = null;
  stopLeadHistorySubscription(state);
  state.leadHistory = { leadId: '', profileUid: '', loading: false, error: '', records: [], stage: '' };
  render();
}

function managementView() {
  const allowedStores = isAdmin() ? STORES : STORES.filter((store) => profileStoreIds(state.profile).includes(store.id));
  return renderManagementView({
    allowed: canManage(),
    management: state.management,
    allowedStores,
    adminView: isAdmin(),
    canOpenLead: hasAccess('leads.edit_all'),
    permissions: {
      appointments: hasAccess('appointments.view'),
      followUps: hasAccess('followups.team'),
      kanban: canManage(),
      dashboard: hasAccess('dashboard.view'),
      export: hasAccess('leads.export'),
      archive: hasAccess('leads.delete')
    },
    queryLimit: MANAGEMENT_QUERY_LIMIT
  });
}

function kanbanView() {
  return renderKanbanView({
    allowed: canManage(),
    records: filteredManagementRecords(),
    loading: state.management.loading,
    error: state.management.error,
    truncated: state.management.truncated
  });
}
function dashboardView() {
  const source = state.management.records;
  const periodFilters = { ...state.management.filters, storeId: '', capturedByUid: '' };
  const comparisonRecords = filterDashboardRecords(source, periodFilters);
  const records = filterDashboardRecords(comparisonRecords, {
    startDate: '',
    endDate: '',
    storeId: state.dashboardFilters.storeId,
    capturedByUid: ''
  });
  const upcomingRecords = filterDashboardRecords(
    state.dashboardUpcoming.records,
    { startDate: '', endDate: '', storeId: state.dashboardFilters.storeId, capturedByUid: '' }
  );
  const rankingRecords = comparisonRecords;
  const rankingStores = isAdmin()
    ? STORES
    : STORES.filter((store) => profileStoreIds(state.profile).includes(store.id));
  return renderDashboardView({
    allowed: hasAccess('dashboard.view'),
    records: comparisonRecords,
    metrics: dashboardMetrics(records, upcomingRecords, storeLabel, new Date(), comparisonRecords),
    management: {
      ...state.management,
      filters: { ...state.management.filters, storeId: state.dashboardFilters.storeId }
    },
    allowedStores: rankingStores,
    ranking: {
      ...state.dashboardRanking,
      captors: dashboardCaptorStats(rankingRecords, state.dashboardRanking.storeId),
      stores: rankingStores
    },
    upcoming: state.dashboardUpcoming,
    savwin: state.savwin,
    savwinEnabled: isLocalSavwinEnabled,
    managementLimit: MANAGEMENT_QUERY_LIMIT,
    appointmentsLimit: APPOINTMENTS_QUERY_LIMIT
  });
}
function appointmentRecords() {
  return state.appointments.records.map(withManualSaleStatus);
}

function allowedAppointmentStores() {
  return isAdmin() ? STORES : STORES.filter((store) => profileStoreIds(state.profile).includes(store.id));
}

function appointmentsView() {
  const canCreate = hasAccess('leads.create');
  return renderAppointmentsView({
    allowed: hasAccess('appointments.view'),
    appointments: state.appointments,
    records: appointmentRecords(),
    allowedStores: allowedAppointmentStores(),
    backRoute: canManage() ? 'management' : 'home',
    canCreate,
    canMarkAttendance: hasAccess('appointments.attendance'),
    adminView: hasAccess('leads.edit_all'),
    createDialog: canCreate ? appointmentCreateDialog(allowedAppointmentStores()) : '',
    queryLimit: APPOINTMENTS_QUERY_LIMIT
  });
}

function confirmationsView() {
  return renderConfirmationsView({
    allowed: hasAccess('appointments.confirmations'),
    source: state.confirmations.records,
    confirmations: state.confirmations,
    profileName: state.profile?.displayName || '',
    queryLimit: APPOINTMENTS_QUERY_LIMIT
  });
}

function allowedWalkInStores() {
  return isAdmin() ? STORES : STORES.filter((store) => profileStoreIds(state.profile).includes(store.id));
}

function selectedWalkInLead() {
  return state.walkIns.searchResults.find((lead) => lead.id === state.walkIns.selectedLeadId) || null;
}

function walkInsView() {
  return renderWalkInsView({
    walkIns: state.walkIns,
    selectedLead: selectedWalkInLead(),
    allowedStores: allowedWalkInStores(),
    services: state.walkIns.services,
    canCreate: hasAccess('leads.create')
  });
}

function externalOperationsView() {
  const allowedStores = isAdmin() ? STORES : STORES.filter((store) => profileStoreIds(state.profile).includes(store.id));
  return renderExternalOperationsView({
    allowed: hasAccess('external.operations.read'),
    operations: state.externalOperations,
    allowedStores
  });
}
function appointmentCreateSchedule() {
  return resolveAppointmentCreateSchedule(state.appointmentCreate);
}

function appointmentCreateService() {
  return resolveAppointmentCreateService(state.appointmentCreate);
}

function appointmentCreateTimeField() {
  return renderAppointmentCreateTimeField({
    appointmentCreate: state.appointmentCreate,
    selectedDate: state.appointments.selectedDate,
    records: appointmentRecords(),
    profile: state.profile
  });
}

function appointmentCreateDialog(allowedStores) {
  return renderAppointmentCreateDialog({
    allowedStores,
    appointmentCreate: state.appointmentCreate,
    selectedDate: state.appointments.selectedDate,
    records: appointmentRecords(),
    profile: state.profile
  });
}
function settingsView() {
  if (!isAdmin()) {
    return renderSettingsView({ allowed: false, settings: state.settings, content: '' });
  }
  const section = state.settings.section;
  const content = section === 'roles'
    ? roleProfilesSettingsView()
    : section === 'services'
      ? renderServicesView(state.settings)
      : renderScheduleSettingsView(state.settings);
  return renderSettingsView({
    allowed: true,
    settings: state.settings,
    content
  });
}
function roleProfilesSettingsView() {
  return renderRoleProfilesView(state.settings);
}

function accessView() {
  return renderAccessView({
    access: state.access,
    profile: state.profile,
    roleProfiles: state.settings.roleProfiles,
    allowed: isAdmin()
  });
}

function goalsView() {
  return renderGoalsView({ state, isAdmin, canManageGoals });
}

function render() {
  renderApplication({
    state,
    appView,
    loginView,
    canAccessRoute,
    bindPageEvents
  });
}

function lookupCpfAppointment(customerCpf) {
  return checkCpfActiveAppointment(customerCpf);
}

function synchronizePendingRegistrations(announce = false) {
  return synchronizeLifecyclePendingRegistrations(state, { announce, showToast });
}

function handleConnectivityChange() {
  handleLifecycleConnectivityChange({
    state,
    render,
    synchronize: synchronizePendingRegistrations,
    selectedNewLeadStoreId,
    refreshAppointmentTimeControl
  });
}


function bindPageEvents() {
  initializeKanbanScrollbar();
  bindAppointmentListScroll(document.querySelector('.appointment-list'), state.appointments);
  if (state.route === 'external-operations') {
    bindExternalOperationsEvents({ state, render, reload: loadExternalOperationsData, showToast });
  }
  const managementArchiveDialog = document.querySelector('#management-archive-dialog');
  if (managementArchiveDialog) {
    requestAnimationFrame(() => {
      if (!managementArchiveDialog.open) managementArchiveDialog.showModal();
    });
    managementArchiveDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      state.management.archiveOpen = false;
      state.management.archiveSelection = [];
      render();
    });
  }
  const rankingDialog = document.querySelector('#dashboard-ranking-dialog');
  if (rankingDialog) {
    requestAnimationFrame(() => {
      if (!rankingDialog.open) rankingDialog.showModal();
    });
    rankingDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      state.dashboardRanking.open = false;
      render();
    });
    rankingDialog.addEventListener('click', (event) => {
      if (event.target === rankingDialog) {
        state.dashboardRanking.open = false;
        render();
      }
    });
    rankingDialog.querySelector('[data-dashboard-ranking-store]')?.addEventListener('change', (event) => {
      state.dashboardRanking.storeId = event.target.value;
      render();
    });
    rankingDialog.querySelectorAll('[data-dashboard-ranking-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        state.dashboardRanking.sortBy = button.dataset.dashboardRankingSort;
        render();
      });
    });
  }
  const leadDetailDialog = document.querySelector('#lead-detail-dialog');
  if (leadDetailDialog) {
    requestAnimationFrame(() => {
      if (!leadDetailDialog.open) leadDetailDialog.showModal();
    });
    leadDetailDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeLeadDetailDialog();
    });
    leadDetailDialog.addEventListener('click', (event) => {
      if (event.target === leadDetailDialog) closeLeadDetailDialog();
    });
  }
  const leadHistoryDialog = document.querySelector('#lead-history-dialog');
  if (leadHistoryDialog) {
    requestAnimationFrame(() => {
      if (!leadHistoryDialog.open) leadHistoryDialog.showModal();
    });
    leadHistoryDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      state.leadHistoryDialogOpen = false;
      render();
    });
    leadHistoryDialog.addEventListener('click', (event) => {
      if (event.target === leadHistoryDialog) {
        state.leadHistoryDialogOpen = false;
        render();
      }
    });
  }
  const manualSaleDialog = document.querySelector('#manual-sale-dialog');
  if (manualSaleDialog) {
    requestAnimationFrame(() => {
      if (manualSaleDialog.isConnected && !manualSaleDialog.open) manualSaleDialog.showModal();
    });
    manualSaleDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeManualSaleDialog(); });
    manualSaleDialog.addEventListener('click', (event) => {
      if (isDialogBackdropClick(event, manualSaleDialog)) closeManualSaleDialog();
    });
    manualSaleDialog.querySelector('[data-close-manual-sale]')?.addEventListener('click', closeManualSaleDialog);
    manualSaleDialog.querySelectorAll('[data-new-purchase]').forEach((button) => button.addEventListener('click', () => {
      state.saleConfirmation.editingId = '';
      state.saleConfirmation.formOpen = true;
      state.saleConfirmation.error = '';
      render();
    }));
    manualSaleDialog.querySelectorAll('[data-edit-purchase]').forEach((button) => button.addEventListener('click', () => {
      state.saleConfirmation.editingId = button.dataset.editPurchase;
      state.saleConfirmation.formOpen = true;
      state.saleConfirmation.error = '';
      render();
    }));
    manualSaleDialog.querySelectorAll('[data-cancel-purchase]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Cancelar esta compra? O registro permanecera no historico.')) return;
      const lead = manualSaleLead();
      state.saleConfirmation.saving = true;
      try {
        const result = await removeManualSaleConfirmation(state.profile, lead, button.dataset.cancelPurchase);
        applyManualSaleUpdate(result.data);
        state.saleConfirmation.record = await loadLeadSaleTracking(state.profile, result.data);
        state.saleConfirmation.editingId = '';
        state.saleConfirmation.error = '';
        showToast('Compra cancelada. O histórico foi preservado.', 'success', 'undo-2');
      } catch {
        state.saleConfirmation.error = 'Nao foi possivel cancelar a compra.';
      } finally {
        state.saleConfirmation.saving = false;
        render();
      }
    }));
    manualSaleDialog.querySelectorAll('[data-reactivate-purchase]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Reativar esta compra? Ela voltara a entrar nos totais do cliente.')) return;
      const lead = manualSaleLead();
      state.saleConfirmation.saving = true;
      try {
        const result = await reactivateManualSaleConfirmation(state.profile, lead, button.dataset.reactivatePurchase);
        applyManualSaleUpdate(result.data);
        state.saleConfirmation.record = await loadLeadSaleTracking(state.profile, result.data);
        state.saleConfirmation.editingId = '';
        state.saleConfirmation.error = '';
        showToast('Compra reativada e incluida novamente nos totais.', 'success', 'rotate-ccw');
      } catch {
        state.saleConfirmation.error = 'Nao foi possivel reativar a compra.';
      } finally {
        state.saleConfirmation.saving = false;
        render();
      }
    }));
    manualSaleDialog.querySelectorAll('[data-delete-purchase]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Excluir esta compra do historico visivel? A auditoria da exclusao sera preservada.')) return;
      const lead = manualSaleLead();
      state.saleConfirmation.saving = true;
      try {
        const result = await deleteManualSaleConfirmation(state.profile, lead, button.dataset.deletePurchase);
        applyManualSaleUpdate(result.data);
        state.saleConfirmation.record = await loadLeadSaleTracking(state.profile, result.data);
        state.saleConfirmation.editingId = '';
        state.saleConfirmation.error = '';
        showToast('Compra excluida. A auditoria foi preservada.', 'success', 'trash-2');
      } catch {
        state.saleConfirmation.error = 'Nao foi possivel excluir a compra.';
      } finally {
        state.saleConfirmation.saving = false;
        render();
      }
    }));
  }
  const manualSaleFormDialog = document.querySelector('#manual-sale-form-dialog');
  if (manualSaleFormDialog) {
    requestAnimationFrame(() => {
      if (manualSaleFormDialog.isConnected && !manualSaleFormDialog.open) manualSaleFormDialog.showModal();
    });
    manualSaleFormDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeManualSaleForm(); });
    manualSaleFormDialog.addEventListener('click', (event) => {
      if (isDialogBackdropClick(event, manualSaleFormDialog)) closeManualSaleForm();
    });
    manualSaleFormDialog.querySelector('[data-close-purchase-form]')?.addEventListener('click', closeManualSaleForm);
    const saleForm = manualSaleFormDialog.querySelector('#manual-sale-form');
    saleForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const lead = manualSaleLead();
      const values = Object.fromEntries(new FormData(saleForm));
      const validation = validateManualSale(values);
      if (!validation.isValid) {
        revealFirstFormError(setFieldErrors(saleForm, validation.errors));
        return;
      }
      state.saleConfirmation.saving = true;
      saleForm.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      try {
        const result = await confirmManualSale(state.profile, lead, validation.data, state.saleConfirmation.editingId);
        if (!result.isValid) {
          revealFirstFormError(setFieldErrors(saleForm, result.errors));
          return;
        }
        applyManualSaleUpdate(result.data);
        state.saleConfirmation.record = await loadLeadSaleTracking(state.profile, result.data);
        state.saleConfirmation.editingId = '';
        state.saleConfirmation.formOpen = false;
        state.saleConfirmation.error = '';
        showToast('Compra registrada e vinculada ao colaborador.', 'success', 'badge-check');
      } catch (error) {
        state.saleConfirmation.error = error?.code === 'permission-denied'
          ? 'Seu perfil nao pode confirmar esta compra.'
          : error?.code === 'offline' ? 'Conecte-se para confirmar a compra.' : 'Nao foi possivel salvar a confirmacao.';
      } finally {
        state.saleConfirmation.saving = false;
        render();
      }
    });
  }
  const form = document.querySelector('#lead-form');
  if (form) {
    initializeCaptureForm(form, {
      draft: state.newLeadSchedule.draft,
      settings: state.newLeadSchedule.settings,
      controlsEnabled: Boolean(selectedNewLeadStoreId() && state.newLeadSchedule.loaded),
      onStoreChange: (storeId) => {
        if (!captureStoreIds().includes(storeId)) return;
        state.newLeadSchedule.draft = state.newLeadSchedule.loaded
          ? captureNewLeadDraft(form)
          : state.newLeadSchedule.draft;
        stopNewLeadScheduleSubscriptions();
        state.newLeadSchedule.storeId = storeId;
        state.newLeadSchedule.loaded = false;
        state.newLeadSchedule.loading = false;
        state.newLeadSchedule.error = '';
        state.newLeadSchedule.settings = { ...DEFAULT_STORE_SCHEDULE };
        state.newLeadSchedule.appointmentDate = '';
        state.newLeadSchedule.appointments = [];
        state.newLeadSchedule.serviceId = '';
        state.newLeadSchedule.triage = {};
        render();
        ensureNewLeadSchedule();
      },
      onServiceChange: (serviceId) => {
        state.newLeadSchedule.serviceId = serviceId;
        const service = selectedNewLeadService();
        form.elements.appointmentServiceName.value = service.name;
        form.elements.appointmentDurationMinutes.value = service.durationMinutes;
        refreshAppointmentTimeControl();
      },
      onAppointmentDateChange: (appointmentDate) => {
        state.newLeadSchedule.appointmentDate = appointmentDate;
        startDayAppointmentsSubscription();
      },
      onTriageChange: (values) => {
        state.newLeadSchedule.triage = values;
        refreshAppointmentTimeControl();
      },
      onTransportChange: (values) => {
        state.newLeadSchedule.triage = values;
        refreshAppointmentTimeControl();
      }
    });
    const cpfAppointmentCheck = bindCpfAppointmentWarning(form, { lookup: lookupCpfAppointment });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!navigator.onLine && !state.offlineCapture.enabled) {
        showToast('O cadastro offline está desativado. Reconecte-se para salvar.', 'danger', 'wifi-off');
        return;
      }
      const rawValues = leadFormValues(form);
      const storeId = rawValues.storeId;
      if (!captureStoreIds().includes(storeId)) {
        const field = setFieldErrors(form, { storeId: 'Selecione uma loja permitida.' });
        showToast('Selecione a loja de destino para continuar.', 'danger', 'circle-alert');
        revealFirstFormError(field);
        return;
      }
      if (!navigator.onLine) {
        rawValues.appointmentDate = '';
        rawValues.appointmentTime = '';
      }
      const values = enrichLeadTriage(rawValues, state.newLeadSchedule.settings);
      if (navigator.onLine && await cpfAppointmentCheck.checkNow()) {
        const confirmed = await confirmDuplicateCpfAppointment(document.querySelector('#cpf-appointment-confirmation'));
        if (!confirmed) {
          form.elements.customerCpf?.focus();
          return;
        }
      }
      const controlledAppointment = values.schedulingMode === 'controlled' && values.appointmentDate && values.appointmentTime;
      if (state.newLeadSchedule.settings.schedulingMode === 'controlled' && values.appointmentDate && values.appointmentTime) {
        const selectedSlot = buildAppointmentSlots({
          ...careRouteAppointmentSchedule(state.newLeadSchedule.settings, values.careRoute),
          appointmentDurationMinutes: Number(values.appointmentDurationMinutes)
        }, state.newLeadSchedule.appointments, '', {
          appointmentDate: values.appointmentDate,
          profile: { ...state.profile, storeId }
        })
          .find((slot) => slot.time === values.appointmentTime);
        if (!selectedSlot?.available) {
          const field = setFieldErrors(form, { appointmentTime: 'Este horário não está mais disponível. Escolha outro.' });
          showToast('O horário escolhido não está mais disponível.', 'danger', 'circle-alert');
          revealFirstFormError(field);
          startDayAppointmentsSubscription();
          return;
        }
      }
      const submitButton = form.querySelector('[type="submit"]');
      submitButton.disabled = true;
      let result;
      try {
        result = saveLead(values, { ...state.profile, storeId }, () => {});
      } catch {
        submitButton.disabled = false;
        showToast(
          navigator.onLine ? 'Não foi possível preparar este cadastro.' : 'Não foi possível salvar o cadastro neste aparelho.',
          'danger',
          'circle-alert'
        );
        return;
      }
      const firstInvalidField = setFieldErrors(form, result.errors || {});
      if (!result.isValid) {
        submitButton.disabled = false;
        showToast('Revise os campos destacados antes de salvar.', 'danger', 'circle-alert');
        revealFirstFormError(firstInvalidField);
        return;
      }
      if (result.localSavePromise) {
        try {
          await result.localSavePromise;
        } catch {
          submitButton.disabled = false;
          showToast('Não foi possível salvar o cadastro neste aparelho.', 'danger', 'circle-alert');
          return;
        }
      }
      if (result.writePromise) {
        try {
          await result.writePromise;
        } catch (error) {
          submitButton.disabled = false;
          if (controlledAppointment) {
            const field = setFieldErrors(form, { appointmentTime: 'Não foi possível confirmar este horário. Atualize e escolha novamente.' });
            revealFirstFormError(field);
            startDayAppointmentsSubscription();
          }
          const message = error?.code === 'permission-denied'
            ? 'O cadastro não foi aceito pelo servidor. Seus dados foram mantidos; atualize a página e tente novamente.'
            : 'Não foi possível salvar o cadastro. Verifique a conexão e tente novamente.';
          showToast(message, 'danger', 'circle-alert');
          return;
        }
      }
      form.reset();
      state.newLeadSchedule.draft = {};
      navigate('leads');
      showToast(navigator.onLine
        ? 'Cadastro salvo com sucesso.'
        : 'Cadastro salvo neste aparelho. Ele será sincronizado quando a internet voltar.');
    });
  }

  const editLeadForm = document.querySelector('#edit-lead-form');
  if (editLeadForm) {
    initializeLeadDetailForm(editLeadForm, {
      settings: state.leadDetailSchedule.settings,
      onServiceChange: (serviceId) => {
        state.leadDetailSchedule.serviceId = serviceId;
        const service = selectedLeadDetailService(existingLeadForDetail());
        editLeadForm.elements.appointmentServiceName.value = service.name;
        editLeadForm.elements.appointmentDurationMinutes.value = service.durationMinutes;
        refreshLeadDetailAppointmentTime(existingLeadForDetail());
      },
      onAppointmentDateChange: (appointmentDate) => {
        state.leadDetailSchedule.appointmentDate = appointmentDate;
        startLeadDetailDayAppointmentsSubscription(existingLeadForDetail());
      },
      onTriageChange: (values) => {
        state.leadDetailSchedule.triage = values;
        refreshLeadDetailAppointmentTime(existingLeadForDetail());
      }
    });
    if (editLeadForm.dataset.readOnly === 'true') {
      editLeadForm.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((control) => {
        control.disabled = true;
      });
    }
    editLeadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (editLeadForm.dataset.readOnly === 'true') return;
      if (!navigator.onLine) {
        showToast('Conecte-se à internet para alterar ou agendar este cadastro.', 'danger', 'wifi-off');
        return;
      }
      const managementEdit = editLeadForm.dataset.management === 'true';
      const existingLead = managementEdit
        ? findManagementLead(editLeadForm.dataset.leadId)
        : state.leads.find((lead) => lead.id === editLeadForm.dataset.leadId);
      const values = leadDetailSubmissionValues(editLeadForm, existingLead, state.leadDetailSchedule.settings, {
        managerReschedule: managementEdit && state.profile?.role === 'manager'
      });
      const scheduleChanged = hasAppointmentScheduleChanged(existingLead, values);
      const appointmentChanged = existingLead?.appointmentDate && existingLead?.appointmentTime
        && scheduleChanged;
      if (appointmentChanged
        && existingLead.appointmentAttendance !== 'attended') {
        const scheduleValidation = validateRescheduleSchedule(values);
        if (!scheduleValidation.isValid) {
          const field = setFieldErrors(editLeadForm, scheduleValidation.errors);
          revealFirstFormError(field);
          return;
        }
        state.appointments.rescheduleLeadId = existingLead.id;
        state.appointments.rescheduleDraft = values;
        state.appointments.rescheduleSaving = false;
        state.appointments.rescheduleError = '';
        render();
        return;
      }
      const submitButton = editLeadForm.querySelector('[type="submit"]');
      submitButton.disabled = true;

      if (managementEdit) {
        try {
          const result = await updateManagementLead(state.profile, existingLead, values);
          setFieldErrors(editLeadForm, result.errors || {});
          if (!result.isValid) {
            submitButton.disabled = false;
            return;
          }
          state.management.records = state.management.records.map((lead) => lead.id === editLeadForm.dataset.leadId
            ? { ...lead, ...result.data }
            : lead);
          state.appointments.records = state.appointments.records.map((lead) => lead.id === editLeadForm.dataset.leadId
            ? { ...lead, ...result.data }
            : lead);
          state.management.activeLead = existingLead
            ? { ...existingLead, ...result.data }
            : state.management.activeLead;
          if (state.leadDetailDialog.leadId) closeLeadDetailDialog();
          else navigate('management');
          showToast('Lead atualizado com sucesso.');
        } catch (error) {
          submitButton.disabled = false;
          showToast(error?.code === 'permission-denied' ? 'Seu perfil não pode alterar este lead.' : 'Não foi possível atualizar o lead.', 'danger', 'circle-alert');
        }
        return;
      }

      const result = updateLead(editLeadForm.dataset.leadId, values, () => {
        if (!values.appointmentDate || !values.appointmentTime) {
          state.dataError = 'A correção não foi aceita pela nuvem. Verifique o acesso e tente novamente.';
          render();
        }
      }, existingLead, {
        appointmentOnly: !hasAccess('leads.edit_own')
          || (scheduleChanged && !leadDetailHasNonAppointmentChanges(editLeadForm)),
        profile: state.profile
      });
      setFieldErrors(editLeadForm, result.errors || {});
      if (!result.isValid) {
        submitButton.disabled = false;
        if (result.notFound) navigate('leads');
        return;
      }
      if (values.appointmentDate && values.appointmentTime && result.writePromise) {
        try {
          await result.writePromise;
        } catch (error) {
          submitButton.disabled = false;
          if (error?.code === 'appointment-slot-unavailable') {
            const field = setFieldErrors(editLeadForm, { appointmentTime: 'Este horário acabou de ser ocupado. Escolha outro.' });
            showToast('O horário escolhido acabou de ser ocupado.', 'danger', 'circle-alert');
            revealFirstFormError(field);
            startLeadDetailDayAppointmentsSubscription(existingLeadForDetail());
          } else if (error?.code === 'permission-denied') {
            showToast('Seu perfil não possui permissão para alterar este cadastro.', 'danger', 'circle-alert');
          } else {
            showToast('Não foi possível salvar o agendamento. Verifique a conexão e tente novamente.', 'danger', 'circle-alert');
          }
          return;
        }
      }
      if (state.leadDetailDialog.leadId) closeLeadDetailDialog();
      else navigate('leads');
      showToast(values.appointmentDate ? 'Agendamento salvo com sucesso.' : 'Alterações salvas com sucesso.');
    });
  }

  const cancellationDialog = document.querySelector('#appointment-cancellation-dialog');
  if (cancellationDialog) {
    requestAnimationFrame(() => {
      if (cancellationDialog.isConnected && !cancellationDialog.open) cancellationDialog.showModal();
    });
    initializeAppointmentCancellationDialog(cancellationDialog, {
      close: () => {
        state.appointments.cancellationLeadId = '';
        state.appointments.cancellationSaving = false;
        render();
      },
      submit: async (values) => {
        const lead = findLeadForAppointmentCancellation(state.appointments.cancellationLeadId);
        if (!lead || state.appointments.cancellationSaving) return;
        const validation = validateAppointmentCancellation(values);
        if (!validation.isValid) {
          const firstInvalidField = setFieldErrors(cancellationDialog.querySelector('form'), validation.errors);
          revealFirstFormError(firstInvalidField);
          return;
        }
        state.appointments.cancellationSaving = true;
        state.appointments.updatingId = lead.id;
        render();
        try {
          await cancelAppointment(state.profile, lead, validation.data);
          const cancelled = {
            appointmentStatus: 'cancelled',
            appointmentAttendance: 'cancelled',
            appointmentCancellationReason: validation.data.reason,
            appointmentCancellationDetails: validation.data.details
          };
          state.leads = state.leads.map((item) => item.id === lead.id ? { ...item, ...cancelled } : item);
          state.management.records = state.management.records.map((item) => item.id === lead.id ? { ...item, ...cancelled } : item);
          state.appointments.records = state.appointments.records.map((item) => item.id === lead.id ? { ...item, ...cancelled } : item);
          state.confirmations.records = state.confirmations.records.map((item) => item.id === lead.id ? { ...item, ...cancelled } : item);
          if (state.management.activeLead?.id === lead.id) state.management.activeLead = { ...state.management.activeLead, ...cancelled };
          state.appointments.cancellationLeadId = '';
          showToast('Agendamento cancelado e horário liberado.');
        } catch (error) {
          showToast(error?.code === 'permission-denied'
            ? 'Seu perfil não pode cancelar este agendamento.'
            : 'Não foi possível cancelar o agendamento. Tente novamente.', 'danger', 'circle-alert');
        } finally {
          state.appointments.cancellationSaving = false;
          state.appointments.updatingId = '';
          render();
        }
      }
    });
  }
  const leadAssignmentDialog = document.querySelector('#lead-assignment-dialog');
  if (leadAssignmentDialog) {
    requestAnimationFrame(() => {
      if (leadAssignmentDialog.isConnected && !leadAssignmentDialog.open) leadAssignmentDialog.showModal();
    });
    leadAssignmentDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (!state.leadAssignment.saving) closeLeadAssignmentDialog();
    });
    leadAssignmentDialog.querySelector('#lead-assignment-target')?.addEventListener('change', (event) => {
      state.leadAssignment.targetUid = event.target.value;
      render();
    });
  }

  const rescheduleDialog = document.querySelector('#appointment-reschedule-dialog');
  if (rescheduleDialog) {
    requestAnimationFrame(() => {
      if (rescheduleDialog.isConnected && !rescheduleDialog.open) rescheduleDialog.showModal();
    });
    initializeAppointmentRescheduleDialog(rescheduleDialog, {
      close: () => {
        state.appointments.rescheduleLeadId = '';
        state.appointments.rescheduleDraft = null;
        state.appointments.rescheduleSaving = false;
        state.appointments.rescheduleError = '';
        render();
      },
      submit: async (reasonValues) => {
        const lead = findLeadForAppointmentCancellation(state.appointments.rescheduleLeadId);
        const draft = state.appointments.rescheduleDraft;
        if (!lead || !draft || state.appointments.rescheduleSaving) return;
        const validation = validateAppointmentReschedule(reasonValues);
        if (!validation.isValid) {
          const field = setFieldErrors(rescheduleDialog.querySelector('form'), validation.errors);
          revealFirstFormError(field);
          return;
        }
        state.appointments.rescheduleSaving = true;
        state.appointments.rescheduleError = '';
        state.appointments.updatingId = lead.id;
        render();
        try {
          const result = await rescheduleAppointment(state.profile, lead, draft, validation.data);
          if (!result.isValid) {
            state.appointments.rescheduleError = 'Revise os dados do agendamento antes de confirmar.';
            return;
          }
          const updated = { ...lead, ...result.data };
          state.leads = state.leads.map((item) => item.id === lead.id ? updated : item);
          state.management.records = state.management.records.map((item) => item.id === lead.id ? updated : item);
          state.appointments.records = state.appointments.records.map((item) => item.id === lead.id ? updated : item);
          state.confirmations.records = state.confirmations.records.map((item) => item.id === lead.id ? updated : item);
          if (state.management.activeLead?.id === lead.id) state.management.activeLead = updated;
          state.appointments.rescheduleLeadId = '';
          state.appointments.rescheduleDraft = null;
          state.appointments.rescheduleError = '';
          if (state.leadDetailDialog.leadId) closeLeadDetailDialog();
          else navigate(state.route === 'management-lead' ? 'management' : 'leads');
          showToast('Agendamento reagendado e histórico atualizado.');
        } catch (error) {
          state.appointments.rescheduleError = error?.code === 'permission-denied'
            ? 'Seu perfil não pode reagendar este atendimento.'
            : error?.code === 'appointment-slot-unavailable'
              ? 'Este horário acabou de ser ocupado. Escolha outro.'
              : 'Não foi possível reagendar. Verifique os dados e tente novamente.';
          showToast(state.appointments.rescheduleError, 'danger', 'circle-alert');
        } finally {
          state.appointments.rescheduleSaving = false;
          state.appointments.updatingId = '';
          render();
        }
      }
    });
  }

  const deleteLeadDialog = document.querySelector('#delete-lead-dialog');
  deleteLeadDialog?.addEventListener('click', (event) => {
    if (event.target === deleteLeadDialog) deleteLeadDialog.close();
  });

  const leadFilters = document.querySelector('[data-lead-filters]');
  if (leadFilters) {
    const queryInput = leadFilters.querySelector('#lead-search');
    const storeInput = leadFilters.querySelector('#lead-store-filter');
    const startInput = leadFilters.querySelector('#lead-start-date');
    const endInput = leadFilters.querySelector('#lead-end-date');
    const saleInput = leadFilters.querySelector('#lead-sale-filter');
    const clearButton = leadFilters.querySelector('[data-lead-filters-clear]');
    const applyLeadFilters = () => {
      state.leadFilters = {
        query: queryInput?.value || '',
        storeId: storeInput?.value || '',
        startDate: startInput?.value || '',
        endDate: endInput?.value || '',
        saleStatus: saleInput?.value || ''
      };
      const visibleIds = new Set(filterLeadRecords(state.leads, state.leadFilters).map((lead) => lead.id));
      document.querySelectorAll('[data-lead-list-row]').forEach((row) => { row.hidden = !visibleIds.has(row.dataset.openLeadId); });
      const empty = document.querySelector('[data-lead-filter-empty]');
      if (empty) empty.hidden = visibleIds.size > 0;
      const count = document.querySelector('[data-lead-filter-count]');
      if (count) count.textContent = `${visibleIds.size} de ${state.leads.length}`;
      if (clearButton) clearButton.disabled = !Object.values(state.leadFilters).some(Boolean);
    };
    queryInput?.addEventListener('input', applyLeadFilters);
    [storeInput, startInput, endInput, saleInput].forEach((input) => input?.addEventListener('change', applyLeadFilters));
    clearButton?.addEventListener('click', () => {
      [queryInput, storeInput, startInput, endInput, saleInput].forEach((input) => { if (input) input.value = ''; });
      applyLeadFilters();
      queryInput?.focus();
    });
  }

  const appointmentSearchForm = document.querySelector('#lead-appointment-search');
  if (appointmentSearchForm) {
    const searchInput = appointmentSearchForm.elements.query;
    searchInput?.addEventListener('input', () => {
      state.leadSearch.query = searchInput.value;
      const error = appointmentSearchForm.querySelector('#lead-search-error');
      if (error) error.textContent = '';
    });
    appointmentSearchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const queryText = String(searchInput?.value || '').trim();
      const validationError = validateLeadSearch(queryText);
      if (validationError) {
        const error = appointmentSearchForm.querySelector('#lead-search-error');
        if (error) error.textContent = validationError;
        searchInput?.focus();
        return;
      }
      state.leadSearch = {
        ...state.leadSearch,
        query: queryText,
        loading: true,
        searched: false,
        error: '',
        results: []
      };
      render();
      try {
        const results = await searchLeadAppointments(queryText);
        state.leadSearch = { ...state.leadSearch, loading: false, searched: true, results };
      } catch (error) {
        const unavailable = ['functions/unavailable', 'functions/deadline-exceeded'].includes(error?.code);
        state.leadSearch = {
          ...state.leadSearch,
          loading: false,
          searched: true,
          error: unavailable
            ? 'A pesquisa está temporariamente indisponível. Tente novamente.'
            : error?.code === 'functions/permission-denied'
              ? 'Seu perfil não possui permissão para esta pesquisa.'
              : error?.message || 'Não foi possível realizar a pesquisa.',
          results: []
        };
      }
      render();
    });
  }

  const walkInSearchForm = document.querySelector('#walk-in-search-form');
  if (walkInSearchForm) {
    const searchInput = walkInSearchForm.elements.query;
    searchInput?.addEventListener('input', () => {
      state.walkIns.searchQuery = searchInput.value;
      const error = walkInSearchForm.querySelector('#walk-in-search-error');
      if (error) error.textContent = '';
    });
    walkInSearchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const queryText = String(searchInput?.value || '').trim();
      const validationError = validateLeadSearch(queryText);
      if (validationError) {
        const error = walkInSearchForm.querySelector('#walk-in-search-error');
        if (error) error.textContent = validationError;
        searchInput?.focus();
        return;
      }
      state.walkIns = {
        ...state.walkIns,
        searchQuery: queryText,
        searchLoading: true,
        searchSearched: false,
        searchError: '',
        searchResults: [],
        selectedLeadId: '',
        quickCreate: false,
        quickDraft: {}
      };
      render();
      try {
        const results = await searchLeadAppointments(queryText);
        state.walkIns = { ...state.walkIns, searchLoading: false, searchSearched: true, searchResults: results };
      } catch (error) {
        state.walkIns = {
          ...state.walkIns,
          searchLoading: false,
          searchSearched: true,
          searchError: error?.code === 'functions/permission-denied'
            ? 'Seu perfil nao possui permissao para pesquisar clientes.'
            : 'Nao foi possivel realizar a pesquisa.',
          searchResults: []
        };
      }
      render();
    });
  }

  const walkInQuickClientForm = document.querySelector('#walk-in-quick-client-form');
  if (walkInQuickClientForm) {
    bindCpfInput(walkInQuickClientForm);
    walkInQuickClientForm.elements.phone?.addEventListener('input', (event) => {
      event.target.value = formatBrazilianPhone(event.target.value);
    });
    walkInQuickClientForm.addEventListener('input', () => {
      state.walkIns.quickDraft = Object.fromEntries(new FormData(walkInQuickClientForm));
    });
  }

  const walkInCreateForm = document.querySelector('#walk-in-create-form');
  if (walkInCreateForm) {
    walkInCreateForm.querySelector('#walk-in-store:not(:disabled)')?.addEventListener('change', (event) => {
      state.walkIns.storeId = event.target.value;
      state.walkIns.serviceId = servicesForStore(state.walkIns.services, event.target.value)[0]?.id || '';
      state.walkIns.broughtByUid = '';
      if (walkInQuickClientForm) state.walkIns.quickDraft = Object.fromEntries(new FormData(walkInQuickClientForm));
      render();
    });
    walkInCreateForm.elements.serviceId?.addEventListener('change', (event) => {
      state.walkIns.serviceId = event.target.value;
    });
    walkInCreateForm.elements.broughtByUid?.addEventListener('change', (event) => {
      state.walkIns.broughtByUid = event.target.value;
    });
    walkInCreateForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!navigator.onLine) {
        showToast('Conecte-se a internet para criar um encaixe.', 'danger', 'wifi-off');
        return;
      }
      const values = Object.fromEntries(new FormData(walkInCreateForm));
      let selectedLead = selectedWalkInLead();
      const quickCreate = state.walkIns.quickCreate === true;
      const quickValues = quickCreate && walkInQuickClientForm
        ? Object.fromEntries(new FormData(walkInQuickClientForm))
        : null;
      if (quickCreate) {
        const quickValidation = validateQuickLeadInput(quickValues || {});
        const firstInvalidQuickField = setFieldErrors(walkInQuickClientForm, quickValidation.errors);
        if (!quickValidation.isValid) {
          state.walkIns.quickDraft = quickValues || {};
          showToast('Revise os dados essenciais do novo cliente.', 'danger', 'circle-alert');
          revealFirstFormError(firstInvalidQuickField);
          return;
        }
      }
      const service = state.walkIns.services.find((item) => item.id === values.serviceId);
      values.leadId = selectedLead?.id || (quickCreate ? 'quick-registration' : '');
      values.storeId = selectedLead?.storeId || values.storeId;
      values.queueDate = toLocalDateInput(new Date());
      values.serviceName = service?.name || '';
      const broughtBy = state.walkIns.captors.find((captor) => captor.uid === values.broughtByUid);
      values.broughtByName = broughtBy?.displayName || '';
      if ((!selectedLead && !quickCreate) || !profileStoreIds(state.profile).includes(values.storeId)) {
        showToast('Selecione um cliente de uma unidade permitida.', 'danger', 'circle-alert');
        return;
      }
      const validation = validateWalkInDraft(values);
      const firstInvalidField = setFieldErrors(walkInCreateForm, validation.errors);
      if (!validation.isValid) {
        showToast('Revise os dados do encaixe antes de adicionar a fila.', 'danger', 'circle-alert');
        revealFirstFormError(firstInvalidField);
        return;
      }
      state.walkIns.quickDraft = quickValues || {};
      state.walkIns.saving = true;
      render();
      try {
        let reusedExistingLead = false;
        if (quickCreate && quickValues.customerCpf) {
          const cpfResults = await searchLeadAppointments(quickValues.customerCpf);
          const cpfDigits = String(quickValues.customerCpf).replace(/\D/g, '');
          const duplicate = cpfResults.find((item) => String(item.customerCpf || '').replace(/\D/g, '') === cpfDigits);
          if (duplicate) {
            if (duplicate.storeId !== values.storeId) {
              const error = new Error('Cadastro localizado em outra unidade.');
              error.code = 'walk-in-duplicate-other-store';
              throw error;
            }
            selectedLead = duplicate;
            values.leadId = duplicate.id;
            reusedExistingLead = true;
          }
        }

        if (quickCreate && !reusedExistingLead) {
          const result = await createQuickWalkIn(state.profile, quickValues, values);
          if (!result.isValid) throw Object.assign(new Error('Dados invalidos.'), { code: 'walk-in-invalid', result });
          selectedLead = result.lead;
          values.leadId = result.lead.id;
        } else {
          const result = await createWalkIn(state.profile, values);
          if (!result.isValid) throw Object.assign(new Error('Dados invalidos.'), { code: 'walk-in-invalid' });
        }
        state.walkIns = {
          ...state.walkIns,
          saving: false,
          selectedLeadId: '',
          searchQuery: '',
          searchSearched: false,
          searchResults: [],
          serviceId: '',
          broughtByUid: '',
          quickCreate: false,
          quickDraft: {}
        };
        showToast(reusedExistingLead
          ? 'O cadastro ja existia e o cliente foi adicionado a fila.'
          : quickCreate
            ? 'Cliente cadastrado e adicionado a fila de encaixes.'
            : 'Cliente adicionado a fila de encaixes.', 'success', 'circle-check');
      } catch (error) {
        state.walkIns.saving = false;
        showToast(error?.code === 'walk-in-already-exists'
          ? 'Este cliente ja possui um encaixe registrado hoje.'
          : error?.code === 'walk-in-duplicate-other-store'
            ? 'Este CPF ja pertence a um cadastro de outra unidade permitida. Selecione o cadastro existente para continuar.'
          : error?.code === 'permission-denied'
            ? 'Seu perfil nao pode criar encaixes nesta unidade.'
            : 'Nao foi possivel adicionar o cliente a fila.', 'danger', 'circle-alert');
      }
      render();
    });
  }

  document.querySelector('#walk-in-store-filter')?.addEventListener('change', (event) => {
    state.walkIns.storeFilter = event.target.value;
    render();
  });

  bindAuthenticationForm({ state, render });

  const managementForm = document.querySelector('#management-filters');
  if (managementForm) {
    initializeManagementFilters(managementForm, {
      submit: (filters) => {
        state.management.filters = filters;
        state.management.page = 1;
        loadManagementData();
      },
      search: (value, selectionStart, selectionEnd) => {
        state.management.filters.search = value;
        state.management.page = 1;
        render();
        const nextSearch = document.querySelector('#management-search');
        nextSearch?.focus();
        nextSearch?.setSelectionRange(selectionStart, selectionEnd);
      },
      change: (name, value) => {
        state.management.filters[name] = value;
        state.management.page = 1;
        render();
      }
    });
  }

  const managementArchiveForm = document.querySelector('#management-archive-form');
  if (managementArchiveForm) {
    managementArchiveForm.querySelector('[data-archive-select-all]')?.addEventListener('change', (event) => {
      state.management.archiveSelection = event.target.checked
        ? filteredManagementRecords().map((lead) => lead.id)
        : [];
      render();
    });
    managementArchiveForm.querySelectorAll('input[name="leadId"]').forEach((input) => {
      input.addEventListener('change', () => {
        state.management.archiveSelection = [...managementArchiveForm.querySelectorAll('input[name="leadId"]:checked')]
          .map((item) => item.value);
        render();
      });
    });
    managementArchiveForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const selectedIds = new Set(state.management.archiveSelection);
      const leads = filteredManagementRecords().filter((lead) => selectedIds.has(lead.id));
      if (!leads.length || state.management.archiveSaving) return;
      state.management.archiveSaving = true;
      render();
      try {
        const archived = await archiveManagementLeads(state.profile, leads);
        state.management.records = state.management.records.filter((lead) => !selectedIds.has(lead.id));
        state.management.archiveOpen = false;
        state.management.archiveSelection = [];
        showToast(`${archived} lead(s) arquivado(s).`, 'success', 'archive');
      } catch (error) {
        showToast(error?.code === 'permission-denied'
          ? 'Seu perfil não tem permissão para arquivar estes leads.'
          : 'Não foi possível arquivar os leads. Tente novamente.', 'danger', 'circle-alert');
      } finally {
        state.management.archiveSaving = false;
        render();
      }
    });
  }

  const dashboardPeriodForm = document.querySelector('#dashboard-period');
  dashboardPeriodForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(dashboardPeriodForm));
    state.management.filters.startDate = values.startDate;
    state.management.filters.endDate = values.endDate;
    state.dashboardFilters.storeId = String(values.storeId || '');
    state.management.loaded = false;
    state.dashboardUpcoming.loaded = false;
    state.management.page = 1;
    state.savwin.error = '';
    state.savwin.result = null;
    loadManagementData();
    loadDashboardUpcomingData();
  });

  const appointmentsStore = document.querySelector('#appointments-store');
  appointmentsStore?.addEventListener('change', () => {
    state.appointments.storeId = appointmentsStore.value;
    state.appointments.listScrollTop = 0;
    state.appointments.loaded = false;
    startAppointmentsSubscription();
  });

  const confirmationDays = document.querySelector('[data-confirmation-days]');
  const updateConfirmationDays = (value) => {
    const days = normalizeConfirmationDays(value);
    if (confirmationDays) confirmationDays.value = String(days);
    if (days === state.confirmations.days) {
      return;
    }
    state.confirmations.days = days;
    state.confirmations.loaded = false;
    state.confirmations.error = '';
    startConfirmationsSubscription();
  };
  confirmationDays?.addEventListener('change', () => updateConfirmationDays(confirmationDays.value));
  document.querySelectorAll('[data-confirmation-days-adjust]').forEach((button) => {
    button.addEventListener('click', () => updateConfirmationDays(state.confirmations.days + Number(button.dataset.confirmationDaysAdjust)));
  });

  const appointmentCreateForm = document.querySelector('#appointment-create-form');
  if (appointmentCreateForm) {
    bindCpfInput(appointmentCreateForm);
    bindPostalCodeInput(appointmentCreateForm);
    bindPostalCodeLookup(appointmentCreateForm);
    bindScoreInput(appointmentCreateForm);
    const cpfAppointmentCheck = bindCpfAppointmentWarning(appointmentCreateForm, { lookup: lookupCpfAppointment });
    bindBirthDateInput(appointmentCreateForm);
    bindProductPaymentFields(appointmentCreateForm);
    bindPurchaseHolderFields(appointmentCreateForm);
    bindExclusiveOptions(appointmentCreateForm, 'ametropiaIds');
    bindExclusiveOptions(appointmentCreateForm, 'pathologyIds');
    const refreshCreateTimeField = (values) => {
      state.appointmentCreate.draft = values;
      const timeField = document.querySelector('#appointment-create-time-field');
      if (timeField) timeField.outerHTML = appointmentCreateTimeField();
    };
    bindEyeTriage(appointmentCreateForm, appointmentCreateSchedule(), refreshCreateTimeField);
    bindTransportFields(appointmentCreateForm, appointmentCreateSchedule(), refreshCreateTimeField);
    initializeAppointmentCreateEvents(appointmentCreateForm, {
      formatPhone: (input) => { input.value = formatBrazilianPhone(input.value); },
      updateNotesCount: (length) => {
        const counter = document.querySelector('#agenda-notes-count');
        if (counter) counter.textContent = length;
      },
      changeStore: (storeId, form) => {
        state.appointmentCreate.draft = leadFormValues(form);
        state.appointmentCreate.storeId = storeId;
        const schedule = appointmentCreateSchedule();
        if (!servicesForStore(state.appointmentCreate.services, storeId).length) {
          state.appointmentCreate.services.push(defaultAppointmentService(storeId, schedule.appointmentDurationMinutes));
        }
        state.appointmentCreate.serviceId = servicesForStore(state.appointmentCreate.services, storeId)[0]?.id || '';
        render();
        document.querySelector('#appointment-create-dialog')?.showModal();
      },
      changeService: (serviceId, form) => {
        state.appointmentCreate.serviceId = serviceId;
        const service = appointmentCreateService();
        form.elements.appointmentServiceName.value = service.name;
        form.elements.appointmentDurationMinutes.value = service.durationMinutes;
        const timeField = document.querySelector('#appointment-create-time-field');
        if (timeField) timeField.outerHTML = appointmentCreateTimeField();
      },
      submit: async (form) => {
        const values = enrichLeadTriage(leadFormValues(form), appointmentCreateSchedule());
        const storeId = form.elements.storeId.value;
        if (!profileStoreIds(state.profile).includes(storeId)) {
          setFieldErrors(form, { storeId: 'Selecione uma loja permitida.' });
          return;
        }
        if (navigator.onLine && await cpfAppointmentCheck.checkNow()) {
          const confirmed = await confirmDuplicateCpfAppointment(document.querySelector('#cpf-appointment-confirmation'));
          if (!confirmed) {
            form.elements.customerCpf?.focus();
            return;
          }
        }
        state.appointmentCreate.saving = true;
        const submitButton = form.querySelector('[type="submit"]');
        submitButton.disabled = true;
        const result = saveLead(values, { ...state.profile, storeId }, () => {
          state.appointmentCreate.error = 'O cadastro não foi aceito pela nuvem.';
          render();
        });
        setFieldErrors(form, result.errors || {});
        if (!result.isValid) {
          state.appointmentCreate.saving = false;
          submitButton.disabled = false;
          return;
        }
        try {
          if (result.writePromise) await result.writePromise;
          document.querySelector('#appointment-create-dialog')?.close();
          state.appointmentCreate.saving = false;
          state.appointmentCreate.error = '';
          showToast('Cadastro adicionado a agenda.');
        } catch {
          state.appointmentCreate.saving = false;
          setFieldErrors(form, { appointmentTime: 'Este horário acabou de ser ocupado. Escolha outro.' });
          submitButton.disabled = false;
        }
      }
    });
  }
  bindAccessEvents({ state, render, showToast });
  bindRoleProfileEvents({ state, render, showToast });
  bindGoalDialog({
    state,
    render,
    showToast,
    createDefaultGoalDraft,
    loadGoalsData
  });
  bindScheduleDialogController({ state, render, showToast });

  bindServiceEvents({
    state,
    render,
    showToast,
    refreshServices: loadServiceCatalogData
  });


  const followUpCaptorDialog = document.querySelector('#follow-up-captor-dialog');
  followUpCaptorDialog?.addEventListener('cancel', () => {
    state.followUps.selectedCaptorId = '';
  });
}

function subscribeProfileLeads() {
  state.unsubscribeLeads?.();
  const unsubscribeLeads = subscribeToLeads(
    state.profile,
    (leads) => {
      state.leads = leads;
      state.dataError = '';
      if (!consumeAttendanceSubscriptionUpdate(leads, 'profile')) render();
      ensureLeadDetailSchedule();
    },
    () => {
      state.dataError = 'Não foi possível carregar os cadastros. Verifique sua conexão ou permissão.';
      render();
    }
  );
  const unsubscribeStatuses = subscribeToManualSaleStatuses(
    state.profile,
    (records) => { state.saleStatuses = records; render(); },
    () => { state.saleStatuses = []; }
  );
  state.unsubscribeLeads = () => {
    unsubscribeLeads?.();
    unsubscribeStatuses?.();
  };
}

function stopOfflineCaptureSubscription() {
  state.unsubscribeOfflineCapture?.();
  state.unsubscribeOfflineCapture = null;
}

function startOfflineCaptureSubscription() {
  stopOfflineCaptureSubscription();
  state.offlineCapture = { loaded: false, enabled: false };
  if (!state.profile) return;

  try {
    state.unsubscribeOfflineCapture = subscribeToStoreSchedule(
      state.profile,
      (settings) => {
        state.offlineCapture = { loaded: true, enabled: settings.offlineCaptureEnabled };
        render();
      },
      () => {
        state.offlineCapture = { loaded: true, enabled: false };
        render();
      }
    );
  } catch {
    state.offlineCapture = { loaded: true, enabled: false };
  }
}

function stopFollowUpScheduleSubscription() {
  state.unsubscribeFollowUpSchedule?.();
  state.unsubscribeFollowUpSchedule = null;
  state.unsubscribeFollowUpLeads = null;
}

function startFollowUpScheduleSubscription() {
  stopFollowUpScheduleSubscription();
  state.followUps = initialFollowUpsState(state.followUps, {
    role: state.profile?.role,
    defaultSettings: DEFAULT_STORE_SCHEDULE
  });
  state.unsubscribeFollowUpSchedule = startFollowUpsSubscriptions({
    profile: state.profile,
    canViewTeam: hasAccess('followups.team'),
    storeIds: profileStoreIds(state.profile),
    loadSchedules: loadStoreSchedules,
    subscribeSchedule: subscribeToStoreSchedule,
    subscribeTeam: subscribeToTeamFollowUps,
    patchState: (patch) => {
      state.followUps = { ...state.followUps, ...patch };
    },
    render,
    shouldRender: () => ['home', 'follow-ups'].includes(state.route)
  });
}

async function loadManagementData() {
  if (!canManage() || state.management.loading) return;
  const periodError = validateManagementPeriod(state.management.filters);
  if (periodError) {
    state.management.error = periodError;
    render();
    return;
  }
  state.management.loading = true;
  state.management.error = '';
  render();
  const result = await loadManagementRecords({
    profile: state.profile,
    filters: state.management.filters,
    loadRecords: loadManagementLeads
  });
  if (result.error) {
    state.management.error = result.error;
  } else {
    state.management.records = result.records;
    state.management.truncated = result.truncated;
    state.management.loaded = true;
    state.management.page = 1;
  }
  state.management.loading = false;
  render();
  ensureLeadDetailSchedule();
  ensureLeadDetailHistory();
}

function consumeAttendanceSubscriptionUpdate(records, source) {
  const update = state.appointments.attendanceUpdate;
  if (state.route !== 'appointments' || !update) return false;
  const lead = records.find((item) => item.id === update.leadId);
  if ((lead?.appointmentAttendance || 'pending') !== update.attendance) return false;

  update[`${source}Synced`] = true;
  if (update.profileSynced && update.appointmentsSynced) {
    queueMicrotask(() => {
      if (state.appointments.attendanceUpdate === update) state.appointments.attendanceUpdate = null;
    });
  }
  return true;
}

function openManagementArchive() {
  const records = filteredManagementRecords();
  state.management.archiveSelection = records.filter(isCaptarImportedLead).map((lead) => lead.id);
  state.management.archiveOpen = true;
  render();
}

async function loadDashboardUpcomingData() {
  if (state.route !== 'dashboard' || !hasAccess('dashboard.view')
    || state.dashboardUpcoming.loading || state.dashboardUpcoming.loaded) return;
  state.dashboardUpcoming.loading = true;
  state.dashboardUpcoming.error = '';
  render();
  const result = await loadDashboardUpcomingRecords({
    profile: state.profile,
    filters: { ...state.management.filters, storeId: state.dashboardFilters.storeId, capturedByUid: '' },
    loadAppointments: loadUpcomingAppointments
  });
  if (result.error) {
    state.dashboardUpcoming.error = result.error;
  } else {
    state.dashboardUpcoming.records = result.records;
    state.dashboardUpcoming.truncated = result.truncated;
    state.dashboardUpcoming.loaded = true;
  }
  state.dashboardUpcoming.loading = false;
  render();
}

function ensureManagementData() {
  if (['management', 'management-lead', 'kanban', 'dashboard'].includes(state.route) && canManage() && !state.management.loaded) {
    loadManagementData();
  }
  loadDashboardUpcomingData();
}

function existingLeadForDetail(leadId = currentRouteParam()) {
  const detailLeadId = leadId || activeLeadDetailId();
  return state.route === 'management-lead' || state.leadDetailDialog.leadId
    ? findManagementLead(detailLeadId)
    : state.leads.find((item) => item.id === detailLeadId);
}

function refreshLeadDetailAppointmentTime(lead) {
  refreshLeadDetailAppointmentTimeField(lead, leadDetailAppointmentTimeField);
}

function startLeadDetailDayAppointmentsSubscription(lead) {
  return startLeadDetailDayAppointments({ state, lead, findLead: existingLeadForDetail, renderTimeField: leadDetailAppointmentTimeField });
}

function ensureLeadDetailSchedule() {
  return ensureLeadDetailScheduleData({ state, routeParam: activeLeadDetailId, findLead: existingLeadForDetail, render, renderTimeField: leadDetailAppointmentTimeField, isOpen: isLeadDetailOpen });
}

function ensureLeadDetailHistory() {
  if (!isLeadDetailOpen()) {
    stopLeadHistorySubscription(state);
    state.leadHistory = { leadId: '', profileUid: '', loading: false, error: '', records: [], stage: '' };
    return;
  }
  ensureLeadHistory({ state, lead: existingLeadForDetail(activeLeadDetailId()), render });
}

function stopAppointmentsSubscription() {
  stopAppointmentsLive(state);
}

function stopConfirmationsSubscription() {
  stopConfirmationsLive(state);
}

function stopWalkInsSubscription() {
  state.unsubscribeWalkIns?.();
  state.unsubscribeWalkIns = null;
}

async function startWalkInsSubscription() {
  stopWalkInsSubscription();
  if (state.route !== 'walk-ins' || !hasAccess('walkins.manage')) return;
  state.walkIns.loading = true;
  state.walkIns.error = '';
  render();
  try {
    const [services, captors] = await Promise.all([
      loadAppointmentServices(state.profile),
      loadWalkInCaptors(state.profile)
    ]);
    state.walkIns.services = services;
    state.walkIns.captors = captors;
    state.unsubscribeWalkIns = subscribeToWalkIns(
      state.profile,
      toLocalDateInput(new Date()),
      (records) => {
        state.walkIns.records = records;
        state.walkIns.loaded = true;
        state.walkIns.loading = false;
        state.walkIns.error = '';
        render();
      },
      (error) => {
        state.walkIns.loading = false;
        state.walkIns.error = error?.code === 'permission-denied'
          ? 'Seu perfil nao pode consultar a fila desta unidade.'
          : 'Nao foi possivel carregar a fila de encaixes.';
        render();
      }
    );
  } catch (error) {
    state.walkIns.loading = false;
    state.walkIns.error = error?.code === 'permission-denied'
      ? 'Seu perfil nao possui acesso a fila de encaixes.'
      : 'Nao foi possivel preparar a fila de encaixes.';
    render();
  }
}

function ensureWalkInsData() {
  if (state.route === 'walk-ins' && hasAccess('walkins.manage') && !state.walkIns.loaded && !state.walkIns.loading) {
    startWalkInsSubscription();
  }
}

async function loadExternalOperationsData() {
  if (state.route !== 'external-operations' || !hasAccess('external.operations.read') || state.externalOperations.loading) return;
  state.externalOperations.loading = true;
  state.externalOperations.error = '';
  render();
  try {
    const result = state.demoMode
      ? { records: demoExternalOperations(state.leads, state.externalOperations), truncated: false }
      : await loadExternalOperations(state.externalOperations);
    state.externalOperations.records = result.records;
    state.externalOperations.truncated = result.truncated;
    state.externalOperations.loaded = true;
  } catch (error) {
    state.externalOperations.error = error?.code === 'functions/permission-denied' || error?.code === 'permission-denied'
      ? 'Seu perfil não possui acesso à operação externa.'
      : 'Não foi possível carregar os dados da operação externa.';
  } finally {
    state.externalOperations.loading = false;
    render();
  }
}

function ensureExternalOperationsData() {
  if (state.route === 'external-operations' && hasAccess('external.operations.read') && !state.externalOperations.loaded && !state.externalOperations.loading) {
    loadExternalOperationsData();
  }
}

function startConfirmationsSubscription() {
  return startConfirmationsLive({ state, render, hasAccess, subscribe: subscribeToAppointmentConfirmations });
}

function startAppointmentsSubscription() {
  return startAppointmentsLive({
    state,
    render,
    hasAccess,
    isAdmin,
    subscribe: subscribeToAppointments,
    shouldRender: (records) => !consumeAttendanceSubscriptionUpdate(records, 'appointments')
  });
}

function openAppointmentCreateDialog() {
  return openAppointmentCreate({ state, render, profileStoreIds });
}

function ensureAppointmentsData() {
  return ensureAppointmentData({ state, hasAccess, startAppointments: startAppointmentsSubscription, startConfirmations: startConfirmationsSubscription });
}

function ensureConfirmationsData() {
  return ensureAppointmentData({ state, hasAccess, startAppointments: startAppointmentsSubscription, startConfirmations: startConfirmationsSubscription });
}

function stopNewLeadScheduleSubscriptions() {
  stopNewLeadSchedules(state);
}

function refreshAppointmentTimeControl() {
  refreshNewLeadAmetropiaField(state);
  refreshNewLeadAppointmentTime({ state, appointmentTimeMarkup: appointmentTimeField, selectedService: selectedNewLeadService, captureProfile: newLeadCaptureProfile });
}

function startDayAppointmentsSubscription() {
  return startNewLeadDayAppointments({ state, selectedStoreId: selectedNewLeadStoreId, captureProfile: newLeadCaptureProfile, refresh: refreshAppointmentTimeControl });
}

function ensureNewLeadSchedule() {
  return ensureNewLeadScheduleData({ state, render, selectedStoreId: selectedNewLeadStoreId, captureProfile: newLeadCaptureProfile, refresh: refreshAppointmentTimeControl });
}

async function loadSettingsData() {
  if (!isAdmin() || state.settings.loading) return;
  state.settings.loading = true;
  state.settings.error = '';
  render();
  try {
    const [records, roleProfiles, loadedServices] = await Promise.all([
      loadStoreSchedules(state.profile),
      loadRoleProfiles(state.profile),
      loadAppointmentServices(state.profile, { includeInactive: true })
    ]);
    state.settings.records = records;
    state.settings.roleProfiles = roleProfiles.map((item) => ({ ...item, permissions: [...item.permissions] }));
    state.settings.services = await ensureDefaultAppointmentServices(state.profile, records, loadedServices);
    state.settings.loaded = true;
  } catch (error) {
    state.settings.error = error?.code === 'permission-denied'
      ? 'Seu perfil não pode consultar estas configurações.'
      : 'Não foi possível carregar as configurações das lojas.';
  } finally {
    state.settings.loading = false;
    render();
  }
}

async function loadServiceCatalogData() {
  if (!isAdmin()) return;
  try {
    state.settings.services = await loadAppointmentServices(state.profile, { includeInactive: true });
    state.settings.saving = false;
    render();
  } catch (error) {
    state.settings.saving = false;
    state.settings.error = error?.code === 'permission-denied'
      ? 'Seu perfil não pode consultar os serviços.'
      : 'Não foi possível carregar os serviços.';
    render();
  }
}

function ensureSettingsData() {
  if (state.route === 'settings' && isAdmin() && !state.settings.loaded) loadSettingsData();
}

function refreshAuthorizedData() {
  ensureManagementData();
  ensureAppointmentsData();
  ensureConfirmationsData();
  ensureWalkInsData();
  ensureExternalOperationsData();
  ensureNewLeadSchedule();
  ensureLeadDetailSchedule();
  ensureLeadDetailHistory();
  ensureAccessData(state, { render });
  ensureGoalsData();
  ensureSettingsData();
}

function loadGoalsData() {
  return loadGoalsFeatureData(state, { render });
}

function ensureGoalsData() {
  return ensureGoalsFeatureData(state, { render });
}

function authControllerDependencies() {
  return {
    state,
    render,
    navigate,
    subscribeProfileLeads,
    startOfflineCaptureSubscription,
    stopOfflineCaptureSubscription,
    startFollowUpScheduleSubscription,
    stopFollowUpScheduleSubscription,
    stopAppointmentsSubscription,
    stopConfirmationsSubscription,
    stopWalkInsSubscription,
    stopNewLeadScheduleSubscriptions,
    stopLeadHistorySubscription: () => stopLeadHistorySubscription(state),
    synchronizePendingRegistrations,
    refreshAuthorizedData,
    hasAccess,
    createDefaultManagementFilters,
    createDefaultGoalDraft,
    createDefaultRoleDraft
  };
}

async function handleAction(action) {
  if (action === 'update-app' && state.updateAction) {
    const updateAction = state.updateAction;
    state.updateAction = null;
    render();
    await updateAction();
    return;
  }

  if (await handleAuthenticationAction(action, authControllerDependencies())) return;

  if (action === 'export-management') {
    const records = filteredManagementRecords();
    if (!records.length) return;
    downloadLeadsCsv(records, state.management.filters.startDate, state.management.filters.endDate);
    showToast(`${records.length} registro(s) exportado(s).`);
  }

  if (action === 'open-management-archive') {
    if (!hasAccess('leads.delete') || state.management.filters.archiveStatus === 'archived') return;
    openManagementArchive();
    return;
  }

  if (action === 'close-management-archive') {
    state.management.archiveOpen = false;
    state.management.archiveSelection = [];
    render();
    return;
  }

  if (action === 'reload-reports') {
    state.management.loaded = false;
    state.dashboardUpcoming.loaded = false;
    await loadManagementData();
    await loadDashboardUpcomingData();
  }

  if (action === 'consult-savwin' && canManage() && isLocalSavwinEnabled) {
    const { startDate, endDate } = state.management.filters;
    const storeId = state.route === 'dashboard' ? state.dashboardFilters.storeId : state.management.filters.storeId;
    state.savwin.loading = true;
    state.savwin.error = '';
    state.savwin.result = null;
    render();
    try {
      const storeIds = storeId ? [storeId] : profileStoreIds(state.profile);
      state.savwin.result = await consultLocalSavwinSales({ startDate, endDate, storeIds });
    } catch (error) {
      state.savwin.error = error.message || 'Não foi possível consultar o SavWin.';
    } finally {
      state.savwin.loading = false;
      render();
    }
  }

  if (action === 'appointments-today') {
    const today = new Date();
    const todayMonth = monthKeyFromDate(today);
    state.appointments.selectedDate = toLocalDateInput(today);
    state.appointments.listScrollTop = 0;
    if (state.appointments.month !== todayMonth) {
      state.appointments.month = todayMonth;
      state.appointments.loaded = false;
      startAppointmentsSubscription();
    } else {
      render();
    }
  }
}

export async function startApp() {
  document.addEventListener('click', async (event) => {
    const openManualSaleButton = event.target.closest('[data-open-manual-sale]');
    if (openManualSaleButton && !openManualSaleButton.disabled) {
      const leadId = openManualSaleButton.dataset.openManualSale;
      const lead = [...state.leads, ...state.management.records, ...state.appointments.records, state.management.activeLead]
        .find((item) => item?.id === leadId);
      if (!canConfirmManualSale(state.profile, lead)) return;
      state.saleConfirmation = { leadId, loading: true, saving: false, error: '', record: null, editingId: '', formOpen: false };
      render();
      try {
        state.saleConfirmation.record = await loadLeadSaleTracking(state.profile, lead);
      } catch (error) {
        state.saleConfirmation.error = error?.code === 'permission-denied'
          ? 'Seu perfil nao pode consultar esta confirmacao.' : 'Nao foi possivel carregar a confirmacao.';
      } finally {
        state.saleConfirmation.loading = false;
        render();
      }
      return;
    }
    const quickWalkInCreateButton = event.target.closest('[data-walk-in-quick-create]');
    if (quickWalkInCreateButton && hasAccess('leads.create')) {
      const storeId = state.walkIns.storeId || allowedWalkInStores()[0]?.id || '';
      state.walkIns.quickCreate = true;
      state.walkIns.quickDraft = {};
      state.walkIns.selectedLeadId = '';
      state.walkIns.storeId = storeId;
      state.walkIns.serviceId = servicesForStore(state.walkIns.services, storeId)[0]?.id || '';
      state.walkIns.broughtByUid = '';
      render();
      document.querySelector('#walk-in-quick-name')?.focus();
      return;
    }
    const quickWalkInCancelButton = event.target.closest('[data-walk-in-quick-cancel]');
    if (quickWalkInCancelButton) {
      state.walkIns.quickCreate = false;
      state.walkIns.quickDraft = {};
      render();
      return;
    }
    const selectWalkInLeadButton = event.target.closest('[data-walk-in-select-lead]');
    if (selectWalkInLeadButton && !selectWalkInLeadButton.disabled) {
      const lead = state.walkIns.searchResults.find((item) => item.id === selectWalkInLeadButton.dataset.walkInSelectLead);
      if (!lead || !profileStoreIds(state.profile).includes(lead.storeId)) return;
      state.walkIns.selectedLeadId = lead.id;
      state.walkIns.quickCreate = false;
      state.walkIns.quickDraft = {};
      state.walkIns.storeId = lead.storeId;
      state.walkIns.serviceId = servicesForStore(state.walkIns.services, lead.storeId)[0]?.id || '';
      state.walkIns.broughtByUid = '';
      render();
      return;
    }
    const walkInTransitionButton = event.target.closest('[data-walk-in-transition]');
    if (walkInTransitionButton && !walkInTransitionButton.disabled) {
      const item = state.walkIns.records.find((record) => record.id === walkInTransitionButton.dataset.walkInId);
      const nextStatus = walkInTransitionButton.dataset.walkInTransition;
      if (!item) return;
      let reason = '';
      if (WALK_IN_CLOSED_STATUSES.includes(nextStatus) && nextStatus !== 'completed') {
        reason = window.prompt('Informe o motivo deste encerramento:')?.trim() || '';
        if (!reason) return;
      }
      state.walkIns.updatingId = item.id;
      render();
      try {
        await transitionWalkIn(state.profile, item, nextStatus, reason);
        showToast(nextStatus === 'completed' ? 'Atendimento concluido.' : 'Fila de encaixes atualizada.', 'success', 'circle-check');
      } catch (error) {
        showToast(error?.code === 'walk-in-stale-state'
          ? 'Este encaixe ja foi atualizado por outra pessoa.'
          : error?.code === 'permission-denied'
            ? 'Seu perfil nao pode alterar este encaixe.'
            : 'Nao foi possivel atualizar o encaixe.', 'danger', 'circle-alert');
      } finally {
        state.walkIns.updatingId = '';
        render();
      }
      return;
    }
    const searchLeadButton = event.target.closest('[data-search-open-lead]');
    if (searchLeadButton && !searchLeadButton.disabled) {
      const result = state.leadSearch.results.find((item) => item.id === searchLeadButton.dataset.searchOpenLead);
      if (!result?.canOpen) return;
      searchLeadButton.disabled = true;
      try {
        const lead = await loadSearchLead(result.id);
        if (!lead) throw new Error('not-found');
        if (lead.capturedByUid === state.profile?.uid && hasAccess('leads.view_own')) {
          if (!state.leads.some((item) => item.id === lead.id)) state.leads = [lead, ...state.leads];
          navigate('lead', lead.id);
        } else if (result.canClaim || hasAccess('leads.view_stores')) {
          if (!state.leads.some((item) => item.id === lead.id)) state.leads = [lead, ...state.leads];
          navigate('lead', lead.id);
        } else if (canManage()) {
          state.management.activeLead = lead;
          navigate('management-lead', lead.id);
        }
      } catch (error) {
        searchLeadButton.disabled = false;
        showToast(error?.code === 'permission-denied'
          ? 'Seu perfil pode consultar o agendamento, mas não abrir este cadastro.'
          : 'Não foi possível abrir o cadastro.', 'danger', 'circle-alert');
      }
      return;
    }
    const rankingPanel = event.target.closest('.dashboard-panel');
    const openRankingButton = event.target.closest('[data-dashboard-ranking-open]')
      || (!event.target.closest('#dashboard-ranking-dialog') && rankingPanel?.querySelector(':scope > .dashboard-ranking-list')
        ? rankingPanel
        : null);
    if (openRankingButton) {
      state.dashboardRanking.open = true;
      render();
      return;
    }
    const closeRankingButton = event.target.closest('[data-dashboard-ranking-close]');
    if (closeRankingButton) {
      state.dashboardRanking.open = false;
      render();
      return;
    }
    const openLeadHistoryButton = event.target.closest('[data-open-lead-history]');
    if (openLeadHistoryButton) {
      state.leadHistoryDialogOpen = true;
      render();
      return;
    }
    const closeLeadHistoryButton = event.target.closest('[data-close-lead-history]');
    if (closeLeadHistoryButton) {
      state.leadHistoryDialogOpen = false;
      render();
      return;
    }
    const claimLeadButton = event.target.closest('[data-claim-lead]');
    if (claimLeadButton && !claimLeadButton.disabled) {
      const lead = existingLeadForDetail(claimLeadButton.dataset.claimLead);
      if (!canClaimCancelledLead(state.profile, lead)) return;
      state.leadAssignment = {
        leadId: lead.id, mode: 'claim', loading: false, saving: false,
        error: '', members: [], targetUid: state.profile.uid
      };
      render();
      return;
    }
    const transferLeadButton = event.target.closest('[data-transfer-lead]');
    if (transferLeadButton && !transferLeadButton.disabled) {
      const lead = existingLeadForDetail(transferLeadButton.dataset.transferLead);
      if (!canTransferLead(state.profile, lead)) return;
      state.leadAssignment = {
        leadId: lead.id, mode: 'reassign', loading: true, saving: false,
        error: '', members: [], targetUid: ''
      };
      render();
      try {
        const members = await loadAssignableLeadOwners(state.profile, lead);
        state.leadAssignment = {
          ...state.leadAssignment,
          loading: false,
          members,
          targetUid: members[0]?.uid || '',
          error: members.length ? '' : 'Nenhum colaborador ativo desta unidade esta disponivel.'
        };
      } catch {
        state.leadAssignment = { ...state.leadAssignment, loading: false, error: 'Nao foi possivel carregar a equipe.' };
      }
      render();
      return;
    }
    if (event.target.closest('[data-close-lead-assignment]')) {
      closeLeadAssignmentDialog();
      return;
    }
    const confirmLeadAssignmentButton = event.target.closest('[data-confirm-lead-assignment]');
    if (confirmLeadAssignmentButton && !confirmLeadAssignmentButton.disabled) {
      const lead = existingLeadForDetail(state.leadAssignment.leadId);
      if (!lead || state.leadAssignment.saving) return;
      const target = state.leadAssignment.mode === 'claim'
        ? state.profile
        : state.leadAssignment.members.find((member) => member.uid === state.leadAssignment.targetUid);
      if (!target) return;
      state.leadAssignment = { ...state.leadAssignment, saving: true, error: '' };
      render();
      try {
        const updated = state.leadAssignment.mode === 'claim'
          ? await claimCancelledLead(state.profile, lead)
          : await transferLead(state.profile, lead, target);
        applyLeadOwnerUpdate(updated);
        closeLeadAssignmentDialog();
        showToast(state.profile.uid === updated.capturedByUid
          ? 'Lead assumido. Agora voce e o responsavel pelo cadastro.'
          : 'Responsavel do lead transferido com sucesso.');
      } catch (error) {
        state.leadAssignment = {
          ...state.leadAssignment,
          saving: false,
          error: error?.code === 'lead-owner-changed'
            ? 'Outra pessoa ja assumiu ou transferiu este lead. Atualize a pesquisa.'
            : error?.code === 'permission-denied'
              ? 'Seu perfil nao pode realizar esta alteracao.'
              : 'Nao foi possivel alterar o responsavel pelo lead.'
        };
        render();
      }
      return;
    }
    const closeLeadDetailButton = event.target.closest('[data-close-lead-detail]');
    if (closeLeadDetailButton) {
      closeLeadDetailDialog();
      return;
    }
    const handledConfirmationClick = await handleConfirmationClick(event, {
      selectFilter: (filter) => {
        state.confirmations.filter = filter;
        render();
      },
      markDone: async (leadId) => {
        const lead = state.confirmations.records.find((item) => item.id === leadId);
        if (!lead) return;
        state.confirmations.updatingId = lead.id;
        render();
        try {
          await markAppointmentReminderDone(state.profile, lead);
          const reminderUpdate = {
            appointmentReminderSentAt: new Date().toISOString(),
            appointmentReminderSentByUid: state.profile.uid,
            appointmentReminderSentByName: state.profile.displayName,
            appointmentReminderAppointmentKey: followUpAppointmentKey(lead)
          };
          state.confirmations.records = state.confirmations.records.map((item) => item.id === lead.id ? { ...item, ...reminderUpdate } : item);
          showToast('Lembrete marcado como feito.');
        } catch (error) {
          showToast(error?.code === 'permission-denied' ? 'Seu perfil não pode concluir este lembrete.' : 'Não foi possível marcar o lembrete como feito.', 'danger', 'circle-alert');
        } finally {
          state.confirmations.updatingId = '';
          render();
        }
      },
      undo: async (leadId) => {
        const lead = state.confirmations.records.find((item) => item.id === leadId);
        if (!lead) return;
        state.confirmations.updatingId = lead.id;
        render();
        try {
          await undoAppointmentReminderDone(state.profile, lead);
          state.confirmations.records = state.confirmations.records.map((item) => {
            if (item.id !== lead.id) return item;
            const { appointmentReminderSentAt, appointmentReminderSentByUid, appointmentReminderSentByName, appointmentReminderAppointmentKey, ...pendingLead } = item;
            return pendingLead;
          });
          showToast('Conclusão do lembrete desfeita.');
        } catch (error) {
          showToast(error?.code === 'permission-denied' ? 'Seu perfil não pode reabrir este lembrete.' : 'Não foi possível desfazer a conclusão.', 'danger', 'circle-alert');
        } finally {
          state.confirmations.updatingId = '';
          render();
        }
      }
    });
    if (handledConfirmationClick) return;
    if (handleSettingsSectionClick(event, { settings: state.settings, render })) return;
    if (await handleServiceClick(event, {
      state,
      render,
      showToast,
      refreshServices: loadServiceCatalogData
    })) return;
    if (await handleRoleProfileClick(event, { state, render, showToast })) return;
    if (await handleGoalsClick(event, {
      state,
      render,
      showToast,
      createDefaultGoalDraft,
      loadGoalsData
    })) return;

    const handledFollowUpClick = await handleFollowUpsClick(event, {
      selectCaptor: (captorId) => {
        state.followUps.selectedCaptorId = captorId;
        render();
        requestAnimationFrame(() => document.querySelector('#follow-up-captor-dialog')?.showModal());
      },
      closeCaptor: () => {
        state.followUps.selectedCaptorId = '';
      },
      selectFilter: (filter) => {
        state.followUps.filter = filter;
        render();
      },
      openWhatsApp: async (leadId) => {
        const lead = [...state.leads, ...state.followUps.records].find((item) => item.id === leadId);
        if (!lead) return;
        try {
          await markFollowUpContactStarted(state.profile, lead);
          const contactUpdate = {
            followUpContactedAt: new Date().toISOString(),
            followUpContactedByUid: state.profile.uid,
            followUpContactedByName: state.profile.displayName,
            followUpContactedAppointmentKey: followUpAppointmentKey(lead)
          };
          state.leads = state.leads.map((item) => item.id === lead.id ? { ...item, ...contactUpdate } : item);
          state.followUps.records = state.followUps.records.map((item) => item.id === lead.id ? { ...item, ...contactUpdate } : item);
          if (state.followUps.filter === 'waiting') state.followUps.filter = 'contacted';
          render();
          if (state.followUps.selectedCaptorId) {
            requestAnimationFrame(() => document.querySelector('#follow-up-captor-dialog')?.showModal());
          }
        } catch {
          showToast('O WhatsApp foi aberto, mas o contato não foi registrado.', 'warning', 'circle-alert');
        }
      },
      reschedule: (leadId) => {
        const lead = [...state.followUps.records, ...state.leads].find((item) => item.id === leadId);
        if (!lead) return;
        state.followUps.selectedCaptorId = '';
        state.management.activeLead = lead;
        navigate('management-lead', lead.id);
      }
    });
    if (handledFollowUpClick) return;
    const leadButton = event.target.closest('[data-open-lead-id]');
    if (leadButton) navigate('lead', leadButton.dataset.openLeadId);
    const handledManagementClick = handleManagementClick(event, {
      openLead: (leadId) => {
        const lead = state.management.records.find((item) => item.id === leadId);
        if (lead) state.management.activeLead = lead;
        if (state.route === 'kanban') openLeadDetailDialog(lead);
        else navigate('management-lead', leadId);
      },
      changePage: (page) => {
        state.management.page = page;
        render();
        document.querySelector('.management-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    if (handledManagementClick) return;
    const handledAppointmentClick = await handleAppointmentClick(event, {
      requestCancellation: (leadId) => {
        const lead = findLeadForAppointmentCancellation(leadId);
        if (!canCancelAppointment(state.profile, lead)) return;
        state.appointments.cancellationLeadId = lead.id;
        state.appointments.cancellationSaving = false;
        render();
      },
      openLead: (leadId) => {
        const lead = appointmentRecords().find((item) => item.id === leadId);
        if (lead) {
          state.management.activeLead = lead;
          openLeadDetailDialog(lead);
        }
      },
      markAttendance: async (leadId, attendance) => {
        const lead = appointmentRecords().find((item) => item.id === leadId);
        if (!lead) return;
        const previousAttendance = lead.appointmentAttendance || 'pending';
        const nextAttendance = nextAppointmentAttendance(previousAttendance, attendance);
        state.appointments.listScrollTop = document.querySelector('.appointment-list')?.scrollTop || 0;
        state.appointments.updatingId = lead.id;
        const attendanceUpdate = { leadId: lead.id, attendance: nextAttendance, appointmentsSynced: false, profileSynced: false };
        state.appointments.attendanceUpdate = attendanceUpdate;
        state.appointments.records = state.appointments.records.map((item) => item.id === lead.id ? { ...item, appointmentAttendance: nextAttendance } : item);
        state.leads = state.leads.map((item) => item.id === lead.id ? { ...item, appointmentAttendance: nextAttendance } : item);
        updateAppointmentAttendanceControls(lead.id, nextAttendance, true);
        try {
          await setAppointmentAttendance(state.profile, lead, nextAttendance);
          showToast(nextAttendance === 'pending'
            ? 'Comparecimento removido.'
            : nextAttendance === 'attended' ? 'Comparecimento registrado.' : 'Falta registrada.');
        } catch (error) {
          state.appointments.records = state.appointments.records.map((item) => item.id === lead.id ? { ...item, appointmentAttendance: previousAttendance } : item);
          state.leads = state.leads.map((item) => item.id === lead.id ? { ...item, appointmentAttendance: previousAttendance } : item);
          if (state.appointments.attendanceUpdate === attendanceUpdate) state.appointments.attendanceUpdate = null;
          updateAppointmentAttendanceControls(lead.id, previousAttendance, false);
          showToast(error?.code === 'permission-denied' ? 'Seu perfil não pode alterar este agendamento.' : 'Não foi possível salvar o comparecimento.', 'danger', 'circle-alert');
        } finally {
          state.appointments.updatingId = '';
          const savedAttendance = state.appointments.records.find((item) => item.id === lead.id)?.appointmentAttendance || 'pending';
          updateAppointmentAttendanceControls(lead.id, savedAttendance, false);
          setTimeout(() => {
            if (state.appointments.attendanceUpdate === attendanceUpdate) state.appointments.attendanceUpdate = null;
          }, 2000);
        }
      },
      selectDate: (date) => {
        state.appointments.selectedDate = date;
        state.appointments.listScrollTop = 0;
        render();
      },
      create: openAppointmentCreateDialog,
      shiftMonth: (offset) => {
        if (state.appointments.loading) return;
        state.appointments.month = shiftMonth(state.appointments.month, offset);
        state.appointments.selectedDate = monthRange(state.appointments.month).startDate;
        state.appointments.listScrollTop = 0;
        state.appointments.loaded = false;
        startAppointmentsSubscription();
      }
    });
    if (handledAppointmentClick) return;
    const deleteLeadButton = event.target.closest('[data-delete-lead]');
    if (deleteLeadButton && !deleteLeadButton.disabled) {
      const lead = findManagementLead(deleteLeadButton.dataset.deleteLead)
        || state.leads.find((item) => item.id === deleteLeadButton.dataset.deleteLead);
      const dialog = document.querySelector('#delete-lead-dialog');
      if (lead && dialog) dialog.showModal();
    }
    const closeDeleteDialogButton = event.target.closest('[data-close-delete-dialog]');
    if (closeDeleteDialogButton) {
      closeDeleteDialogButton.closest('dialog')?.close();
    }
    const confirmDeleteButton = event.target.closest('[data-confirm-delete]');
    if (confirmDeleteButton && !confirmDeleteButton.disabled) {
      const lead = findManagementLead(confirmDeleteButton.dataset.confirmDelete)
        || state.leads.find((item) => item.id === confirmDeleteButton.dataset.confirmDelete);
      if (!lead) return;
      const openedInDialog = Boolean(state.leadDetailDialog.leadId);
      const returnRoute = state.route === 'management-lead' ? 'management' : 'leads';
      confirmDeleteButton.disabled = true;
      try {
        await deleteManagementLead(state.profile, lead);
        state.leads = state.leads.filter((item) => item.id !== lead.id);
        state.management.records = state.management.records.filter((item) => item.id !== lead.id);
        state.appointments.records = state.appointments.records.filter((item) => item.id !== lead.id);
        state.management.activeLead = null;
        if (openedInDialog) closeLeadDetailDialog();
        else navigate(returnRoute);
        showToast('Lead excluído definitivamente.');
      } catch (error) {
        confirmDeleteButton.disabled = false;
        showToast(error?.code === 'permission-denied' ? 'Seu perfil não pode excluir este lead.' : 'Não foi possível excluir o lead.', 'danger', 'circle-alert');
      }
    }
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) navigate(routeButton.dataset.route);
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) handleAction(actionButton.dataset.action);
    if (await handleAccessClick(event, { state, render, showToast })) return;

  });

  await startLifecycle({
    state,
    render,
    currentRoute,
    refreshAuthorizedData,
    stopAppointmentsSubscription,
    stopConfirmationsSubscription,
    stopWalkInsSubscription,
    stopNewLeadScheduleSubscriptions,
    stopLeadHistorySubscription: () => stopLeadHistorySubscription(state),
    handleConnectivity: handleConnectivityChange,
    syncAgendaHeight: syncAgendaSidebarHeight,
    synchronize: synchronizePendingRegistrations,
    startAuthentication: () => startAuthenticationController(authControllerDependencies())
  });


}

export function showOfflineReady() {
  showToast('Aplicativo pronto para abrir offline.', 'success', 'cloud-check');
}

export function showUpdateReady(updateAction) {
  state.updateAction = updateAction;
  render();
}
