# Plano de implementacao - feedback do treinamento

| Campo | Valor |
| --- | --- |
| Status | Etapa 1 implementada localmente e validada; demais etapas planejadas |
| Origem | Primeiro dia de treinamento operacional |
| Data | 03/11/2026 |
| Objetivo | Evoluir encaixes, agenda, dados comerciais e operacao externa sem romper o fluxo atual |

## 1. Principios de implementacao

- Entregar uma etapa por vez, com testes locais antes de qualquer publicacao em Hosting.
- Nunca apagar um lead, agendamento, encaixe ou evento para representar cancelamento, falta ou reagendamento.
- Preservar o autor original do cadastro. A atribuicao posterior a um captador sera um vinculo adicional, auditavel, e nao uma troca silenciosa de autoria.
- Implementar permissoes no Firestore e na interface. Ocultar uma tela nao e controle de acesso.
- Tratar CPF, RG, score, contatos alternativos e endereco como dados pessoais; exibir somente para quem precisa operar o caso.
- Separar agendamento comum, reagendamento e retorno de tratamento. Eles podem compartilhar a agenda, mas nao representam o mesmo evento de negocio.
- Publicar regras do Firestore somente quando a etapa exigir novos campos ou permissoes. Regras aditivas e compativeis podem coexistir com a versao que ja esta na Hosting; regras restritivas ou que mudem campos obrigatorios exigem janela de publicacao e teste de regressao.

## 2. Situacao atual relevante

O FascinLead ja possui:

- fila diaria de encaixes (`appointmentWalkIns`) vinculada a um lead;
- cadastro rapido dentro do fluxo de encaixe;
- estados de fila, encerramento justificado e eventos no historico do lead;
- agenda regular e historico de leads;
- perfis de colaborador, MEI, atendente de balcao, telemarketing, gestor e administrador;
- campos opcionais atuais de referencia financeira associados ao fluxo de pagamento;
- formas de pagamento de exame, incluindo Boleto e Carne como opcoes separadas na versao atual.

O plano abaixo corrige a ultima interpretacao: **Boleto e Carne representam a mesma modalidade operacional**. A interface futura mostrara uma unica opcao, com nome a ser aprovado como `Boleto / Carne`. Os dados de contato e referencia nao devem depender da forma de pagamento do exame.

## 3. Ordem recomendada

1. Base de historico e cancelamento de agendamento.
2. Reagendamento formal e retorno de tratamento.
3. Atribuicao de captador em encaixes rapidos.
4. Dados complementares, score e pagamento comercial.
5. Painel de lider de externa.
6. Indicadores e relatorios gerenciais derivados das novas informacoes.

Essa ordem primeiro protege a trilha operacional, depois melhora a agenda e so entao amplia os cadastros e os paineis.

## 4. Etapa 1 - Cancelamento de agendamento com historico

**Status: implementada localmente em 03/11/2026.** A entrega ainda nao foi publicada em Hosting nem teve regras do Firestore enviadas ao projeto de producao.

### Status

Implementacao inicial concluida localmente: busca por nome, exibicao na fila, registro auditavel e acompanhamento do captador vinculado. A troca posterior de responsavel com motivo continua pendente para uma etapa especifica.

### Objetivo

Permitir cancelar um agendamento sem excluir o lead, a data anterior ou eventos ja registrados. O cancelamento deve explicar o motivo e permanecer visivel no historico.

### Experiencia proposta

1. O usuario autorizado abre um agendamento regular.
2. Escolhe `Cancelar agendamento`.
3. Um modal informa que o cadastro sera preservado e solicita um motivo.
4. O usuario escolhe um motivo padronizado; ao escolher `Outro`, a descricao passa a ser obrigatoria.
5. Ao confirmar, o horario deixa de ser tratado como ativo, a vaga e liberada conforme as regras atuais da agenda e um evento imutavel e criado no historico.

### Catalogo inicial de motivos

- Cliente desistiu.
- Nao conseguiu comparecer.
- Horario incompativel.
- Atendimento realizado em outro local.
- Problema de transporte.
- Cadastro duplicado.
- Orientacao clinica ou operacional.
- Outro motivo.

### Dados e auditoria

Adicionar ao lead, sem remover os campos atuais de agenda:

