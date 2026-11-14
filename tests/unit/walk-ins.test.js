import { describe, expect, it } from 'vitest';
import { walkInsView } from '../../src/app/features/walk-ins/walk-ins-view.js';
import {
  canTransitionWalkIn,
  validateWalkInDraft,
  walkInElapsedMinutes,
  walkInIsOpen
} from '../../src/utils/walk-in.js';

const store = { id: 'loja-06', label: 'Loja 06', displayLabel: 'Loja 06 - Surubim' };
const service = { id: 'eye-exam', name: 'Exame de vista', durationMinutes: 20, storeIds: ['loja-06'], active: true };
const lead = { id: 'lead-1', fullName: 'Maria Silva', customerCpf: '12345678901', phoneSearch: '81999991234', storeId: 'loja-06' };
const captor = { uid: 'captor-1', displayName: 'Ana Captadora', role: 'captor', active: true, storeId: 'loja-06', storeIds: ['loja-06'] };

function state(overrides = {}) {
  return {
    loading: false,
    loaded: true,
    saving: false,
    error: '',
    records: [],
    services: [service],
    captors: [captor],
    serviceId: 'eye-exam',
    broughtByUid: captor.uid,
    storeId: 'loja-06',
    storeFilter: '',
    selectedLeadId: lead.id,
    searchQuery: 'Maria',
    searchLoading: false,
    searchSearched: true,
    searchError: '',
    searchResults: [lead],
    quickCreate: false,
    quickDraft: {},
    updatingId: '',
    ...overrides
  };
}

describe('walk-in queue', () => {
  it('validates operational data and state transitions', () => {
    const valid = validateWalkInDraft({
      leadId: lead.id,
      storeId: store.id,
      queueDate: '2026-10-30',
      serviceId: service.id,
      serviceName: service.name,
      professionalType: 'optometrist',
      broughtByUid: captor.uid,
      broughtByName: captor.displayName,
      reason: 'Cliente presencial solicitou exame imediato',
      notes: ''
    });
    expect(valid.isValid).toBe(true);
    expect(valid.data).toMatchObject({ broughtByUid: captor.uid, broughtByName: captor.displayName });
    expect(validateWalkInDraft({ ...valid.data, broughtByName: '' }).errors.broughtByUid).toBeTruthy();
    expect(validateWalkInDraft({}).isValid).toBe(false);
    expect(canTransitionWalkIn('waiting', 'called')).toBe(true);
    expect(canTransitionWalkIn('waiting', 'completed')).toBe(false);
    expect(canTransitionWalkIn('in_service', 'completed')).toBe(true);
    expect(walkInIsOpen('called')).toBe(true);
    expect(walkInIsOpen('completed')).toBe(false);
  });

  it('calculates elapsed waiting time', () => {
    expect(walkInElapsedMinutes('2026-10-30T10:00:00-03:00', new Date('2026-10-30T10:27:00-03:00'))).toBe(27);
  });

  it('renders creation, queue status and actions', () => {
    const markup = walkInsView({
      walkIns: state({
        records: [{
          id: 'walk-in-1',
          leadId: lead.id,
          lead,
          storeId: store.id,
          serviceName: service.name,
          professionalType: 'optometrist',
          broughtByUid: captor.uid,
          broughtByName: captor.displayName,
          reason: 'Cliente presencial solicitou exame imediato',
          status: 'waiting',
          arrivedAt: new Date('2026-10-30T10:00:00-03:00')
        }]
      }),
      selectedLead: lead,
      allowedStores: [store],
      services: [service],
      now: new Date('2026-10-30T10:20:00-03:00')
    });
    expect(markup).toContain('Novo encaixe');
    expect(markup).toContain('class="button button-primary lead-search-submit"');
    expect(markup).toContain('aria-label="Pesquisar"');
    expect(markup).not.toContain('<span>Buscar</span>');
    expect(markup).not.toContain('Fila de hoje');
    expect(markup).not.toContain('<i data-lucide="clock-3"></i></header>');
    expect(markup).toContain('Maria Silva');
    expect(markup).toContain('20</strong><span>min');
    expect(markup).toContain('data-walk-in-transition="called"');
    expect(markup).toContain('Adicionar a fila de encaixes');
    expect(markup).toContain('Quem trouxe:');
    expect(markup).toContain('Ana Captadora');
    expect(markup).toContain('não altera o captador original');
  });

  it('renders the inline quick registration after an unsuccessful search', () => {
    const markup = walkInsView({
      walkIns: state({
        selectedLeadId: '',
        searchQuery: 'Cliente Novo',
        searchResults: [],
        searchSearched: true,
        quickCreate: true
      }),
      selectedLead: null,
      allowedStores: [store],
      services: [service],
      canCreate: true
    });
    expect(markup).toContain('CADASTRO RÁPIDO');
    expect(markup).toContain('walk-in-quick-name');
    expect(markup).toContain('Cadastrar e adicionar a fila');
    expect(markup).not.toContain('data-route="new"');
  });
});
