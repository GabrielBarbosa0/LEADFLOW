const ALLOWED_COLLECTIONS = Object.freeze({
  sales: 'savwinSales',
  attributions: 'leadSaleAttributions',
  reviews: 'savwinReviewCases',
  runs: 'savwinSyncRuns'
});

class SavwinPersistenceExecutorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SavwinPersistenceExecutorError';
  }
}

function assertEmulatorOnlyEnvironment(environment = process.env) {
  const projectId = environment.GCLOUD_PROJECT || environment.GOOGLE_CLOUD_PROJECT || '';
  if (projectId !== 'demo-leadflow'
    || !String(environment.FIRESTORE_EMULATOR_HOST || '').trim()
    || environment.SAVWIN_PERSISTENCE_APPLY_MODE !== 'emulator_only') {
    throw new SavwinPersistenceExecutorError(
      'Persistencia bloqueada: use somente o emulador demo-leadflow em modo emulator_only.'
    );
  }
}

function assertWrite(write, collection) {
  if (!write || write.collection !== collection || !String(write.id || '').trim()
    || !write.document || typeof write.document !== 'object' || Array.isArray(write.document)) {
    throw new SavwinPersistenceExecutorError(`Plano invalido para ${collection}.`);
  }
}

function validatePlan(plan) {
  assertWrite(plan?.runWrite, ALLOWED_COLLECTIONS.runs);
  if (!Array.isArray(plan.saleWrites) || plan.saleWrites.length === 0 || plan.saleWrites.length > 200) {
    throw new SavwinPersistenceExecutorError('O plano deve conter entre 1 e 200 vendas.');
  }
  if (!Array.isArray(plan.attributionWrites) || plan.attributionWrites.length > plan.saleWrites.length) {
    throw new SavwinPersistenceExecutorError('A lista de atribuicoes e invalida.');
  }
  if (!Array.isArray(plan.reviewWrites) || plan.reviewWrites.length > plan.saleWrites.length) {
    throw new SavwinPersistenceExecutorError('A lista de revisoes e invalida.');
  }
  plan.saleWrites.forEach((write) => assertWrite(write, ALLOWED_COLLECTIONS.sales));
  plan.attributionWrites.forEach((write) => assertWrite(write, ALLOWED_COLLECTIONS.attributions));
  plan.reviewWrites.forEach((write) => assertWrite(write, ALLOWED_COLLECTIONS.reviews));

  const saleIds = new Set(plan.saleWrites.map((write) => write.id));
  const attributionIds = new Set(plan.attributionWrites.map((write) => write.id));
  const reviewIds = new Set(plan.reviewWrites.map((write) => write.id));
  if (saleIds.size !== plan.saleWrites.length
    || attributionIds.size !== plan.attributionWrites.length
    || reviewIds.size !== plan.reviewWrites.length
    || [...attributionIds].some((id) => !saleIds.has(id))
    || [...reviewIds].some((id) => !saleIds.has(id) || attributionIds.has(id))) {
    throw new SavwinPersistenceExecutorError('O plano contem IDs duplicados ou atribuicoes sem venda.');
  }
  if (!/^[a-f0-9]{64}$/.test(String(plan.runWrite.document.planFingerprint || ''))) {
    throw new SavwinPersistenceExecutorError('O plano nao possui uma assinatura valida.');
  }
}

function sameSaleIdentity(existing, incoming) {
  return existing.source === incoming.source
    && existing.storeCode === incoming.storeCode
    && existing.osNumber === incoming.osNumber;
}

