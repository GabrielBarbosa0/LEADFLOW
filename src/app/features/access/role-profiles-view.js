import { PERMISSION_GROUPS, ROLE_SCOPES, permissionsForScope } from '../../../utils/role-profile.js';
import { escapeHtml } from '../../shared/formatters.js';

function permissionGroupMarkup(group, activePermissions, compatiblePermissionIds, { saving, inputAttributes = '' }) {
  return `<fieldset class="role-details-group"><legend>${escapeHtml(group.label)}</legend>${group.permissions.map((permission) => {
    const active = activePermissions.includes(permission.id);
    const canToggle = compatiblePermissionIds.has(permission.id);
    return `<label class="role-details-permission ${active ? 'is-active' : ''} ${canToggle ? 'is-editable' : 'is-locked'}"><span><strong>${escapeHtml(permission.label)}</strong><small>${active ? 'Ativada' : 'Desativada'}</small></span><input ${inputAttributes} value="${escapeHtml(permission.id)}" ${active ? 'checked' : ''} ${canToggle && !saving ? '' : 'disabled'} /><span class="setting-toggle-control" aria-hidden="true"></span></label>`;
  }).join('')}</fieldset>`;
}

function permissionColumns(groups) {
  return `<div class="role-details-column">${groups[0]}${groups[2]}</div><div class="role-details-column">${groups[1]}</div>`;
}

