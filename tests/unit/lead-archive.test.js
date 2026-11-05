import { describe, expect, it } from 'vitest';
import { activeLeads, archivedLeads, isArchivedLead } from '../../src/utils/lead-archive.js';

describe('lead archive helpers', () => {
  const records = [{ id: 'active' }, { id: 'archived', archived: true }];

  it('separates archived leads from operational records', () => {
    expect(isArchivedLead(records[1])).toBe(true);
    expect(activeLeads(records).map((lead) => lead.id)).toEqual(['active']);
    expect(archivedLeads(records).map((lead) => lead.id)).toEqual(['archived']);
  });
});
