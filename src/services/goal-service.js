import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/client.js';
import { calculateGoalProgress, GOAL_METRIC, validateGoal } from '../utils/goal.js';
import { canAccessStore, profileStoreIds } from '../utils/permissions.js';
import { hasPermission, isCollaboratorProfile } from '../utils/role-profile.js';

export const GOALS_LEAD_LIMIT = 1000;

function canManageGoals(profile) {
  return hasPermission(profile, 'goals.manage');
}

function localDayStart(date) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function localDayAfter(date) {
  const nextDay = new Date(`${date}T00:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString();
}

async function loadGoals(profile) {
  const constraints = [];
  if (canManageGoals(profile) && profile.role !== 'admin') {
    const storeIds = profileStoreIds(profile);
    constraints.push(where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds));
  }
  if (!canManageGoals(profile)) constraints.push(where('assigneeUid', '==', profile.uid));

  const snapshot = await getDocs(query(collection(db, 'goals'), ...constraints));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function loadMembers(profile) {
  if (!canManageGoals(profile)) return [];
  const storeIds = profileStoreIds(profile);
  const usersQuery = profile.role === 'manager'
    ? query(collection(db, 'users'), where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds))
    : collection(db, 'users');
  const snapshot = await getDocs(usersQuery);

  return snapshot.docs
    .map((item) => ({ uid: item.id, ...item.data() }))
    .filter((member) => member.active === true && isCollaboratorProfile(member))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

async function loadProgressLeads(profile, goals) {
  if (!goals.length) return { leads: [], truncated: false };
  const startDate = goals.reduce((minimum, goal) => goal.startDate < minimum ? goal.startDate : minimum, goals[0].startDate);
  const endDate = goals.reduce((maximum, goal) => goal.endDate > maximum ? goal.endDate : maximum, goals[0].endDate);
  const constraints = [
    where('capturedAtClient', '>=', localDayStart(startDate)),
    where('capturedAtClient', '<', localDayAfter(endDate)),
    orderBy('capturedAtClient', 'desc'),
    limit(GOALS_LEAD_LIMIT + 1)
  ];

  if (canManageGoals(profile) && profile.role !== 'admin') {
    const storeIds = profileStoreIds(profile);
    constraints.unshift(where('storeId', storeIds.length === 1 ? '==' : 'in', storeIds.length === 1 ? storeIds[0] : storeIds));
  }
  if (!canManageGoals(profile)) constraints.unshift(where('capturedByUid', '==', profile.uid));

  const snapshot = await getDocs(query(collection(db, 'leads'), ...constraints));
  return {
    leads: snapshot.docs.slice(0, GOALS_LEAD_LIMIT).map((item) => ({ id: item.id, ...item.data() })),
    truncated: snapshot.size > GOALS_LEAD_LIMIT
  };
}

export async function loadGoalsDashboard(profile) {
  if (!isFirebaseConfigured || !profile?.uid) throw new Error('Metas indisponíveis.');
  const [goals, members] = await Promise.all([loadGoals(profile), loadMembers(profile)]);
  const { leads, truncated } = await loadProgressLeads(profile, goals);
  const progress = goals
    .map((goal) => calculateGoalProgress(goal, leads))
    .sort((a, b) => a.endDate.localeCompare(b.endDate) || a.assigneeName.localeCompare(b.assigneeName, 'pt-BR'));

  return { goals: progress, members, truncated };
}

function validateGoalMembers(profile, values, members) {
  if (!isFirebaseConfigured || !canManageGoals(profile)) {
    const error = new Error('Seu perfil não pode gerenciar metas.');
    error.code = 'permission-denied';
    throw error;
  }

  const validation = validateGoal(values);
  if (!validation.isValid) return { validation, selectedMembers: [] };
  const selectedMembers = validation.data.assigneeUids
    .map((uid) => members.find((member) => member.uid === uid))
    .filter(Boolean);
  if (selectedMembers.length !== validation.data.assigneeUids.length) {
    return {
      validation: { ...validation, isValid: false, errors: { assigneeUids: 'Um dos colaboradores selecionados não está disponível.' } },
      selectedMembers: []
    };
  }
  if (profile.role !== 'admin' && (
    !canAccessStore(profile, validation.data.storeId)
    || selectedMembers.some((member) => member.storeId !== validation.data.storeId)
  )) {
    const error = new Error('O gestor só pode criar metas para sua propria equipe.');
    error.code = 'permission-denied';
    throw error;
  }

  return { validation, selectedMembers };
}

export async function createGoals(profile, values, members) {
  const { validation, selectedMembers } = validateGoalMembers(profile, values, members);
  if (!validation.isValid) return validation;

  const batch = writeBatch(db);
  const groupId = crypto.randomUUID();
  selectedMembers.forEach((member) => {
    const goalRef = doc(collection(db, 'goals'));
    batch.set(goalRef, {
      title: validation.data.title,
      metric: GOAL_METRIC,
      targetCount: validation.data.targetCount,
      startDate: validation.data.startDate,
      endDate: validation.data.endDate,
      storeId: validation.data.storeId,
      assigneeUid: member.uid,
      assigneeName: member.displayName,
      createdByUid: profile.uid,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      groupId,
      schemaVersion: 1
    });
  });
  await batch.commit();
  return validation;
}

export async function updateGoalGroup(profile, goals, values, members) {
  const currentGoals = Array.isArray(goals) ? goals : [];
  if (!currentGoals.length) throw new Error('Meta não encontrada.');
  const { validation, selectedMembers } = validateGoalMembers(profile, values, members);
  if (!validation.isValid) return validation;
  if (profile.role === 'manager' && currentGoals.some((goal) => !canAccessStore(profile, goal.storeId))) {
    const error = new Error('Seu perfil não pode editar esta meta.');
    error.code = 'permission-denied';
    throw error;
  }

  const batch = writeBatch(db);
  const selectedByUid = new Map(selectedMembers.map((member) => [member.uid, member]));
  const currentByUid = new Map(currentGoals.map((goal) => [goal.assigneeUid, goal]));
  const groupId = currentGoals[0].groupId || currentGoals[0].id;

  currentGoals.forEach((goal) => {
    const member = selectedByUid.get(goal.assigneeUid);
    const goalRef = doc(db, 'goals', goal.id);
    if (!member) {
      batch.delete(goalRef);
      return;
    }
    batch.update(goalRef, {
      title: validation.data.title,
      targetCount: validation.data.targetCount,
      startDate: validation.data.startDate,
      endDate: validation.data.endDate,
      storeId: validation.data.storeId,
      assigneeName: member.displayName
    });
  });

  selectedMembers.forEach((member) => {
    if (currentByUid.has(member.uid)) return;
    batch.set(doc(collection(db, 'goals')), {
      title: validation.data.title,
      metric: GOAL_METRIC,
      targetCount: validation.data.targetCount,
      startDate: validation.data.startDate,
      endDate: validation.data.endDate,
      storeId: validation.data.storeId,
      assigneeUid: member.uid,
      assigneeName: member.displayName,
      createdByUid: profile.uid,
      createdByName: profile.displayName,
      createdAt: serverTimestamp(),
      groupId,
      schemaVersion: 1
    });
  });

  await batch.commit();
  return validation;
}

export async function deleteGoalGroup(profile, goals) {
  const currentGoals = Array.isArray(goals) ? goals : [];
  if (!isFirebaseConfigured || !canManageGoals(profile)
    || !currentGoals.length
    || (profile.role === 'manager' && currentGoals.some((goal) => !canAccessStore(profile, goal.storeId)))) {
    const error = new Error('Seu perfil não pode excluir esta meta.');
    error.code = 'permission-denied';
    throw error;
  }
  const batch = writeBatch(db);
  currentGoals.forEach((goal) => batch.delete(doc(db, 'goals', goal.id)));
  await batch.commit();
}
