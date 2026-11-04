import { describe, expect, it } from 'vitest';
import { demoExternalOperations, externalOperationRecord } from '../../src/services/external-operations-service.js';
import { externalOperationsView } from '../../src/app/features/external-operations/external-operations-view.js';

const lead = {
  id: 'lead-1',
  fullName: 'Maria da Silva',
  preferredName: 'Maria',
  phoneSearch: '81999999999',
  storeId: 'loja-06',
  appointmentDate: '2026-11-03',
  appointmentTime: '08:00',
  needsTransport: true,
  hasCompanion: true,
  companionCount: 1,
  transportSeats: 2,
  street: 'Rua das Flores',
  number: '12',
  neighborhood: 'Centro',
  city: 'Surubim',
  state: 'PE',
  addressReference: 'Perto da praca',
  capturedByName: 'Ana'
};

describe('external operations', () => {
  it('keeps only operational fields in the external projection', () => {
    const record = externalOperationRecord({ ...lead, customerCpf: '12345678901', creditScore: 900, paymentMethod: 'boleto' });

    expect(record).toMatchObject({ id: 'lead-1', fullName: 'Maria da Silva', needsTransport: true, transportSeats: 2 });
    expect(record).not.toHaveProperty('customerCpf');
    expect(record).not.toHaveProperty('creditScore');
    expect(record).not.toHaveProperty('paymentMethod');
  });

  it('filters demo operations by period, store, transport and active appointment', () => {
    const records = demoExternalOperations([
      lead,
      { ...lead, id: 'cancelled', appointmentStatus: 'cancelled' },
      { ...lead, id: 'other-date', appointmentDate: '2026-11-04' },
      { ...lead, id: 'other-store', storeId: 'loja-04' },
      { ...lead, id: 'without-transport', needsTransport: false }
    ], { startDate: '2026-11-03', endDate: '2026-11-04', storeId: 'loja-06' });

    expect(records.map((item) => item.id)).toEqual(['lead-1', 'other-date']);
  });

  it('renders logistical details without the full lead editor', () => {
    const markup = externalOperationsView({
      allowed: true,
      operations: { records: [externalOperationRecord(lead)], startDate: '2026-11-03', endDate: '2026-11-05', storeId: '', query: '', transportMode: 'all', detailLeadId: 'lead-1' },
      allowedStores: [{ id: 'loja-06', displayLabel: 'Loja 06 - Surubim' }]
    });

    expect(markup).toContain('Leads externa');
    expect(markup).toContain('Data inicial');
    expect(markup).toContain('Todos com transporte');
    expect(markup).toContain('Transporte + Acompanhante');
    expect(markup).toContain('Rua das Flores');
    expect(markup).not.toContain('CPF');
  });
});
