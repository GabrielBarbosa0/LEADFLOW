import { isArchivedLead } from '../../../utils/lead-archive.js';

export function validateLeadSearch(queryText) {
  const query = String(queryText || '').trim().replace(/\s+/g, ' ');
  const digits = query.replace(/\D/g, '');
  if (!query) return 'Informe o nome ou CPF da pessoa.';
  if (/\p{L}/u.test(query) && query.length < 3) return 'Digite pelo menos 3 letras do nome.';
  if (!/\p{L}/u.test(query) && digits.length !== 11) return 'Informe o CPF com 11 dígitos.';
  return '';
}

export function searchDemoLeads(leads = [], queryText = '', profile = {}) {
  const query = String(queryText || '').trim().toLocaleLowerCase('pt-BR');
  const digits = query.replace(/\D/g, '');
  return leads
    .filter((lead) => !isArchivedLead(lead))
    .filter((lead) => digits.length === 11
      ? String(lead.customerCpf || '').replace(/\D/g, '') === digits
      : String(lead.fullName || '').toLocaleLowerCase('pt-BR').includes(query))
    .slice(0, 20)
    .map((lead) => ({
      id: lead.id,
      fullName: lead.fullName || '',
      customerCpf: lead.customerCpf || '',
      storeId: lead.storeId || '',
      appointmentDate: lead.appointmentDate || '',
      appointmentTime: lead.appointmentTime || '',
      appointmentAttendance: lead.appointmentAttendance || '',
      appointmentServiceName: lead.appointmentServiceName || '',
      capturedByName: lead.capturedByName || '',
      canOpen: lead.capturedByUid === profile.uid || lead.followUpCaptorUid === profile.uid || profile.role === 'admin' || profile.role === 'manager'
    }));
}
