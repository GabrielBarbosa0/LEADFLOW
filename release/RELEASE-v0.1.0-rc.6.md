# LeadFlow v0.1.0-rc.6

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-07
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte congelado: `816a72a`
- Projeto Firebase do build: `fascinlead`

## Correcoes desde a rc.5

- O historico do lead agora usa icones distintos para cadastro, agendamento, reagendamento, cancelamento, transferencia e demais eventos, facilitando a leitura visual.
- A agenda preserva a posicao da lista ao registrar ou remover comparecimento.
- A alteracao de comparecimento atualiza somente os controles do cliente afetado, sem remontar toda a agenda nem produzir piscadas visuais.
- As assinaturas de retornos da equipe continuam atualizando os dados em segundo plano, mas redesenham somente as telas que exibem esses retornos.
- Testes de regressao garantem que o mesmo elemento da lista permanece montado durante as alteracoes de comparecimento.

## Congelamento

As candidatas anteriores permanecem imutaveis. Esta `rc.6` substitui a `rc.5`
como candidata atual. Antes da aprovacao, somente correcoes de falhas encontradas
na homologacao podem entrar, sempre com nova bateria de testes e nova candidata.

## Validacoes automatizadas

- Testes unitarios: 292 aprovados.
- Testes de regras do Firestore: 113 aprovados.
- Playwright completo: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Regressao dedicada: a lista da agenda permanece montada e na mesma posicao ao marcar e remover comparecimento.
- Inspecao quadro a quadro: gravacao automatizada sem salto, piscada ou reconstrucao visivel da lista durante a alteracao.
- Verificacao Docker: testes unitarios, regras e build de homologacao aprovados com codigo de saida zero.
- Build de producao: aprovado para o projeto `fascinlead`.
- Build de homologacao: aprovado para o projeto `leadflowtest-d32c2`.
- Sintaxe das Functions: aprovada com `node --check`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.6.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.0-rc.6.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.6.txt`: integridade dos artefatos.

## Auditoria de dependencias

A auditoria da candidata anterior registrou 7 alertas transitivos (6 moderados e
1 alto) na arvore Node/Firebase Admin. Essas dependencias nao integram o ZIP
estatico da Hostinger e nenhuma Function foi alterada nesta candidata. A
atualizacao deve ser tratada separadamente, com nova bateria completa.

## Ordem de homologacao

1. Manter backup/exportacao recente do Firestore e preservar o pacote anterior.
2. Publicar as regras `firestore-v0.1.0-rc.6.rules` no projeto de homologacao.
3. Publicar o ZIP `LeadFlow-Hostinger-v0.1.0-rc.6.zip` na hospedagem de homologacao.
4. Abrir um lead com historico variado e confirmar os icones de cada tipo de evento.
5. Na agenda, rolar ate os ultimos clientes e alternar entre compareceu, nao compareceu e pendente.
6. Confirmar que a lista permanece na mesma posicao e sem piscadas em computador e celular.
7. Validar transferencia, primeiro agendamento pelo novo responsavel, cancelamento e reagendamento.
8. Validar os demais perfis, operacao offline, sincronizacao e indicadores.
9. Registrar qualquer falha e gerar outra candidata; nao corrigir diretamente em producao.

## Criterio de bloqueio

Esta candidata nao deve seguir para producao se cadastro, login, historico,
agenda, transferencia, comparecimento, cancelamento, reagendamento, operacao
offline, sincronizacao, permissoes por unidade ou integridade dos indicadores
apresentarem falha.
