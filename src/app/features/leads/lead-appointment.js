import { ophthalmologyTriage } from '../../../utils/lead.js';
import { defaultAppointmentService, servicesForStore } from '../../../utils/service-catalog.js';
import {
  appointmentQuotaStatus,
  buildAppointmentSlots,
  isTransportAppointmentAllowed,
  isTransportDateAllowed
} from '../../../utils/schedule.js';
import { escapeHtml } from '../../shared/formatters.js';
import { careRouteAppointmentSchedule, isCareRouteDateAllowed } from '../capture/capture-schedule.js';

export function selectedLeadDetailService(lead, scheduleState) {
  const available = servicesForStore(scheduleState.services, lead?.storeId);
  return available.find((service) => service.id === scheduleState.serviceId)
    || available.find((service) => service.id === lead?.appointmentServiceId)
    || available[0]
    || defaultAppointmentService(lead?.storeId, lead?.appointmentDurationMinutes || scheduleState.settings.appointmentDurationMinutes);
}

export function leadDetailAppointmentTimeField({ lead, scheduleState, profile, online = navigator.onLine }) {
  const { settings, appointments, appointmentLoading, error } = scheduleState;
  const appointmentDate = scheduleState.leadId === lead.id
    ? scheduleState.appointmentDate
    : lead.appointmentDate || '';
  const currentValues = {
    ...lead,
    ...(scheduleState.triage || {})
  };
  const selectedTime = appointmentDate === lead.appointmentDate ? lead.appointmentTime : '';
  if (!online) {
    return '<div id="edit-appointment-time-field" class="field" data-field="appointmentTime"><label for="edit-appointmentTime">Horário disponível</label><select id="edit-appointmentTime" name="appointmentTime" disabled><option>Conecte-se para consultar os horários</option></select><small class="field-error"></small></div>';
  }
  if (settings.schedulingMode === 'free') {
    return `<div id="edit-appointment-time-field" class="field" data-field="appointmentTime"><label for="edit-appointmentTime">Horário</label><input id="edit-appointmentTime" name="appointmentTime" type="time" value="${escapeHtml(selectedTime)}" /><small class="field-error"></small></div>`;
  }

  const triage = ophthalmologyTriage(currentValues, settings);
  const routeAllowed = isCareRouteDateAllowed(settings, triage.careRoute, appointmentDate);
  const transportAllowed = !(currentValues.needsTransport === true || currentValues.needsTransport === 'true')
    || isTransportDateAllowed(settings, appointmentDate);
  const durationMinutes = selectedLeadDetailService(lead, scheduleState).durationMinutes;
  const serviceSchedule = {
    ...careRouteAppointmentSchedule(settings, triage.careRoute),
    appointmentDurationMinutes: durationMinutes
  };
  const quota = appointmentQuotaStatus(settings, appointmentDate, appointments, profile, lead.id);
  const available = appointmentDate && routeAllowed && transportAllowed && !appointmentLoading && !error
    ? buildAppointmentSlots(serviceSchedule, appointments, lead.id, { appointmentDate, profile })
      .filter((slot) => slot.available && (!(currentValues.needsTransport === true || currentValues.needsTransport === 'true') || isTransportAppointmentAllowed(
        settings,
        appointmentDate,
        slot.time,
        durationMinutes
      )))
    : [];
  let placeholder = appointmentDate ? 'Selecione um horário' : 'Escolha primeiro uma data';
  if (appointmentLoading) placeholder = 'Consultando horários...';
  else if (error) placeholder = 'Horários indisponíveis';
  else if (appointmentDate && !routeAllowed) placeholder = triage.careRoute === 'ophthalmologist'
    ? 'O oftalmologista não atende neste dia'
    : 'O optometrista não atende neste dia';
  else if (appointmentDate && !transportAllowed) placeholder = 'Transporte indisponível neste dia';
  else if (quota.reason === 'mei-day-not-allowed') placeholder = 'MEI sem cota para este dia';
  else if (quota.reason === 'mei-quota' || quota.reason === 'daily-limit') placeholder = 'Limite de agendamentos atingido';
  else if (appointmentDate && !available.length) placeholder = 'Dia sem horários disponíveis';

  return `<div id="edit-appointment-time-field" class="field" data-field="appointmentTime"><label for="edit-appointmentTime">Horário disponível</label><select id="edit-appointmentTime" name="appointmentTime" ${available.length && !quota.blocked ? '' : 'disabled'}><option value="">${placeholder}</option>${available.map((slot) => `<option value="${slot.time}" ${slot.time === selectedTime ? 'selected' : ''}>${slot.time} - ${slot.endTime}</option>`).join('')}</select><small class="field-error"></small></div>`;
}
