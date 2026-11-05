import { isValidCpf, normalizeCpf } from '../../../utils/savwin-matching.js';

export const CPF_APPOINTMENT_WARNING = 'Já existe um agendamento ativo vinculado a este CPF.';

export function localDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hasActiveAppointment(lead = {}, today = localDateKey()) {
  const attendance = String(lead.appointmentAttendance || 'pending');
  return Boolean(
    lead.appointmentDate
    && lead.appointmentTime
    && String(lead.appointmentDate) >= today
    && !['attended', 'missed'].includes(attendance)
  );
}

export function cpfAppointmentStatusMarkup() {
  return '<small class="cpf-appointment-status" data-cpf-appointment-status role="status" aria-live="polite" hidden></small>';
}

export function cpfAppointmentConfirmationDialog() {
  return `<dialog id="cpf-appointment-confirmation" class="confirmation-dialog" aria-labelledby="cpf-appointment-confirmation-title" aria-describedby="cpf-appointment-confirmation-description">
    <div class="confirmation-dialog-icon"><i data-lucide="triangle-alert"></i></div>
    <div class="confirmation-dialog-copy">
      <h2 id="cpf-appointment-confirmation-title">CPF já possui agendamento</h2>
      <p id="cpf-appointment-confirmation-description">Já existe um agendamento ativo vinculado a este CPF. Deseja realmente continuar e criar outro agendamento?</p>
    </div>
    <div class="confirmation-dialog-actions">
      <button class="button button-secondary" type="button" data-cpf-appointment-cancel>Voltar e revisar</button>
      <button class="button button-danger-solid" type="button" data-cpf-appointment-confirm><i data-lucide="circle-check"></i><span>Continuar e salvar</span></button>
    </div>
  </dialog>`;
}

function updateStatus(output, status, message = '') {
  if (!output) return;
  output.dataset.status = status;
  output.textContent = message;
  output.hidden = !message;
}

export function bindCpfAppointmentWarning(form, {
  lookup,
  online = () => navigator.onLine,
  debounceMs = 450
} = {}) {
  const input = form?.elements?.customerCpf;
  const output = form?.querySelector?.('[data-cpf-appointment-status]');
  let timer = null;
  let requestSequence = 0;
  let lastCpf = '';
  let lastResult = false;

  const clear = () => {
    requestSequence += 1;
    lastCpf = '';
    lastResult = false;
    updateStatus(output, '', '');
  };

  const check = async ({ force = false } = {}) => {
    const cpf = normalizeCpf(input?.value);
    if (!online() || !isValidCpf(cpf) || typeof lookup !== 'function') {
      clear();
      return false;
    }
    if (!force && cpf === lastCpf) return lastResult;

    const sequence = ++requestSequence;
    updateStatus(output, 'checking', 'Verificando agendamentos...');
    try {
      const result = await lookup(cpf);
      if (sequence !== requestSequence || normalizeCpf(input?.value) !== cpf) return false;
      lastCpf = cpf;
      lastResult = result?.hasAppointment === true;
      updateStatus(output, lastResult ? 'warning' : '', lastResult ? CPF_APPOINTMENT_WARNING : '');
      return lastResult;
    } catch {
      if (sequence !== requestSequence || normalizeCpf(input?.value) !== cpf) return false;
      lastCpf = '';
      lastResult = false;
      updateStatus(output, 'unavailable', 'Não foi possível verificar agendamentos agora.');
      return null;
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    clear();
    if (!online() || !isValidCpf(input?.value)) return;
    timer = setTimeout(() => check(), debounceMs);
  };

  input?.addEventListener('input', schedule);
  input?.addEventListener('blur', () => {
    if (timer) clearTimeout(timer);
    check();
  });
  if (isValidCpf(input?.value) && online()) schedule();

  return {
    checkNow: () => {
      if (timer) clearTimeout(timer);
      return check({ force: true });
    }
  };
}

export function confirmDuplicateCpfAppointment(dialog) {
  if (!dialog) return Promise.resolve(false);
  return new Promise((resolve) => {
    const confirmButton = dialog.querySelector('[data-cpf-appointment-confirm]');
    const cancelButton = dialog.querySelector('[data-cpf-appointment-cancel]');
    let settled = false;
    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      dialog.close();
      confirmButton?.removeEventListener('click', confirm);
      cancelButton?.removeEventListener('click', cancel);
      dialog.removeEventListener('cancel', cancel);
      resolve(confirmed);
    };
    const confirm = () => finish(true);
    const cancel = (event) => {
      event?.preventDefault?.();
      finish(false);
    };
    confirmButton?.addEventListener('click', confirm);
    cancelButton?.addEventListener('click', cancel);
    dialog.addEventListener('cancel', cancel);
    dialog.showModal();
  });
}
