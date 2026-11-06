import { describe, expect, it } from 'vitest';
import {
  demoExternalOperations,
  externalOperationRecord,
  filterExternalOperationRecords
} from '../../src/services/external-operations-service.js';
import { externalOperationsView } from '../../src/app/features/external-operations/external-operations-view.js';

const lead = {
  id: 'lead-1',
  fullName: 'Maria da Silva',
  preferredName: 'Dona Maria',
  phoneSearch: '81999999999',
  storeId: 'loja-06',
  appointmentDate: '2026-11-05',
  appointmentTime: '08:00',
  needsTransport: true,
  companionCount: 1,
  transportSeats: 2,
  postalCode: '50000123',
  street: 'Rua das Flores',
  streetNumber: '12',
  neighborhood: 'Centro',
  city: 'Surubim',
  state: 'PE',
  addressReference: 'Perto da praça',
  capturedByName: 'Ana'
};

describe('external operations', () => {
  it('projects only logistical fields', () => {
    const record = externalOperationRecord({ ...lead, customerCpf: '12345678901', score: 900, paymentMethod: 'boleto' });

    expect(record).toMatchObject({ fullName: 'Maria da Silva', preferredName: 'Dona Maria', needsTransport: true, companionCount: 1 });
    expect(record).not.toHaveProperty('customerCpf');
    expect(record).not.toHaveProperty('score');
    expect(record).not.toHaveProperty('paymentMethod');
  });

  it('loads active appointments by period and store without forcing transport', () => {
    const records = demoExternalOperations([
      lead,
      { ...lead, id: 'without-transport', needsTransport: false, companionCount: 0 },
      { ...lead, id: 'cancelled', appointmentStatus: 'cancelled' },
      { ...lead, id: 'other-store', storeId: 'loja-04' }
    ], { startDate: '2026-11-05', endDate: '2026-11-05', storeId: 'loja-06' });

    expect(records.map((item) => item.id)).toEqual(['lead-1', 'without-transport']);
  });

  it('filters transport and companion independently', () => {
    const records = [
      externalOperationRecord(lead),
      externalOperationRecord({ ...lead, id: 'transport-alone', companionCount: 0 }),
      externalOperationRecord({ ...lead, id: 'own-car', needsTransport: false, companionCount: 1 })
    ];

    expect(filterExternalOperationRecords(records, { transportMode: 'with', companionMode: 'without' }).map((item) => item.id)).toEqual(['transport-alone']);
    expect(filterExternalOperationRecords(records, { transportMode: 'without', companionMode: 'with' }).map((item) => item.id)).toEqual(['own-car']);
  });

  it('renders filters, nickname, address and reference', () => {
    const record = externalOperationRecord(lead);
    const markup = externalOperationsView({
      allowed: true,
      operations: { records: [record], startDate: '2026-11-05', endDate: '2026-11-05', storeId: '', query: '', transportMode: 'all', companionMode: 'all', detailLeadId: record.id },
      allowedStores: [{ id: 'loja-06', displayLabel: 'Loja 06 - Surubim' }]
    });

    expect(markup).not.toContain('Rotas e deslocamentos');
    expect(markup).not.toContain('Organize clientes, transporte e acompanhantes por unidade.');
    expect(markup).toContain('Voltar ao início');
    expect(markup).toContain('Transporte');
    expect(markup).toContain('Acompanhante');
    expect(markup).toContain('Dona Maria');
    expect(markup).toContain('Rua das Flores');
    expect(markup).toContain('Referência: Perto da praça');
    expect(markup).not.toContain('CPF');
  });
});
