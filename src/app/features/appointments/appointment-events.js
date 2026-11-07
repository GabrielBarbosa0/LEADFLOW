export function initializeAppointmentCreateEvents(form, handlers) {
  const phone = form.elements.phone;
  const notes = form.elements.notes;
  phone?.addEventListener('input', () => handlers.formatPhone(phone));
  notes?.addEventListener('input', () => handlers.updateNotesCount(notes.value.length));
  form.elements.storeId?.addEventListener('change', (event) => handlers.changeStore(event.target.value, form));
  form.elements.appointmentServiceId?.addEventListener('change', () => handlers.changeService(form.elements.appointmentServiceId.value, form));
  form.addEventListener('submit', (event) => { event.preventDefault(); handlers.submit(form); });
}

export function bindAppointmentListScroll(list, appointments, schedule = globalThis.requestAnimationFrame) {
  if (!list) return;
  const savedScrollTop = Number(appointments.listScrollTop);
  const restoreScrollTop = Number.isFinite(savedScrollTop) ? Math.max(0, savedScrollTop) : 0;
  schedule(() => schedule(() => {
    if (list.isConnected !== false) list.scrollTop = restoreScrollTop;
  }));
  list.addEventListener('scroll', () => {
    if (list.isConnected !== false) appointments.listScrollTop = list.scrollTop;
  }, { passive: true });
}

export async function handleAppointmentClick(event, handlers) {
  const cancellationButton = event.target.closest('[data-cancel-appointment]');
  if (cancellationButton && !cancellationButton.disabled) { handlers.requestCancellation(cancellationButton.dataset.cancelAppointment); return true; }
  const leadButton = event.target.closest('[data-appointment-lead-id]');
  if (leadButton) { handlers.openLead(leadButton.dataset.appointmentLeadId); return true; }
  const attendanceButton = event.target.closest('[data-attendance-lead]');
  if (attendanceButton && !attendanceButton.disabled) { await handlers.markAttendance(attendanceButton.dataset.attendanceLead, attendanceButton.dataset.attendanceStatus); return true; }
  const dayButton = event.target.closest('[data-appointment-date]');
  if (dayButton) { handlers.selectDate(dayButton.dataset.appointmentDate); return true; }
  const createButton = event.target.closest('[data-create-appointment]');
  if (createButton && !createButton.disabled) { await handlers.create(); return true; }
  const closeButton = event.target.closest('[data-close-appointment-create]');
  if (closeButton) { closeButton.closest('dialog')?.close(); return true; }
  const monthButton = event.target.closest('[data-appointment-month]');
  if (monthButton) { handlers.shiftMonth(Number(monthButton.dataset.appointmentMonth)); return true; }
  return false;
}

export function nextAppointmentAttendance(currentAttendance, selectedAttendance) {
  return currentAttendance === selectedAttendance ? 'pending' : selectedAttendance;
}
