import { describe, expect, it } from 'vitest';
import { manualSaleDialog } from '../../src/app/features/sales/manual-sale-dialog.js';
import { parseManualSaleValue, validateManualSale } from '../../src/services/sale-tracking-service.js';

describe('manual sale confirmation', () => {
  it('normalizes optional Brazilian currency values', () => {
    expect(parseManualSaleValue('1.234,56')).toBe(1234.56);
    expect(parseManualSaleValue('')).toBe(0);
  });

  it('requires a non-future date, a responsible collaborator and a positive sale value', () => {
    expect(validateManualSale({ saleDate: '', saleValue: '' }).errors.saleDate).toBeTruthy();
    expect(validateManualSale({ saleDate: '2026-11-11', saleValue: '', responsibleUid: 'seller-1' }).errors.saleValue).toBeTruthy();
    expect(validateManualSale({ saleDate: '2026-11-11', saleValue: '0', responsibleUid: 'seller-1' }).errors.saleValue).toBeTruthy();
    expect(validateManualSale({ saleDate: '2999-01-01' }).errors.saleDate).toContain('futura');
    const result = validateManualSale({ saleDate: '2026-11-11', orderNumber: 'OS-10', saleValue: '450,90', responsibleUid: 'seller-1', notes: 'Pago no balcao' });
    expect(result).toMatchObject({ isValid: true, data: { saleValue: 450.9, orderNumber: 'OS-10', responsibleUid: 'seller-1' } });
    expect(validateManualSale({ saleDate: '2026-11-11' }).errors.responsibleUid).toBeTruthy();
  });

  it('keeps the purchase history separate from the registration form', () => {
    const purchase = {
      id: 'purchase-1', saleDate: '2026-11-11', saleValue: 450,
      orderNumber: 'OS-1', responsibleName: 'Colaborador Teste', status: 'confirmed'
    };
    const baseState = {
      leadId: 'lead-1', loading: false, saving: false, error: '', editingId: '',
      profileUid: 'seller-1', record: { purchases: [purchase], members: [{ uid: 'seller-1', displayName: 'Colaborador Teste' }] }
    };
    const historyOnly = manualSaleDialog({ state: { ...baseState, formOpen: false }, lead: { fullName: 'Cliente Teste' } });
    expect(historyOnly).toContain('id="manual-sale-dialog"');
    expect(historyOnly).toContain('data-lucide="circle-x"');
    expect(historyOnly).not.toContain('id="manual-sale-form-dialog"');

    const withForm = manualSaleDialog({ state: { ...baseState, formOpen: true }, lead: { fullName: 'Cliente Teste' } });
    expect(withForm).toContain('id="manual-sale-form-dialog"');
    expect(withForm).toContain('Registrar nova compra');
    expect(withForm).toContain('id="manual-sale-value" name="saleValue" inputmode="decimal" value="" required');
    expect(withForm).not.toContain('placeholder="Opcional"');
    expect(withForm).toContain('aria-label="Fechar formulário de compra"');
    expect(withForm).not.toContain('data-close-purchase-form>Voltar</button>');
  });
});
