# LeadFlow v0.1.0-rc.5

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-07
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte congelado: `945b70b`
- Projeto Firebase do build: `fascinlead`

## Correcoes desde a rc.4

- O novo responsavel por um cadastro transferido agora consegue realizar o primeiro agendamento normalmente.
- Salvamentos que alteram apenas data e horario enviam uma atualizacao restrita aos campos do agendamento, evitando a validacao completa e desnecessaria do cadastro.
- As regras do Firestore agora priorizam a validacao especifica de agendamento antes da validacao geral de edicao do lead.
- A causa real da mensagem generica de permissao era o limite de 1000 expressoes das regras do Firestore durante o lote de agendamento, e nao falta de acesso do colaborador.
- O teste de reagendamento foi tornado independente do calendario ao evitar domingos sem expediente.

## Congelamento

As candidatas anteriores permanecem imutaveis. Esta `rc.5` substitui a `rc.4`
como candidata atual. Antes da aprovacao, somente correcoes de falhas encontradas
na homologacao podem entrar, sempre com nova bateria de testes e nova candidata.

## Validacoes automatizadas

- Testes unitarios: 287 aprovados.
- Testes de regras do Firestore: 113 aprovados.
- Playwright completo: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Regressao dedicada: gestor transfere cadastro sem agendamento para `MEI Teste`; o MEI entra e conclui o primeiro agendamento com sucesso.
- Verificacao Docker: testes unitarios, regras e build de homologacao aprovados com codigo de saida zero.
- Build de producao: aprovado para o projeto `fascinlead`.
- Build de homologacao: aprovado para o projeto `leadflowtest-d32c2`.
- Sintaxe das Functions: aprovada com `node --check`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.5.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.0-rc.5.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.5.txt`: integridade dos artefatos.

## Auditoria de dependencias

A auditoria da candidata anterior registrou 7 alertas transitivos (6 moderados e
1 alto) na arvore Node/Firebase Admin. Essas dependencias nao integram o ZIP
estatico da Hostinger e nenhuma Function foi alterada nesta candidata. A
atualizacao deve ser tratada separadamente, com nova bateria completa.

## Ordem de homologacao

1. Manter backup/exportacao recente do Firestore e preservar o pacote anterior.
2. Publicar as regras `firestore-v0.1.0-rc.5.rules` no projeto de homologacao.
3. Publicar o ZIP `LeadFlow-Hostinger-v0.1.0-rc.5.zip` na hospedagem de homologacao.
4. Criar um lead sem agendamento com um colaborador externo.
5. Entrar como administrador ou gestor e transferir esse lead para outro captador.
6. Entrar como o novo responsavel, criar o primeiro agendamento e confirmar o registro no historico e na agenda.
7. Repetir o fluxo em computador e celular e observar o console do navegador.
8. Validar os demais perfis, operacao offline, sincronizacao e indicadores.
9. Registrar qualquer falha e gerar outra candidata; nao corrigir diretamente em producao.

## Criterio de bloqueio

Esta candidata nao deve seguir para producao se cadastro, login, historico,
agenda, transferencia, comparecimento, cancelamento, reagendamento, operacao
offline, sincronizacao, permissoes por unidade ou integridade dos indicadores
apresentarem falha.
