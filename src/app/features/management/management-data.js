export function findManagementLead(leadId, { records = [], appointments = [], activeLead = null }) {
  return records.find((item) => item.id === leadId)
    || appointments.find((item) => item.id === leadId)
    || (activeLead?.id === leadId ? activeLead : null);
}

export function validateManagementPeriod({ startDate, endDate }, maxRangeDays = 92) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const rangeInDays = (end - start) / 86_400_000;
  if (!startDate || !endDate || Number.isNaN(rangeInDays) || rangeInDays < 0) return 'Informe um período válido.';
  if (rangeInDays > maxRangeDays) return `Consulte no máximo ${maxRangeDays + 1} dias por vez para preservar a cota do sistema.`;
  return '';
}

export async function loadManagementRecords({ profile, filters, demoMode, demoRecords, loadRecords }) {
  const periodError = validateManagementPeriod(filters);
  if (periodError) return { error: periodError };
  if (demoMode) return { records: [...demoRecords], truncated: false };
  try {
    return await loadRecords(profile, filters.startDate, filters.endDate, { archiveStatus: filters.archiveStatus });
  } catch (error) {
    return {
      error: error?.code === 'permission-denied'
        ? 'Seu perfil não possui permissão para esta consulta.'
        : 'Não foi possível carregar o painel. Verifique a conexão e tente novamente.'
    };
  }
}
