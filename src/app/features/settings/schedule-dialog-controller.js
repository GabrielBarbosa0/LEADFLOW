import { saveStoreSchedule } from '../../../services/schedule-service.js';
import { DEFAULT_STORE_SCHEDULE, validateStoreSchedule, WEEKDAY_OPTIONS } from '../../../utils/schedule.js';
import { setFieldErrors } from '../../shared/form-helpers.js';
import { bindScheduleStoreSelection, scheduleSettingsValues } from './schedule-events.js';

export function bindScheduleDialogController({ state, render, showToast }) {
  const scheduleSettingsForm = document.querySelector('#schedule-settings-form');
  if (scheduleSettingsForm) {
    bindScheduleStoreSelection(scheduleSettingsForm, { settings: state.settings, render });
    const generalScheduleDialog = document.querySelector('#general-schedule-dialog');
    const generalScheduleFields = generalScheduleDialog?.querySelector('.schedule-settings-fields');
    const setGeneralScheduleMode = () => {
      const isFree = scheduleSettingsForm.elements.schedulingMode.value === 'free';
      generalScheduleFields?.classList.toggle('is-disabled', isFree);
    };
    const syncGeneralScheduleDraft = () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record || !generalScheduleDialog) return;
      scheduleSettingsForm.elements.schedulingMode.value = record.schedulingMode;
      scheduleSettingsForm.elements.openingTime.value = record.openingTime;
      scheduleSettingsForm.elements.closingTime.value = record.closingTime;
      generalScheduleDialog.querySelector('[name="storeHoursRules"]').value = JSON.stringify(record.storeHoursRules);
      generalScheduleDialog.querySelectorAll('[data-store-hours-row]').forEach((row) => {
        const weekday = Number(row.dataset.storeHoursRow);
        const rule = record.storeHoursRules.find((item) => item.weekday === weekday);
        const checkbox = row.querySelector('[name="storeHoursWeekday"]');
        const openingInput = row.querySelector(`[name="storeOpeningTime-${weekday}"]`);
        const closingInput = row.querySelector(`[name="storeClosingTime-${weekday}"]`);
        checkbox.checked = Boolean(rule);
        openingInput.value = rule?.openingTime || record.openingTime;
        closingInput.value = rule?.closingTime || record.closingTime;
        openingInput.disabled = !rule;
        closingInput.disabled = !rule;
        row.classList.toggle('is-active', Boolean(rule));
      });
      scheduleSettingsForm.elements.noShowGraceMinutes.value = record.noShowGraceMinutes;
      scheduleSettingsForm.elements.rescheduleAfterMinutes.value = record.rescheduleAfterMinutes;
      document.querySelector('#settings-automatic-follow-up').checked = record.automaticPendingFollowUp;
      document.querySelector('#settings-show-ametropias').checked = record.showAmetropiaFields;
      setGeneralScheduleMode();
      setFieldErrors(generalScheduleDialog, {});
    };
    const discardGeneralScheduleDraft = () => {
      syncGeneralScheduleDraft();
      generalScheduleDialog.close();
    };

    document.querySelector('[data-general-schedule-open]')?.addEventListener('click', () => {
      syncGeneralScheduleDraft();
      generalScheduleDialog?.showModal();
    });
    generalScheduleDialog?.querySelectorAll('[data-general-schedule-close]').forEach((button) => {
      button.addEventListener('click', discardGeneralScheduleDraft);
    });
    generalScheduleDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      discardGeneralScheduleDraft();
    });
    scheduleSettingsForm.elements.schedulingMode.addEventListener('change', () => {
      setGeneralScheduleMode();
      setFieldErrors(generalScheduleDialog, {});
    });
    generalScheduleDialog?.querySelectorAll('[data-store-hours-row]').forEach((row) => {
      const checkbox = row.querySelector('[name="storeHoursWeekday"]');
      const timeInputs = [...row.querySelectorAll('input[type="time"]')];
      checkbox.addEventListener('change', () => {
        row.classList.toggle('is-active', checkbox.checked);
        timeInputs.forEach((input) => { input.disabled = !checkbox.checked; });
      });
    });
    generalScheduleDialog?.querySelector('[data-general-schedule-apply]')?.addEventListener('click', () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record) return;
      const schedulingMode = scheduleSettingsForm.elements.schedulingMode.value;
      const storeHoursRules = [...generalScheduleDialog.querySelectorAll('[name="storeHoursWeekday"]:checked')].map((checkbox) => {
        const weekday = Number(checkbox.value);
        return {
          weekday,
          openingTime: generalScheduleDialog.querySelector(`[name="storeOpeningTime-${weekday}"]`).value,
          closingTime: generalScheduleDialog.querySelector(`[name="storeClosingTime-${weekday}"]`).value
        };
      });
      const primaryHours = storeHoursRules[0] || { openingTime: record.openingTime, closingTime: record.closingTime };
      const candidate = {
        ...record,
        schedulingMode,
        openingTime: primaryHours.openingTime,
        closingTime: primaryHours.closingTime,
        storeHoursRules,
        noShowGraceMinutes: Number(scheduleSettingsForm.elements.noShowGraceMinutes.value),
        rescheduleAfterMinutes: Number(scheduleSettingsForm.elements.rescheduleAfterMinutes.value),
        automaticPendingFollowUp: document.querySelector('#settings-automatic-follow-up').checked,
        showAmetropiaFields: document.querySelector('#settings-show-ametropias').checked
      };
      const validation = validateStoreSchedule(candidate);
      const errors = Object.fromEntries(Object.entries(validation.errors).filter(([name]) => (
        ['storeHoursRules', 'noShowGraceMinutes', 'rescheduleAfterMinutes'].includes(name)
      )));
      setFieldErrors(generalScheduleDialog, errors);
      if (Object.keys(errors).length) return;

      Object.assign(record, candidate);
      generalScheduleDialog.querySelector('[name="storeHoursRules"]').value = JSON.stringify(storeHoursRules);
      scheduleSettingsForm.elements.openingTime.value = primaryHours.openingTime;
      scheduleSettingsForm.elements.closingTime.value = primaryHours.closingTime;
      document.querySelector('[data-general-schedule-summary]').textContent = schedulingMode === 'free'
        ? 'Cadastro livre'
        : `${storeHoursRules.length} ${storeHoursRules.length === 1 ? 'dia aberto' : 'dias abertos'}`;
      generalScheduleDialog.close();
    });
    const limitedDaysDialog = document.querySelector('#limited-days-dialog');
    const limitedDaysEnabledInput = document.querySelector('#settings-limited-days');
    const limitedDaysFields = limitedDaysDialog?.querySelector('[data-field="limitedDayRules"]');
    const syncLimitedDaysDraft = () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record || !limitedDaysDialog) return;
      limitedDaysEnabledInput.checked = record.limitedDaysEnabled;
      limitedDaysDialog.querySelector('[name="limitedDayRules"]').value = JSON.stringify(record.limitedDayRules);
      limitedDaysDialog.querySelectorAll('[data-limited-day-row]').forEach((row) => {
        const weekday = Number(row.dataset.limitedDayRow);
        const rule = record.limitedDayRules.find((item) => item.weekday === weekday);
        const checkbox = row.querySelector('[name="limitedDayWeekday"]');
        const capacityInput = row.querySelector(`[name="limitedDayCapacity-${weekday}"]`);
        checkbox.checked = Boolean(rule);
        capacityInput.value = rule?.capacity || record.limitedDayCapacity;
        capacityInput.disabled = !rule || !record.limitedDaysEnabled;
        row.classList.toggle('is-active', Boolean(rule));
      });
      limitedDaysFields.disabled = !record.limitedDaysEnabled;
      limitedDaysFields.classList.toggle('is-disabled', !record.limitedDaysEnabled);
      limitedDaysDialog.querySelector('[data-limited-days-divider]')?.classList.toggle('is-hidden', !record.limitedDaysEnabled);
      setFieldErrors(limitedDaysDialog, {});
    };
    const discardLimitedDaysDraft = () => {
      syncLimitedDaysDraft();
      limitedDaysDialog.close();
    };

    document.querySelector('[data-limited-days-open]')?.addEventListener('click', () => {
      syncLimitedDaysDraft();
      limitedDaysDialog?.showModal();
    });
    limitedDaysDialog?.querySelectorAll('[data-limited-days-close]').forEach((button) => {
      button.addEventListener('click', discardLimitedDaysDraft);
    });
    limitedDaysDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      discardLimitedDaysDraft();
    });
    limitedDaysEnabledInput?.addEventListener('change', () => {
      limitedDaysFields.disabled = !limitedDaysEnabledInput.checked;
      limitedDaysFields.classList.toggle('is-disabled', !limitedDaysEnabledInput.checked);
      limitedDaysDialog.querySelector('[data-limited-days-divider]')?.classList.toggle('is-hidden', !limitedDaysEnabledInput.checked);
      limitedDaysDialog.querySelectorAll('[data-limited-day-row]').forEach((row) => {
        const checked = row.querySelector('[name="limitedDayWeekday"]').checked;
        row.querySelector('input[type="number"]').disabled = !limitedDaysEnabledInput.checked || !checked;
      });
      setFieldErrors(limitedDaysDialog, {});
    });
    limitedDaysDialog?.querySelectorAll('[name="limitedDayWeekday"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const row = checkbox.closest('[data-limited-day-row]');
        row.classList.toggle('is-active', checkbox.checked);
        row.querySelector('input[type="number"]').disabled = !checkbox.checked;
      });
    });
    limitedDaysDialog?.querySelector('[data-limited-days-apply]')?.addEventListener('click', () => {
      const enabled = limitedDaysEnabledInput.checked;
      const rules = [...limitedDaysDialog.querySelectorAll('[name="limitedDayWeekday"]:checked')].map((checkbox) => {
        const weekday = Number(checkbox.value);
        return {
          weekday,
          capacity: Number(limitedDaysDialog.querySelector(`[name="limitedDayCapacity-${weekday}"]`).value)
        };
      });
      const errors = {};

      if (enabled && !rules.length) errors.limitedDayRules = 'Selecione pelo menos um dia.';
      if (enabled && rules.some((rule) => !Number.isInteger(rule.capacity) || rule.capacity < 1 || rule.capacity > 100)) {
        errors.limitedDayRules = 'Informe entre 1 e 100 vagas em cada dia selecionado.';
      }
      setFieldErrors(limitedDaysDialog, errors);
      if (Object.keys(errors).length) return;

      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (record) {
        record.limitedDaysEnabled = enabled;
        if (enabled) {
          record.limitedDayRules = rules;
          record.limitedWeekdays = rules.map((rule) => rule.weekday);
          record.limitedDayCapacity = rules[0].capacity;
        }
      }
      limitedDaysDialog.querySelector('[name="limitedDayRules"]').value = JSON.stringify(enabled ? rules : record.limitedDayRules);
      document.querySelector('[data-limited-days-summary]').textContent = enabled
        ? `${rules.length} ${rules.length === 1 ? 'dia configurado' : 'dias configurados'}`
        : 'Desativado';
      limitedDaysDialog.close();
    });
    const meiQuotaDialog = document.querySelector('#mei-quota-dialog');
    const meiQuotaEnabledInput = document.querySelector('#settings-mei-quota-enabled');
    const meiQuotaFields = meiQuotaDialog?.querySelector('[data-field="meiQuotaRules"]');
    const syncMeiQuotaDraft = () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record || !meiQuotaDialog) return;
      meiQuotaEnabledInput.checked = record.meiQuotaEnabled;
      meiQuotaDialog.querySelector('[name="meiQuotaRules"]').value = JSON.stringify(record.meiQuotaRules);
      meiQuotaDialog.querySelectorAll('[data-mei-day-row]').forEach((row) => {
        const weekday = Number(row.dataset.meiDayRow);
        const rule = record.meiQuotaRules.find((item) => item.weekday === weekday);
        const checkbox = row.querySelector('[name="meiQuotaWeekday"]');
        const morningInput = row.querySelector(`[name="meiMorningQuota-${weekday}"]`);
        const afternoonInput = row.querySelector(`[name="meiAfternoonQuota-${weekday}"]`);
        checkbox.checked = Boolean(rule);
        morningInput.value = rule?.morningQuota ?? record.meiMorningQuota;
        afternoonInput.value = rule?.afternoonQuota ?? record.meiAfternoonQuota;
        morningInput.disabled = !rule || !record.meiQuotaEnabled;
        afternoonInput.disabled = !rule || !record.meiQuotaEnabled;
        row.classList.toggle('is-active', Boolean(rule));
        row.querySelector('[data-mei-day-total]').textContent = `${Number(morningInput.value) + Number(afternoonInput.value)} total`;
      });
      meiQuotaFields.disabled = !record.meiQuotaEnabled;
      meiQuotaFields.classList.toggle('is-disabled', !record.meiQuotaEnabled);
      meiQuotaDialog.querySelector('[data-mei-quota-divider]')?.classList.toggle('is-hidden', !record.meiQuotaEnabled);
      setFieldErrors(meiQuotaDialog, {});
    };
    const discardMeiQuotaDraft = () => {
      syncMeiQuotaDraft();
      meiQuotaDialog.close();
    };

    document.querySelector('[data-mei-quota-open]')?.addEventListener('click', () => {
      syncMeiQuotaDraft();
      meiQuotaDialog?.showModal();
    });
    meiQuotaDialog?.querySelectorAll('[data-mei-quota-close]').forEach((button) => {
      button.addEventListener('click', discardMeiQuotaDraft);
    });
    meiQuotaDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      discardMeiQuotaDraft();
    });
    meiQuotaEnabledInput?.addEventListener('change', () => {
      meiQuotaFields.disabled = !meiQuotaEnabledInput.checked;
      meiQuotaFields.classList.toggle('is-disabled', !meiQuotaEnabledInput.checked);
      meiQuotaDialog.querySelector('[data-mei-quota-divider]')?.classList.toggle('is-hidden', !meiQuotaEnabledInput.checked);
      meiQuotaDialog.querySelectorAll('[data-mei-day-row]').forEach((row) => {
        const checked = row.querySelector('[name="meiQuotaWeekday"]').checked;
        row.querySelectorAll('input[type="number"]').forEach((input) => {
          input.disabled = !meiQuotaEnabledInput.checked || !checked;
        });
      });
      setFieldErrors(meiQuotaDialog, {});
    });
    meiQuotaDialog?.querySelectorAll('[data-mei-day-row]').forEach((row) => {
      const checkbox = row.querySelector('[name="meiQuotaWeekday"]');
      const quotaInputs = [...row.querySelectorAll('input[type="number"]')];
      checkbox.addEventListener('change', () => {
        row.classList.toggle('is-active', checkbox.checked);
        quotaInputs.forEach((input) => { input.disabled = !checkbox.checked; });
      });
      quotaInputs.forEach((input) => input.addEventListener('input', () => {
        row.querySelector('[data-mei-day-total]').textContent = `${Number(quotaInputs[0].value) + Number(quotaInputs[1].value)} total`;
      }));
    });
    meiQuotaDialog?.querySelector('[data-mei-quota-apply]')?.addEventListener('click', () => {
      const enabled = meiQuotaEnabledInput.checked;
      const rules = [...meiQuotaDialog.querySelectorAll('[name="meiQuotaWeekday"]:checked')].map((checkbox) => {
        const weekday = Number(checkbox.value);
        return {
          weekday,
          morningQuota: Number(meiQuotaDialog.querySelector(`[name="meiMorningQuota-${weekday}"]`).value),
          afternoonQuota: Number(meiQuotaDialog.querySelector(`[name="meiAfternoonQuota-${weekday}"]`).value)
        };
      });
      const errors = {};

      if (enabled && !rules.length) errors.meiQuotaRules = 'Selecione pelo menos um dia.';
      if (enabled && rules.some((rule) => !Number.isInteger(rule.morningQuota) || rule.morningQuota < 0 || rule.morningQuota > 100
        || !Number.isInteger(rule.afternoonQuota) || rule.afternoonQuota < 0 || rule.afternoonQuota > 100
        || rule.morningQuota + rule.afternoonQuota < 1)) {
        errors.meiQuotaRules = 'Informe cotas válidas em cada dia selecionado.';
      }
      setFieldErrors(meiQuotaDialog, errors);
      if (Object.keys(errors).length) return;

      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (record) {
        record.meiQuotaEnabled = enabled;
        if (enabled) {
          record.meiQuotaRules = rules;
          record.meiQuotaWeekdays = rules.map((rule) => rule.weekday);
          record.meiMorningQuota = rules[0].morningQuota;
          record.meiAfternoonQuota = rules[0].afternoonQuota;
          record.meiDailyQuota = rules[0].morningQuota + rules[0].afternoonQuota;
        }
      }
      meiQuotaDialog.querySelector('[name="meiQuotaRules"]').value = JSON.stringify(enabled ? rules : record.meiQuotaRules);
      document.querySelector('[data-mei-quota-summary]').textContent = enabled
        ? `${rules.length} ${rules.length === 1 ? 'dia configurado' : 'dias configurados'}`
        : 'Desativadas';
      meiQuotaDialog.close();
    });
    const ophthalmologyDialog = document.querySelector('#ophthalmology-dialog');
    const optometristEnabledInput = document.querySelector('#settings-optometrist-enabled');
    const optometristFieldsGroup = ophthalmologyDialog?.querySelector('[data-optometrist-fields]');
    const ophthalmologyEnabledInput = document.querySelector('#settings-ophthalmology-enabled');
    const ophthalmologyFields = ophthalmologyDialog?.querySelector('[data-ophthalmology-fields]');
    const setOptometristFieldsState = () => {
      const enabled = optometristEnabledInput.checked;
      optometristFieldsGroup.disabled = !enabled;
      optometristFieldsGroup.classList.toggle('is-disabled', !enabled);
      ophthalmologyDialog.scrollTop = 0;
      ophthalmologyDialog.querySelectorAll('[data-optometrist-hours-row]').forEach((row) => {
        const checked = row.querySelector('[name="optometristWeekday"]').checked;
        row.querySelectorAll('input[type="time"]').forEach((input) => { input.disabled = !enabled || !checked; });
      });
    };
    const setOphthalmologyFieldsState = () => {
      const enabled = ophthalmologyEnabledInput.checked;
      ophthalmologyFields.classList.toggle('is-disabled', !enabled);
      ophthalmologyDialog.scrollTop = 0;
    };
    const syncOphthalmologyDraft = () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record || !ophthalmologyDialog) return;
      optometristEnabledInput.checked = record.optometristEnabled;
      ophthalmologyEnabledInput.checked = record.ophthalmologyRoutingEnabled;
      scheduleSettingsForm.elements.optometristExamPrice.value = record.optometristExamPrice;
      scheduleSettingsForm.elements.ophthalmologistExamPrice.value = record.ophthalmologistExamPrice;
      scheduleSettingsForm.elements.optometristOpeningTime.value = record.optometristOpeningTime;
      scheduleSettingsForm.elements.optometristClosingTime.value = record.optometristClosingTime;
      ophthalmologyDialog.querySelector('[name="optometristHoursRules"]').value = JSON.stringify(record.optometristHoursRules);
      ophthalmologyDialog.querySelectorAll('[data-optometrist-hours-row]').forEach((row) => {
        const weekday = Number(row.dataset.optometristHoursRow);
        const rule = record.optometristHoursRules.find((item) => item.weekday === weekday);
        const checkbox = row.querySelector('[name="optometristWeekday"]');
        const openingInput = row.querySelector(`[name="optometristOpeningTime-${weekday}"]`);
        const closingInput = row.querySelector(`[name="optometristClosingTime-${weekday}"]`);
        checkbox.checked = Boolean(rule);
        openingInput.value = rule?.openingTime || record.optometristOpeningTime;
        closingInput.value = rule?.closingTime || record.optometristClosingTime;
        row.classList.toggle('is-active', Boolean(rule));
      });
      ophthalmologyDialog.querySelector('[name="optometristWeekdays"]').value = JSON.stringify(record.optometristWeekdays);
      scheduleSettingsForm.elements.ophthalmologyMinimumAge.value = record.ophthalmologyMinimumAge;
      scheduleSettingsForm.elements.ophthalmologyOpeningTime.value = record.ophthalmologyOpeningTime;
      scheduleSettingsForm.elements.ophthalmologyClosingTime.value = record.ophthalmologyClosingTime;
      ophthalmologyDialog.querySelector('[name="ophthalmologyHoursRules"]').value = JSON.stringify(record.ophthalmologyHoursRules);
      ophthalmologyDialog.querySelectorAll('[data-ophthalmology-hours-row]').forEach((row) => {
        const weekday = Number(row.dataset.ophthalmologyHoursRow);
        const rule = record.ophthalmologyHoursRules.find((item) => item.weekday === weekday);
        const checkbox = row.querySelector('[name="ophthalmologyWeekday"]');
        const openingInput = row.querySelector(`[name="ophthalmologyOpeningTime-${weekday}"]`);
        const closingInput = row.querySelector(`[name="ophthalmologyClosingTime-${weekday}"]`);
        checkbox.checked = Boolean(rule);
        openingInput.value = rule?.openingTime || record.ophthalmologyOpeningTime;
        closingInput.value = rule?.closingTime || record.ophthalmologyClosingTime;
        openingInput.disabled = !rule;
        closingInput.disabled = !rule;
        row.classList.toggle('is-active', Boolean(rule));
      });
      ophthalmologyDialog.querySelector('[name="ophthalmologyWeekdays"]').value = JSON.stringify(record.ophthalmologyWeekdays);
      setOptometristFieldsState();
      setOphthalmologyFieldsState();
      setFieldErrors(ophthalmologyDialog, {});
    };
    const discardOphthalmologyDraft = () => {
      syncOphthalmologyDraft();
      ophthalmologyDialog.close();
    };
    document.querySelector('[data-ophthalmology-open]')?.addEventListener('click', () => {
      syncOphthalmologyDraft();
      ophthalmologyDialog?.showModal();
    });
    ophthalmologyDialog?.querySelectorAll('[data-ophthalmology-close]').forEach((button) => button.addEventListener('click', discardOphthalmologyDraft));
    ophthalmologyDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      discardOphthalmologyDraft();
    });
    optometristEnabledInput?.addEventListener('change', setOptometristFieldsState);
    ophthalmologyEnabledInput?.addEventListener('change', setOphthalmologyFieldsState);
    ophthalmologyDialog?.querySelectorAll('[data-optometrist-hours-row]').forEach((row) => {
      const checkbox = row.querySelector('[name="optometristWeekday"]');
      const timeInputs = [...row.querySelectorAll('input[type="time"]')];
      checkbox.addEventListener('change', () => {
        row.classList.toggle('is-active', checkbox.checked);
        timeInputs.forEach((input) => { input.disabled = !optometristEnabledInput.checked || !checkbox.checked; });
      });
    });
    ophthalmologyDialog?.querySelectorAll('[data-ophthalmology-hours-row]').forEach((row) => {
      const checkbox = row.querySelector('[name="ophthalmologyWeekday"]');
      const timeInputs = [...row.querySelectorAll('input[type="time"]')];
      checkbox.addEventListener('change', () => {
        row.classList.toggle('is-active', checkbox.checked);
        timeInputs.forEach((input) => { input.disabled = !checkbox.checked; });
      });
    });
    ophthalmologyDialog?.querySelector('[data-ophthalmology-apply]')?.addEventListener('click', () => {
      const optometristEnabled = optometristEnabledInput.checked;
      const enabled = ophthalmologyEnabledInput.checked;
      const optometristHoursRules = [...ophthalmologyDialog.querySelectorAll('[name="optometristWeekday"]:checked')].map((checkbox) => {
        const weekday = Number(checkbox.value);
        return {
          weekday,
          openingTime: ophthalmologyDialog.querySelector(`[name="optometristOpeningTime-${weekday}"]`).value,
          closingTime: ophthalmologyDialog.querySelector(`[name="optometristClosingTime-${weekday}"]`).value
        };
      });
      const ophthalmologyHoursRules = [...ophthalmologyDialog.querySelectorAll('[name="ophthalmologyWeekday"]:checked')].map((checkbox) => {
        const weekday = Number(checkbox.value);
        return {
          weekday,
          openingTime: ophthalmologyDialog.querySelector(`[name="ophthalmologyOpeningTime-${weekday}"]`).value,
          closingTime: ophthalmologyDialog.querySelector(`[name="ophthalmologyClosingTime-${weekday}"]`).value
        };
      });
      const primaryHours = ophthalmologyHoursRules[0] || {
        openingTime: scheduleSettingsForm.elements.ophthalmologyOpeningTime.value,
        closingTime: scheduleSettingsForm.elements.ophthalmologyClosingTime.value
      };
      const primaryOptometristHours = optometristHoursRules[0] || {
        openingTime: scheduleSettingsForm.elements.optometristOpeningTime.value,
        closingTime: scheduleSettingsForm.elements.optometristClosingTime.value
      };
      const candidate = {
        optometristEnabled,
        optometristWeekdays: optometristHoursRules.map((rule) => rule.weekday),
        optometristOpeningTime: primaryOptometristHours.openingTime,
        optometristClosingTime: primaryOptometristHours.closingTime,
        optometristHoursRules,
        ophthalmologyRoutingEnabled: enabled,
        optometristExamPrice: Number(scheduleSettingsForm.elements.optometristExamPrice.value),
        ophthalmologistExamPrice: Number(scheduleSettingsForm.elements.ophthalmologistExamPrice.value),
        ophthalmologyMinimumAge: Number(scheduleSettingsForm.elements.ophthalmologyMinimumAge.value),
        ophthalmologyWeekdays: ophthalmologyHoursRules.map((rule) => rule.weekday),
        ophthalmologyOpeningTime: primaryHours.openingTime,
        ophthalmologyClosingTime: primaryHours.closingTime,
        ophthalmologyHoursRules,
        ophthalmologyPathologyIds: ['cataract'],
        ophthalmologySurgeryIds: ['cataract', 'refractive', 'corneal-transplant']
      };
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      const validation = validateStoreSchedule({ ...record, ...candidate });
      const errors = Object.fromEntries(Object.entries(validation.errors).filter(([name]) => (
        name.startsWith('ophthalmology') || ['optometristExamPrice', 'ophthalmologistExamPrice'].includes(name)
      )));
      setFieldErrors(ophthalmologyDialog, errors);
      if (Object.keys(errors).length) return;
      Object.assign(record, candidate);
      ophthalmologyDialog.querySelector('[name="optometristWeekdays"]').value = JSON.stringify(candidate.optometristWeekdays);
      ophthalmologyDialog.querySelector('[name="optometristHoursRules"]').value = JSON.stringify(optometristHoursRules);
      scheduleSettingsForm.elements.optometristOpeningTime.value = primaryOptometristHours.openingTime;
      scheduleSettingsForm.elements.optometristClosingTime.value = primaryOptometristHours.closingTime;
      ophthalmologyDialog.querySelector('[name="ophthalmologyWeekdays"]').value = JSON.stringify(candidate.ophthalmologyWeekdays);
      ophthalmologyDialog.querySelector('[name="ophthalmologyHoursRules"]').value = JSON.stringify(ophthalmologyHoursRules);
      scheduleSettingsForm.elements.ophthalmologyOpeningTime.value = primaryHours.openingTime;
      scheduleSettingsForm.elements.ophthalmologyClosingTime.value = primaryHours.closingTime;
      document.querySelector('[data-ophthalmology-summary]').textContent = `Optometrista ${candidate.optometristExamPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Oftalmologista ${candidate.ophthalmologistExamPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      ophthalmologyDialog.close();
    });
    const transportDialog = document.querySelector('#transport-dialog');
    const transportEnabledInput = document.querySelector('#settings-transport-enabled');
    const transportFieldsGroup = transportDialog?.querySelector('[data-transport-fields]');
    const setTransportFieldsState = () => {
      const enabled = transportEnabledInput.checked;
      transportFieldsGroup.disabled = !enabled;
      transportFieldsGroup.classList.toggle('is-disabled', !enabled);
      transportDialog.querySelector('[data-transport-divider]')?.classList.toggle('is-hidden', !enabled);
      transportDialog.querySelectorAll('[data-transport-hours-row]').forEach((row) => {
        const checked = row.querySelector('[name="transportWeekday"]').checked;
        row.querySelectorAll('input[type="time"]').forEach((input) => { input.disabled = !enabled || !checked; });
      });
    };
    const syncTransportDraft = () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record || !transportDialog) return;
      transportEnabledInput.checked = record.transportEnabled;
      scheduleSettingsForm.elements.maxCompanions.value = record.maxCompanions;
      transportDialog.querySelector('[name="transportHoursRules"]').value = JSON.stringify(record.transportHoursRules);
      transportDialog.querySelectorAll('[data-transport-hours-row]').forEach((row) => {
        const weekday = Number(row.dataset.transportHoursRow);
        const rule = record.transportHoursRules.find((item) => item.weekday === weekday);
        const checkbox = row.querySelector('[name="transportWeekday"]');
        const openingInput = row.querySelector(`[name="transportOpeningTime-${weekday}"]`);
        const closingInput = row.querySelector(`[name="transportClosingTime-${weekday}"]`);
        checkbox.checked = Boolean(rule);
        openingInput.value = rule?.openingTime || '08:00';
        closingInput.value = rule?.closingTime || '18:00';
        row.classList.toggle('is-active', Boolean(rule));
      });
      setTransportFieldsState();
      setFieldErrors(transportDialog, {});
    };
    const discardTransportDraft = () => {
      syncTransportDraft();
      transportDialog.close();
    };
    document.querySelector('[data-transport-open]')?.addEventListener('click', () => {
      syncTransportDraft();
      transportDialog.showModal();
    });
    transportDialog?.querySelectorAll('[data-transport-close]').forEach((button) => button.addEventListener('click', discardTransportDraft));
    transportDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      discardTransportDraft();
    });
    transportEnabledInput?.addEventListener('change', setTransportFieldsState);
    transportDialog?.querySelectorAll('[data-transport-hours-row]').forEach((row) => {
      const checkbox = row.querySelector('[name="transportWeekday"]');
      checkbox.addEventListener('change', () => {
        row.classList.toggle('is-active', checkbox.checked);
        row.querySelectorAll('input[type="time"]').forEach((input) => { input.disabled = !checkbox.checked; });
      });
    });
    transportDialog?.querySelector('[data-transport-apply]')?.addEventListener('click', () => {
      const enabled = transportEnabledInput.checked;
      const rules = [...transportDialog.querySelectorAll('[name="transportWeekday"]:checked')].map((checkbox) => {
        const weekday = Number(checkbox.value);
        return {
          weekday,
          openingTime: transportDialog.querySelector(`[name="transportOpeningTime-${weekday}"]`).value,
          closingTime: transportDialog.querySelector(`[name="transportClosingTime-${weekday}"]`).value
        };
      });
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      const candidate = {
        ...record,
        transportEnabled: enabled,
        transportHoursRules: rules,
        maxCompanions: Number(scheduleSettingsForm.elements.maxCompanions.value)
      };
      const validation = validateStoreSchedule(candidate);
      const errors = Object.fromEntries(Object.entries(validation.errors).filter(([name]) => name.startsWith('transport')));
      setFieldErrors(transportDialog, errors);
      if (Object.keys(errors).length) return;
      record.transportEnabled = enabled;
      record.maxCompanions = candidate.maxCompanions;
      if (enabled) record.transportHoursRules = rules;
      transportDialog.querySelector('[name="transportHoursRules"]').value = JSON.stringify(enabled ? rules : record.transportHoursRules);
      document.querySelector('[data-transport-summary]').textContent = enabled
        ? `${rules.length} ${rules.length === 1 ? 'dia configurado' : 'dias configurados'}`
        : 'Desativado';
      transportDialog.close();
    });
    const offlineCaptureDialog = document.querySelector('#offline-capture-dialog');
    const offlineCaptureEnabledInput = document.querySelector('#settings-offline-capture-enabled');
    const syncOfflineCaptureDraft = () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record || !offlineCaptureDialog) return;
      offlineCaptureEnabledInput.checked = record.offlineCaptureEnabled;
    };
    const discardOfflineCaptureDraft = () => {
      syncOfflineCaptureDraft();
      offlineCaptureDialog.close();
    };
    document.querySelector('[data-offline-capture-open]')?.addEventListener('click', () => {
      syncOfflineCaptureDraft();
      offlineCaptureDialog?.showModal();
    });
    offlineCaptureDialog?.querySelectorAll('[data-offline-capture-close]').forEach((button) => {
      button.addEventListener('click', discardOfflineCaptureDraft);
    });
    offlineCaptureDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      discardOfflineCaptureDraft();
    });
    offlineCaptureDialog?.querySelector('[data-offline-capture-apply]')?.addEventListener('click', () => {
      const record = state.settings.records.find((item) => item.id === state.settings.selectedStoreId);
      if (!record) return;
      record.offlineCaptureEnabled = offlineCaptureEnabledInput.checked;
      document.querySelector('[data-offline-capture-summary]').textContent = record.offlineCaptureEnabled ? 'Ativado' : 'Desativado';
      offlineCaptureDialog.close();
    });
    scheduleSettingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.settings.saving) return;
      const currentStoreId = scheduleSettingsForm.elements.storeId.value;
      const current = state.settings.records.find((item) => item.id === currentStoreId) || DEFAULT_STORE_SCHEDULE;
      const values = scheduleSettingsValues(scheduleSettingsForm, current);
      state.settings.saving = true;
      state.settings.error = '';
      setFieldErrors(scheduleSettingsForm, {});
      try {
        const result = await saveStoreSchedule(state.profile, values.storeId, values);
        if (!result.isValid) {
          state.settings.saving = false;
          setFieldErrors(scheduleSettingsForm, result.errors);
          return;
        }
        const record = state.settings.records.find((item) => item.id === values.storeId);
        Object.assign(record, result.data);
        if (values.storeId === state.profile.storeId) {
          state.newLeadSchedule.settings = { ...state.newLeadSchedule.settings, ...result.data };
          state.followUps.settings = { ...state.followUps.settings, ...result.data };
          state.offlineCapture = { loaded: true, enabled: result.data.offlineCaptureEnabled };
        }
        state.settings.saving = false;
        render();
        showToast('Configuração da agenda salva.');
      } catch (error) {
        state.settings.saving = false;
        state.settings.error = error?.code === 'permission-denied'
          ? 'Seu perfil não pode alterar estas configurações.'
          : 'Não foi possível salvar a configuração.';
        render();
      }
    });
  }
}
