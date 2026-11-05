import { escapeHtml } from '../../shared/formatters.js';

export function leadAssignmentDialog({ assignment, lead }) {
  if (!assignment?.leadId || !lead) return '';
  const claim = assignment.mode === 'claim';
  const options = assignment.members.map((member) => (
    `<option value="${escapeHtml(member.uid)}" ${assignment.targetUid === member.uid ? 'selected' : ''}>${escapeHtml(member.displayName || member.email)}</option>`
  )).join('');
  return `<dialog id="lead-assignment-dialog" class="confirmation-dialog lead-assignment-dialog" aria-labelledby="lead-assignment-title">
    <div class="confirmation-dialog-icon"><i data-lucide="${claim ? 'user-round-check' : 'user-round-cog'}"></i></div>
    <div class="confirmation-dialog-copy">
      <h2 id="lead-assignment-title">${claim ? 'Assumir este lead?' : 'Transferir responsável'}</h2>
      <p>${claim
        ? `O cadastro de <strong>${escapeHtml(lead.fullName)}</strong> deixará de pertencer a <strong>${escapeHtml(lead.capturedByName || 'outro colaborador')}</strong> e passará para você. A alteração ficará registrada no histórico.`
        : `Escolha quem passará a ser responsável pelo cadastro de <strong>${escapeHtml(lead.fullName)}</strong>. O responsável anterior perderá a edição comum, e a transferência ficará registrada.`}</p>
    </div>
    ${claim ? '' : `<div class="field"><label for="lead-assignment-target">Novo responsável</label><select id="lead-assignment-target" ${assignment.loading || assignment.saving ? 'disabled' : ''}><option value="">${assignment.loading ? 'Carregando equipe...' : 'Selecione um colaborador'}</option>${options}</select></div>`}
    ${assignment.error ? `<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>${escapeHtml(assignment.error)}</span></div>` : ''}
    <div class="confirmation-dialog-actions">
      <button class="button button-secondary" type="button" data-close-lead-assignment ${assignment.saving ? 'disabled' : ''}>Voltar</button>
      <button class="button button-primary" type="button" data-confirm-lead-assignment ${assignment.saving || assignment.loading || (!claim && !assignment.targetUid) ? 'disabled' : ''}><i data-lucide="${claim ? 'handshake' : 'repeat-2'}"></i><span>${assignment.saving ? 'Salvando...' : claim ? 'Assumir lead' : 'Confirmar transferência'}</span></button>
    </div>
  </dialog>`;
}