```text
appointmentStatus: scheduled | confirmed | attended | missed | cancelled
appointmentCancelledAtServer: timestamp | null
appointmentCancelledByUid: string | null
appointmentCancelledByName: string | null
appointmentCancellationReason: string | null
appointmentCancellationDetails: string | null
```

Criar tambem um evento `appointment_cancelled` em `leads/{leadId}/history`, contendo a data e horario que foram cancelados, motivo, detalhe, ator e unidade.

### Permissoes propostas

- Captador ou MEI: cancelar somente agendamento de lead proprio enquanto o atendimento ainda nao foi concluido, dentro da unidade permitida.
- Atendente de balcao: cancelar agendamentos da unidade permitida.
- Gestor e administrador: cancelar nas unidades permitidas.
- Telemarketing: sem cancelamento nesta primeira etapa, salvo se uma permissao explicita for criada depois.

### Testes de aceite

- Cancelar nao apaga lead nem eventos anteriores.
- A vaga deixa de bloquear novo agendamento.
- Motivo e ator aparecem no historico.
- Usuario sem alcance de unidade ou sem permissao recebe `permission-denied` no Firestore.
- Um agendamento ja marcado como atendido nao pode ser cancelado como se ainda estivesse aberto.

## 5. Etapa 2 - Reagendamento e retorno de tratamento

**Status: reagendamento formal implementado localmente; retorno de tratamento pendente.**

### Objetivo

Evitar que a simples edicao da data esconda a historia do cliente e distinguir retorno clinico de uma tentativa de remarcacao comum.

### Reagendamento

Quando um usuario alterar data, horario, unidade, servico ou profissional de um agendamento ativo, a interface nao salvara diretamente. Ela abrira o modal `Reagendar cliente` com:

- data e horario anteriores;
- nova data e horario;
- motivo padronizado;
- observacao opcional, obrigatoria para `Outro`;
- confirmacao explicita.

O sistema libera a reserva antiga, cria a nova reserva usando a rotina atual e grava `appointment_rescheduled` no historico. O evento deve referenciar os valores anterior e novo, sem expor dados desnecessarios em listas.

### Retorno de tratamento

Adicionar uma acao distinta, `Agendar retorno de tratamento`, para casos definidos pelo profissional. Ela cria um novo evento de agenda, mas com classificacao propria:

```text
appointmentKind: regular | treatment_return
relatedAppointmentId: string | null
treatmentReturnReason: string | null
```

O retorno nao sera contado como reagendamento nos relatorios. A interface da agenda podera identificar visualmente o retorno sem misturar o dado com os encaixes.

### Testes de aceite

- Alteracao de data em agendamento existente exige confirmacao de reagendamento.
- Reagendamento preserva historico e libera corretamente a vaga anterior.
- Retorno de tratamento aparece como categoria propria e nao incrementa indicadores de reagendamento.
- Cancelamento, reagendamento e retorno respeitam os mesmos limites de agenda e unidade.

## 6. Etapa 3 - Captador responsavel no encaixe rapido

### Objetivo

Permitir associar opcionalmente um captador a um encaixe, para que ele acompanhe aquele cliente sem adulterar quem realizou o cadastro original. Para um cadastro rapido novo, o captador escolhido passa a ser o autor original; para um lead existente, ele fica registrado apenas como quem trouxe o cliente para aquele encaixe.

### Experiencia proposta

No formulario de `Novo encaixe rapido`, incluir o campo opcional `Captador responsavel`:

- pesquisa por nome entre captadores ativos permitidos para a unidade;
- opcao `Sem captador vinculado` como padrao;
- exibicao do nome selecionado na fila e no detalhe do cliente;
- ao concluir o encaixe, o lead passa a aparecer em `Meus cadastros` e nos retornos desse captador como lead acompanhado, com identificacao de que a atribuicao veio de encaixe.

### Modelo de dados

Nao substituir `capturedByUid` nem `capturedByName`. Adicionar ao encaixe e, quando confirmado, ao acompanhamento do lead:

```text
appointmentWalkIns/{walkInId}
  assignedCaptorUid: string | null
  assignedCaptorName: string | null

leads/{leadId}
  followUpCaptorUid: string | null
  followUpCaptorName: string | null
  followUpSource: walk_in | null
  followUpAssignedAtServer: timestamp | null
```

