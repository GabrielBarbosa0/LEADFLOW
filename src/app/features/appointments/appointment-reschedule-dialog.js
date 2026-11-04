import { APPOINTMENT_RESCHEDULE_REASONS } from '../../../utils/appointment-reschedule.js';
import { escapeHtml, formatAppointmentDate } from '../../shared/formatters.js';

export function appointmentRescheduleDialog({ lead, draft, saving = false, error = '' }) {
  if (!lead || !draft) return '';
  const reasons = APPOINTMENT_RESCHEDULE_REASONS.map((item) => `<option value="${item.id}">${item.label}</option>`).join('');
  return `<dialog id="appointment-reschedule-dialog" class="confirmation-dialog" aria-labelledby="appointment-reschedule-title">
    <div class="confirmation-dialog-icon"><i data-lucide="calendar-clock"></i></div>
    <div class="confirmation-dialog-copy"><h2 id="appointment-reschedule-title">Reagendar cliente?</h2><p><strong>${escapeHtml(lead.fullName)}</strong>: ${escapeHtml(formatAppointmentDate(lead.appointmentDate))}, às ${escapeHtml(lead.appointmentTime)} para ${escapeHtml(formatAppointmentDate(draft.appointmentDate))}, às ${escapeHtml(draft.appointmentTime)}.</p></div>
    <form id="appointment-reschedule-form" novalidate>
      ${error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(error)}</span></div>` : ''}
      <div class="field" data-field="reason"><label for="appointment-reschedule-reason">Motivo do reagendamento <span aria-hidden="true">*</span></label><select id="appointment-reschedule-reason" name="reason" required ${saving ? 'disabled' : ''}><option value="">Selecione o motivo</option>${reasons}</select><small class="field-error"></small></div>
      <div class="field" data-field="details"><label for="appointment-reschedule-details">Observação <span data-reschedule-details-required hidden aria-hidden="true">*</span></label><textarea id="appointment-reschedule-details" name="details" maxlength="500" rows="3" placeholder="Opcional; obrigatória para Outro motivo" ${saving ? 'disabled' : ''}></textarea><small class="field-error"></small></div>
      <div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-close-appointment-reschedule ${saving ? 'disabled' : ''}>Voltar</button><button class="button button-primary" type="submit" ${saving ? 'disabled' : ''}><i data-lucide="calendar-clock"></i><span>${saving ? 'Reagendando...' : 'Confirmar reagendamento'}</span></button></div>
    </form>
  </dialog>`;
}

export function initializeAppointmentRescheduleDialog(dialog, handlers) {
  const form = dialog?.querySelector('#appointment-reschedule-form');
  const reason = form?.elements.reason;
  const required = form?.querySelector('[data-reschedule-details-required]');
  reason?.addEventListener('change', () => { if (required) required.hidden = reason.value !== 'other'; });
  form?.addEventListener('submit', (event) => { event.preventDefault(); handlers.submit({ reason: reason?.value, details: form.elements.details?.value }); });
  dialog?.querySelector('[data-close-appointment-reschedule]')?.addEventListener('click', handlers.close);
  dialog?.addEventListener('cancel', (event) => { event.preventDefault(); handlers.close(); });
}
