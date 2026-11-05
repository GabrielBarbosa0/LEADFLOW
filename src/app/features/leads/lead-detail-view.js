import { formatBrazilianPostalCode, INTERESTS } from '../../../utils/lead.js';
import { leadOriginLabel } from '../../../utils/lead-origin.js';
import { formatBrazilianPhone } from '../../../utils/phone.js';
import { servicesForStore } from '../../../utils/service-catalog.js';
import { formatBrazilianCpf } from '../../../utils/savwin-matching.js';
import {
  escapeHtml,
  storeLabel,
  syncLabel,
  toLocalDateInput
} from '../../shared/formatters.js';
import { birthAgeText } from '../../shared/form-helpers.js';
import { ametropiaOptions, eyeTriageFields, pathologyOptions, sexOptions, triageConfigFields } from '../capture/capture-triage.js';
import { transportFields } from '../capture/capture-transport.js';
import { selectedLeadDetailService } from './lead-appointment.js';

export function leadDetailView({
  lead,
  managementMode,
  canManage,
  profileRole,
  scheduleState,
  appointmentTimeMarkup,
  canDelete,
  canEditClinical = false,
  readOnly = false,
  inDialog = false,
  history = { loading: false, error: '', records: [], stage: '' }
}) {
  if (managementMode && !canManage) {
    return '<div class="notice notice-danger"><i data-lucide="circle-alert"></i><span>Seu perfil não pode alterar leads da equipe.</span></div>';
  }

  const backRoute = readOnly ? 'search' : managementMode ? 'management' : 'leads';
  if (!lead) {
    return `<section class="page-toolbar"><button class="back-button" type="button" data-route="${backRoute}" aria-label="Voltar"><i data-lucide="arrow-left"></i></button></section><div class="notice notice-warning"><i data-lucide="info"></i><span>Cadastro não encontrado. Volte para a lista e tente novamente.</span></div>`;
  }

  const [syncStatus, syncTone] = managementMode ? ['Sincronizado', 'success'] : syncLabel(lead);
  const originLabel = leadOriginLabel(lead);
  const managerReschedule = managementMode && profileRole === 'manager' && !canEditClinical;
  const offlineEdit = !navigator.onLine;
  const locked = managerReschedule || offlineEdit || readOnly ? 'disabled' : '';
  const renderedAppointmentTimeMarkup = readOnly
    ? appointmentTimeMarkup.replace(/<select\b(?![^>]*\bdisabled\b)/g, '<select disabled').replace(/<input\b(?![^>]*\bdisabled\b)/g, '<input disabled')
    : appointmentTimeMarkup;
  const showAmetropiaFields = scheduleState.storeId === lead.storeId && scheduleState.settings.showAmetropiaFields;
  const interests = INTERESTS.map((item) => `<option value="${item.id}" ${lead.interestId === item.id ? 'selected' : ''}>${item.label}</option>`).join('');
  const selectedService = selectedLeadDetailService(lead, scheduleState);
  const availableServices = servicesForStore(scheduleState.services, lead.storeId);
  const serviceOptions = (availableServices.length ? availableServices : [selectedService])
    .map((service) => `<option value="${escapeHtml(service.id)}" ${service.id === selectedService.id ? 'selected' : ''}>${escapeHtml(service.name)} - ${service.durationMinutes} min</option>`)
    .join('');
  const heading = inDialog
    ? `<header class="lead-detail-dialog-header"><div><p class="eyebrow">CADASTRO</p><h2>${escapeHtml(lead.fullName)}</h2></div><button class="icon-button" type="button" data-close-lead-detail title="Fechar" aria-label="Fechar cadastro"><i data-lucide="circle-x"></i></button></header>`
    : `<section class="page-toolbar detail-toolbar"><button class="back-button" type="button" data-route="${backRoute}" aria-label="Voltar"><i data-lucide="arrow-left"></i></button><h2>${escapeHtml(lead.fullName)}</h2></section>`;
  return `
    ${heading}
    <section class="lead-detail-summary" aria-label="Informações do cadastro">
      <div><span>Status</span><strong class="status-badge status-${syncTone}">${syncStatus}</strong></div>
      <div><span>Loja</span><strong>${escapeHtml(storeLabel(lead.storeId))}</strong></div>
      ${originLabel ? `<div><span>Origem do registro</span><strong class="lead-origin-badge"><i data-lucide="archive"></i>${escapeHtml(originLabel)}</strong></div>` : ''}
      <button class="lead-history-summary" type="button" data-open-lead-history aria-haspopup="dialog"><span>Histórico do lead</span><strong>Ver histórico</strong><small>Ver todas as alterações</small></button>
    </section>
    <form id="edit-lead-form" class="form-panel" data-lead-id="${escapeHtml(lead.id)}" data-management="${managementMode}" data-read-only="${readOnly}" novalidate>
      ${readOnly ? '<div class="notice notice-info"><i data-lucide="eye"></i><span>Consulta somente leitura. Este perfil não pode alterar nem excluir o cadastro.</span></div>' : offlineEdit ? '<div class="notice notice-warning"><i data-lucide="wifi-off"></i><span>O cadastro pode ser consultado offline, mas alterações e agendamento exigem internet.</span></div>' : ''}
      <input name="schedulingMode" type="hidden" value="${escapeHtml(scheduleState.settings.schedulingMode || lead.appointmentSchedulingMode || 'controlled')}" />
      ${triageConfigFields(scheduleState.settings)}
      <input name="appointmentDurationMinutes" type="hidden" value="${selectedService.durationMinutes}" />
      <input name="appointmentServiceName" type="hidden" value="${escapeHtml(selectedService.name)}" />
      <div class="field-row lead-identification-fields">
        <div class="field" data-field="fullName"><label for="edit-fullName">Nome <span aria-hidden="true">*</span></label><input id="edit-fullName" name="fullName" autocomplete="name" maxlength="120" value="${escapeHtml(lead.fullName)}" required ${locked} /><small class="field-error"></small></div>
        <div class="field" data-field="savwinCode"><label for="edit-savwinCode">Cod. SavWin</label><input id="edit-savwinCode" name="savwinCode" maxlength="40" autocomplete="off" value="${escapeHtml(lead.savwinCode || '')}" placeholder="Código do cliente" ${locked} /><small class="field-error"></small></div>
        <div class="field" data-field="score"><label for="edit-score">Score</label><input id="edit-score" name="score" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${escapeHtml(lead.score ?? '')}" placeholder="0 a 1000" ${locked} /><small class="field-error"></small></div>
      </div>
      <div class="field-row contact-fields"><div class="field" data-field="phone"><label for="edit-phone">Telefone ou WhatsApp <span aria-hidden="true">*</span></label><input id="edit-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" value="${escapeHtml(formatBrazilianPhone(lead.phoneSearch))}" required ${locked} /><small class="field-error"></small></div><div class="field" data-field="customerRg"><label for="edit-customerRg">RG</label><input id="edit-customerRg" name="customerRg" maxlength="20" autocomplete="off" value="${escapeHtml(lead.customerRg || '')}" placeholder="0.000.000" ${locked} /><small class="field-error"></small></div></div>
      <div class="field-row identity-fields"><div class="field" data-field="customerCpf"><label for="edit-customerCpf">CPF</label><input id="edit-customerCpf" name="customerCpf" inputmode="numeric" autocomplete="off" maxlength="14" value="${escapeHtml(formatBrazilianCpf(lead.customerCpf))}" placeholder="000.000.000-00" ${locked} /><small class="field-error"></small></div><div class="field" data-field="birthDate"><label for="edit-birthDate">Data de nascimento</label><input id="edit-birthDate" name="birthDate" type="date" autocomplete="bday" max="${toLocalDateInput(new Date())}" value="${escapeHtml(lead.birthDate)}" ${locked} /><small class="birth-age-hint" data-birth-age>${escapeHtml(birthAgeText(lead.birthDate))}</small><small class="field-error"></small></div><div class="field" data-field="sex"><label for="edit-sex">Sexo</label><select id="edit-sex" name="sex" ${locked}>${sexOptions(lead.sex)}</select><small class="field-error"></small></div></div>
      <div class="field"><label for="edit-preferredName">Como prefere ser chamado</label><input id="edit-preferredName" name="preferredName" maxlength="60" value="${escapeHtml(lead.preferredName)}" ${locked} /></div>
      <div class="field" data-field="postalCode"><label for="edit-postalCode">CEP</label><input id="edit-postalCode" name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" value="${escapeHtml(formatBrazilianPostalCode(lead.postalCode || ''))}" placeholder="00000-000" ${locked} /><small class="field-error"></small></div>
      <div class="field-row address-fields">
        <div class="field address-street" data-field="street"><label for="edit-street">Rua</label><input id="edit-street" name="street" maxlength="120" autocomplete="address-line1" value="${escapeHtml(lead.street)}" ${locked} /><small class="field-error"></small></div>
        <div class="field address-number" data-field="streetNumber"><label for="edit-streetNumber">Número</label><input id="edit-streetNumber" name="streetNumber" maxlength="12" autocomplete="address-line2" value="${escapeHtml(lead.streetNumber)}" placeholder="S/N" ${locked} /><small class="field-error"></small></div>
        <div class="field address-neighborhood"><label for="edit-neighborhood">Bairro</label><input id="edit-neighborhood" name="neighborhood" maxlength="80" value="${escapeHtml(lead.neighborhood)}" ${locked} /></div>
        <div class="field address-city"><label for="edit-city">Cidade</label><input id="edit-city" name="city" maxlength="80" value="${escapeHtml(lead.city)}" ${locked} /></div>
        <div class="field field-state"><label for="edit-state">UF</label><input id="edit-state" name="state" maxlength="2" value="${escapeHtml(lead.state || 'PE')}" ${locked} /></div>
      </div>
      <div class="field address-reference-field" data-field="addressReference"><label for="edit-addressReference">Referência do endereço</label><input id="edit-addressReference" name="addressReference" maxlength="160" autocomplete="off" value="${escapeHtml(lead.addressReference || '')}" placeholder="Ex.: próximo à praça, em frente à escola" ${locked} /><small class="field-error"></small></div>
      <div class="field-row interest-service-fields">
        <div class="field"><label for="edit-interestId">Interesse principal</label><select id="edit-interestId" name="interestId" ${locked}>${interests}</select></div>
        <div class="field" data-field="appointmentServiceId"><label for="edit-appointmentServiceId">Serviço do agendamento</label><select id="edit-appointmentServiceId" name="appointmentServiceId" ${locked}><option value="">Selecione o serviço</option>${serviceOptions}</select><small class="field-error"></small></div>
      </div>
      ${showAmetropiaFields ? `<fieldset class="field ametropia-field" ${locked}><legend>Ametropias</legend><small>Marque todas que se aplicam.</small><div class="ametropia-options">${ametropiaOptions(lead.ametropiaIds || [])}</div></fieldset>` : ''}
      <fieldset class="field ametropia-field" ${locked}><legend>Patologias e condições de saúde</legend><small>Marque todas que se aplicam.</small><div class="ametropia-options">${pathologyOptions(lead.pathologyIds || [])}</div></fieldset>
      ${eyeTriageFields(lead, scheduleState.settings, 'edit-lead-eye')}
      ${transportFields(lead, scheduleState.settings, 'edit-lead-transport', Boolean(locked))}
      <div class="field-row appointment-fields">
        <div class="field" data-field="appointmentDate"><label for="edit-appointmentDate">Data do pré-agendamento</label><input id="edit-appointmentDate" name="appointmentDate" type="date" min="${toLocalDateInput(new Date())}" value="${escapeHtml(scheduleState.appointmentDate || lead.appointmentDate)}" ${offlineEdit || readOnly ? 'disabled' : ''} /><small class="schedule-date-status">${offlineEdit ? 'Conecte-se para escolher uma data.' : ''}</small><small class="field-error"></small></div>
        ${renderedAppointmentTimeMarkup}
      </div>
      <div class="field" data-field="notes"><label for="edit-notes">Observação rápida</label><textarea id="edit-notes" name="notes" maxlength="500" rows="3" ${locked}>${escapeHtml(lead.notes)}</textarea><small class="field-hint"><span id="edit-notes-count">${String(lead.notes || '').length}</span>/500</small><small class="field-error"></small></div>
      ${readOnly ? '' : `<button class="button button-primary button-block" type="submit" ${offlineEdit ? 'disabled' : ''}><i data-lucide="save"></i><span>${managerReschedule ? 'Salvar reagendamento' : 'Salvar alterações'}</span></button>`}
      ${canDelete ? `<button class="button button-danger button-block" type="button" data-delete-lead="${escapeHtml(lead.id)}"><i data-lucide="trash-2"></i><span>Excluir lead</span></button>` : ''}
      <p class="form-footnote"><i data-lucide="shield-check"></i> Autor, loja e data original permanecem preservados.</p>
    </form>
    ${canDelete ? `<dialog id="delete-lead-dialog" class="confirmation-dialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description"><div class="confirmation-dialog-icon"><i data-lucide="trash-2"></i></div><div class="confirmation-dialog-copy"><h2 id="delete-dialog-title">Excluir este lead?</h2><p id="delete-dialog-description">O cadastro de <strong>${escapeHtml(lead.fullName)}</strong> será excluído definitivamente. Essa ação não pode ser desfeita.</p></div><div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-close-delete-dialog>Cancelar</button><button class="button button-danger-solid" type="button" data-confirm-delete="${escapeHtml(lead.id)}"><i data-lucide="trash-2"></i><span>Excluir definitivamente</span></button></div></dialog>` : ''}`;
}