O historico recebe `walk_in_captor_assigned` e, se o encaixe for concluido, `walk_in_completed`. Caso seja necessario trocar o captador, a troca exige motivo e gera novo evento.

### Permissoes propostas

- Atendente de balcao, gestor e administrador podem escolher captador na unidade permitida.
- Captador nao pode atribuir encaixe a outro captador.
- Um captador acompanha somente leads em que seja autor ou `followUpCaptorUid`.

### Testes de aceite

- A atribuicao nao altera autor original do cadastro.
- Lead atribuido aparece apenas na visao autorizada do captador escolhido.
- Usuarios de outra unidade nao aparecem na pesquisa nem podem ser vinculados por chamada direta ao Firestore.

## 7. Etapa 4 - Dados comerciais e contatos alternativos

### 7.1 Unificar Boleto e Carne

Substituir as opcoes separadas por uma unica forma de pagamento `Boleto / Carne`. Dados historicos com `bank-slip` e `booklet` devem continuar legiveis e ser normalizados por migracao planejada, sem apagar registros.

### 7.2 Contatos e referencias do cliente

Os campos abaixo serao opcionais e pertencerao ao cadastro do cliente, nao a forma de pagamento:

```text
fatherName: string | null
motherName: string | null
spouseName: string | null
auxiliaryContactName: string | null
auxiliaryContactRelationship: string | null
auxiliaryPhone: string | null
```

A interface deve deixar claro a quem pertence o telefone auxiliar. Sugestao: nome do contato, vinculo (`conjuge`, `filho(a)`, `vizinho(a)`, `outro`) e telefone. Esses campos serao opcionais e terao validacao de DDD quando preenchidos.

### 7.3 Pagamento de produtos do combo

O pagamento do exame continuara separado da venda de produtos. Ao registrar itens do combo, cada item ou grupo comercial podera ter:

```text
productItems: [{
  itemType: frame | lens | glasses | other,
  description: string,
  quantity: number,
  paymentMethod: cash | pix | debit_card | credit_card | boleto_carne | other,
  paymentDetails: string | null
}]
```

Antes de implementar, confirmar com o balcao se o pagamento deve ser por item, por combo inteiro ou permitir ambos. A proposta inicial e **pagamento por combo**, com divisao por item apenas quando realmente houver necessidade; isso evita uma tela financeira excessivamente pesada.

### 7.4 Score

Adicionar campo numerico opcional `creditScore`, com origem e data da consulta:

```text
creditScore: number | null
creditScoreCheckedAtServer: timestamp | null
creditScoreCheckedByUid: string | null
```

O score nao deve ser exibido a captadores, telemarketing ou usuarios comuns. A primeira regra proposta permite visualizar e editar somente para `Atendente de balcao`, gestor autorizado e administrador. Os relatorios usarao apenas faixas agregadas, por exemplo `0-300`, `301-500`, `501-700`, `701-1000`, sem expor CPF ou score individual fora do detalhe autorizado.

### Testes de aceite

- Boleto e Carne antigos permanecem legiveis; novos registros usam a forma unificada.
- Campos opcionais vazios nao bloqueiam cadastro.
- Telefone auxiliar invalido e rejeitado somente quando informado.
- Captador e telemarketing nao leem nem gravam score por interface ou Firestore.
- Exportacoes separadas respeitam permissao de dados financeiros e score.

## 8. Etapa 5 - Painel do lider de externa

### Objetivo

Criar uma visao operacional de transporte para o lider de externa, acessivel pela pagina inicial e focada no dia escolhido.

### Novo perfil e permissao

Criar o perfil padrao `Lider de externa`, com alcance limitado a unidades permitidas e permissoes iniciais:

- consultar agendamentos do dia selecionado;
- consultar dados logísticos de clientes que precisam de transporte;
- abrir detalhe do cadastro para operacao externa;
- sem editar dados clinicos, financeiros, score ou perfis de acesso;
- sem apagar ou cancelar agendamentos na primeira versao.

Permissao sugerida: `external.operations.read`.

### Tela proposta

Adicionar item na pagina inicial: `Operacao externa`.

