import { describe, expect, it } from 'vitest';
import { parseManualSaleValue, validateManualSale } from '../../src/services/sale-tracking-service.js';

describe('manual sale confirmation', () => {
  it('normalizes optional Brazilian currency values', () => {
    expect(parseManualSaleValue('1.234,56')).toBe(1234.56);
    expect(parseManualSaleValue('')).toBe(0);
  });

  it('requires a non-future date and limits private notes', () => {
    expect(validateManualSale({ saleDate: '', saleValue: '' }).errors.saleDate).toBeTruthy();
    expect(validateManualSale({ saleDate: '2999-01-01' }).errors.saleDate).toContain('futura');
    const result = validateManualSale({ saleDate: '2026-11-11', orderNumber: 'OS-10', saleValue: '450,90', notes: 'Pago no balcao' });
    expect(result).toMatchObject({ isValid: true, data: { saleValue: 450.9, orderNumber: 'OS-10' } });
  });
});
