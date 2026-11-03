import { APPOINTMENT_CANCELLATION_REASONS } from '../../../utils/appointment-cancellation.js';
import { escapeHtml, formatAppointmentDate } from '../../shared/formatters.js';

export function appointmentCancellationDialog({ lead, saving = false }) {
  if (!lead) return '';
  const reasons = APPOINTMENT_CANCELLATION_REASONS
    .map((reason) => `<option value="${reason.id}">${reason.label}</option>`)
    .join('');
  return `<dialog id="appointment-cancellation-dialog" class="confirmation-dialog appointment-cancellation-dialog" aria-labelledby="appointment-cancellation-title" aria-describedby="appointment-cancellation-description">
    <div class="confirmation-dialog-icon"><i data-lucide="calendar-x"></i></div>
    <div class="confirmation-dialog-copy">
      <h2 id="appointment-cancellation-title">Cancelar agendamento?</h2>
      <p id="appointment-cancellation-description">O cadastro de <strong>${escapeHtml(lead.fullName)}</strong> será preservado. O horário de ${escapeHtml(formatAppointmentDate(lead.appointmentDate))}, às ${escapeHtml(lead.appointmentTime)}, será liberado e o motivo ficará no histórico.</p>
    </div>
    <form id="appointment-cancellation-form" novalidate>
      <div class="field" data-field="reason"><label for="appointment-cancellation-reason">Motivo do cancelamento <span aria-hidden="true">*</span></label><select id="appointment-cancellation-reason" name="reason" required ${saving ? 'disabled' : ''}><option value="">Selecione o motivo</option>${reasons}</select><small class="field-error"></small></div>
      <div class="field" data-field="details"><label for="appointment-cancellation-details">Observação <span data-cancellation-details-required hidden aria-hidden="true">*</span></label><textarea id="appointment-cancellation-details" name="details" maxlength="500" rows="3" placeholder="Opcional; obrigatória para Outro motivo" ${saving ? 'disabled' : ''}></textarea><small class="field-hint"><span data-cancellation-details-count>0</span>/500</small><small class="field-error"></small></div>
      <div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-close-appointment-cancellation ${saving ? 'disabled' : ''}>Voltar</button><button class="button button-danger-solid" type="submit" ${saving ? 'disabled' : ''}><i data-lucide="calendar-x"></i><span>${saving ? 'Cancelando...' : 'Confirmar cancelamento'}</span></button></div>
    </form>
  </dialog>`;
}

export function initializeAppointmentCancellationDialog(dialog, handlers) {
  if (!dialog) return;
  const form = dialog.querySelector('#appointment-cancellation-form');
  const reason = form?.elements.reason;
  const details = form?.elements.details;
  const required = form?.querySelector('[data-cancellation-details-required]');
  const count = form?.querySelector('[data-cancellation-details-count]');
  const refresh = () => {
    if (required) required.hidden = reason?.value !== 'other';
    if (count) count.textContent = String(details?.value.length || 0);
  };
  reason?.addEventListener('change', refresh);
  details?.addEventListener('input', refresh);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submit({ reason: reason?.value, details: details?.value });
  });
  dialog.querySelector('[data-close-appointment-cancellation]')?.addEventListener('click', handlers.close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    handlers.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) handlers.close();
  });
  refresh();
}
