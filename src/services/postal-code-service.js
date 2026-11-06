import { normalizePostalCode } from '../utils/lead.js';

const VIA_CEP_BASE_URL = 'https://viacep.com.br/ws';

export async function lookupPostalCode(value, { fetchImpl = globalThis.fetch, signal } = {}) {
  const postalCode = normalizePostalCode(value);
  if (postalCode.length !== 8) throw new TypeError('O CEP deve conter 8 digitos.');
  if (typeof fetchImpl !== 'function') throw new Error('Consulta de CEP indisponivel.');

  const response = await fetchImpl(`${VIA_CEP_BASE_URL}/${postalCode}/json/`, {
    headers: { Accept: 'application/json' },
    signal
  });
  if (!response.ok) throw new Error('Falha ao consultar o CEP.');

  const result = await response.json();
  if (result?.erro === true || result?.erro === 'true') return null;

  return {
    postalCode,
    street: String(result?.logradouro || '').trim(),
    neighborhood: String(result?.bairro || '').trim(),
    city: String(result?.localidade || '').trim(),
    state: String(result?.uf || '').trim().toUpperCase()
  };
}
