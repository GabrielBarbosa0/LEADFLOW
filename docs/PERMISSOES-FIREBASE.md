# Permissoes e regras do Firebase

## Objetivo

Evitar divergencias entre o que a interface permite e o que o Firestore autoriza, alem de manter as regras abaixo do limite de expressoes do Firebase.

## Fonte efetiva

- `allowedEmails/{email}` guarda a autorizacao administrativa atribuida ao e-mail.
- `users/{uid}` guarda a permissao efetiva usada pelas regras do Firestore.
- `roleProfiles` funciona como modelo para aplicar permissoes aos acessos, e nao e consultado pelas regras durante cada operacao.
- `functions/system-role-profiles.json` concentra a versao e as permissoes padrao dos cargos do sistema.

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
npm.cmd run deploy:firebase
```

Esse comando valida todo o conjunto e publica somente as regras, sendo compativel com o plano gratuito Spark.

`syncCurrentAccess` fica desativada enquanto a Function nao estiver publicada, evitando bloqueios de login e erros de CORS. Depois de migrar o projeto para o plano Blaze, publique regras e Functions com `npm.cmd run deploy:firebase:full` e defina `VITE_ENABLE_ACCESS_SYNC=true` na build. Nos emuladores, a sincronizacao e habilitada automaticamente.

Esse comando executa os testes do emulador e verifica a sintaxe das funcoes antes da publicacao. A hospedagem do site continua sendo empacotada separadamente.

## Alteracao futura de cargos

Ao mudar permissoes padrao:

1. Atualize `functions/system-role-profiles.json`.
2. Aumente `permissionSchemaVersion`.
3. Execute os testes.
4. Publique regras e funcoes pelo comando unico.

No proximo carregamento da sessao, os acessos antigos serao corrigidos automaticamente.
