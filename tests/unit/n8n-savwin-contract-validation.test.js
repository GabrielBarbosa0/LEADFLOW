import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const code = readFileSync(new URL('../../docs/n8n/validar-contrato-lote.js', import.meta.url), 'utf8');
const executeCodeNode = new Function('$input', code);

const sale = {
  saleKey: '0004:4257',
  storeCode: '0004',
  osNumber: '4257',
  saleDate: '2026-11-04',
  customerCpf: '52998224725',
  reconciliationStatus: 'matched',
  reportedSaleNetValue: 1100
};

function execute(jsonItems) {
  return executeCodeNode({ all: () => jsonItems.map((json) => ({ json })) });
}

describe('n8n SavWin minimum contract validation', () => {
  it('returns a safe summary without CPF, OS or value', () => {
    const [item] = execute([{
      mode: 'dry_run',
      attributionWindowDays: 90,
      sales: [sale]
    }]);
    expect(item.json).toEqual({
      payloadReady: true,
      mode: 'dry_run',
      attributionWindowDays: 90,
      salesPrepared: 1,
      salesWithCpf: 1,
      reconciliationMatched: 1,
      containsOnlyAllowedFields: true,
      externalRequestSent: false
    });
    expect(item.json).not.toHaveProperty('sales');
  });

  it('rejects fields outside the minimum contract', () => {
    expect(() => execute([{
      mode: 'dry_run',
      attributionWindowDays: 90,
      sales: [{ ...sale, customerName: 'Nao permitido' }]
    }])).toThrow('contrato minimo');
  });

  it('rejects non-dry-run and multiple batch items', () => {
    expect(() => execute([{ mode: 'apply', sales: [sale] }])).toThrow('dry_run');
    expect(() => execute([
      { mode: 'dry_run', sales: [sale] },
      { mode: 'dry_run', sales: [sale] }
    ])).toThrow('Esperado 1 lote');
  });
});
