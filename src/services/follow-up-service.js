import { collection, doc, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { followUpAppointmentKey } from '../utils/follow-up.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { activeLeads } from '../utils/lead-archive.js';

export const FOLLOW_UP_QUERY_LIMIT = 500;

function permissionError(message) {
  const error = new Error(message);
  error.code = 'permission-denied';
  return error;
}

export function subscribeToTeamFollowUps(profile, onData, onError) {
  if (!isFirebaseConfigured || !['manager', 'admin'].includes(profile?.role) || (profile.role === 'manager' && !profile.storeId)) {
    throw permissionError('Retornos da equipe indisponíveis.');
  }
  const today = new Date();
  const localToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60_000)).toISOString().slice(0, 10);
  const constraints = [where('appointmentDate', '<=', localToday), limit(FOLLOW_UP_QUERY_LIMIT + 1)];
  if (profile.role === 'manager') {
    const storeIds = profileStoreIds(profile);
    constraints.unshift(where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds));
  }
  const followUpsQuery = query(collection(db, 'leads'), ...constraints);
  return onSnapshot(followUpsQuery, (snapshot) => {
    onData({
      records: activeLeads(snapshot.docs.slice(0, FOLLOW_UP_QUERY_LIMIT).map((item) => ({ id: item.id, ...item.data() }))),
      truncated: snapshot.size > FOLLOW_UP_QUERY_LIMIT
    });
  }, onError);
}

export async function markFollowUpContactStarted(profile, lead) {
  const captorOwnsLead = profile?.role === 'captor'
    && (lead?.capturedByUid === profile.uid || lead?.followUpCaptorUid === profile.uid);
  const managerCanAccess = ['manager', 'admin'].includes(profile?.role) && canAccessStore(profile, lead?.storeId);
  if (!isFirebaseConfigured || (!captorOwnsLead && !managerCanAccess)) {
    throw permissionError('Retorno não autorizado.');
  }
  await setDoc(doc(db, 'leads', lead.id), {
    followUpContactedAt: serverTimestamp(),
    followUpContactedByUid: profile.uid,
    followUpContactedByName: profile.displayName,
    followUpContactedAppointmentKey: followUpAppointmentKey(lead),
    updatedAtServer: serverTimestamp()
  }, { merge: true });
}
