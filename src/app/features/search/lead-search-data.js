export function validateLeadSearch(queryText) {
  const query = String(queryText || '').trim().replace(/\s+/g, ' ');
  const digits = query.replace(/\D/g, '');
  if (!query) return 'Informe o nome ou CPF da pessoa.';
  if (/\p{L}/u.test(query) && query.length < 3) return 'Digite pelo menos 3 letras do nome.';
  if (!/\p{L}/u.test(query) && digits.length !== 11) return 'Informe o CPF com 11 dígitos.';
  return '';
}
