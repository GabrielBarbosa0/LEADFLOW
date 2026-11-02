# Plano de execucao: fila de encaixes do dia

## Status

Primeira versao operacional atualizada em 02/11/2026.

Esta entrega inclui acesso pela pagina inicial, pesquisa por nome ou CPF, selecao de cadastro existente, cadastro rapido dentro do proprio fluxo, criacao da entrada, fila diaria por unidade, estados de chamada e atendimento, encerramentos justificados, historico do lead e regras de seguranca no Firestore. Permanecem para evolucoes posteriores: prioridade manual, alerta de conflito com o proximo horario, conversao para agendamento futuro e indicadores gerenciais.

Este documento registra a operacao implementada para receber clientes presenciais que solicitam atendimento no mesmo dia, especialmente em dias de grande movimento. O uso em campo deve ser validado com a recepcao e com os profissionais responsaveis antes da liberacao ampla.

## Contexto

Quinta-feira, sexta-feira e sabado costumam concentrar um volume elevado de clientes nas Oticas Fascinante. Embora a agenda reserve um periodo estimado para cada atendimento, alguns exames terminam antes do previsto. Esse intervalo pode ser aproveitado para atender um cliente que chegou sem agendamento e deseja realizar o exame imediatamente.

Sem um fluxo proprio, a equipe precisa escolher entre:

- recusar o cliente e correr o risco de perde-lo para outra clinica;
- criar um agendamento sobreposto e prejudicar a leitura da agenda;
- atender sem registrar a origem, o responsavel e o resultado;
- alterar um agendamento existente para representar algo que nao aconteceu.

A solucao proposta e uma **fila de encaixes do dia**, integrada a agenda, mas independente dos horarios regulares.

## Objetivos

- Aproveitar intervalos que surgem quando um atendimento termina antes do previsto.
- Registrar clientes que solicitam exame imediato sem criar horarios falsos ou duplicados.
- Preservar os agendamentos confirmados e sua ordem operacional.
- Permitir que a recepcao chame rapidamente o proximo cliente disponivel.
- Manter uma trilha completa de quem criou, autorizou e concluiu o encaixe.
- Medir espera, atendimento, desistencias e conversao dos encaixes.

## O que a fila de encaixes nao deve fazer

- Nao alterar automaticamente a data ou o horario de um agendamento regular.
- Nao reservar um horario que ja pertence a outro cliente.
- Nao garantir atendimento imediato ao cliente que entrou na fila.
- Nao ultrapassar silenciosamente regras de profissional, servico ou unidade.
- Nao substituir a lista de espera para vagas futuras.
- Nao permitir que prioridade seja alterada sem justificativa e auditoria.

## Diferenca entre encaixe e lista de espera

| Recurso | Finalidade |
| --- | --- |
| Fila de encaixes | Atender um cliente presente na unidade, no mesmo dia, quando surgir uma oportunidade entre atendimentos. |
| Lista de espera | Localizar clientes interessados em uma vaga futura que ainda nao esta disponivel. |

Um cliente da lista de espera podera futuramente ser convidado para um horario liberado. Um cliente da fila de encaixes ja esta aguardando uma oportunidade operacional no dia atual.

## Experiencia proposta

### Acesso pela pagina inicial

A pagina inicial apresenta o botao **Novo encaixe rapido**, que abre uma tela propria da fila do dia. A fila permanece visualmente separada da agenda regular para evitar que um encaixe seja interpretado como horario confirmado.

Os agendamentos regulares continuam organizados pelos horarios reservados; a fila nao cria documentos em `appointmentSlots`.

### Criacao de um encaixe

O fluxo devera ser curto:

1. Pesquisar o cliente por nome ou CPF.
2. Selecionar um cadastro existente ou iniciar um cadastro rapido.
3. Confirmar a unidade, o servico e o tipo de profissional.
4. Informar o motivo do encaixe.
5. Adicionar uma observacao opcional.
6. Confirmar a entrada na fila.

O sistema devera registrar automaticamente a hora de chegada e o usuario responsavel.

Quando o cliente nao possuir cadastro, o cadastro rapido devera coletar apenas os dados minimos aprovados para identifica-lo e permitir a complementacao posterior. Antes de criar um novo registro, a interface devera procurar possiveis duplicidades.

### Operacao da fila

Estados previstos:

- `waiting`: aguardando oportunidade;
- `called`: chamado pela recepcao;
- `in_service`: em atendimento;
- `completed`: atendimento concluido;
- `gave_up`: cliente desistiu;
- `not_accommodated`: nao foi possivel realizar o encaixe;
- `cancelled`: registro cancelado por correcao operacional.

Fluxo principal:

`Aguardando -> Chamado -> Em atendimento -> Atendido`

Fluxos alternativos:

`Aguardando -> Desistiu`

`Aguardando -> Nao foi possivel encaixar`

`Aguardando -> Cancelado`

Quando um atendimento terminar antes do previsto, a recepcao podera usar a acao **Chamar proximo**. A interface devera mostrar o proximo cliente compativel com a unidade, o servico e o profissional disponivel.

### Ordem e prioridade

