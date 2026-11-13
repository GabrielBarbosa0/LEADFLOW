import { describe, expect, it } from 'vitest';
import { validateLeadSearch } from '../../src/app/features/search/lead-search-data.js';
import { leadSearchView } from '../../src/app/features/search/lead-search-view.js';

const leads = [
  {
    id: 'scheduled',
    fullName: 'Maria Silva',
    customerCpf: '52998224725',
    storeId: 'loja-06',
    capturedByUid: 'captor-1',
    capturedByName: 'Ana',
    canOpen: true,
    appointmentDate: '2026-11-05',
    appointmentTime: '08:20',
    appointmentServiceName: 'Exame de vista'
  },
  {
    id: 'unscheduled',
    fullName: 'Mariana Souza',
    customerCpf: '12345678909',
    storeId: 'loja-06',
    capturedByUid: 'captor-2',
    canOpen: false
  },
  {
    id: 'cancelled',
    fullName: 'Marina Cancelada',
    customerCpf: '11144477735',
    storeId: 'loja-06',
    capturedByName: 'Carlos',
    canOpen: true,
    canClaim: true,
    appointmentDate: '2026-11-04',
    appointmentTime: '10:00',
    appointmentStatus: 'cancelled',
    appointmentAttendance: 'cancelled'
  }
];

describe('lead appointment search', () => {
  it('validates names and complete CPF numbers', () => {
    expect(validateLeadSearch('')).toBeTruthy();
    expect(validateLeadSearch('Ma')).toBeTruthy();
    expect(validateLeadSearch('Maria')).toBe('');
    expect(validateLeadSearch('529.982.247-25')).toBe('');
  });

  it('renders scheduled and unscheduled results', () => {
    const markup = leadSearchView({
      search: { query: 'maria', loading: false, searched: true, error: '', results: leads }
    });
    expect(markup).toContain('Agendado');
    expect(markup).toContain('Aguardando agendamento');
    expect(markup).toContain('Cancelado');
    expect(markup).toContain('Consultar lead cancelado');
    expect(markup).toContain('05 de novembro às 08:20');
    expect(markup).toContain('CPF 529.982.247-25');
    expect(markup).toContain('data-search-open-lead="scheduled"');
  });

  it('renders a compact icon-only search command with an accessible name', () => {
    const markup = leadSearchView({
      search: { query: '', loading: false, searched: false, error: '', results: [] }
    });
    expect(markup).toContain('class="button button-primary lead-search-submit"');
    expect(markup).toContain('aria-label="Pesquisar"');
    expect(markup).not.toContain('<span>Pesquisar</span>');
  });
});
