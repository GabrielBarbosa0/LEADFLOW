# LeadFlow v0.1.0-rc.1

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-06
- Branch de origem: `chore/docker-homologacao`
- Commit de origem: `00c7860`
- Projeto Firebase do build: `fascinlead`

## Congelamento

A partir desta candidata, novas funcionalidades ficam congeladas. Antes da
aprovacao, somente correcoes de falhas encontradas na homologacao podem entrar.
Cada correcao exige nova execucao dos testes afetados e uma nova candidata.

## Correcao critica desta candidata

- Reagendamento formal de agendamentos cancelados autorizado nas regras.
- Reativacao simples, sem motivo, ator, funil e metadados formais, permanece bloqueada.
- Atendimento marcado como comparecido continua sem permitir reagendamento.
- Novos blocos da agenda e historico sao gravados no mesmo fluxo atomico.

## Validacoes automatizadas

- Testes unitarios: 282 aprovados.
- Testes de regras do Firestore: 110 aprovados.
- Playwright: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Build de producao: aprovado.
- Build de homologacao: aprovado para o projeto `leadflowtest-d32c2`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.1.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.0-rc.1.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.1.txt`: integridade dos artefatos.

## Ordem de homologacao

1. Manter backup/exportacao recente do Firestore e preservar o pacote anterior.
2. Publicar as regras da candidata no projeto de homologacao.
3. Publicar o ZIP da candidata na hospedagem de homologacao.
4. Testar todos os perfis, computador e celular, online, offline e sincronizacao.
5. Validar cancelamento, pesquisa do cancelado e reagendamento formal.
6. Registrar qualquer falha e gerar outra candidata; nao corrigir diretamente em producao.

## Criterio de bloqueio

Esta candidata nao deve seguir para producao se cadastro, login, agenda,
comparecimento, cancelamento, reagendamento, operacao offline, sincronizacao ou
permissoes por unidade apresentarem falha.
