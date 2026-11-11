import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((database, name) => ({ database, name })),
  doc: vi.fn((database, name, id) => ({ database, name, id })),
  getDocs: vi.fn(),
  limit: vi.fn((value) => ({ type: 'limit', value })),
  query: vi.fn((reference, ...constraints) => ({ reference, constraints })),
  serverTimestamp: vi.fn(() => ({ type: 'server-timestamp' })),
  updateDoc: vi.fn(),
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value }))
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../../src/firebase/client.js', () => ({ db: { id: 'test-db' }, isFirebaseConfigured: true }));

import { savwinReviewView } from '../../src/app/features/savwin-review/savwin-review-view.js';
import { loadSavwinReviewCases, saveSavwinReviewDecision } from '../../src/services/savwin-review-service.js';

const manager = {
  uid: 'manager-1', role: 'manager', storeId: 'loja-04', storeIds: ['loja-04'],
  permissions: ['savwin.review']
};

function reviewCase(overrides = {}) {
  return {
    id: 'review-safe-case', storeId: 'loja-04', period: '2026-11', saleDate: '2026-11-04',
    netValue: 150, matchStatus: 'no_lead', reconciliationStatus: 'matched', reviewStatus: 'pending',
    reviewReason: '', ...overrides
  };
}

describe('SavWin review service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads only the safe projection with mandatory store and period filters', async () => {
    firestoreMocks.getDocs.mockResolvedValue({ docs: [{
      id: 'review-safe-case',
      data: () => ({ ...reviewCase(), customerCpf: '52998224725', osNumber: '4257' })
    }] });

    const result = await loadSavwinReviewCases(manager, { storeId: 'loja-04', period: '2026-11' });

    expect(result[0]).not.toHaveProperty('customerCpf');
    expect(result[0]).not.toHaveProperty('osNumber');
    expect(firestoreMocks.where).toHaveBeenCalledWith('storeId', '==', 'loja-04');
    expect(firestoreMocks.where).toHaveBeenCalledWith('period', '==', '2026-11');
  });

  it('rejects another store before reading Firestore', async () => {
    await expect(loadSavwinReviewCases(manager, { storeId: 'loja-05', period: '2026-11' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('updates only the allowed review decision fields', async () => {
    firestoreMocks.updateDoc.mockResolvedValue();

    const result = await saveSavwinReviewDecision(manager, reviewCase(), {
      reviewStatus: 'resolved', reviewReason: 'Conferido na homologacao.'
    });

    expect(result).toMatchObject({ reviewStatus: 'resolved', reviewedByUid: 'manager-1' });
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { database: { id: 'test-db' }, name: 'savwinReviewCases', id: 'review-safe-case' },
      {
        reviewStatus: 'resolved', reviewReason: 'Conferido na homologacao.',
        reviewedByUid: 'manager-1', reviewedAt: { type: 'server-timestamp' }
      }
    );
  });

  it('rejects a second decision and short justifications', async () => {
    await expect(saveSavwinReviewDecision(manager, reviewCase({ reviewStatus: 'resolved' }), {
      reviewStatus: 'dismissed', reviewReason: 'Motivo valido'
    })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(saveSavwinReviewDecision(manager, reviewCase(), {
      reviewStatus: 'resolved', reviewReason: 'Nao'
    })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
  });
});

describe('SavWin review view', () => {
  it('renders filters and safe case details without CPF or OS', () => {
    const markup = savwinReviewView({
      review: {
        loading: false, error: '', records: [reviewCase()], activeId: '', saving: false,
        filters: { storeId: 'loja-04', period: '2026-11', status: 'pending' }
      },
      allowedStores: [{ id: 'loja-04', displayLabel: 'Loja 04' }]
    });

    expect(markup).toContain('savwin-review-filters');
    expect(markup).toContain('Revisar pendencia');
    expect(markup).toContain('Lead nao encontrado');
    expect(markup).not.toMatch(/CPF|\bOS\b|52998224725|4257/i);
  });
});
