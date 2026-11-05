export function initialFollowUpsState(current, { role, defaultSettings }) {
  return {
    loaded: !['captor', 'manager', 'admin'].includes(role),
    error: '',
    records: [],
    truncated: false,
    filter: current.filter || 'all',
    selectedCaptorId: '',
    settingsByStore: {},
    settings: { ...defaultSettings }
  };
}

export function startFollowUpsSubscriptions({
  profile,
  canViewTeam,
  storeIds,
  loadSchedules,
  subscribeSchedule,
  subscribeTeam,
  patchState,
  render
}) {
  let active = true;
  let unsubscribeSchedule = null;
  let unsubscribeTeam = null;
  const update = (patch) => {
    if (!active) return;
    patchState(patch);
    render();
  };

  if (!['captor', 'manager', 'admin'].includes(profile?.role)) return () => { active = false; };

  if (profile.role === 'admin' || storeIds.length > 1) {
    loadSchedules(profile)
      .then((records) => update({
        settingsByStore: Object.fromEntries(records.map((record) => [record.id, record])),
        loaded: true
      }))
      .catch(() => update({
        loaded: true,
        error: 'Não foi possível carregar as configurações das lojas. Usando 30 minutos.'
      }));
  } else {
    try {
      unsubscribeSchedule = subscribeSchedule(
        profile,
        (settings) => update({ settings, loaded: true, error: '' }),
        () => update({ loaded: true, error: 'Não foi possível carregar a tolerância da loja. Usando 30 minutos.' })
      );
    } catch {
      update({ loaded: true, error: 'Não foi possível carregar a tolerância da loja. Usando 30 minutos.' });
    }
  }

  if (canViewTeam) {
    try {
      unsubscribeTeam = subscribeTeam(
        profile,
        (result) => update({ records: result.records, truncated: result.truncated }),
        (error) => update({
          error: error?.code === 'permission-denied'
            ? 'Seu perfil não pode consultar os retornos desta equipe.'
            : 'Não foi possível acompanhar os retornos da equipe.'
        })
      );
    } catch {
      update({ error: 'Não foi possível acompanhar os retornos da equipe.' });
    }
  }

  return () => {
    active = false;
    unsubscribeSchedule?.();
    unsubscribeTeam?.();
  };
}