export function roleProfilesView(settings) {
  const { roleProfiles, roleEditorOpen, roleDraft, editingRoleId, pendingDeleteRoleId, detailsRoleId, detailsRolePermissions, saving } = settings;
  const compatiblePermissionIds = new Set(permissionsForScope(roleDraft.scope));
  const scopeOptions = ROLE_SCOPES.map((scope) => `<option value="${scope.id}" ${scope.id === roleDraft.scope ? 'selected' : ''}>${scope.label}</option>`).join('');
  const editorPermissionGroups = PERMISSION_GROUPS.map((group) => permissionGroupMarkup(
    group,
    roleDraft.permissions,
    compatiblePermissionIds,
    { saving, inputAttributes: 'name="permissions" type="checkbox"' }
  ));
  const rows = roleProfiles.map((profile) => `<article class="service-catalog-row role-catalog-row ${editingRoleId === profile.id ? 'is-editing' : ''}">
    <span class="service-catalog-icon"><i data-lucide="shield-check"></i></span>
    <button class="role-catalog-name" type="button" data-role-details="${escapeHtml(profile.id)}" aria-label="Visualizar permissões do perfil ${escapeHtml(profile.name)}"><strong>${escapeHtml(profile.name)}</strong><span>${profile.scope === 'admin' ? 'Acesso completo' : profile.scope === 'stores' ? 'Unidades permitidas' : 'Dados próprios'}</span></button>
    <div class="service-catalog-duration role-catalog-permissions"><span>Permissões</span><strong>${profile.permissions.length} ativa(s)</strong></div>
    <span class="status-badge status-${profile.system ? 'neutral' : 'success'}">${profile.system ? profile.customized ? 'Ajustado' : 'Padrão' : 'Personalizado'}</span>
    <div class="service-catalog-actions role-catalog-actions">
      ${profile.system
        ? `<button class="icon-button" type="button" data-role-details="${escapeHtml(profile.id)}" title="${profile.baseRole === 'admin' ? 'Visualizar permissões' : 'Configurar permissões'}" ${saving ? 'disabled' : ''}><i data-lucide="${profile.baseRole === 'admin' ? 'eye' : 'pencil'}"></i></button>`
        : `<button class="icon-button" type="button" data-role-edit="${escapeHtml(profile.id)}" title="Editar cargo" ${saving ? 'disabled' : ''}><i data-lucide="pencil"></i></button><button class="icon-button role-delete-button" type="button" data-role-delete="${escapeHtml(profile.id)}" title="Excluir cargo" ${saving ? 'disabled' : ''}><i data-lucide="trash-2"></i></button>`}
    </div>
  </article>`).join('');
  const deleting = roleProfiles.find((profile) => profile.id === pendingDeleteRoleId);
  const detailsProfile = roleProfiles.find((profile) => profile.id === detailsRoleId);
  const detailsEditable = detailsProfile?.system && detailsProfile.baseRole !== 'admin';
  const activeDetailPermissions = detailsProfile && detailsRoleId === detailsProfile.id
    ? detailsRolePermissions
    : detailsProfile?.permissions || [];
  const compatibleDetailPermissions = new Set(detailsProfile ? permissionsForScope(detailsProfile.scope) : []);
  const detailGroups = detailsProfile ? PERMISSION_GROUPS.map((group) => permissionGroupMarkup(
    group,
    activeDetailPermissions,
    detailsEditable ? compatibleDetailPermissions : new Set(),
    { saving, inputAttributes: 'type="checkbox" data-system-role-permission' }
  )) : [];
  const permissionCount = PERMISSION_GROUPS.flatMap((group) => group.permissions).length;

  return `<section class="service-catalog-panel role-catalog-panel">
    <div class="service-catalog-heading"><div><span class="eyebrow">EQUIPE</span><h2>Cargos cadastrados</h2><p>Defina o alcance e as permissões de cada cargo da equipe.</p></div><button class="button button-primary" type="button" data-role-new><i data-lucide="circle-plus"></i><span>Adicionar cargo</span></button></div>
    <div class="service-catalog-list role-catalog-list">${rows}</div>
  </section>
  ${roleEditorOpen ? `<dialog id="role-editor-dialog" class="role-details-dialog role-editor-dialog" aria-labelledby="role-editor-title">
    <form id="role-profile-form" class="role-editor-form" novalidate>
      <header><div><span class="eyebrow">CARGO DA EQUIPE</span><h2 id="role-editor-title">${editingRoleId ? 'Editar cargo' : 'Novo cargo'}</h2><p>Configure individualmente o que este cargo poderá acessar.</p></div><button class="icon-button" type="button" data-role-cancel aria-label="Fechar"><i data-lucide="x"></i></button></header>
      <div class="role-editor-content">
        <div class="role-editor-basics">
          <div class="field" data-field="name"><label for="role-profile-name">Nome do cargo</label><input id="role-profile-name" name="name" maxlength="60" value="${escapeHtml(roleDraft.name)}" placeholder="Ex.: Supervisor de atendimento" required /><small class="field-error"></small></div>
          <div class="field" data-field="scope"><label for="role-profile-scope">Alcance dos dados</label><select id="role-profile-scope" name="scope">${scopeOptions}</select><small class="field-error"></small></div>
        </div>
        <div class="role-permissions-heading"><strong>Permissões</strong><span>As opções indisponíveis não pertencem ao alcance selecionado.</span></div>
        <div class="role-details-body role-editor-permissions-body" data-field="permissions">${permissionColumns(editorPermissionGroups)}<small class="field-error"></small></div>
      </div>
      <footer><span><strong data-role-editor-count>${roleDraft.permissions.length}</strong> de ${permissionCount} permissões ativadas</span><div class="role-details-actions"><button class="button button-secondary" type="button" data-role-cancel>Cancelar</button><button class="button button-primary" type="submit" ${saving ? 'disabled' : ''}><i data-lucide="save"></i><span>${saving ? 'Salvando...' : editingRoleId ? 'Salvar alterações' : 'Criar cargo'}</span></button></div></footer>
    </form>
  </dialog>` : ''}
  ${deleting ? `<dialog id="delete-role-dialog" class="confirmation-dialog" aria-labelledby="delete-role-title" aria-describedby="delete-role-description"><div class="confirmation-dialog-icon"><i data-lucide="trash-2"></i></div><h2 id="delete-role-title">Excluir cargo?</h2><p id="delete-role-description">O cargo <strong>${escapeHtml(deleting.name)}</strong> será removido. A exclusão só será permitida se nenhuma pessoa estiver usando este cargo.</p><div class="confirmation-dialog-actions"><button class="button button-secondary" type="button" data-role-delete-cancel>Cancelar</button><button class="button button-danger" type="button" data-role-delete-confirm="${escapeHtml(deleting.id)}" ${saving ? 'disabled' : ''}>Excluir cargo</button></div></dialog>` : ''}
  ${detailsProfile ? `<dialog id="role-details-dialog" class="role-details-dialog" aria-labelledby="role-details-title">
    <header><div><span class="eyebrow">PERFIL DE ACESSO</span><h2 id="role-details-title">${escapeHtml(detailsProfile.name)}</h2><p>${detailsProfile.scope === 'admin' ? 'Acesso completo ao sistema' : detailsProfile.scope === 'stores' ? 'Acesso limitado às unidades permitidas' : 'Acesso aos próprios dados'}</p></div><button class="icon-button" type="button" data-role-details-close title="Fechar" aria-label="Fechar permissões"><i data-lucide="x"></i></button></header>
    <div class="role-details-body">${permissionColumns(detailGroups)}</div>
    <footer><span><strong data-role-details-count>${activeDetailPermissions.length}</strong> de ${permissionCount} permissões ativadas</span><div class="role-details-actions">${detailsEditable ? `<button class="button button-secondary" type="button" data-system-role-reset="${escapeHtml(detailsProfile.id)}" ${saving ? 'disabled' : ''}><i data-lucide="refresh-cw"></i><span>Restaurar padrão</span></button><button class="button button-secondary" type="button" data-role-details-close>Cancelar</button><button class="button button-primary" type="button" data-system-role-save="${escapeHtml(detailsProfile.id)}" ${saving ? 'disabled' : ''}><i data-lucide="save"></i><span>${saving ? 'Salvando...' : 'Salvar permissões'}</span></button>` : '<button class="button button-primary" type="button" data-role-details-close>Concluir</button>'}</div></footer>
  </dialog>` : ''}`;
}
