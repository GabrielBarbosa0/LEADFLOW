import { monthKeyFromDate } from '../../utils/calendar.js';
import { SYSTEM_ROLE_PROFILES } from '../../utils/role-profile.js';
import { DEFAULT_STORE_SCHEDULE } from '../../utils/schedule.js';
import { STORES } from '../../utils/stores.js';
import { toLocalDateInput } from '../shared/formatters.js';

export const DEMO_SESSION_KEY = 'fascinlead:demo-session';
export const DEMO_ROLE_KEY = 'fascinlead:demo-role';

const demoProfile = {
  uid: 'demo-user',
  displayName: 'Equipe Fascinante',
  email: 'modo.de.desenvolvimento@local',
  role: 'captor',
  storeId: 'loja-06',
  active: true
};

export function createDemoProfile(role = sessionStorage.getItem(DEMO_ROLE_KEY)) {
  if (role === 'admin') {
    return { ...demoProfile, uid: 'demo-admin', displayName: 'Administrador de Teste', role: 'admin', storeId: 'loja-06', storeIds: STORES.map((store) => store.id) };
  }
  if (role === 'manager') {
    return { ...demoProfile, uid: 'demo-manager', displayName: 'Gestor de Teste', role: 'manager', storeId: 'loja-06', storeIds: ['loja-06', 'loja-02'] };
  }
  if (role === 'mei') {
    const mei = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-mei');
    return {
      ...demoProfile,
      uid: 'demo-mei',
      displayName: 'MEI de Teste',
      role: mei.baseRole,
      roleProfileId: mei.id,
      roleProfileName: mei.name,
      permissions: [...mei.permissions],
      storeId: 'loja-06',
      storeIds: STORES.map((store) => store.id)
    };
  }
  if (role === 'receptionist') {
    const receptionist = SYSTEM_ROLE_PROFILES.find((profile) => profile.id === 'system-receptionist');
    return {
      ...demoProfile,
      uid: 'demo-receptionist',
      displayName: 'Atendente de Teste',
      role: receptionist.baseRole,
      roleProfileId: receptionist.id,
      roleProfileName: receptionist.name,
      permissions: [...receptionist.permissions],
      storeId: 'loja-06',
      storeIds: ['loja-06']
    };
  }
  return { ...demoProfile };
}

export function hasDemoSession(enabled) {
  return enabled && sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';
}

export function startDemoSession(state) {
  sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
  state.demoMode = true;
  state.profile = createDemoProfile();
  state.authError = '';
  state.authMessage = '';
}

export function clearDemoSession() {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function resetSessionState(state, {
  createDefaultManagementFilters,
  createDefaultGoalDraft,
  createDefaultRoleDraft
}) {
  state.profile = null;
  state.demoMode = false;
  state.leads = [];
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
    filters: createDefaultManagementFilters()
  };
  state.savwin = { loading: false, error: '', result: null };
  state.appointments = {
    loading: false,
    loaded: false,
    error: '',
    records: [],
    truncated: false,
    updatingId: '',
    cancellationLeadId: '',
    cancellationSaving: false,
    rescheduleLeadId: '',
    rescheduleDraft: null,
    rescheduleSaving: false,
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
    loading: false, loaded: false, saving: false, error: '', records: [], services: [],
    serviceId: '', storeId: '', storeFilter: '', selectedLeadId: '', searchQuery: '',
    searchLoading: false, searchSearched: false, searchError: '', searchResults: [],
    quickCreate: false, quickDraft: {}, updatingId: ''
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
    draft: createDefaultGoalDraft()
  };
}
