# Permissoes e regras do Firebase

## Objetivo

Evitar divergencias entre o que a interface permite e o que o Firestore autoriza, alem de manter as regras abaixo do limite de expressoes do Firebase.

## Fonte efetiva

- `allowedEmails/{email}` guarda a autorizacao administrativa atribuida ao e-mail.
- `users/{uid}` guarda a permissao efetiva usada pelas regras do Firestore.
- `roleProfiles` funciona como modelo para aplicar permissoes aos acessos, e nao e consultado pelas regras durante cada operacao.
- `functions/system-role-profiles.json` concentra a versao e as permissoes padrao dos cargos do sistema.

## Matriz operacional v7

| Funcionalidade | Externo / MEI | Interno | Gestor | Administrador |
| --- | --- | --- | --- | --- |
| Nova abordagem, cadastros, retornos proprios e metas proprias | Sim | Sim | Sim | Sim |
| Operacao externa | Sim | Sim | Sim | Sim |
| Agenda de exames | Somente leitura | Sim | Sim | Sim |
| Comparecimento, falta e estado neutro | Nao | Sim | Sim | Sim |
| Encaixe rapido | Nao | Sim | Sim | Sim |
| Confirmacoes | Nao | Sim | Sim | Sim |
| Acessos da equipe e configuracoes | Nao | Nao | Nao | Sim |

`appointments.view` controla somente a leitura da agenda. `appointments.confirmations`,
`appointments.attendance` e `walkins.manage` permanecem permissoes independentes.

## Sincronizacao

A funcao callable `syncCurrentAccess` roda no carregamento da sessao. Ela:

1. Confirma o e-mail autenticado e ativo.
2. Atualiza permissoes antigas quando a versao dos cargos mudou.
3. Sincroniza `allowedEmails/{email}` e `users/{uid}`.
4. Retorna ao aplicativo exatamente o perfil que o Firestore passara a usar.

A funcao so grava quando encontra alguma diferenca, evitando ciclos no listener do usuario.

## Regras de leads

- Administrador possui bypass direto para criar, editar e excluir leads.
- Gestor e Colaborador Interno editam apenas leads das unidades permitidas quando possuem `leads.edit_all`.
- Colaborador Externo e MEI editam os proprios leads quando possuem `leads.edit_own`.
- Autoria, loja, origem e datas originais permanecem imutaveis para perfis nao administrativos.
- Comparecimento, retornos e agendamentos limitados continuam com verificacoes especificas.
- Campos novos de formulario nao exigem inclusao em uma lista global nas regras.

## Publicacao

Validar e publicar regras e funcoes juntas:

```powershell
npm.cmd run deploy:firebase:full
```

O hotfix de permissoes exige a Function e as regras da mesma versao. A Function
`syncCurrentAccess` atualiza `allowedEmails` e `users` no proximo login; a build de
producao chama essa Function automaticamente. Nao publique primeiro a interface,
pois ela pode expor uma acao que as regras antigas ainda recusam.

Ordem de publicacao:

1. Execute todos os testes locais e gere o build.
2. Publique Functions e regras com `npm.cmd run deploy:firebase:full`.
3. Publique a interface somente depois do sucesso do passo anterior.
4. Peca aos usuarios conectados que saiam e entrem novamente.
5. Valide um Externo, um Interno e um Gestor antes de remover os acessos administrativos temporarios.

O erro de limite de 1.000 refere-se a expressoes avaliadas pelas regras do Firestore,
nao a 1.000 requisicoes. Os testes de regras devem permanecer verdes para impedir
que alteracoes de permissao ultrapassem esse limite.

Esse comando executa os testes do emulador e verifica a sintaxe das funcoes antes da publicacao. A hospedagem do site continua sendo empacotada separadamente.

## Alteracao futura de cargos

Ao mudar permissoes padrao:

1. Atualize `functions/system-role-profiles.json`.
2. Aumente `permissionSchemaVersion`.
3. Execute os testes.
4. Publique regras e funcoes pelo comando unico.

No proximo carregamento da sessao, os acessos antigos serao corrigidos automaticamente.
