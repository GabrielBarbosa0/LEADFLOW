import { formatBrazilianPhone } from './phone.js';
import { STORES } from './stores.js';
import { calculateAge, examPaymentMethodsLabel, examPricing } from './lead.js';

function datePart(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR').format(date);
}

function timePart(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function inputDatePart(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function storeName(storeId) {
  return STORES.find((store) => store.id === storeId)?.label
    || String(storeId || '').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceName(source) {
  return source === 'street' ? 'Captação em campo' : source || '';
}

function attendanceLabel(attendance) {
  return { attended: 'Sim', missed: 'Não', pending: 'Aguardando' }[attendance] || 'Aguardando';
}

function sexLabel(sex) {
  return { female: 'Feminino', male: 'Masculino' }[sex] || 'Não informado';
}

const CSV_COLUMNS = [
  ['ID do lead', (lead) => lead.id],
  ['Nome do cliente', (lead) => lead.fullName],
  ['Nome preferido', (lead) => lead.preferredName],
  ['Telefone', (lead) => formatBrazilianPhone(lead.phoneSearch || lead.phone)],
  ['RG', (lead) => lead.customerRg],
  ['Data de nascimento', (lead) => inputDatePart(lead.birthDate)],
  ['Idade atual', (lead) => calculateAge(lead.birthDate) ?? ''],
  ['Sexo', (lead) => sexLabel(lead.sex)],
  ['Captador responsável', (lead) => lead.capturedByName],
  ['ID do captador', (lead) => lead.capturedByUid],
  ['Unidade / loja', (lead) => storeName(lead.storeId)],
  ['Data da captação', (lead) => datePart(lead.capturedAtClient)],
  ['Horário da captação', (lead) => timePart(lead.capturedAtClient)],
  ['Data do pré-agendamento', (lead) => inputDatePart(lead.appointmentDate)],
  ['Horário do pré-agendamento', (lead) => lead.appointmentTime],
  ['Tipo do exame', (lead) => lead.examPaymentType === 'courtesy' ? 'Cortesia' : 'Pago'],
  ['Forma de pagamento do exame', (lead) => lead.examPaymentType === 'courtesy' ? '' : examPaymentMethodsLabel(lead.examPaymentMethods || lead.examPaymentMethod)],
  ['Nome do pai (carnê)', (lead) => lead.creditFatherName || ''],
  ['Nome da mãe (carnê)', (lead) => lead.creditMotherName || ''],
  ['Telefone auxiliar (carnê)', (lead) => formatBrazilianPhone(lead.creditAuxiliaryPhoneSearch || lead.creditAuxiliaryPhone || '')],
  ['Valor do exame', (lead) => Number.isFinite(Number(lead.examPrice))
    ? Number(lead.examPrice)
    : examPricing(lead.careRoute, lead.examPaymentType).examPrice],
  ['Compareceu?', (lead) => lead.appointmentDate ? attendanceLabel(lead.appointmentAttendance) : ''],
  ['Precisa de transporte?', (lead) => lead.needsTransport ? 'Sim' : 'Não'],
  ['Levara acompanhante?', (lead) => lead.needsTransport && lead.hasCompanion ? 'Sim' : 'Não'],
  ['Quantidade de acompanhantes', (lead) => lead.needsTransport ? Number(lead.companionCount ?? (lead.hasCompanion ? 1 : 0)) : 0],
  ['Assentos do transporte', (lead) => Number(lead.transportSeats) || 0],
  ['Interesse principal', (lead) => lead.interestLabel],
  ['Ametropias', (lead) => Array.isArray(lead.ametropiaLabels) ? lead.ametropiaLabels.join(', ') : ''],
  ['Patologias e condições de saúde', (lead) => Array.isArray(lead.pathologyLabels) ? lead.pathologyLabels.join(', ') : ''],
  ['Rua', (lead) => lead.street],
  ['Número', (lead) => lead.streetNumber],
  ['Bairro', (lead) => lead.neighborhood],
  ['Cidade', (lead) => lead.city],
  ['UF', (lead) => lead.state],
  ['Referência do endereço', (lead) => lead.addressReference],
  ['Origem do lead', (lead) => sourceName(lead.source)],
  ['Observações', (lead) => lead.notes]
];

function protectSpreadsheetFormula(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const safeValue = protectSpreadsheetFormula(value).replaceAll('"', '""');
  return `"${safeValue}"`;
}

export function createLeadsCsv(leads) {
  const header = CSV_COLUMNS.map(([label]) => csvCell(label)).join(';');
  const rows = leads.map((lead) => CSV_COLUMNS
    .map(([, getValue]) => csvCell(getValue(lead)))
    .join(';'));
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function downloadLeadsCsv(leads, startDate, endDate) {
  const blob = new Blob([createLeadsCsv(leads)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fascinlead-detalhado-${startDate}-a-${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