1. Seletor de data, iniciado em hoje.
2. Resumo: total de agendamentos, clientes com transporte, acompanhantes e assentos necessarios.
3. Lista apenas de clientes com transporte, agrupada por unidade e horario.
4. Cartao compacto: nome, telefone, endereco, bairro, referencia, apelido, horario, acompanhante e responsavel pelo cadastro.
5. Seta para abrir detalhe completo autorizado, sem mostrar score ou informacoes financeiras.
6. Estado vazio claro para dia sem transporte.

O endpoint e a consulta devem filtrar por data e unidades autorizadas para evitar baixar a agenda inteira. A pagina nao tera rota publica nem permitira pesquisa de CPF para esse perfil fora de sua finalidade logistica.

### Testes de aceite

- Lider ve apenas suas unidades e a data selecionada.
- Dados de endereco e apelido aparecem no detalhe operacional autorizado.
- Score, pagamentos e dados clinicos permanecem ocultos.
- Colaborador sem permissao nao abre a rota nem consulta documentos no Firestore.

## 9. Etapa 6 - Relatorios e acompanhamento

Depois que as etapas anteriores estiverem em producao com dados reais, criar indicadores sem alterar retrospectivamente o significado de registros antigos:

- cancelamentos por motivo, unidade, captador e periodo;
- taxa e tempo medio de reagendamento;
- retornos de tratamento agendados, realizados e pendentes;
- encaixes por captador atribuido e resultado do encaixe;
- demanda de transporte por dia e unidade;
- distribuicao agregada de score, somente para perfis autorizados;
- formas de pagamento de exame e de produtos do combo.

Os paineis devem oferecer filtro de periodo e unidade e deixar claro quando dados historicos nao tiverem a nova classificacao.

## 10. Publicacao, compatibilidade e migracoes

### Trabalho local e GitHub

Cada etapa deve seguir esta sequencia:

1. Escrever ou ajustar testes unitarios, regras e fluxo de tela.
2. Implementar em branch ou conjunto de commits pequeno e tematico.
3. Rodar testes locais, emulador de regras e teste visual/E2E do fluxo alterado.
4. Fazer commit e enviar ao GitHub.
5. Revisar com a operacao em ambiente local ou de teste.
6. Gerar build e publicar Hosting somente quando a etapa for aprovada.

### Firestore

- Adicionar campos opcionais e novas permissoes pode ser publicado antes da interface, desde que regras antigas continuem validas.
- Nunca tornar um campo novo obrigatorio sem migrar ou aceitar documentos legados.
- Publicar regras restritivas somente junto com a interface que deixa de depender do acesso removido.
- Toda nova consulta composta precisa ser validada contra `firestore.indexes.json` antes da publicacao.
- Migracoes de dados devem ter script idempotente, modo de simulacao e relatorio de documentos alterados.

### Hosting

A versao ja publicada continuara funcionando se as regras forem apenas ampliadas de forma compativel. Mesmo assim, a regra pratica e: nao publicar regras que removem um campo permitido, tornam campo obrigatorio ou restringem permissao usada pela versao atual sem publicar a interface correspondente no mesmo ciclo.

## 11. Decisoes pendentes para validar antes de cada etapa

- Nome final da forma unificada: `Boleto / Carne` ou apenas `Carne`.
- Quais motivos de cancelamento entram no catalogo definitivo.
- Se captador pode cancelar qualquer lead atribuido a ele ou somente aqueles que cadastrou.
- Prazo maximo para captador cancelar antes da data do exame.
- Quem pode alterar a atribuicao de captador de um encaixe ja concluido.
- Se o pagamento de produtos sera por combo, por item ou ambos.
- Faixa e fornecedor do score; o FascinLead apenas registra o resultado informado, nao fara consulta automatica nesta fase.
- Quais dados o lider de externa realmente precisa editar, caso algum; a proposta inicial e leitura operacional.
- Regra clinica e responsavel que pode criar retorno de tratamento.

## 12. Criterio de conclusao geral

Cada etapa so sera considerada concluida quando tiver:

- fluxo testado em desktop, celular e tablet quando houver tela nova;
- autorizacao validada por testes das regras do Firestore;
- historico criado para toda acao relevante;
- tratamento de dados legados definido e testado;
- TDD atualizado para refletir apenas o comportamento efetivamente entregue;
- versao de Hosting publicada apenas apos aprovacao operacional.
