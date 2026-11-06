import { INTERESTS } from '../../../utils/lead.js';
import { servicesForStore } from '../../../utils/service-catalog.js';
import { STORES } from '../../../utils/stores.js';
import { escapeHtml, toLocalDateInput } from '../../shared/formatters.js';
import { ametropiaOptions, eyeTriageFields, pathologyOptions, sexOptions, triageConfigFields } from './capture-triage.js';
import { transportFields } from './capture-transport.js';
import { cpfAppointmentConfirmationDialog, cpfAppointmentStatusMarkup } from './cpf-appointment-warning.js';
import { productPaymentFields } from './product-payment.js';
import { purchaseHolderFields } from './purchase-holder.js';

export function captureView({
  scheduleState,
  offlineCaptureEnabled,
  selectedStoreId,
  allowedStoreIds,
  storeChoice,
  selectedService,
  appointmentTimeMarkup
}) {
  if (!navigator.onLine && !offlineCaptureEnabled) {
    return `
      <section class="page-toolbar">
        <button class="back-button" type="button" data-route="home" aria-label="Voltar"><i data-lucide="arrow-left"></i></button>
      </section>
      <div class="empty-state"><i data-lucide="wifi-off"></i><strong>Cadastro offline desativado</strong><p>Conecte-se à internet para iniciar um novo cadastro. Esta proteção evita registros incompletos enquanto o modo offline está em refinamento.</p></div>`;
  }
  const interests = INTERESTS.map((item) => `<option value="${item.id}">${item.label}</option>`).join('');
  const storeOptions = STORES.filter((store) => allowedStoreIds.includes(store.id))
    .map((store) => `<option value="${store.id}" ${store.id === selectedStoreId ? 'selected' : ''}>${store.displayLabel}</option>`)
    .join('');
  const availableServices = servicesForStore(scheduleState.services, selectedStoreId);
  const serviceOptions = (availableServices.length ? availableServices : selectedStoreId ? [selectedService] : [])
    .map((service) => `<option value="${escapeHtml(service.id)}" ${service.id === selectedService.id ? 'selected' : ''}>${escapeHtml(service.name)} - ${service.durationMinutes} min</option>`)
    .join('');
  return `
    <section class="page-toolbar">
      <button class="back-button" type="button" data-route="home" aria-label="Voltar"><i data-lucide="arrow-left"></i></button>
    </section>
    <form id="lead-form" class="form-panel" novalidate>
      <div class="notice notice-warning" data-offline-capture-notice ${navigator.onLine ? 'hidden' : ''}><i data-lucide="wifi-off"></i><span>Cadastro offline ativo. Os dados do lead serão preservados, mas data e horário só poderão ser escolhidos com internet.</span></div>
      <div class="field" data-field="storeId">
        <label for="capture-store">Loja de destino <span aria-hidden="true">*</span></label>
        <select id="capture-store" name="storeId" required ${storeChoice ? '' : 'aria-disabled="true" tabindex="-1"'}>
          ${storeChoice ? '<option value="">Selecione a loja</option>' : ''}${storeOptions}
        </select>
        <small>${storeChoice ? 'Os serviços, horários e limites serão carregados para esta unidade.' : 'Unidade definida no acesso deste colaborador.'}</small>
        <small class="field-error"></small>
      </div>
      ${selectedStoreId && !scheduleState.loaded ? '<div class="notice notice-info" data-schedule-loading><i data-lucide="refresh-cw"></i><span>Carregando agenda, transporte e horários desta loja...</span></div>' : ''}
      <input name="schedulingMode" type="hidden" value="${escapeHtml(scheduleState.settings.schedulingMode)}" />
      ${triageConfigFields(scheduleState.settings)}
      <input name="appointmentServiceName" type="hidden" value="${escapeHtml(selectedService.name)}" />
      <input name="appointmentDurationMinutes" type="hidden" value="${selectedService.durationMinutes}" />
      <div class="field-row lead-identification-fields">
        <div class="field" data-field="fullName"><label for="fullName">Nome <span aria-hidden="true">*</span></label><input id="fullName" name="fullName" autocomplete="name" maxlength="120" placeholder="Nome do cliente" required /><small class="field-error"></small></div>
        <div class="field" data-field="savwinCode"><label for="savwinCode">Cod. SavWin</label><input id="savwinCode" name="savwinCode" maxlength="40" autocomplete="off" placeholder="Código do cliente" /><small class="field-error"></small></div>
        <div class="field" data-field="score"><label for="score">Score</label><input id="score" name="score" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0 a 1000" /><small class="field-error"></small></div>
      </div>
      <div class="field" data-field="phone"><label for="phone">Telefone ou WhatsApp <span aria-hidden="true">*</span></label><input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="(00) 00000-0000" required /><small class="field-error"></small></div>
      <div class="field-row document-fields">
        <div class="field" data-field="customerRg"><label for="customerRg">RG</label><input id="customerRg" name="customerRg" maxlength="20" autocomplete="off" placeholder="0.000.000" /><small class="field-error"></small></div>
        <div class="field" data-field="customerCpf"><label for="customerCpf">CPF</label><input id="customerCpf" name="customerCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" />${cpfAppointmentStatusMarkup()}<small class="field-error"></small></div>
      </div>
      <div class="field-row demographic-fields">
        <div class="field" data-field="birthDate"><label for="birthDate">Data de nascimento <span aria-hidden="true">*</span></label><input id="birthDate" name="birthDate" type="date" autocomplete="bday" max="${toLocalDateInput(new Date())}" required /><small class="birth-age-hint" data-birth-age>A idade será calculada automaticamente.</small><small class="field-error"></small></div>
        <div class="field" data-field="sex"><label for="sex">Sexo</label><select id="sex" name="sex">${sexOptions()}</select><small class="field-error"></small></div>
      </div>
      <div class="field-row preferred-postal-fields"><div class="field"><label for="preferredName">Como prefere ser chamado</label><input id="preferredName" name="preferredName" maxlength="60" placeholder="Apelido ou nome preferido" /></div><div class="field" data-field="postalCode"><label for="postalCode">CEP</label><input id="postalCode" name="postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="9" aria-describedby="postal-code-status" placeholder="00000-000" /><small id="postal-code-status" class="field-help" data-postal-code-status aria-live="polite"></small><small class="field-error"></small></div></div>
      <div class="field-row address-fields">
        <div class="field address-street" data-field="street"><label for="street">Rua</label><input id="street" name="street" maxlength="120" autocomplete="address-line1" /><small class="field-error"></small></div>
        <div class="field address-number" data-field="streetNumber"><label for="streetNumber">Número</label><input id="streetNumber" name="streetNumber" maxlength="12" autocomplete="address-line2" placeholder="S/N" /><small class="field-error"></small></div>
        <div class="field address-neighborhood"><label for="neighborhood">Bairro</label><input id="neighborhood" name="neighborhood" maxlength="80" /></div>
        <div class="field address-city"><label for="city">Cidade</label><input id="city" name="city" maxlength="80" /></div>
        <div class="field field-state"><label for="state">UF</label><input id="state" name="state" maxlength="2" value="PE" /></div>
      </div>
      <div class="field address-reference-field" data-field="addressReference"><label for="addressReference">Referência do endereço</label><input id="addressReference" name="addressReference" maxlength="160" autocomplete="off" placeholder="Ex.: próximo à praça, em frente à escola" /><small class="field-error"></small></div>
      <div class="field-row interest-service-fields">
        <div class="field"><label for="interestId">Interesse principal</label><select id="interestId" name="interestId">${interests}</select></div>
        <div class="field" data-field="appointmentServiceId"><label for="appointmentServiceId">Serviço do agendamento</label><select id="appointmentServiceId" name="appointmentServiceId" ${selectedStoreId ? '' : 'disabled'}><option value="">${selectedStoreId ? 'Selecione o serviço' : 'Escolha primeiro a loja'}</option>${serviceOptions}</select><small class="field-error"></small></div>
      </div>
      ${productPaymentFields({}, 'new-lead-product-payment')}
      ${purchaseHolderFields({}, 'new-lead-purchase-holder')}
      ${scheduleState.settings.showAmetropiaFields ? `<fieldset id="new-lead-ametropias" class="field ametropia-field"><legend>Ametropias</legend><small>Marque todas que se aplicam.</small><div class="ametropia-options">${ametropiaOptions()}</div></fieldset>` : ''}
      <fieldset id="new-lead-pathologies" class="field ametropia-field"><legend>Patologias e condições de saúde</legend><small>Marque todas que se aplicam.</small><div class="ametropia-options">${pathologyOptions()}</div></fieldset>
      ${eyeTriageFields({}, scheduleState.settings, 'new-lead-eye')}
      ${scheduleState.settings.transportEnabled ? transportFields({ appointmentDate: scheduleState.appointmentDate }, scheduleState.settings, 'new-lead-transport') : ''}
      <div class="field-row appointment-fields" data-online-appointment ${navigator.onLine ? '' : 'hidden'}>
        <div class="field" data-field="appointmentDate"><label for="appointmentDate">Data do pré-agendamento</label><input id="appointmentDate" name="appointmentDate" type="date" min="${toLocalDateInput(new Date())}" value="${navigator.onLine ? escapeHtml(scheduleState.appointmentDate) : ''}" ${navigator.onLine && selectedStoreId ? '' : 'disabled'} /><small class="schedule-date-status">${!navigator.onLine ? 'Conecte-se para escolher uma data.' : !selectedStoreId ? 'Escolha primeiro a loja de destino.' : ''}</small><small class="field-error"></small></div>
        <div id="appointment-time-field">${appointmentTimeMarkup}</div>
      </div>
      <div class="field" data-field="notes"><label for="notes">Observação rápida</label><textarea id="notes" name="notes" maxlength="500" rows="3" placeholder="Ex.: prefere contato pela manhã"></textarea><small class="field-hint"><span id="notes-count">0</span>/500</small><small class="field-error"></small></div>
      <button class="button button-primary button-block" type="submit"><i data-lucide="save"></i><span>Salvar cadastro</span></button>
      <p class="form-footnote"><i data-lucide="shield-check"></i> ${offlineCaptureEnabled ? 'Quando offline, somente os dados do lead serão salvos; o agendamento será feito depois.' : 'O cadastro exige conexão com a internet nesta loja.'}</p>
    </form>${cpfAppointmentConfirmationDialog()}`;
}
