# LeadFlow v0.1.0-rc.4

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-06
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte congelado: `b56def4`
- Projeto Firebase do build: `fascinlead`

## Correcoes desde a rc.3

- Administradores e gestores agora podem transferir um lead para colaboradores internos ativos configurados com o perfil funcional de captador, mesmo quando o papel-base do usuario e `manager`.
- A transferencia de lead cancelado nao exige novo agendamento: o responsavel pode ser alterado diretamente e a operacao permanece registrada no historico.
- O dialogo de cancelamento verifica se ainda esta conectado ao documento antes de chamar `showModal`, eliminando o `InvalidStateError` observado no navegador.
- O icone `repeat-2` foi registrado no conjunto de icones da aplicacao.
- As mensagens originadas por `webextension.js` pertencem a uma extensao do navegador e nao ao codigo do LeadFlow.

## Congelamento

As candidatas anteriores permanecem imutaveis. Esta `rc.4` substitui a `rc.3`
como candidata atual. Antes da aprovacao, somente correcoes de falhas encontradas
na homologacao podem entrar, sempre com nova bateria de testes e nova candidata.

## Validacoes automatizadas

- Testes unitarios: 286 aprovados.
- Testes de regras do Firestore: 112 aprovados.
- Playwright: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Transferencia para `Colaborador Interno Multi-loja` e respectivo historico validados no navegador com seed limpo.
- Verificacao Docker: testes unitarios, regras e build de homologacao aprovados com Java 21.
- Build de producao: aprovado para o projeto `fascinlead`.
- Build de homologacao: aprovado para o projeto `leadflowtest-d32c2`.
- Sintaxe das Functions: aprovada com `node --check`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.4.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.0-rc.4.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.4.txt`: integridade dos artefatos.

## Auditoria de dependencias

A auditoria da candidata anterior registrou 7 alertas transitivos (6 moderados e
1 alto) na arvore Node/Firebase Admin. Essas dependencias nao integram o ZIP
estatico da Hostinger e nenhuma Function foi alterada nesta candidata. A
atualizacao deve ser tratada separadamente, com nova bateria completa.

## Ordem de homologacao

1. Manter backup/exportacao recente do Firestore e preservar o pacote anterior.
2. Publicar as regras da candidata no projeto de homologacao.
3. Publicar o ZIP da candidata na hospedagem de homologacao.
4. Entrar como administrador ou gestor e transferir um lead cancelado para um colaborador interno com perfil de captador.
5. Confirmar a troca de responsavel e o registro da transferencia no historico, sem reagendar o lead antes.
6. Repetir o fluxo em computador e celular e observar o console do navegador.
7. Validar os demais perfis, operacao offline, sincronizacao e indicadores.
8. Registrar qualquer falha e gerar outra candidata; nao corrigir diretamente em producao.

## Criterio de bloqueio

Esta candidata nao deve seguir para producao se cadastro, login, historico,
agenda, transferencia, comparecimento, cancelamento, reagendamento, operacao
offline, sincronizacao, permissoes por unidade ou integridade dos indicadores
apresentarem falha.
