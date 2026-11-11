import { monthKeyFromDate } from '../../utils/calendar.js';
import { SYSTEM_ROLE_PROFILES } from '../../utils/role-profile.js';
import { DEFAULT_STORE_SCHEDULE } from '../../utils/schedule.js';
import { STORES } from '../../utils/stores.js';
import { toLocalDateInput } from '../shared/formatters.js';

export function resetSessionState(state, {
  createDefaultManagementFilters,
  createDefaultGoalDraft,
  createDefaultRoleDraft
}) {
  state.profile = null;
  state.leads = [];
  state.leadFilters = { query: '', storeId: '', startDate: '', endDate: '' };
  state.leadSearch = { query: '', loading: false, searched: false, error: '', results: [] };
  state.management = {
    loading: false,
    loaded: false,
    error: '',
    records: [],
    activeLead: null,
    truncated: false,
    page: 1,
    pageSize: 20,
    archiveOpen: false,
    archiveSelection: [],
    archiveSaving: false,
    filters: createDefaultManagementFilters()
  };
  state.savwin = { loading: false, error: '', result: null };
  state.salesStats = {
    loading: false, loaded: false, error: '', records: [], period: '', storeId: ''
  };
  state.savwinReview = {
    loading: false, loaded: false, saving: false, error: '', records: [], activeId: '',
    filters: { storeId: '', period: monthKeyFromDate(), status: 'pending' }
  };
  state.appointments = {
    loading: false,
    loaded: false,
    error: '',
    records: [],
    truncated: false,
    updatingId: '',
    cancellationLeadId: '',
    cancellationSaving: false,
    backfillingMonth: '',
    backfilledMonths: [],
    month: monthKeyFromDate(),
    storeId: '',
    selectedDate: toLocalDateInput(new Date())
  };
  state.confirmations = {
    loading: false,
    loaded: false,
    error: '',
    records: [],
    truncated: false,
    filter: 'pending',
    updatingId: ''
  };
  state.walkIns = {
    loading: false, loaded: false, saving: false, error: '', records: [], services: [], captors: [],
    serviceId: '', broughtByUid: '', storeId: '', storeFilter: '', selectedLeadId: '', searchQuery: '',
    searchLoading: false, searchSearched: false, searchError: '', searchResults: [],
    quickCreate: false, quickDraft: {}, updatingId: ''
  };
  state.externalOperations = {
    loading: false,
    loaded: false,
    error: '',
    records: [],
    truncated: false,
    startDate: toLocalDateInput(new Date()),
    endDate: toLocalDateInput(new Date()),
    storeId: '',
    query: '',
    transportMode: 'with',
    companionMode: 'all',
    detailLeadId: ''
  };
  state.appointmentCreate = {
    loading: false,
    saving: false,
    error: '',
    schedules: [],
    storeId: '',
    services: [],
    serviceId: '',
    draft: {}
  };
  state.newLeadSchedule = {
    loaded: false,
    loading: false,
    error: '',
    storeId: '',
    settings: { ...DEFAULT_STORE_SCHEDULE },
    appointmentDate: '',
    appointments: [],
    services: [],
    serviceId: '',
    triage: {},
    draft: {}
  };
  state.leadDetailSchedule = {
    loading: false,
    appointmentLoading: false,
    leadId: '',
    storeId: '',
    appointmentDate: '',
    appointments: [],
    services: [],
    serviceId: '',
    error: '',
    settings: { ...DEFAULT_STORE_SCHEDULE }
  };
  state.leadHistory = {
    leadId: '',
    profileUid: '',
    loading: false,
    error: '',
    records: [],
    stage: ''
  };
  state.leadDetailDialog = { leadId: '' };
  state.leadHistoryDialogOpen = false;
  state.offlineCapture = { loaded: false, enabled: false };
  state.followUps = {
    loaded: false,
    error: '',
    records: [],
    truncated: false,
    filter: 'all',
    selectedCaptorId: '',
    settingsByStore: {},
    settings: { ...DEFAULT_STORE_SCHEDULE }
  };
  state.settings = {
    loaded: false,
    loading: false,
    saving: false,
    error: '',
    selectedStoreId: STORES[0]?.id || '',
    records: [],
    section: 'schedule',
    roleProfiles: SYSTEM_ROLE_PROFILES.map((item) => ({ ...item, permissions: [...item.permissions] })),
    services: [],
    serviceEditorOpen: false,
    editingServiceId: '',
    pendingDeleteServiceId: '',
    roleEditorOpen: false,
    roleDraft: createDefaultRoleDraft(),
    editingRoleId: '',
    pendingDeleteRoleId: '',
    detailsRoleId: '',
    detailsRolePermissions: []
  };
  state.access = {
    loading: false,
    loaded: false,
    saving: false,
    error: '',
    accesses: [],
    storeIds: []
  };
  state.goals = {
    loading: false,
    loaded: false,
    saving: false,
    error: '',
    records: [],
    members: [],
    truncated: false,
    editorOpen: false,
    editingGroupId: '',
    duplicatingGroupId: '',
    pendingDeleteGroupId: '',
    salesStats: {
      enabled: false,
      loading: false,
      loaded: false,
      error: '',
      record: null,
      period: ''
    },
    draft: createDefaultGoalDraft()
  };
}