async function applySavwinPersistencePlan(firestore, plan, options = {}) {
  assertEmulatorOnlyEnvironment(options.environment);
  validatePlan(plan);

  const runRef = firestore.collection(ALLOWED_COLLECTIONS.runs).doc(plan.runWrite.id);
  const saleRefs = plan.saleWrites.map((write) => firestore.collection(write.collection).doc(write.id));
  const attributionRefs = plan.saleWrites.map((write) => (
    firestore.collection(ALLOWED_COLLECTIONS.attributions).doc(write.id)
  ));
  const reviewRefs = plan.saleWrites.map((write) => firestore.collection(ALLOWED_COLLECTIONS.reviews).doc(write.id));
  const plannedAttributions = new Map(plan.attributionWrites.map((write) => [write.id, write]));
  const plannedReviews = new Map(plan.reviewWrites.map((write) => [write.id, write]));

  return firestore.runTransaction(async (transaction) => {
    const [runSnapshot, ...snapshots] = await Promise.all([
      transaction.get(runRef),
      ...saleRefs.map((reference) => transaction.get(reference)),
      ...attributionRefs.map((reference) => transaction.get(reference)),
      ...reviewRefs.map((reference) => transaction.get(reference))
    ]);
    const saleSnapshots = snapshots.slice(0, saleRefs.length);
    const attributionSnapshots = snapshots.slice(saleRefs.length, saleRefs.length * 2);
    const reviewSnapshots = snapshots.slice(saleRefs.length * 2);

    if (runSnapshot.exists) {
      const existingRun = runSnapshot.data();
      if (existingRun.planFingerprint === plan.runWrite.document.planFingerprint
        && existingRun.status === 'applied') {
        return {
          alreadyApplied: true,
          salesWritten: 0,
          attributionsWritten: 0,
          attributionsRevoked: 0,
          reviewCasesWritten: 0,
          reviewCasesRemoved: 0
        };
      }
      throw new SavwinPersistenceExecutorError('runId ja utilizado por outro plano.');
    }

    for (let index = 0; index < plan.saleWrites.length; index += 1) {
      const write = plan.saleWrites[index];
      const existing = saleSnapshots[index].data();
      if (existing && !sameSaleIdentity(existing, write.document)) {
        throw new SavwinPersistenceExecutorError(`Colisao de identidade na venda ${write.id}.`);
      }
    }

    let attributionsWritten = 0;
    let attributionsRevoked = 0;
    let reviewCasesWritten = 0;
    let reviewCasesRemoved = 0;
    for (let index = 0; index < plan.saleWrites.length; index += 1) {
      const saleWrite = plan.saleWrites[index];
      const saleExisting = saleSnapshots[index].data();
      const firstImportedAt = saleExisting?.firstImportedAt || saleWrite.document.lastImportedAt;
      transaction.set(saleRefs[index], {
        ...saleWrite.document,
        firstImportedAt
      });

      const attributionWrite = plannedAttributions.get(saleWrite.id);
      const attributionExisting = attributionSnapshots[index].data();
      const reviewWrite = plannedReviews.get(saleWrite.id);
      const reviewExisting = reviewSnapshots[index].data();
      if (attributionWrite) {
        if (attributionExisting?.saleId && attributionExisting.saleId !== saleWrite.id) {
          throw new SavwinPersistenceExecutorError(`Colisao de atribuicao na venda ${saleWrite.id}.`);
        }
        transaction.set(attributionRefs[index], {
          ...attributionWrite.document,
          active: true,
          firstAttributedAt: attributionExisting?.firstAttributedAt || attributionWrite.document.attributedAt,
          lastAttributedAt: attributionWrite.document.attributedAt,
          revokedAt: null,
          revocationReason: ''
        });
        attributionsWritten += 1;
      } else if (attributionExisting?.active === true) {
        transaction.set(attributionRefs[index], {
          ...attributionExisting,
          active: false,
          attributionStatus: 'revoked',
          lastAttributedAt: saleWrite.document.lastImportedAt,
          revokedAt: saleWrite.document.lastImportedAt,
          revocationReason: saleWrite.document.matchStatus
        });
        attributionsRevoked += 1;
      }

      if (reviewWrite) {
        const preserveDecision = reviewExisting
          && reviewExisting.matchStatus === reviewWrite.document.matchStatus
          && ['resolved', 'dismissed'].includes(reviewExisting.reviewStatus);
        transaction.set(reviewRefs[index], preserveDecision ? {
          ...reviewWrite.document,
          reviewStatus: reviewExisting.reviewStatus,
          reviewReason: reviewExisting.reviewReason,
          reviewedByUid: reviewExisting.reviewedByUid,
          reviewedAt: reviewExisting.reviewedAt
        } : reviewWrite.document);
        reviewCasesWritten += 1;
      } else if (reviewExisting) {
        transaction.delete(reviewRefs[index]);
        reviewCasesRemoved += 1;
      }
    }

    transaction.set(runRef, {
      ...plan.runWrite.document,
      status: 'applied',
      appliedAt: plan.runWrite.document.finishedAt,
      salesWritten: plan.saleWrites.length,
      attributionsWritten,
      attributionsRevoked,
      reviewCasesWritten,
      reviewCasesRemoved
    });

    return {
      alreadyApplied: false,
      salesWritten: plan.saleWrites.length,
      attributionsWritten,
      attributionsRevoked,
      reviewCasesWritten,
      reviewCasesRemoved
    };
  });
}

module.exports = {
  SavwinPersistenceExecutorError,
  applySavwinPersistencePlan,
  assertEmulatorOnlyEnvironment
};
