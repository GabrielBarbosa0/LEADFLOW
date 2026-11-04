import { monthKeyFromDate } from '../../utils/calendar.js';
import { SYSTEM_ROLE_PROFILES } from '../../utils/role-profile.js';
import { DEFAULT_STORE_SCHEDULE } from '../../utils/schedule.js';
import { STORES } from '../../utils/stores.js';
import { toLocalDateInput } from '../shared/formatters.js';

export function createAppState({ route, createDefaultManagementFilters, createDefaultGoalDraft, createDefaultRoleDraft }) {
  return {
    route,
    loading: true,
    profile: null,
    demoMode: false,
    leads: [],
    authError: '',
    authMessage: '',
    dataError: '',
    toast: null,
    search: '',
    leadSearch: {
      query: '',
      loading: false,
      searched: false,
      error: '',
      results: []
    },
    unsubscribeProfile: null,
    unsubscribeLeads: null,
    unsubscribeAppointments: null,
    unsubscribeConfirmations: null,
    unsubscribeWalkIns: null,
    unsubscribeStoreSchedule: null,
    unsubscribeOfflineCapture: null,
    unsubscribeFollowUpSchedule: null,
    unsubscribeFollowUpLeads: null,
    unsubscribeDayAppointments: null,
    unsubscribeLeadHistory: null,
    updateAction: null,
    management: {
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
    },
    dashboardUpcoming: {
      loading: false,
      loaded: false,
      error: '',
      records: [],
      truncated: false
    },
    dashboardFilters: {
      storeId: ''
    },
    dashboardRanking: {
      open: false,
      storeId: ''
    },
    appointments: {
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
    },
    confirmations: {
      loading: false,
      loaded: false,
      error: '',
      records: [],
      truncated: false,
      filter: 'pending',
      days: 7,
      updatingId: ''
    },
    walkIns: {
      loading: false,
      loaded: false,
      saving: false,
      error: '',
      records: [],
      captors: [],
      services: [],
      serviceId: '',
      storeId: '',
      storeFilter: '',
      selectedLeadId: '',
      searchQuery: '',
      searchLoading: false,
      searchSearched: false,
      searchError: '',
      searchResults: [],
      quickCreate: false,
      quickDraft: {},
      updatingId: ''
    },
    appointmentCreate: {
      loading: false,
      saving: false,
      error: '',
      schedules: [],
      storeId: '',
      services: [],
      serviceId: '',
      draft: {}
    },
    newLeadSchedule: {
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
    },
    leadDetailSchedule: {
      loading: false,
      appointmentLoading: false,
      leadId: '',
      storeId: '',
      appointmentDate: '',
      appointments: [],
      services: [],
      serviceId: '',
      triage: {},
      error: '',
      settings: { ...DEFAULT_STORE_SCHEDULE }
    },
    leadHistory: {
      leadId: '',
      loading: false,
      error: '',
      records: [],
      stage: ''
    },
    leadDetailDialog: {
      leadId: ''
    },
    leadHistoryDialogOpen: false,
    offlineCapture: {
      loaded: false,
      enabled: false
    },
    followUps: {
      loaded: false,
      error: '',
      records: [],
      truncated: false,
      filter: 'all',
      selectedCaptorId: '',
      settingsByStore: {},
      settings: { ...DEFAULT_STORE_SCHEDULE }
    },
    settings: {
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
    },
    access: {
      loading: false,
      loaded: false,
      saving: false,
      error: '',
      accesses: [],
      storeIds: [],
      query: '',
      storeFilter: '',
      editorOpen: false,
      editingEmail: '',
      pendingDeleteEmail: ''
    },
    goals: {
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
    },
    savwin: {
      loading: false,
      error: '',
      result: null
    }
  };
}