A ordem padrao sera a hora de entrada na fila.

Uma alteracao manual de prioridade somente podera ocorrer por usuario autorizado e devera exigir motivo. A prioridade nao devera ser apresentada como criterio clinico automatico. Situacoes clinicas urgentes devem seguir o protocolo definido pelo profissional responsavel, inclusive encaminhamento externo quando necessario.

### Encerramento do dia

Entradas ainda abertas no encerramento do expediente nao poderao permanecer indefinidamente como aguardando. A equipe devera concluir cada uma como:

- atendido;
- cliente desistiu;
- nao foi possivel encaixar;
- convertido em agendamento regular para outra data.

A conversao para outra data devera usar o fluxo normal de agendamento e manter no historico a referencia ao encaixe original.

## Informacoes registradas

Cada entrada devera armazenar:

- identificador do lead;
- loja;
- data operacional da fila;
- servico solicitado;
- tipo de profissional ou encaminhamento;
- motivo do encaixe;
- observacao opcional;
- estado atual;
- ordem e prioridade;
- horario de chegada;
- horario em que o cliente foi chamado;
- inicio real do atendimento;
- termino real do atendimento;
- usuario que criou o encaixe;
- usuario que chamou o cliente;
- usuario que iniciou e concluiu o atendimento;
- motivo de desistencia, cancelamento ou impossibilidade, quando aplicavel;
- referencia ao agendamento futuro, quando houver conversao;
- data de criacao e de ultima atualizacao;
- versao do esquema.

## Modelo de dados sugerido

Criar uma colecao operacional separada dos agendamentos regulares:

```text
appointmentWalkIns/{walkInId}
  leadId: string
  storeId: string
  queueDate: string
  serviceId: string
  serviceName: string
  professionalType: string
  reason: string
  notes: string | null
  status: string
  priority: number
  priorityReason: string | null
  arrivedAt: timestamp
  calledAt: timestamp | null
  startedAt: timestamp | null
  completedAt: timestamp | null
  closedReason: string | null
  convertedAppointmentLeadId: string | null
  createdAt: timestamp
  createdByUid: string
  createdByName: string
  updatedAt: timestamp
  updatedByUid: string
  schemaVersion: 1
```

A entrada devera referenciar o lead e guardar apenas os dados operacionais necessarios. Nome, telefone, CPF e informacoes clinicas nao deverao ser duplicados nessa colecao.

O nome e a duracao do servico poderao ser copiados para preservar o contexto historico, seguindo a mesma estrategia dos agendamentos regulares.

## Historico e auditoria

Cada transicao relevante devera gerar um evento no historico do lead e na auditoria operacional.

Exemplo:

```text
Encaixe criado em 30/10/2026 as 14:12 por Maria, Loja 04.
Motivo: cliente presencial solicitou exame imediato.
Chamado as 14:25 por Joana.
Atendimento iniciado as 14:28 e concluido as 14:39.
```

Eventos minimos:

- entrada na fila;
- alteracao de prioridade;
- chamada do cliente;
- inicio do atendimento;
- conclusao;
- desistencia;
- impossibilidade de encaixe;
- cancelamento;
- conversao em agendamento futuro.

Eventos anteriores nao poderao ser apagados ou reescritos silenciosamente.

## Permissoes

Permissao implementada: `walkins.manage`.

- atendente de balcao: visualizar, criar, chamar, iniciar, concluir e encerrar na unidade permitida;
- gestor de loja: as mesmas acoes nas unidades permitidas;
- administrador: todas as acoes em todas as unidades;
- telemarketing, colaborador e MEI: nenhum acesso a fila;
- usuario sem permissao: nenhum acesso direto a colecao.

As regras deverao ser aplicadas no Firestore, nao somente na interface. O usuario nao podera alterar loja, autor ou horarios de auditoria para ampliar o proprio acesso.

## Regras de negocio

- Um encaixe deve pertencer ao dia atual da unidade.
- Um encaixe nao cria nem ocupa `appointmentSlots` enquanto estiver na fila.
- O inicio do atendimento devera validar unidade, servico e profissional compativel.
- Agendamentos regulares mantem precedencia sobre encaixes.
- A interface devera alertar quando o inicio de um encaixe puder comprometer o proximo horario regular.
- Continuar apesar do alerta devera exigir permissao e justificativa.
- Um lead nao podera ter duas entradas abertas na mesma fila e no mesmo dia.
- Somente entradas abertas poderao mudar de ordem ou prioridade.
- Estados encerrados nao poderao retornar a fila sem uma nova entrada auditada.
- Horarios reais deverao ser preenchidos pelo sistema nas transicoes, preferencialmente com timestamp do servidor.
- Toda consulta devera respeitar as lojas permitidas do usuario.

## Indicacao de espera

A primeira versao nao devera prometer um horario exato. A interface podera apresentar:

- quantidade de pessoas aguardando;
- tempo decorrido desde a chegada;
- proximo agendamento regular;
- alerta de risco para o proximo horario;
- estimativa interna de espera, identificada claramente como aproximada.

A estimativa nao deve ser usada como garantia ao cliente, porque depende da duracao real dos atendimentos e da prioridade dos agendamentos confirmados.

