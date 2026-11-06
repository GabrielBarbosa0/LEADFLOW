import { describe, expect, it, vi } from 'vitest';
import { lookupPostalCode } from '../../src/services/postal-code-service.js';

describe('postal code service', () => {
  it('normalizes the CEP and returns the address fields from ViaCEP', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: 'Praca da Se',
        bairro: 'Se',
        localidade: 'Sao Paulo',
        uf: 'sp'
      })
    });

    await expect(lookupPostalCode('01001-000', { fetchImpl })).resolves.toEqual({
      postalCode: '01001000',
      street: 'Praca da Se',
      neighborhood: 'Se',
      city: 'Sao Paulo',
      state: 'SP'
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/', expect.objectContaining({
      headers: { Accept: 'application/json' }
    }));
  });

  it('returns null when ViaCEP reports an unknown CEP', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ erro: true }) });
    await expect(lookupPostalCode('99999999', { fetchImpl })).resolves.toBeNull();
  });

  it('rejects invalid CEPs and failed responses', async () => {
    await expect(lookupPostalCode('123', { fetchImpl: vi.fn() })).rejects.toThrow('8 digitos');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    await expect(lookupPostalCode('01001000', { fetchImpl })).rejects.toThrow('Falha ao consultar');
  });
});
