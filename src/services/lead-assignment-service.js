import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { canAccessStore } from '../utils/permissions.js';
import { hasPermission, isCollaboratorProfile } from '../utils/role-profile.js';
import { createId } from '../utils/id.js';
import { appointmentBlockTimes, appointmentSlotId } from '../utils/schedule.js';

export function isCancelledLead(lead) {
  return lead?.appointmentStatus === 'cancelled' || lead?.appointmentAttendance === 'cancelled';
}

export function canClaimCancelledLead(profile, lead) {
  return Boolean(
    isFirebaseConfigured
    && profile?.uid
    && profile.role === 'captor'
    && lead?.id
    && lead.capturedByUid !== profile.uid
    && isCancelledLead(lead)
    && canAccessStore(profile, lead.storeId)
    && hasPermission(profile, 'leads.create')
    && hasPermission(profile, 'leads.edit_own')
  );
}

export function canTransferLead(profile, lead) {
  return Boolean(
    isFirebaseConfigured
    && profile?.uid
    && lead?.id
    && ['manager', 'admin'].includes(profile.role)
    && canAccessStore(profile, lead.storeId)
    && hasPermission(profile, 'leads.edit_all')
  );
}

export async function loadAssignableLeadOwners(profile, lead) {
  if (!canTransferLead(profile, lead)) return [];
  const usersQuery = profile.role === 'admin'
    ? collection(db, 'users')
    : query(collection(db, 'users'), where('storeId', '==', lead.storeId));
  const snapshot = await getDocs(usersQuery);
  return snapshot.docs
    .map((item) => ({ uid: item.id, ...item.data() }))
    .filter((member) => member.active === true
      && isCollaboratorProfile(member)
      && member.uid !== lead.capturedByUid
      && (member.storeId === lead.storeId || member.storeIds?.includes(lead.storeId)))
    .sort((left, right) => String(left.displayName || '').localeCompare(String(right.displayName || ''), 'pt-BR'));
}

function assignmentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function changeLeadOwner(profile, lead, target, changeType) {
  const leadRef = doc(db, 'leads', lead.id);
  const historyRef = doc(db, 'leads', lead.id, 'history', createId());
  const occurredAtClient = new Date().toISOString();
  const actorName = String(profile.displayName || 'Usuario');
  let updatedLead;

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(leadRef);
    if (!snapshot.exists()) throw assignmentError('not-found', 'Cadastro nao encontrado.');
    const current = { id: snapshot.id, ...snapshot.data() };
    if (current.capturedByUid !== lead.capturedByUid) {
      throw assignmentError('lead-owner-changed', 'O responsavel deste lead ja foi alterado.');
    }
    if (changeType === 'claim' && !isCancelledLead(current)) {
      throw assignmentError('lead-not-cancelled', 'Somente leads cancelados podem ser assumidos.');
    }
    if (current.capturedByUid === target.uid) {
      throw assignmentError('lead-owner-unchanged', 'Este colaborador ja e o responsavel pelo lead.');
    }

    const slotSnapshots = changeType === 'reassign'
      && current.appointmentSchedulingMode !== 'free'
      && current.appointmentDate
      && current.appointmentTime
      && !isCancelledLead(current)
      ? await Promise.all(appointmentBlockTimes(current.appointmentTime, current.appointmentDurationMinutes || 20)
        .map((blockTime) => transaction.get(doc(db, 'appointmentSlots', appointmentSlotId(
          current.storeId, current.appointmentDate, blockTime
        )))))
      : [];

    const previousName = String(current.capturedByName || 'Responsavel anterior');
    const update = {
      capturedByUid: target.uid,
      capturedByName: String(target.displayName || 'Colaborador'),
      originalCapturedByUid: String(current.originalCapturedByUid || current.capturedByUid),
      originalCapturedByName: String(current.originalCapturedByName || previousName),
      ownershipUpdatedAtServer: serverTimestamp(),
      ownershipUpdatedByUid: profile.uid,
      ownershipUpdatedByName: actorName,
      ownershipChangeType: changeType,
      updatedAtServer: serverTimestamp()
    };
    transaction.update(leadRef, update);
    slotSnapshots.filter((slot) => slot.exists()).forEach((slot) => {
      transaction.update(slot.ref, { capturedByUid: target.uid });
    });
    transaction.set(historyRef, {
      leadId: current.id,
      storeId: current.storeId,
      eventType: changeType === 'claim' ? 'lead_claimed' : 'lead_reassigned',
      funnelStage: String(current.funnelStage || 'cancelled'),
      reasonCode: changeType,
      description: changeType === 'claim'
        ? `${target.displayName} assumiu o lead anteriormente atribuido a ${previousName}.`
        : `Responsavel alterado de ${previousName} para ${target.displayName}.`,
      actorUid: profile.uid,
      actorName,
      actorRole: String(profile.role || 'captor'),
      occurredAtClient,
      occurredAtServer: serverTimestamp(),
      schemaVersion: 1
    });
    updatedLead = { ...current, ...update };
  });
  return updatedLead;
}

export async function claimCancelledLead(profile, lead) {
  if (!canClaimCancelledLead(profile, lead)) {
    throw assignmentError('permission-denied', 'Seu perfil nao pode assumir este lead.');
  }
  return changeLeadOwner(profile, lead, {
    uid: profile.uid,
    displayName: String(profile.displayName || 'Colaborador')
  }, 'claim');
}

export async function transferLead(profile, lead, target) {
  if (!canTransferLead(profile, lead) || !target?.uid || target.active !== true || target.role !== 'captor') {
    throw assignmentError('permission-denied', 'Transferencia de lead nao autorizada.');
  }
  if (!canAccessStore(target, lead.storeId)) {
    throw assignmentError('invalid-target', 'O colaborador nao pertence a unidade deste lead.');
  }
  return changeLeadOwner(profile, lead, target, 'reassign');
}
