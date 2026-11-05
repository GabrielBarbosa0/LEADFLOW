import { describe, expect, it, vi } from 'vitest';
import { findManagementLead, loadManagementRecords, validateManagementPeriod } from '../../src/app/features/management/management-data.js';
import { handleManagementClick } from '../../src/app/features/management/management-events.js';
import { createDefaultManagementFilters, filterManagementRecords } from '../../src/app/features/management/management-filters.js';
import { managementView } from '../../src/app/features/management/management-view.js';

const records = [
  { id: 'lead-1', fullName: 'Maria Silva', phoneSearch: '81999991234', capturedByUid: 'captor-1', capturedByName: 'Ana Souza', storeId: 'loja-06', interestLabel: 'Óculos completo', capturedAtClient: '2026-10-20T10:00:00-03:00' },
  { id: 'lead-2', fullName: 'João Santos', phoneSearch: '81988887777', capturedByUid: 'captor-2', capturedByName: 'Bruno Lima', storeId: 'loja-02', interestLabel: 'Exame de vista', capturedAtClient: '2026-10-21T11:00:00-03:00' }
];

describe('management feature modules', () => {
  it('creates the current-month period and filters by text, phone, store and captor', () => {
    expect(createDefaultManagementFilters(new Date('2026-10-29T12:00:00-03:00'))).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-29' });
    expect(filterManagementRecords(records, { search: 'maria', storeId: '', capturedByUid: '' })).toHaveLength(1);
    expect(filterManagementRecords(records, { search: '988887777', storeId: '', capturedByUid: '' })[0].id).toBe('lead-2');
    expect(filterManagementRecords(records, { search: '', storeId: 'loja-06', capturedByUid: 'captor-1' })[0].id).toBe('lead-1');
  });

  it('validates the management query period', () => {
    expect(validateManagementPeriod({ startDate: '2026-10-29', endDate: '2026-10-01' })).toBe('Informe um período válido.');
    expect(validateManagementPeriod({ startDate: '2026-01-01', endDate: '2026-10-29' })).toContain('93 dias');
    expect(validateManagementPeriod({ startDate: '2026-10-01', endDate: '2026-10-29' })).toBe('');
  });

  it('loads remote records with normalized errors', async () => {
    await expect(loadManagementRecords({ profile: {}, filters: { startDate: '2026-10-01', endDate: '2026-10-29' }, loadRecords: vi.fn().mockResolvedValue({ records, truncated: false }) })).resolves.toMatchObject({ records, truncated: false });
    const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });
    await expect(loadManagementRecords({ profile: {}, filters: { startDate: '2026-10-01', endDate: '2026-10-29' }, loadRecords: vi.fn().mockRejectedValue(denied) })).resolves.toMatchObject({ error: 'Seu perfil não possui permissão para esta consulta.' });
  });

  it('finds records across management, appointments and active detail', () => {
    expect(findManagementLead('appointment', { records, appointments: [{ id: 'appointment' }], activeLead: null }).id).toBe('appointment');
    expect(findManagementLead('active', { records: [], appointments: [], activeLead: { id: 'active' } }).id).toBe('active');
  });

  it('renders management results, permissions and pagination', () => {
    const markup = managementView({
      allowed: true,
      management: { filters: { startDate: '2026-10-01', endDate: '2026-10-29', storeId: '', capturedByUid: '', search: '' }, loaded: true, loading: false, error: '', records, truncated: false, page: 1, pageSize: 1 },
      allowedStores: [{ id: 'loja-02', displayLabel: 'Loja 02' }, { id: 'loja-06', displayLabel: 'Loja 06' }],
      adminView: true,
      canOpenLead: true,
      permissions: { appointments: true, followUps: true, dashboard: true, export: true },
      queryLimit: 500
    });
    expect(markup).toContain('data-management-lead-id="lead-1"');
    expect(markup).toContain('1 de 2');
    expect(markup).toContain('Agenda de exames');
    expect(markup).toContain('Exportar CSV');
  });

  it('delegates lead and pagination clicks', () => {
    const openLead = vi.fn();
    const changePage = vi.fn();
    const leadElement = { dataset: { managementLeadId: 'lead-1' }, disabled: false };
    const leadEvent = { target: { closest: (selector) => selector === '[data-management-lead-id]' ? leadElement : null } };
    expect(handleManagementClick(leadEvent, { openLead, changePage })).toBe(true);
    expect(openLead).toHaveBeenCalledWith('lead-1');
    const pageElement = { dataset: { managementPage: '2' }, disabled: false };
    const pageEvent = { target: { closest: (selector) => selector === '[data-management-page]' ? pageElement : null } };
    handleManagementClick(pageEvent, { openLead, changePage });
    expect(changePage).toHaveBeenCalledWith(2);
  });
});
