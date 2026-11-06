import { describe, expect, it } from 'vitest';
import { isAssignableLeadOwner } from '../../src/services/lead-assignment-service.js';

describe('lead assignment', () => {
  it('accepts internal system-captor profiles as lead owners', () => {
    expect(isAssignableLeadOwner({
      active: true,
      role: 'manager',
      roleProfileId: 'system-captor'
    })).toBe(true);
  });

  it('accepts active captors and rejects management-only or inactive profiles', () => {
    expect(isAssignableLeadOwner({ active: true, role: 'captor', roleProfileId: 'system-mei' })).toBe(true);
    expect(isAssignableLeadOwner({ active: true, role: 'manager', roleProfileId: 'system-manager' })).toBe(false);
    expect(isAssignableLeadOwner({ active: false, role: 'captor', roleProfileId: 'system-mei' })).toBe(false);
  });
});
