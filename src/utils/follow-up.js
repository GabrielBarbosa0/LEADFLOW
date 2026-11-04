import { DEFAULT_STORE_SCHEDULE } from './schedule.js';
import { canAccessStore } from './permissions.js';
import { isArchivedLead } from './lead-archive.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function appointmentDateTime(lead) {
  if (!DATE_PATTERN.test(lead?.appointmentDate || '') || !TIME_PATTERN.test(lead?.appointmentTime || '')) return null;
  const appointment = new Date(`${lead.appointmentDate}T${lead.appointmentTime}:00`);
  return Number.isNaN(appointment.getTime()) ? null : appointment;
}

export function followUpAvailableAt(lead, noShowGraceMinutes = DEFAULT_STORE_SCHEDULE.noShowGraceMinutes) {
  const appointment = appointmentDateTime(lead);
  if (!appointment) return null;
  appointment.setMinutes(appointment.getMinutes() + Number(noShowGraceMinutes || 0));
  return appointment;
}

export function followUpStage(lead, settings = DEFAULT_STORE_SCHEDULE, now = new Date()) {
  const appointment = appointmentDateTime(lead);
  if (!appointment) return 'late';
  const rescheduleAfter = Number(settings?.rescheduleAfterMinutes ?? DEFAULT_STORE_SCHEDULE.rescheduleAfterMinutes);
  appointment.setMinutes(appointment.getMinutes() + rescheduleAfter);
  return appointment.getTime() <= now.getTime() ? 'reschedule' : 'late';
}

export function appointmentFollowUps(leads, profile, settings = DEFAULT_STORE_SCHEDULE, now = new Date()) {
  if (!['captor', 'manager', 'admin'].includes(profile?.role)) return [];
  return leads
    .filter((lead) => !isArchivedLead(lead))
    .filter((lead) => profile.role === 'captor'
      ? lead.capturedByUid === profile.uid
      : profile.role === 'manager' ? canAccessStore(profile, lead.storeId) : true)
    .filter((lead) => lead.appointmentStatus !== 'cancelled' && lead.appointmentAttendance !== 'cancelled')
    .filter((lead) => {
      const leadSettings = settings?.byStore?.[lead.storeId] || settings;
      return lead.appointmentAttendance === 'missed'
        || (leadSettings?.automaticPendingFollowUp === true
          && (!lead.appointmentAttendance || lead.appointmentAttendance === 'pending'));
    })
    .filter((lead) => {
      const leadSettings = settings?.byStore?.[lead.storeId] || settings;
      const grace = Number(leadSettings?.noShowGraceMinutes ?? DEFAULT_STORE_SCHEDULE.noShowGraceMinutes);
      const availableAt = followUpAvailableAt(lead, grace);
      return availableAt && availableAt.getTime() <= now.getTime();
    })
    .sort((a, b) => String(b.appointmentDate || '').localeCompare(String(a.appointmentDate || ''))
      || String(b.appointmentTime || '').localeCompare(String(a.appointmentTime || '')));
}

export function followUpAppointmentKey(lead) {
  return `${lead?.appointmentDate || ''}|${lead?.appointmentTime || ''}`;
}

export function isFollowUpContacted(lead) {
  return Boolean(lead?.followUpContactedAt
    && lead.followUpContactedAppointmentKey === followUpAppointmentKey(lead));
}

export function isAppointmentReminderDone(lead) {
  return Boolean(lead?.appointmentReminderSentAt
    && lead.appointmentReminderAppointmentKey === followUpAppointmentKey(lead));
}

export function buildWhatsAppFollowUpUrl(lead, stage = 'reschedule', senderName = '') {
  const phone = String(lead?.phone || lead?.phoneSearch || '').replace(/\D/g, '');
  if (!phone) return '';
  const internationalPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const customerName = String(lead?.preferredName || lead?.fullName || '').trim();
  const attendantName = String(senderName || '').trim();
  const greeting = customerName ? `Olá, ${customerName}!` : 'Olá!';
  const introduction = attendantName
    ? `Sou ${attendantName}, da Óticas Fascinante.`
    : 'Somos da equipe das Óticas Fascinante.';
  const message = stage === 'late'
    ? `${greeting} Seu atendimento estava marcado para ${lead.appointmentTime}. Você está a caminho?`
    : `${greeting} Tudo bem? ${introduction} Vi que você não conseguiu comparecer ao seu atendimento. Gostaria de reagendar? Posso ajudar a encontrar um novo horário que fique melhor para você.`;
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppAppointmentReminderUrl(lead, senderName = '', unitName = '') {
  const phone = String(lead?.phone || lead?.phoneSearch || '').replace(/\D/g, '');
  if (!phone) return '';
  const internationalPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const customerName = String(lead?.preferredName || lead?.fullName || '').trim();
  const responsibleName = String(senderName || '').trim();
  const appointmentDate = DATE_PATTERN.test(lead?.appointmentDate || '')
    ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      .format(new Date(`${lead.appointmentDate}T12:00:00`))
    : 'data combinada';
  const appointmentTime = TIME_PATTERN.test(lead?.appointmentTime || '') ? lead.appointmentTime : 'horário combinado';
  const professional = lead?.careRoute === 'ophthalmologist' ? 'oftalmologista' : 'optometrista';
  const unit = String(unitName || '').trim() || 'unidade combinada';
  const greeting = customerName ? `Olá, ${customerName}!` : 'Olá!';
  const introduction = responsibleName
    ? `Sou ${responsibleName}, da ConsultVision, parceira das Óticas Fascinante.`
    : 'Somos da ConsultVision, parceira das Óticas Fascinante.';
  const message = `${greeting} Tudo bem? ${introduction}\n\nPassando para lembrar que seu atendimento com o ${professional} está marcado para ${appointmentDate}, às ${appointmentTime}, na ${unit}.\n\nPodemos confirmar sua presença? Se precisar alterar o horário, é só nos avisar por aqui.`;
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}
