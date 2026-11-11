import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const code = readFileSync(new URL('../../docs/n8n/montar-lote-dry-run.js', import.meta.url), 'utf8');
const executeCodeNode = new Function('$input', code);

function row(overrides = {}) {
  return {
    saleKey: '0004:4257',
    storeCode: '0004',
    osNumber: '4257',
    saleDate: '2026-11-04',
    customerCpf: '529.982.247-25',
    customerName: 'Campo que nao pode atravessar',
    products: [{ description: 'Campo que nao pode atravessar' }],
    reconciliationStatus: 'matched',
    reportedSaleNetValue: 1100,
    ...overrides
  };
}

async function execute(rows) {
  return executeCodeNode({ all: () => rows.map((json) => ({ json })) });
}

describe('n8n dry-run payload builder', () => {
  it('keeps only the minimum contract and produces one batch item', async () => {
    const [item] = await execute([row()]);
    expect(item.json).toEqual({
      mode: 'dry_run',
      attributionWindowDays: 90,
      sales: [{
        saleKey: '0004:4257',
        storeCode: '0004',
        osNumber: '4257',
        saleDate: '2026-11-04',
        customerCpf: '52998224725',
        reconciliationStatus: 'matched',
        reportedSaleNetValue: 1100
      }],
      preflight: {
        salesPrepared: 1,
        salesWithCpf: 1,
        reconciliationMatched: 1,
        externalRequestSent: false
      }
    });
    expect(item.json.sales[0]).not.toHaveProperty('customerName');
    expect(item.json.sales[0]).not.toHaveProperty('products');
  });

  it('rejects duplicate OSs, unknown stores and oversized batches', async () => {
    await expect(execute([row(), row()])).rejects.toThrow('duplicada');
    await expect(execute([row({ storeCode: '99' })])).rejects.toThrow('nao permitida');
    await expect(execute(Array.from({ length: 201 }, (_, index) => row({ saleKey: `0004:${index}` }))))
      .rejects.toThrow('limite');
  });

  it('rejects invalid values before creating the batch', async () => {
    await expect(execute([row({ saleDate: '' })])).rejects.toThrow('saleDate');
    await expect(execute([row({ reportedSaleNetValue: 'invalid' })])).rejects.toThrow('reportedSaleNetValue');
  });
});
