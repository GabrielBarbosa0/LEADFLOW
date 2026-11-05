import { describe, expect, it, vi } from 'vitest';
import { handleFollowUpsClick } from '../../src/app/features/follow-ups/follow-ups-events.js';
import { initialFollowUpsState, startFollowUpsSubscriptions } from '../../src/app/features/follow-ups/follow-ups-subscriptions.js';
import { followUpsView, pendingFollowUps } from '../../src/app/features/follow-ups/follow-ups-view.js';
import { DEFAULT_STORE_SCHEDULE } from '../../src/utils/schedule.js';

function sampleLead(overrides = {}) {
  return {
    id: 'lead-1',
    fullName: 'Maria Silva',
    phone: '81999991234',
    phoneSearch: '81999991234',
    preferredName: 'Maria',
    storeId: 'loja-06',
    capturedByUid: 'captor-1',
    capturedByName: 'Ana Souza',
    appointmentDate: '2026-10-28',
    appointmentTime: '08:00',
    appointmentAttendance: 'missed',
    ...overrides
  };
}

function handlers(overrides = {}) {
  return {
    selectCaptor: vi.fn(),
    closeCaptor: vi.fn(),
    selectFilter: vi.fn(),
    openWhatsApp: vi.fn(),
    reschedule: vi.fn(),
    ...overrides
  };
}

describe('follow-ups feature modules', () => {
  it('selects pending records without depending on application-global state', () => {
    const records = pendingFollowUps({
      canViewTeam: true,
      records: [sampleLead()],
      leads: [],
      profile: { role: 'manager', storeIds: ['loja-06'] },
      settings: DEFAULT_STORE_SCHEDULE,
      settingsByStore: {},
      now: new Date('2026-10-29T12:00:00-03:00')
    });
    expect(records.map((lead) => lead.id)).toEqual(['lead-1']);
  });

  it('renders manager filters, captor grouping and the selected captor dialog', () => {
    const markup = followUpsView({
      allowed: true,
      managerView: true,
      adminView: false,
      allRecords: [sampleLead()],
      activeFilter: 'captors',
      selectedCaptorId: 'captor-1',
      settings: DEFAULT_STORE_SCHEDULE,
      profileName: 'Gestor'
    });
    expect(markup).toContain('data-follow-up-filter="captors"');
    expect(markup).toContain('Ana Souza');
    expect(markup).toContain('id="follow-up-captor-dialog"');
    expect(markup).toContain('data-follow-up-whatsapp="lead-1"');
  });

  it('delegates follow-up click actions to explicit handlers', async () => {
    const actionHandlers = handlers();
    const button = { dataset: { followUpFilter: 'waiting' } };
    const event = { target: { closest: (selector) => selector === '[data-follow-up-filter]' ? button : null } };
    await expect(handleFollowUpsClick(event, actionHandlers)).resolves.toBe(true);
    expect(actionHandlers.selectFilter).toHaveBeenCalledWith('waiting');
    expect(actionHandlers.openWhatsApp).not.toHaveBeenCalled();
  });

  it('starts and stops both live subscriptions through one controller', () => {
    const stopSchedule = vi.fn();
    const stopTeam = vi.fn();
    const patchState = vi.fn();
    const render = vi.fn();
    const stop = startFollowUpsSubscriptions({
      profile: { role: 'manager' },
      canViewTeam: true,
      storeIds: ['loja-06'],
      loadSchedules: vi.fn(),
      subscribeSchedule: (_profile, onData) => {
        onData({ noShowGraceMinutes: 20 });
        return stopSchedule;
      },
      subscribeTeam: (_profile, onData) => {
        onData({ records: [sampleLead()], truncated: false });
        return stopTeam;
      },
      patchState,
      render
    });
    expect(patchState).toHaveBeenCalledWith(expect.objectContaining({ loaded: true }));
    expect(patchState).toHaveBeenCalledWith(expect.objectContaining({ records: expect.any(Array) }));
    stop();
    expect(stopSchedule).toHaveBeenCalledOnce();
    expect(stopTeam).toHaveBeenCalledOnce();
  });

  it('preserves the active filter when resetting follow-up state', () => {
    expect(initialFollowUpsState({ filter: 'contacted' }, {
      role: 'captor',
      defaultSettings: DEFAULT_STORE_SCHEDULE
    })).toMatchObject({ filter: 'contacted', loaded: false, records: [] });
  });
});
