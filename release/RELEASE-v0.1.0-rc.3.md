# LeadFlow v0.1.0-rc.3

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-06
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte congelado: `1051a1c`
- Projeto Firebase do build: `fascinlead`

## Correcao desde a rc.2

- O historico do lead agora encerra a assinatura anterior e limpa o cache ao sair ou trocar de acesso.
- O mesmo lead e carregado novamente quando aberto por outro perfil, preservando a visualizacao dos eventos de criacao, agendamento, cancelamento e transferencia.
- Foi adicionada uma regressao das regras para o fluxo completo de lead cancelado, transferido para MEI e reagendado pelo novo responsavel.
- A falha de permissao observada durante a preparacao da rc.2 foi reproduzida com as regras atuais e nao persiste: a transacao passa quando o lead existe. O erro original ocorreu enquanto o banco descartavel `demo-leadflow` era reinicializado durante o teste manual.

## Congelamento

A `rc.2` permanece imutavel. Esta `rc.3` a substitui como candidata atual.
Antes da aprovacao, somente correcoes de falhas encontradas na homologacao podem
entrar, sempre com nova bateria de testes e nova candidata.

## Validacoes automatizadas

- Testes unitarios: 284 aprovados.
- Testes de regras do Firestore: 112 aprovados.
- Playwright: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Fluxos de assumir lead cancelado e transferir responsavel validados em navegador com seed limpo.
- Verificacao Docker: testes unitarios, regras e build de homologacao aprovados com Java 21.
- Build de producao: aprovado para o projeto `fascinlead`.
- Build de homologacao: aprovado para o projeto `leadflowtest-d32c2`.
- Sintaxe das Functions: aprovada com `node --check`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.3.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.0-rc.3.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.3.txt`: integridade dos artefatos.

## Auditoria de dependencias

O `npm audit --omit=dev` registrou 7 alertas transitivos (6 moderados e 1 alto)
na arvore Node/Firebase Admin. Essas dependencias nao integram o ZIP estatico
da Hostinger e nenhuma Function foi alterada nesta candidata. A atualizacao
dessas dependencias deve ser tratada separadamente, com nova bateria completa.

## Ordem de homologacao

1. Manter backup/exportacao recente do Firestore e preservar o pacote anterior.
2. Publicar as regras da candidata no projeto de homologacao.
3. Publicar o ZIP da candidata na hospedagem de homologacao.
4. Testar troca de acesso entre colaborador externo, gestor e MEI abrindo o mesmo lead.
5. Confirmar que o historico completo permanece visivel depois da transferencia.
6. Repetir cancelamento, transferencia e reagendamento pelo novo responsavel.
7. Validar os demais perfis, computador e celular, online, offline e sincronizacao.
8. Registrar qualquer falha e gerar outra candidata; nao corrigir diretamente em producao.

## Criterio de bloqueio

Esta candidata nao deve seguir para producao se cadastro, login, historico,
agenda, comparecimento, cancelamento, reagendamento, operacao offline,
sincronizacao, permissoes por unidade ou integridade dos indicadores apresentarem falha.