## Indicadores

O painel podera apresentar por periodo e loja:

- encaixes solicitados;
- encaixes atendidos;
- clientes que desistiram;
- clientes que nao puderam ser atendidos;
- conversoes em agendamento futuro;
- tempo medio de espera;
- duracao media do atendimento;
- percentual atendido;
- distribuicao por dia da semana e faixa de horario;
- resultado comercial quando houver integracao autorizada com vendas.

Esses dados ajudarao a identificar se a duracao configurada dos servicos esta adequada e quais dias precisam de mais capacidade.

## Experiencia responsiva

### Desktop

- Agenda regular na area principal.
- Fila de encaixes em painel lateral ou faixa propria.
- Acoes rapidas para chamar, iniciar e concluir.
- Destaque para tempo de espera e proximidade do proximo agendamento.

### Celular

- Acesso pela agenda por uma aba ou botao **Encaixes**.
- Contador visivel de clientes aguardando.
- Cartoes compactos com estado, espera, servico e acoes permitidas.
- Confirmacao antes de encerrar uma entrada.

## Notificacoes futuras

Uma evolucao posterior podera avisar a equipe quando:

- um atendimento terminar antes do previsto e houver pessoas aguardando;
- um cliente ultrapassar um limite configurado de espera;
- o expediente estiver proximo do fim e ainda houver entradas abertas;
- surgir risco de conflito com o proximo agendamento regular.

A primeira versao nao precisa enviar notificacoes externas nem mensagens automaticas ao cliente.

## Etapas de execucao

### Etapa 0: validacao operacional

- [ ] Acompanhar o fluxo real da recepcao em dias movimentados.
- [ ] Validar quem pode criar, priorizar e encerrar encaixes.
- [ ] Definir o catalogo inicial de motivos.
- [ ] Definir como a equipe encerra entradas nao atendidas no fim do dia.
- [ ] Confirmar os alertas necessarios antes do proximo horario regular.

### Etapa 1: dados e seguranca

- [x] Definir o modelo inicial da colecao.
- [x] Criar validadores e normalizacao de estados.
- [x] Criar regras do Firestore e testes no emulador.
- [x] Criar eventos de historico e auditoria.
- [x] Garantir transicoes de estado validadas no cliente e no Firestore.

### Etapa 2: fila basica

- [x] Adicionar o botao **Novo encaixe rapido** na pagina inicial.
- [x] Implementar pesquisa por nome e CPF.
- [x] Reutilizar o cadastro existente.
- [x] Iniciar cadastro rapido dentro da tela de encaixes.
- [x] Criar a lista de clientes aguardando.
- [x] Implementar desistencia, impossibilidade e cancelamento.

### Etapa 3: operacao do atendimento

- [x] Implementar chamada individual seguindo a ordem da fila.
- [x] Registrar inicio e termino reais.
- [ ] Exibir risco de conflito com o proximo agendamento.
- [ ] Exigir justificativa para prioridade e excecoes.
- [ ] Permitir conversao para agendamento futuro.

### Etapa 4: indicadores

- [ ] Adicionar filtros por periodo e loja.
- [ ] Calcular espera, atendimento, desistencia e conversao.
- [ ] Incluir os indicadores no painel gerencial.
- [ ] Validar custo e quantidade de leituras no Firestore.

### Etapa 5: verificacao

- [x] Testes unitarios das regras de estado e fluxo basico.
- [x] Testes das regras do Firestore por perfil e unidade.
- [ ] Testes de concorrencia ao chamar o proximo cliente.
- [x] Testes ponta a ponta do cadastro existente e do cadastro rapido ate a conclusao.
- [ ] Testes de regressao da agenda regular e dos `appointmentSlots`.
- [ ] Verificacao visual em desktop e celular.
- [ ] Piloto acompanhado em uma unidade antes da liberacao geral.

## Criterios de conclusao

- A recepcao consegue registrar um cliente presencial em poucos passos.
- O encaixe aparece separado dos horarios regulares.
- Nenhum agendamento confirmado e alterado ou removido automaticamente.
- A equipe consegue chamar, iniciar e concluir o atendimento.
- Todas as transicoes registram autor, data, hora e justificativas exigidas.
- Usuarios visualizam e alteram somente filas das unidades permitidas.
- O historico do lead mostra todo o ciclo do encaixe.
- Entradas abertas sao encerradas ou convertidas ao final do dia.
- O painel informa demanda, espera, atendimento e perdas por unidade.
- A agenda regular continua funcionando sem regressao.

## Decisoes pendentes

- Quais dados serao obrigatorios no cadastro rapido.
- Quais motivos de encaixe, desistencia e impossibilidade serao padronizados.
- Se colaborador e MEI poderao visualizar a fila.
- Qual perfil podera alterar prioridade.
- Qual antecedencia devera gerar alerta para o proximo agendamento.
- Se o profissional tera uma tela propria para chamar o proximo cliente.
- Como registrar o resultado comercial sem misturar dados clinicos e comerciais.
- Por quanto tempo os eventos operacionais detalhados serao mantidos.
