import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SavwinPersistencePlanError,
  buildSavwinPersistencePlan,
  customerCpfHash,
  saleDocumentId
} = require('../../functions/savwin-persistence-plan');

const hashKey = 'chave-ficticia-com-mais-de-32-caracteres-para-testes';
const importedAt = new Date('2026-11-07T18:00:00.000Z');

function sale(overrides = {}) {
  return {
    saleKey: '0004:4257',
    storeCode: '0004',
    storeId: 'loja-04',
    osNumber: '4257',
    saleDate: '2026-11-04',
    customerCpf: '52998224725',
    reconciliationStatus: 'matched',
    reportedSaleNetValue: 1100,
    ...overrides
  };
}

function result(overrides = {}) {
  return {
    saleKey: '0004:4257',
    status: 'matched_same_store',
    leadId: 'lead-ficticio-04',
    capturedByUid: 'captor-ficticio',
    leadStoreId: 'loja-04',
    saleStoreId: 'loja-04',
    daysToConversion: 10,
    saleNetValue: 1100,
    ...overrides
  };
}

function plan(overrides = {}) {
  return buildSavwinPersistencePlan({
    runId: 'run-homolog-20261107',
    importedAt,
    hashKey,
    sales: [sale()],
    results: [result()],
    ...overrides
  });
}

describe('SavWin persistence plan', () => {
  it('uses deterministic identifiers and never retains the full CPF', () => {
    const first = plan();
    const second = plan();

    expect(first).toEqual(second);
    expect(first.saleWrites[0].id).toBe(saleDocumentId('0004', '4257'));
    expect(first.attributionWrites[0].id).toBe(first.saleWrites[0].id);
    expect(first.reviewWrites).toEqual([]);
    expect(first.saleWrites[0].document.customerCpfHash).toBe(customerCpfHash('52998224725', hashKey));
    expect(JSON.stringify(first)).not.toContain('52998224725');
  });

  it('plans multiple OSs for the same lead without overwriting either sale', () => {
    const output = plan({
      sales: [sale(), sale({ saleKey: '0004:4258', osNumber: '4258', reportedSaleNetValue: 300 })],
      results: [result(), result({ saleKey: '0004:4258' })]
    });

    expect(output.saleWrites).toHaveLength(2);
    expect(output.attributionWrites).toHaveLength(2);
    expect(new Set(output.saleWrites.map((write) => write.id)).size).toBe(2);
    expect(output.runWrite.document).toMatchObject({
      groupedSales: 2,
      matchedSales: 2,
      unmatchedSales: 0,
      status: 'planned'
    });
  });

  it('keeps unmatched sales without creating an attribution', () => {
    const output = plan({ results: [result({ status: 'no_lead' })] });

    expect(output.saleWrites).toHaveLength(1);
    expect(output.attributionWrites).toHaveLength(0);
    expect(output.reviewWrites).toHaveLength(1);
    expect(output.reviewWrites[0]).toMatchObject({
      collection: 'savwinReviewCases',
      document: {
        storeId: 'loja-04', period: '2026-11', saleDate: '2026-11-04',
        matchStatus: 'no_lead', reviewStatus: 'pending'
      }
    });
    expect(output.reviewWrites[0].document).not.toHaveProperty('customerCpf');
    expect(output.reviewWrites[0].document).not.toHaveProperty('customerCpfHash');
    expect(output.reviewWrites[0].document).not.toHaveProperty('osNumber');
    expect(output.runWrite.document.unmatchedSales).toBe(1);
  });

  it('rejects divergence between sales and matching results', () => {
    expect(() => plan({ results: [] })).toThrow(SavwinPersistencePlanError);
    expect(() => plan({ results: [result({ status: 'unknown' })] })).toThrow(/status desconhecido/);
    expect(() => plan({ results: [result({ leadId: '' })] })).toThrow(/Atribuicao incompleta/);
  });

  it('requires the external HMAC key and rejects impossible dates', () => {
    expect(() => plan({ hashKey: '' })).toThrow(/chave de hash/);
    expect(() => plan({
      sales: [sale({ saleDate: '2026-02-31' })]
    })).toThrow(/Data de venda invalida/);
  });
});
