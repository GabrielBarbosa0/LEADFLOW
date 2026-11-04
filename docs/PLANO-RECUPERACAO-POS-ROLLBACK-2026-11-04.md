# Plano de recuperacao apos rollback

## Contexto

O ambiente operacional foi temporariamente restaurado para o commit
`a2d90e1034b67df2931b42d5677bd13774980544`. O codigo mais recente permanece
preservado no repositorio principal e na copia
`FASCINLEAD-BACKUP-ANTES-ROLLBACK-2026-11-04`.

O rollback confirmou que o fluxo antigo funciona com os perfis reais. A
regressao foi introduzida depois desse ponto, com maior suspeita sobre a
combinacao dos commits `95c2d77` e `95505a9`, que tornou o reagendamento
transacional e alterou as regras dos perfis de balcao.

## Funcionalidades retiradas pelo rollback

### 1. Forma de pagamento Carne

- Substituicao da opcao Boleto por Carne no pagamento do exame.
- Validacao, exportacao e regras do Firestore alinhadas ao identificador
  `booklet`.

### 2. Comparecimento reversivel

- Segundo clique em `Compareceu` retorna o agendamento para `Pendente`.
- Segundo clique em `Nao compareceu` tambem retorna para `Pendente`.
- Correcao imediata de marcacoes acidentais sem alterar data ou cadastro.

### 3. Arquivamento de leads

- Acao `Arquivar leads` na Gestao, com selecao individual e em lote.
- Filtro para visualizar arquivados e possibilidade de manter o botao em
  posicao estavel na interface.
- Leads arquivados deixam de participar de agenda, retornos, alertas de CPF,
  estatisticas, dashboard e operacao diaria.
- Historico e dados originais permanecem preservados.
- Os marcadores de origem `captar_import` continuam no banco, mas a versao de
  rollback nao aplica o filtro de arquivamento.

### 4. Cancelamento formal de agendamento

- Cancelamento dentro do cadastro, sem excluir o lead.
- Lista padronizada de motivos e opcao `Outro motivo` com observacao.
- Liberacao dos blocos de horario reservados.
- Registro imutavel de autor, data, motivo e observacao no historico.
- Exclusao do agendamento cancelado das filas e indicadores ativos.

### 5. Reagendamento formal

- Modal de confirmacao ao alterar data, horario ou servico.
- Motivo obrigatorio e observacao obrigatoria para `Outro motivo`.
- Preservacao da data anterior e registro do evento no historico.
- Liberacao dos blocos antigos e reserva dos novos blocos.
- Distincao entre reagendamento e futuro retorno de tratamento.

### 6. Historico operacional do lead

- Eventos de cadastro, agendamento, reagendamento, cancelamento e encaixe.
- Identificacao do autor e do momento de cada acao.
- Modal simplificado `Historico do lead`, sem cabecalhos repetidos e sem o
  rotulo `Funil`.

### 7. Captador no encaixe rapido

- Pesquisa opcional do captador que trouxe o cliente para a loja.
- Preservacao do captador original em cadastros existentes.
- Vinculo adicional para acompanhamento do encaixe pelo captador responsavel.
- Exibicao dessa atribuicao na fila e nos cadastros relacionados.

### 8. Operacao externa

- Perfil `Lider de externa` com as permissoes do colaborador padrao e a
  permissao adicional de operacao externa.
- Entrada `Operacao externa` na pagina inicial.
- Consulta por periodo, unidade, cliente, apelido, bairro e referencia.
- Listagem focada em clientes com transporte, com ou sem acompanhante.
- Resumo de assentos, contatos, endereco, referencia e apelido.
- Callable Function que limita os dados enviados ao navegador.

### 9. Score do cliente

- Campo opcional de score entre 0 e 1000.
- Edicao por Balcao, Gestor e Administrador.
- Visualizacao controlada para evitar exposicao a perfis comuns.
- Validacao no formulario e nas regras do Firestore.

### 10. Sincronizacao de permissoes do Balcao

- Conjunto padrao de permissoes do perfil `Atendente Balcao`.
- Sincronizacao de acessos antigos com o perfil atual.
- Permissoes para editar cadastro, criar encaixe, agendar, cancelar e alterar
  comparecimento nas unidades permitidas.

## Ordem segura de reimplementacao

Cada etapa deve gerar um commit e um pacote independentes. Uma etapa somente
avanca depois de ser testada no ambiente real com Administrador, Atendente
Balcao e um perfil sem permissao.

1. **Carne**: mudanca pequena e isolada de dados e interface.
2. **Comparecimento reversivel**: implementar somente a transicao
   `attended/missed -> pending`, com teste de regra para Balcao.
3. **Arquivamento**: recuperar gravacao, filtros e exclusao das estatisticas,
   sem alterar agenda ou reservas.
4. **Captador no encaixe rapido**: recuperar o vinculo adicional sem mudar a
   autoria original.
5. **Operacao externa**: recuperar perfil, Callable Function e tela de leitura.
6. **Score**: recuperar o campo e sua permissao especifica.
7. **Base de historico**: recuperar leitura e criacao de eventos sem ainda
   alterar blocos da agenda.
8. **Cancelamento**: adicionar motivo, historico e liberacao de horario em uma
   transacao testada por perfil.
9. **Reagendamento**: recuperar por ultimo e dividir em entregas menores:
   validacao e modal; atualizacao do lead; historico; troca de blocos.
10. **Sincronizacao final de acessos**: revisar os documentos reais de Balcao e
    executar a matriz completa de permissoes.

## Matriz obrigatoria de verificacao

Para toda etapa que tocar Firestore:

- Administrador executa a operacao nas unidades permitidas.
- Atendente Balcao executa a operacao em sua unidade.
- Atendente Balcao e bloqueado fora de suas unidades.
- Colaborador, MEI e Telemarketing permanecem sem acesso indevido.
- Cadastro legado e cadastro novo sao testados separadamente.
- Regras sao testadas no emulador antes da publicacao.
- Frontend e regras da mesma versao sao publicados juntos.
- O ZIP e validado com `index.html` e todos os arquivos de `assets/` na raiz.
- O teste na Hostinger e feito em janela anonima para evitar cache do PWA.

## Criterio para localizar a regressao

Depois de cada etapa, executar no minimo:

1. editar nome ou telefone de um cadastro pelo Balcao;
2. criar um cadastro e agenda-lo;
3. agendar um cadastro existente;
4. criar um encaixe rapido;
5. marcar e desfazer comparecimento;
6. cancelar, quando a etapa estiver disponivel;
7. reagendar, somente quando a etapa final estiver disponivel.

O primeiro commit que fizer um desses fluxos retornar `permission-denied` sera
isolado antes de qualquer nova funcionalidade ser portada.
