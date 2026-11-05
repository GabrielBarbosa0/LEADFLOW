export function isArchivedLead(lead = {}) {
  return lead.archived === true;
}

export function activeLeads(leads = []) {
  return leads.filter((lead) => !isArchivedLead(lead));
}

export function archivedLeads(leads = []) {
  return leads.filter(isArchivedLead);
}
