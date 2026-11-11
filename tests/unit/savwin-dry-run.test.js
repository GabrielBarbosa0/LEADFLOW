import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  SavwinDryRunInputError,
  buildDryRunResult,
  isValidCpf,
  validateDryRunPayload
} = require('../../functions/savwin-dry-run');

const baseSale = {
  saleKey: '0004:4257',
  storeCode: '4',
  osNumber: '4257',
  saleDate: '2026-11-04',
  customerCpf: '529.982.247-25',
  reconciliationStatus: 'matched',
  reportedSaleNetValue: 1100
};

function lead(overrides = {}) {
  return {
    id: 'lead-test-1',
    customerCpf: '52998224725',
    storeId: 'loja-04',
    capturedByUid: 'captor-test-1',
    capturedAtClient: '2026-10-20T13:00:00.000Z',
    archived: false,
    ...overrides
  };
}

describe('SavWin dry-run contract', () => {
  it('normalizes a valid payload without retaining customer names', () => {
    const result = validateDryRunPayload({
      mode: 'dry_run',
      sales: [{ ...baseSale, customerName: 'Dado que nao deve atravessar o contrato' }]
    });
    expect(result.sales[0]).toEqual({
      saleKey: '0004:4257',
      storeCode: '0004',
      storeId: 'loja-04',
      osNumber: '4257',
      saleDate: '2026-11-04',
      customerCpf: '52998224725',
      reconciliationStatus: 'matched',
      reportedSaleNetValue: 1100
    });
    expect(result.sales[0]).not.toHaveProperty('customerName');
  });

  it('rejects every mode other than dry_run and oversized batches', () => {
    expect(() => validateDryRunPayload({ mode: 'apply', sales: [baseSale] }))
      .toThrow(SavwinDryRunInputError);
    expect(() => validateDryRunPayload({ mode: 'dry_run', sales: Array(201).fill(baseSale) }))
      .toThrow('no maximo 200');
  });

  it('rejects unknown stores and impossible calendar dates', () => {
    expect(() => validateDryRunPayload({
      mode: 'dry_run',
      sales: [{ ...baseSale, storeCode: '99' }]
    })).toThrow('storeCode');
    expect(() => validateDryRunPayload({
      mode: 'dry_run',
      sales: [{ ...baseSale, saleDate: '2026-02-31' }]
    })).toThrow('saleDate');
  });

  it('validates CPF digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});

describe('SavWin dry-run matching', () => {
  it('matches one eligible lead from the same store without exposing CPF or name', () => {
    const { sales } = validateDryRunPayload({ mode: 'dry_run', sales: [baseSale] });
    const output = buildDryRunResult(sales, new Map([
      ['52998224725', [lead({ fullName: 'Nao deve sair' })]]
    ]), 90);
    expect(output.summary).toMatchObject({ salesReceived: 1, matched: 1, matchedSameStore: 1 });
    expect(output.results[0]).toMatchObject({
      saleKey: '0004:4257',
      status: 'matched_same_store',
      leadId: 'lead-test-1',
      capturedByUid: 'captor-test-1'
    });
    expect(output.results[0]).not.toHaveProperty('customerCpf');
    expect(output.results[0]).not.toHaveProperty('fullName');
  });

  it('keeps multiple eligible leads ambiguous instead of guessing attribution', () => {
    const { sales } = validateDryRunPayload({ mode: 'dry_run', sales: [baseSale] });
    const output = buildDryRunResult(sales, new Map([
      ['52998224725', [lead(), lead({ id: 'lead-test-2' })]]
    ]), 90);
    expect(output.summary.ambiguous).toBe(1);
    expect(output.results[0]).toEqual({
      saleKey: '0004:4257',
      status: 'ambiguous',
      candidateCount: 2
    });
  });

  it('classifies missing, invalid, late and unmatched CPFs without a match', () => {
    const variants = [
      { ...baseSale, saleKey: 'missing', customerCpf: '' },
      { ...baseSale, saleKey: 'invalid', customerCpf: '11111111111' },
      { ...baseSale, saleKey: 'before', customerCpf: '12612562478' },
      { ...baseSale, saleKey: 'none', customerCpf: '11144477735' }
    ];
    const { sales } = validateDryRunPayload({ mode: 'dry_run', sales: variants });
    const output = buildDryRunResult(sales, new Map([
      ['12612562478', [lead({ customerCpf: '12612562478', capturedAtClient: '2026-11-05T13:00:00.000Z' })]]
    ]), 90);
    expect(output.results.map((item) => item.status)).toEqual([
      'missing_cpf',
      'invalid_cpf',
      'sale_before_capture',
      'no_lead'
    ]);
  });

  it('does not attribute a lead outside the configured window', () => {
    const { sales } = validateDryRunPayload({ mode: 'dry_run', sales: [baseSale] });
    const output = buildDryRunResult(sales, new Map([
      ['52998224725', [lead({ capturedAtClient: '2026-01-01T13:00:00.000Z' })]]
    ]), 90);
    expect(output.summary.outsideWindow).toBe(1);
    expect(output.results[0].status).toBe('outside_window');
  });
});
