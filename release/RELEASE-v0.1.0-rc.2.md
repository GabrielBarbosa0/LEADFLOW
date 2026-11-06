# LeadFlow v0.1.0-rc.2

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-06
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte congelado: `b107ca8`
- Projeto Firebase do build: `fascinlead`

## Congelamento

A partir desta candidata, novas funcionalidades ficam congeladas. Antes da
aprovacao, somente correcoes de falhas encontradas na homologacao podem entrar.
Cada correcao exige nova execucao dos testes afetados e uma nova candidata.

## Principais alteracoes desde a rc.1

- Tipo de estrategia obrigatorio em novos cadastros, validado na interface e nas regras do Firestore.
- Encaixes rapidos classificados automaticamente como `Visita espontanea`.
- Novos rotulos de acompanhamento do cadastro e melhorias no fluxo de cancelamento e reagendamento.
- Filtros e alinhamentos revisados em cadastros, dashboard, operacao externa e telas de retorno.
- Dashboard reorganizado com tipos de estrategia, formas de pagamento e ranking de captadores reformulado.
- Calculo dos proximos sete dias fixado no fuso `America/Sao_Paulo`.
- Testes de regras isolados na porta correta, sem depender do emulador de desenvolvimento.

## Validacoes automatizadas

- Testes unitarios: 283 aprovados.
- Testes de regras do Firestore: 111 aprovados.
- Playwright: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Verificacao Docker: testes unitarios, regras e build de homologacao aprovados com Java 21.
- Build de producao: aprovado para o projeto `fascinlead`.
- Build de homologacao: aprovado para o projeto `leadflowtest-d32c2`.
- Sintaxe das Functions: aprovada com `node --check`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.2.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.0-rc.2.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.2.txt`: integridade dos artefatos.

## Auditoria de dependencias

O `npm audit --omit=dev` registrou 7 alertas transitivos (6 moderados e 1 alto)
na arvore Node/Firebase Admin. Essas dependencias nao integram o ZIP estatico
da Hostinger e nenhuma Function foi alterada nesta candidata. A atualizacao
dessas dependencias deve ser tratada separadamente, com nova bateria completa,
antes de uma futura publicacao de codigo server-side.

## Ordem de homologacao

1. Manter backup/exportacao recente do Firestore e preservar o pacote anterior.
2. Publicar as regras da candidata no projeto de homologacao.
3. Publicar o ZIP da candidata na hospedagem de homologacao.
4. Testar todos os perfis, computador e celular, online, offline e sincronizacao.
5. Validar cadastro com estrategia, encaixe rapido, agenda, comparecimento, cancelamento e reagendamento.
6. Validar filtros, dashboards, ranking e operacao externa com dados reais de homologacao.
7. Registrar qualquer falha e gerar outra candidata; nao corrigir diretamente em producao.

## Criterio de bloqueio

Esta candidata nao deve seguir para producao se cadastro, login, agenda,
comparecimento, cancelamento, reagendamento, operacao offline, sincronizacao,
permissoes por unidade ou integridade dos indicadores apresentarem falha.
