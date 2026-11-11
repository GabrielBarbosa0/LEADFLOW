# Plano de integracao SavWin e evolucao das metas

## 1. Status deste documento

Este documento consolida a descoberta tecnica realizada em 07/11/2026 sobre a
API do SavWin, os fluxos existentes no n8n e a evolucao planejada do sistema de
metas do LeadFlow.

A integracao descrita aqui **ainda nao esta disponivel em producao**. O plano
esta aprovado para detalhamento e implementacao por etapas, mas cada fase deve
ser validada antes de liberar a seguinte. A primeira entrega deve terminar em
um `dry-run` auditavel; nenhum resultado financeiro deve aparecer como oficial
antes da conciliacao com o SavWin e com o setor financeiro.

O objetivo nao e transformar o LeadFlow em sistema financeiro, ERP ou CRM. O
SavWin continua sendo a fonte de verdade das vendas. O LeadFlow recebera apenas
os dados necessarios para medir a conversao e o valor gerado pelas captacoes.

### 1.1 Implementacao atual de homologacao

Em 07/11/2026 foi criada, na branch
`feature/savwin-n8n-homologacao`, a primeira fronteira de correspondencia em
`dry_run`. Ela ainda nao e uma integracao entre o n8n Cloud e o LeadFlow. Seu
objetivo e validar localmente o contrato e as regras antes de escolher qualquer
canal de rede para homologacao.

Componentes implementados:

- workflow manual `GRUPO FASCIN - SavWin -> LEADFLOW - HOMOLOGACAO` no n8n,
  com consulta, normalizacao, consolidacao por OS e resumo seguro;
- Function HTTP `savwinDryRunMatch`, executavel exclusivamente na Firebase
  Emulator Suite com o projeto `demo-leadflow`;
- validacao de lotes com ate 200 OSs consolidadas;
- consulta somente leitura dos leads ficticios do emulador;
- classificacao de CPF ausente ou invalido, lead nao encontrado, venda anterior
  a captacao, janela vencida, divergencia, ambiguidade e correspondencia;
- resposta sem nome e sem CPF;
- testes unitarios e teste integrado local com dados ficticios.

A Function exige simultaneamente `FUNCTIONS_EMULATOR=true`, projeto
`demo-leadflow`, `FIRESTORE_EMULATOR_HOST` e um token local de no minimo 32
caracteres. Ela devolve `403 emulator_only` antes de acessar o Firestore quando
qualquer trava de ambiente falha. Nao existe modo `apply`, nao existem escritas
e nao existe fallback para outro projeto Firebase.

O export da Function tambem e condicional a essas travas. Fora do emulador, o
Firebase CLI nao encontra `savwinDryRunMatch` entre as Functions publicaveis.
Essa protecao nao substitui a proibicao operacional de executar deploy nesta
branch, mas reduz o impacto de um comando disparado no ambiente errado.

O n8n utilizado pela empresa esta na nuvem e nao alcanca `127.0.0.1`. Portanto,
o workflow nao deve receber a URL da Function local ate que seja aprovado um
canal de homologacao isolado, como um tunel temporario autenticado para o
emulador ou um projeto Firebase separado de homologacao. O projeto de producao
nao e uma opcao para esta fase.

O teste temporario por tunel usa um gateway local em `127.0.0.1:5088`. Ele
expoe somente `POST /savwin-dry-run`, exige o mesmo token local, limita o corpo
e encaminha apenas para `savwinDryRunMatch`. As portas do Emulator Suite nao
devem ser tuneladas diretamente. O primeiro teste deve usar OS e CPF ficticios;
o fluxo real do SavWin permanece desconectado.

### 1.2 Resultado do primeiro teste ponta a ponta

Em 07/11/2026, o workflow temporario
`LEADFLOW - TESTE PONTE HOMOLOGACAO` executou com sucesso o caminho n8n Cloud ->
tunel temporario -> gateway de rota unica -> Function local -> Firestore
Emulator. O teste utilizou somente OS, valor e CPF ficticios do seed local.

Resultado observado:

- `ok = true` e `mode = dry_run`;
- uma venda recebida e uma correspondencia;
- estado `matched_same_store`;
- nenhuma ausencia de lead, ambiguidade, divergencia, janela vencida ou erro;
- dez dias ficticios entre captacao e conversao;
- nenhuma escrita executada.

Depois da validacao, o tunel e o gateway foram encerrados, o emulador foi
parado e o token local foi rotacionado. O token armazenado no workflow
temporario deixou de ser valido. Nenhuma porta do emulador permanece publicada
e nenhum projeto Firebase remoto foi acessado.

### 1.3 Preparacao do contrato no workflow principal

O proximo bloco do workflow principal de homologacao e `Montar lote dry-run`,
conectado somente a saida de `Consolidar por OS`. Seu codigo versionado esta em
`docs/n8n/montar-lote-dry-run.js`.

Esse bloco nao realiza requisicoes. Ele limita o lote a 200 OSs, valida loja,
chave, data, duplicidade e valor, e remove nomes, produtos e demais campos que
nao pertencem ao contrato. A saida contem apenas `saleKey`, `storeCode`,
`osNumber`, `saleDate`, `customerCpf`, `reconciliationStatus` e
`reportedSaleNetValue`, alem de um resumo `preflight` com
`externalRequestSent = false`.

O bloco seguinte, `Validar contrato do lote`, confirma que existe exatamente
um lote em `dry_run` e que cada venda possui somente os sete campos permitidos.
Sua saida remove CPF, OS e valores individuais, exibindo apenas contagens,
`payloadReady`, `containsOnlyAllowedFields` e `externalRequestSent = false`.
O codigo versionado esta em `docs/n8n/validar-contrato-lote.js`.

Em 07/11/2026, os dois blocos foram executados no workflow principal de
homologacao sobre uma consulta manual do SavWin. O resultado observado foi um
lote com quatro OSs consolidadas, tres delas com CPF utilizavel, contrato valido
e `payloadReady = true`. A validacao foi executada sem nova consulta ao SavWin,
sem requisicao externa e sem acesso a qualquer projeto Firebase. O proximo
passo permanece bloqueado ate a abertura deliberada de um novo canal temporario
para a Emulator Suite, com token novo e rota unica.

Na sequencia, o canal temporario foi reaberto somente para a Emulator Suite e o
lote validado foi enviado pelo bloco `Enviar dry-run ao emulador`. O emulador
recebeu quatro vendas: tres foram classificadas como `no_lead` e uma como
`missing_cpf`. O resultado era esperado, pois os CPFs vindos do SavWin nao
existem no seed ficticio. Nao houve correspondencia, ambiguidade, divergencia,
venda anterior a captacao ou janela vencida. A resposta nao devolveu CPF nem
nome e nenhuma escrita foi realizada.

Imediatamente depois do teste, o tunel, o gateway e a Emulator Suite foram
encerrados. As portas locais protegidas foram verificadas como fechadas e o
token temporario foi rotacionado. A URL e a credencial presentes no bloco HTTP
do n8n deixaram de fornecer acesso ao ambiente local.

O bloco seguinte, `Resumir retorno do dry-run`, usa somente a resposta ja
armazenada na execucao do n8n. Ele valida o modo, os contadores, a quantidade de
resultados e os estados permitidos. Sua saida elimina os resultados individuais
e preserva apenas totais de correspondencias, pendencias e motivos de rejeicao.
O codigo versionado esta em `docs/n8n/resumir-retorno-dry-run.js`.

O resumo foi executado sobre a resposta armazenada, sem reabrir a ponte. Ele
confirmou quatro vendas recebidas, zero correspondencias elegiveis e quatro
pendencias. A saida foi aceita com `responseAccepted = true` e nao reteve a
lista de resultados individuais.

Ao encerrar a rodada, o bloco `Enviar dry-run ao emulador` tambem foi
neutralizado no n8n. A URL temporaria foi substituida por um dominio reservado
`.invalid` e o valor do cabecalho foi trocado por um marcador sem acesso. Assim,
uma execucao manual acidental nao consegue reutilizar o tunel nem a credencial
da homologacao concluida.

## 2. Resultado esperado

Ao final da evolucao, o LeadFlow devera relacionar uma captacao a uma ou mais
ordens de servico do SavWin e permitir que:

- o captador acompanhe quantos clientes captou, quantos converteram e quanto
  valor suas captacoes geraram;
- a gestao acompanhe resultados por captador, unidade e periodo;
- as metas deixem de considerar somente quantidade de cadastros e passem a
  suportar tambem conversoes e faturamento;
- cada numero exibido possa ser rastreado ate uma OS importada, sem duplicar
  valores por causa das linhas de produtos;
- divergencias, CPFs ausentes e atribuicoes ambiguas sejam revisadas sem
  alterar silenciosamente os resultados.

## 3. Estado atual do LeadFlow

O modelo atual de metas utiliza a colecao `goals` e a metrica
`leads_captured`. Cada meta possui `targetCount`, periodo, unidade e captador.
O progresso e calculado a partir dos leads sincronizados.

O repositorio tambem possui uma fundacao experimental para SavWin:

- proxy local somente leitura em `server/savwin-local-proxy.js`;
- contrato local em `docs/savwin-local-proxy.openapi.yaml`;
- normalizacao e agrupamento em `src/utils/savwin-matching.js`;
- colecao experimental `leadSales/{leadId}`;
- campo opcional de codigo SavWin em leads e acessos.

Essa fundacao nao representa uma integracao de producao. Em especial,
`leadSales/{leadId}` nao comporta corretamente um cliente com varias OSs e nao
deve ser adotada como modelo definitivo.

## 4. Descobertas sobre a operacao atual no n8n

A empresa ja possui uma instancia n8n Cloud com credencial do SavWin e
workflows publicados para dados financeiros, comerciais, clientes e boletos.
Os fluxos comerciais observados executam, em geral, duas vezes ao dia, as 12h e
19h, e seguem esta sequencia:

1. calcular o periodo de consulta;
2. consultar a API do SavWin;
3. unificar e validar os registros;
4. consultar o JSON anual ja publicado;
5. consolidar os dados em JavaScript;
6. publicar um JSON protegido para o sistema financeiro.

Os workflows existentes sao operacionais e nao devem ser alterados durante a
primeira fase da integracao. O LeadFlow deve receber um workflow isolado, com
nome sugerido `GRUPO FASCIN - SavWin -> LEADFLOW`, credenciais proprias quando
possivel e logs separados.

### 4.1 Fonte inicial dos dados

A ordem de preferencia para a primeira versao e:

1. consumir no novo workflow a saida comercial protegida que ja foi validada
   pelo fluxo existente, caso ela preserve todos os campos necessarios;
2. reutilizar, sem alterar o fluxo publicado, uma fonte intermediaria segura;
3. consultar diretamente o endpoint SavWin em um workflow independente apenas
   depois de confirmar limites de requisicao e impacto operacional.

O navegador do LeadFlow nunca deve consultar diretamente o SavWin nem o JSON
com CPFs e valores. A integracao ocorre somente no n8n e na camada protegida de
dados.

## 5. Contrato observado da API SavWin

As informacoes abaixo foram confirmadas empiricamente em uma execucao do n8n.
Elas nao substituem uma documentacao oficial do fornecedor e devem ser
monitoradas contra mudancas no upstream.

### 5.1 Produtos por OS

```text
Metodo: POST
URL: https://cliapi.savwinweb.com.br/api/APIRelatoriosCR/ProdutosPorOSGrid
Autenticacao: Custom Auth armazenada no n8n
Content-Type: application/json
```

Corpo observado:

```json
{
  "DATAINICIAL": "01/11/2026",
  "DATAFINAL": "30/11/2026",
  "LOJAS": "2,4,5,6"
}
```

Campos de entrada e codigos devem permanecer como texto quando puderem conter
zeros a esquerda.

### 5.2 Campos observados na resposta

| Grupo | Campos observados | Uso planejado |
| --- | --- | --- |
| Unidade e OS | `LOJA`, `OS`, `DATA`, `HORA` | Identificar e datar a venda |
| Cliente | `CODCLIENTE`, `CODIGOCLIENTE`, `CLIENTE`, `CPFCNPJ`, `TELEFONE`, `CELULAR` | Relacionar a venda ao lead |
| Produto | `CODIGO`, `PRODUTO`, `DESCRICAO`, `GRIFE`, `LINHA`, `QUANTIDADE` | Detalhar os itens da OS |
| Fabricacao | `FABRICANTEFORNECEDOR`, `FABRICANTELENTES` | Analises futuras, se aprovadas |
| Valores | `VALORBRUTOPRODUTO`, `DESCPRODUTO`, `LIQUIDOPRODUTO`, `CUSTO`, `VLRLIQUIDOVENDA`, `VLRLIQDESCFCPGTO` | Calcular valor e conferir divergencias |
| Atendimento | `MEDICO`, `TIPOVENDA`, `INDICACAO`, `OBSERVACOES`, `PAGADOR` | Segmentar origem e tipo da venda |
| Equipe SavWin | `VENDEDOR`, `VENDEDOR2`, `VENDEDOR3`, `GERENTE` | Analise comercial separada da autoria da captacao |
| Fiscal | `CUPOMFISCAL`, `DATACUPOM`, `STATUSCUPOM` | Identificar situacao fiscal e possiveis cancelamentos |
| Classificacao | `NCM`, `NCMDESCRICAO`, `CODBARRASFORNECEDOR`, `SKU`, `UPC` | Classificacao de produtos |
| Auditoria | `USUARIO`, `USUARIODESCONTO` | Auditoria tecnica restrita |

Campos podem chegar vazios e os valores monetarios podem usar virgula como
separador decimal. O importador nao pode depender de telefone ou celular para
o cruzamento, pois esses campos aparecem vazios em varios registros.

### 5.3 Contas recebidas

O fluxo financeiro observado utiliza outro endpoint:

```text
Metodo: POST
URL: https://cliapi.savwinweb.com.br/api/APIRelatoriosCR/ContasReceberRecebidasGrid
```

Foram observados parametros como `FIUID`, `STATUSRECEBIDO`, `DUPEMISSAO1`,
`DUPEMISSAO2`, `RECRECEBIMENTO1`, `RECRECEBIMENTO2`, `PARVENCIMENTO1` e
`PARVENCIMENTO2`.

Esse endpoint representa recebimentos e parcelas, nao a conversao comercial.
Ele fica fora da primeira versao. Usa-lo prematuramente poderia contar varias
parcelas da mesma OS como varias vendas. Uma futura metrica de valor recebido
devera ser projetada separadamente de valor vendido.

### 5.4 Endpoint por CPF existente no repositorio

O proxy local tambem conhece o endpoint:

```text
POST /api/APIVendasEntregues/RetornaVendasCPF
```

Ele aceita CPF com 11 digitos. Como esse contrato ainda nao foi confirmado no
workflow de producao e pode responder `404`, a integracao em lote deve usar
inicialmente `ProdutosPorOSGrid` e filtrar CPFs normalizados. O endpoint por CPF
pode permanecer como recurso de consulta ou diagnostico.

## 6. Semantica dos registros

A resposta de `ProdutosPorOSGrid` possui uma linha por produto. Uma mesma OS
aparece em varias linhas. Portanto:

- uma linha da API nao equivale a uma venda;
- quantidade de linhas nao equivale a quantidade de clientes convertidos;
- valores da OS nao podem ser somados cegamente em todas as linhas;
- a chave inicial da venda deve ser `codigoDaLoja + numeroDaOs`;
- todos os produtos dessa chave devem ser consolidados antes da atribuicao.

Exemplo de identificador deterministico ficticio:

```text
0005:1234
```

`VLRLIQUIDOVENDA` aparenta representar o total liquido da OS e pode estar
preenchido somente em uma das linhas, enquanto `LIQUIDOPRODUTO` representa o
item. A implementacao deve calcular:

- total informado da OS: maior valor nao vazio de `VLRLIQUIDOVENDA` dentro da
  OS, sujeito a validacao;
- total calculado dos itens: soma de `LIQUIDOPRODUTO` das linhas validas;
- divergencia: diferenca entre os dois totais;
- valor oficial inicial: `VLRLIQUIDOVENDA`, quando consistente; caso contrario,
  registro pendente de conciliacao.

Essa regra precisa ser confirmada com amostras reais antes da aplicacao.

## 7. Normalizacao obrigatoria

O workflow deve normalizar os dados antes de qualquer correspondencia:

- CPF/CNPJ: somente digitos, preservado como texto e com zeros a esquerda;
- CPF: aceitar para vinculo automatico somente 11 digitos validos;
- loja: extrair o codigo numerico sem perder a descricao original;
- OS e codigo do cliente: texto, nunca numero de ponto flutuante;
- data: converter `DD/MM/AAAA` para data canonica;
- hora: validar `HH:mm:ss` e combinar com a data no fuso
  `America/Sao_Paulo`;
- valores: converter virgula decimal com parser explicito, sem usar substituicao
  ambigua de milhares;
- textos: remover espacos externos sem alterar nomes ou codigos originais;
- campos vazios: converter para `null` quando a ausencia possuir significado;
- produtos: preservar as linhas normalizadas dentro da OS sem duplicar o total.

O CPF jamais deve ser convertido para numero. Alem de perder zeros a esquerda,
JavaScript e planilhas podem modificar sua representacao.

## 8. Regras propostas de correspondencia e atribuicao

### 8.1 Correspondencia do cliente

A primeira versao utiliza CPF como chave de correspondencia:

1. localizar leads com o mesmo CPF normalizado;
2. ignorar, para atribuicao automatica, vendas anteriores a captacao;
3. considerar inicialmente uma janela de 90 dias apos a captacao;
4. dar preferencia a uma captacao da mesma unidade da venda;
5. quando houver varias captacoes elegiveis, usar a mais recente anterior a
   venda somente se a regra estiver aprovada;
6. enviar casos sem correspondencia ou ambiguos para revisao.

Depois do primeiro vinculo confiavel, `CODCLIENTE` pode ser armazenado como
identificador auxiliar do SavWin. Ele nao substitui o CPF no primeiro
cruzamento e nao autoriza juntar pessoas diferentes.

### 8.2 Credito do captador

O resultado da captacao deve ser atribuido inicialmente ao `capturedByUid`, que
registra quem originou o lead. Transferir o responsavel operacional pelo lead
nao deve transferir silenciosamente o credito historico da captacao.

Os campos `VENDEDOR`, `VENDEDOR2` e `VENDEDOR3` do SavWin representam a equipe
da venda e sao independentes do captador. Eles nao devem ser usados para
substituir `capturedByUid` ate que o setor financeiro esclareca:

- o significado de cada posicao;
- se uma venda pode ter mais de um vendedor;
- como ocorre divisao de valor ou comissao;
- se vendedor 2 e vendedor 3 devem receber credito integral, parcial ou nenhum
  credito nos indicadores do LeadFlow.

Sem essa definicao, o mesmo valor poderia ser contabilizado varias vezes.

### 8.3 Casos que exigem revisao

- CPF ausente ou invalido no SavWin;
- lead sem CPF no LeadFlow;
- mais de um lead elegivel para o mesmo CPF;
- venda anterior a qualquer captacao;
- diferenca relevante entre unidade da captacao e unidade da venda;
- total da OS divergente da soma dos produtos;
- OS cancelada, devolvida ou com situacao fiscal nao reconhecida;
- alteracao retroativa da OS depois de ja importada.

Uma revisao manual deve registrar decisao, usuario, data e motivo. Nunca se
deve apagar a evidencia original da importacao.

## 9. Arquitetura alvo

```text
SavWin
  |
  | consulta protegida
  v
n8n - workflow exclusivo do LeadFlow
  |-- extracao
  |-- normalizacao
  |-- consolidacao por loja + OS
  |-- correspondencia por CPF
  |-- atribuicao ao capturedByUid
  |-- dry-run, auditoria e metricas da execucao
  v
Firestore - dados privados e agregados autorizados
  |
  | regras e consultas por perfil
  v
LeadFlow
  |-- resultados pessoais do captador
  |-- dashboards gerenciais
  `-- metas de captacao, conversao e faturamento
```

A captacao offline continua independente da integracao. Falha do n8n ou do
SavWin nao pode impedir cadastro, agenda ou sincronizacao dos leads.

## 10. Autenticacao e seguranca do n8n

- manter a credencial SavWin somente no cofre do n8n;
- criar credencial exclusiva para a integracao LeadFlow sempre que possivel;
- aplicar privilegio minimo e restringir as colecoes que o workflow pode
  gravar;
- nunca colocar segredo, token ou conta de servico no frontend, no ZIP da
  Hostinger ou no repositorio;
- nao enviar CPF, nomes ou valores para logs comuns;
- mascarar documentos em relatorios de erro;
- registrar somente identificadores tecnicos necessarios para reprocessamento;
- definir rotacao e revogacao da credencial;
- limitar concorrencia, tentativas e volume por execucao;
- impedir webhooks publicos sem autenticacao forte e protecao contra replay.

Credenciais administrativas do Firebase podem ignorar Security Rules. Se o n8n
usar uma conta de servico, o controle de acesso deve ser aplicado tambem por IAM
e pelo proprio workflow, com uma conta dedicada e sem privilegios gerais de
administracao.

## 11. Modelo de dados proposto

Os nomes abaixo sao candidatos e deverao ser fechados no TDD antes da primeira
escrita em producao.

### 11.1 `savwinSales/{storeCode__osNumber}`

Representa uma OS consolidada, nao uma linha de produto.

```json
{
  "storeCode": "0005",
  "osNumber": "1234",
  "customerCode": "codigo-textual",
  "customerCpfHash": "hash-controlado",
  "saleDate": "Timestamp",
  "grossValue": 0,
  "discountValue": 0,
  "netValue": 0,
  "calculatedItemsValue": 0,
  "reconciliationStatus": "matched",
  "sourceUpdatedAt": "Timestamp",
  "lastImportedAt": "Timestamp",
  "schemaVersion": 1
}
```

O CPF integral deve ficar em uma area privada apenas se for indispensavel para
o processamento. Para consultas e idempotencia, preferir hash deterministico
com chave protegida, depois de avaliar a estrategia de busca.

### 11.2 `leadSaleAttributions/{storeCode__osNumber}`

Registra a decisao de atribuicao da OS:

```json
{
  "leadId": "uuid-do-lead",
  "capturedByUid": "uid-do-captador",
  "captureStoreId": "loja-05",
  "saleStoreCode": "0005",
  "attributionStatus": "automatic",
  "attributionRule": "same_cpf_same_store_latest_before_sale",
  "daysToConversion": 12,
  "attributedAt": "Timestamp",
  "reviewedByUid": "",
  "reviewReason": "",
  "schemaVersion": 1
}
```

### 11.3 `captorSalesStats/{captorUid__period}`

Agregado de leitura para evitar que o frontend consulte CPFs e todas as OSs:

```json
{
  "captorUid": "uid-do-captador",
  "period": "2026-11",
  "storeIds": ["loja-05"],
  "capturedLeads": 0,
  "convertedLeads": 0,
  "salesCount": 0,
  "grossRevenue": 0,
  "netRevenue": 0,
  "averageTicket": 0,
  "conversionRate": 0,
  "averageDaysToConversion": 0,
  "lastCalculatedAt": "Timestamp",
  "schemaVersion": 1
}
```

### 11.4 `savwinSyncRuns/{runId}`

Resumo tecnico e auditavel de cada execucao:

```json
{
  "mode": "dry_run",
  "periodStart": "2026-11-01",
  "periodEnd": "2026-11-30",
  "receivedRows": 0,
  "groupedSales": 0,
  "matchedSales": 0,
  "unmatchedSales": 0,
  "ambiguousSales": 0,
  "reconciliationErrors": 0,
  "startedAt": "Timestamp",
  "finishedAt": "Timestamp",
  "status": "completed",
  "schemaVersion": 1
}
```

Os dados agregados devem poder ser recalculados a partir das OSs e atribuicoes.
Eles sao uma projecao de leitura, nao a fonte original da venda.

## 12. Idempotencia e atualizacoes

Executar o mesmo periodo varias vezes nao pode duplicar vendas nem faturamento.
Para isso:

- o documento da OS usa identificador deterministico de loja + OS;
- cada importacao calcula uma assinatura dos campos relevantes;
- registros sem alteracao nao geram nova atribuicao;
- OS alteradas sao atualizadas, preservando auditoria;
- cancelamentos removem o valor dos agregados por recalculo, nao por delecao
  silenciosa;
- agregados sao reconstruiveis por periodo;
- reprocessamentos informam quantos registros foram criados, atualizados,
  ignorados e enviados para revisao.

## 13. Dry-run e conciliacao

O primeiro workflow deve operar sem gravar vendas oficiais. Ao final, deve
produzir um resumo semelhante a:

```text
Linhas recebidas: 119
OSs consolidadas: 52
CPFs localizados no LeadFlow: 38
Conversoes atribuiveis: 31
Vendas anteriores a captacao: 4
Correspondencias ambiguas: 2
CPFs ausentes ou nao encontrados: 7
OSs com divergencia de valor: 1
```

Os numeros acima sao apenas ilustrativos. O relatorio real nao deve expor
nomes ou CPFs completos.

Antes de ativar gravacao:

1. selecionar uma amostra de OSs de lojas e datas diferentes;
2. comparar cliente, produtos, valor e situacao diretamente com o SavWin;
3. confirmar a autoria da captacao no LeadFlow;
4. validar casos com varias captacoes para o mesmo CPF;
5. validar cancelamento e alteracao retroativa;
6. obter aceite do setor financeiro sobre os totais;
7. registrar a versao das regras usada no teste.

## 14. Evolucao do sistema de metas

O modelo atual utiliza somente quantidade. A evolucao deve suportar metricas
com unidade e fonte explicitas:

```json
{
  "title": "Meta mensal de faturamento",
  "metric": "net_revenue",
  "targetValue": 25000,
  "unit": "BRL",
  "source": "savwin",
  "startDate": "2026-11-01",
  "endDate": "2026-11-30",
  "assigneeUid": "firebase-uid-captador",
  "storeId": "loja-05",
  "schemaVersion": 2
}
```

Metricas candidatas:

| Metrica | Unidade | Fonte |
| --- | --- | --- |
| `leads_captured` | quantidade | LeadFlow |
| `converted_leads` | quantidade | LeadFlow + SavWin |
| `sales_count` | quantidade de OSs | SavWin |
| `conversion_rate` | percentual | LeadFlow + SavWin |
| `gross_revenue` | BRL | SavWin |
| `net_revenue` | BRL | SavWin |
| `average_ticket` | BRL | SavWin |

`targetCount` deve continuar compativel com metas existentes. A migracao para
um modelo com `targetValue`, `unit` e `source` exige versao de esquema, leitura
retrocompativel e script em `dry-run` antes de qualquer alteracao em massa.

Metas de comissao nao fazem parte deste plano. Elas dependem de regras de
vendedor, percentuais, devolucoes, recebimentos e autorizacao especifica.

## 15. Informacoes que poderao ser visualizadas

### 15.1 Para o captador

- meta e realizado de captacoes;
- quantidade de clientes convertidos;
- taxa de conversao das suas captacoes;
- quantidade de OSs geradas;
- valor bruto e valor liquido gerado;
- ticket medio;
- tempo medio entre captacao e primeira compra;
- progresso percentual por tipo de meta;
- comparacao com o periodo anterior, quando houver dados completos;
- data da ultima atualizacao do SavWin.

O captador nao deve visualizar CPF, OS detalhada, custo, margem ou resultados
de outros colaboradores sem permissao explicita.

### 15.2 Para gestores e administradores

- todos os indicadores pessoais, respeitando unidades permitidas;
- totais e medias por unidade;
- ranking por captacoes, conversoes, faturamento ou taxa de conversao;
- evolucao diaria, semanal e mensal;
- funil entre captacao, agendamento, comparecimento e compra;
- ticket medio por captador e unidade;
- tempo medio e distribuicao do tempo ate a compra;
- clientes com uma ou varias OSs;
- faturamento por tipo de estrategia de captacao;
- conversao por interesse, origem, indicacao e unidade;
- vendas sem correspondencia e atribuicoes pendentes de revisao;
- divergencias entre total informado da OS e soma dos produtos;
- cobertura da integracao: percentual de vendas com CPF valido e vinculo.

Custos, margem, comissao e recebimentos ficam fora da primeira versao, mesmo
que alguns campos existam no retorno da API.

## 16. Etapas de implementacao

### Fase 0 - Fechamento das regras

- confirmar com o financeiro a semantica de valores e situacoes da OS;
- esclarecer `VENDEDOR`, `VENDEDOR2` e `VENDEDOR3`;
- confirmar limite de requisicoes e horario seguro de sincronizacao;
- definir janela de atribuicao e tolerancia de divergencia;
- definir retencao de vendas, logs e dados sem correspondencia;
- aprovar perfis que podem consultar cada indicador.

### Fase 1 - Workflow n8n isolado em dry-run

- criar o workflow exclusivo do LeadFlow;
- ler a fonte comercial protegida ou o endpoint aprovado;
- normalizar campos;
- consolidar por loja + OS;
- gerar resumo sem gravar resultados oficiais;
- configurar tratamento de falhas, tentativas e notificacao operacional.

### Fase 2 - Correspondencia e atribuicao simuladas

- obter os leads elegiveis por uma fronteira protegida;
- cruzar CPF, data e unidade;
- aplicar a janela de atribuicao;
- classificar encontrados, nao encontrados e ambiguos;
- revisar amostras com operacao e financeiro.

Estado em 07/11/2026: o nucleo e a fronteira local somente leitura estao
implementados e testados no emulador. Falta conectar o n8n Cloud por um canal de
homologacao aprovado e revisar os resultados com uma amostra controlada.

### Fase 3 - Modelo protegido e escrita idempotente

- aprovar colecoes e contratos no TDD;
- implementar autenticacao n8n -> Firebase com privilegio minimo;
- criar regras e indices;
- gravar OSs, atribuicoes e execucoes;
- recalcular agregados sem duplicacao;
- testar cancelamentos e reprocessamentos.

Estado em 07/11/2026: os nomes das quatro colecoes foram reservados no TDD, o
frontend foi explicitamente bloqueado pelas Security Rules e um gerador puro de
plano de persistencia foi implementado. Ele usa IDs deterministicos por loja e
OS, remove o CPF integral em favor de HMAC e separa venda de atribuicao. Ainda
nao existe endpoint de escrita. Um executor transacional separado foi criado
somente para testes no emulador `demo-leadflow`: ele transforma a repeticao da
mesma execucao em `no-op`, atualiza OSs sem duplicacao e revoga atribuicoes que
deixarem de ser validas sem apagar seu historico. O modulo nao e exportado por
`functions/index.js` e nao pode ser chamado pelo n8n ou pelo frontend.

O executor foi validado no Firestore Emulator com o projeto explicitamente
definido como `demo-leadflow`. Aplicar duas vezes o mesmo `runId` e a mesma
assinatura manteve uma unica OS, uma unica atribuicao e uma unica execucao. Em
uma nova execucao, a mesma OS teve o valor atualizado sem duplicacao e a antiga
atribuicao foi marcada como revogada quando o resultado passou a `no_lead`.

O agregado `captorSalesStats` tambem teve sua semantica fechada para
homologacao. Conversao usa a coorte captada no mes; vendas, faturamento e ticket
usam as OSs vendidas no mes; tempo medio considera a primeira compra. Essas
bases sao armazenadas explicitamente para impedir que o dashboard misture os
denominadores. O calculo e reconstruivel e o mesmo captador + periodo usa ID
deterministico.

O reconstrutor foi executado duas vezes no Firestore Emulator. O captador e o
mes permaneceram com um unico documento, um agregado obsoleto do mesmo periodo
foi removido e um documento de outro periodo foi preservado. Os testes usaram
somente IDs, datas, valores e leads ficticios.

Em 08/11/2026, a fronteira de leitura foi dividida em duas projecoes para evitar
exposicao entre unidades. `captorSalesStats` contem apenas o agregado pessoal e
pode ser consultado pelo proprio captador com `goals.view_own`.
`storeCaptorSalesStats` e particionada por unidade, captador e periodo; gestores
com `dashboard.view` consultam somente `storeId` autorizado. Captacao e
conversao usam a loja de captacao, enquanto vendas e receita usam a loja da OS.
As colecoes individuais continuam bloqueadas e nenhuma projecao aceita escrita
de clientes.

A primeira integracao de interface foi adicionada ao dashboard de homologacao.
Ela exige uma unica loja e um intervalo dentro do mesmo mes, soma somente a
projecao `storeCaptorSalesStats` autorizada e apresenta quatro indicadores
agregados. Intervalos entre meses e a opcao de todas as lojas nao fazem consulta
financeira. A interface ainda nao e evidencia de aceite dos numeros e nao foi
publicada em producao.

### Fase 4 - Painel de resultados

- [x] disponibilizar agregados pessoais ao captador;
- [x] criar dashboards gerenciais por unidade e periodo;
- [x] mostrar ultima sincronizacao e cobertura dos dados;
- [x] criar tela de revisao para gestao;
- [x] validar mobile e permissoes da tela de revisao;
- validar volume de leituras com uma amostra representativa do piloto.

Em 8 de novembro de 2026, a interface de homologacao passou a mostrar a ultima
sincronizacao bem-sucedida, o intervalo coberto e os totais de vendas recebidas,
elegiveis e conciliadas. O estado visual diferencia dados atuais, atrasados,
desatualizados e cobertura parcial. Esses metadados fazem parte apenas das
projecoes agregadas autorizadas; `savwinSyncRuns` continua privada. A validacao
foi executada com dados ficticios no projeto `demo-leadflow`, em desktop e
mobile, sem consulta ou publicacao no Firebase de producao.

Em 8 de novembro de 2026, a homologacao recebeu a tela gerencial de revisao.
Casos sem atribuicao automatica sao projetados em `savwinReviewCases` sem CPF,
hash de CPF ou numero de OS. A consulta exige uma unidade autorizada, um mes e
o limite de 200 casos. Gestores com `savwin.review` podem registrar uma unica
decisao, `resolved` ou `dismissed`, com justificativa; os campos de origem ficam
imutaveis para o cliente. Reprocessamentos preservam a decisao quando a
pendencia continua igual e removem o caso quando a venda volta a ser conciliada.
Security Rules, integracao do executor e jornada E2E foram validadas somente no
Firestore/Auth Emulator do projeto `demo-leadflow`, em desktop e mobile. A
medicao com volume representativo do piloto continua pendente antes de qualquer
promocao.

### Pausa operacional - recuperacao da producao (11/11/2026)

A evolucao SavWin e a reformulacao das metas ficam temporariamente congeladas.
A versao atualmente publicada apresentou uma regressao ainda nao diagnosticada,
que nao foi detectada antes da publicacao por ausencia de cobertura automatizada
do fluxo afetado. O commit de homologacao `f471466` nao deve ser promovido como
tentativa de corrigir esse incidente. A recuperacao da versao oficial passa a
ter prioridade P0 e deve ocorrer em branch e release candidate proprias.

#### Etapa 1 - preservar evidencias e limitar o impacto

- [ ] registrar URL, horario, perfil, dispositivo e passos exatos que apresentam
  a falha;
- [ ] salvar capturas da tela, mensagens do console e requisicoes com erro, sem
  incluir CPF, credenciais ou outros dados pessoais;
- [ ] identificar quais fluxos continuam funcionando e quais estao bloqueados;
- [ ] identificar o commit, tag, artefato, regras, indices e Functions que estao
  efetivamente publicados;
- [ ] suspender novas publicacoes ate existir diagnostico, teste de regressao e
  caminho de rollback aprovados.

#### Etapa 2 - reproduzir e diagnosticar

- [ ] reproduzir a falha em ambiente controlado usando a mesma combinacao de
  frontend, configuracao e regras da versao publicada;
- [ ] comparar a versao publicada com a ultima release conhecida como estavel;
- [ ] determinar se o problema esta no frontend, cache/PWA, Firestore Rules,
  indices, Functions, configuracao ou incompatibilidade entre componentes;
- [ ] documentar causa raiz, impacto nos dados e motivo pelo qual os testes
  existentes nao detectaram a regressao;
- [ ] decidir entre rollback imediato e hotfix minimo, favorecendo rollback se
  houver risco de perda de dados, indisponibilidade ampla ou acesso indevido.

#### Etapa 3 - criar a barreira de regressao

- [ ] escrever primeiro um teste automatizado que falhe pelo mesmo motivo da
  producao;
- [ ] cobrir o fluxo com o nivel adequado: unidade, Security Rules, integracao
  com emuladores e Playwright autenticado;
- [ ] incluir os perfis e tamanhos de tela envolvidos no incidente;
- [ ] confirmar que o teste falha na revisao quebrada e passa somente depois da
  correcao;
- [ ] impedir que o pipeline gere ou publique artefatos quando essa cobertura
  falhar.

#### Etapa 4 - corrigir e validar a candidata

- [ ] aplicar a menor correcao possivel em branch de hotfix, sem misturar a
  integracao SavWin ainda nao promovida;
- [ ] executar testes unitarios, regras, integracao, E2E autenticado e build;
- [ ] validar manualmente os fluxos criticos de login, captacao, sincronizacao,
  agenda, gestao e permissoes na candidata;
- [ ] testar instalacao limpa e atualizacao de uma PWA ja instalada, incluindo
  cache e Service Worker;
- [ ] confirmar que nenhuma migracao ou correcao altera dados sem backup,
  simulacao e aprovacao explicita;
- [ ] registrar o commit, versoes dos componentes, resultados dos testes e
  responsaveis pelo aceite.

#### Etapa 5 - recuperar e acompanhar producao

- [ ] preparar backup/exportacao e procedimento de rollback antes da promocao;
- [ ] publicar somente a candidata aprovada, com os projetos e destinos
  conferidos explicitamente;
- [ ] executar smoke test autenticado imediatamente depois da publicacao;
- [ ] acompanhar erros e os fluxos criticos durante a janela de observacao;
- [ ] encerrar o incidente apenas depois de confirmar a recuperacao em mais de
  um dispositivo e perfil afetado;
- [ ] registrar a licao aprendida e atualizar o checklist de release.

#### Criterio para retomar o SavWin

O trabalho das fases seguintes so pode ser retomado quando a producao estiver
estavel, a causa raiz estiver documentada, o teste de regressao fizer parte da
barreira de qualidade e o hotfix ou rollback estiver identificado por commit e
release. Depois disso, permanecem pendentes para o SavWin:

- [ ] validar o volume de leituras com uma amostra representativa do piloto;
- [ ] executar a Fase 5 de reformulacao das metas;
- [ ] executar a Fase 6 de operacao assistida e promocao;
- [ ] comparar ao menos um ciclo mensal completo antes de oficializar os
  indicadores.

### Fase 5 - Reformulacao das metas

- versionar o modelo `goals`;
- manter metas de quantidade existentes;
- adicionar conversoes, faturamento e ticket medio;
- adaptar progresso, filtros, ranking e comparacoes;
- executar migracao em `dry-run` antes de aplicar;
- validar resultados contra os agregados oficiais.

### Fase 6 - Operacao assistida e promocao

- executar em paralelo sem substituir relatorios existentes;
- comparar pelo menos um ciclo mensal completo;
- documentar suporte, reprocessamento e recuperacao;
- definir alertas e responsaveis por falhas;
- promover os indicadores a oficiais somente depois do aceite.

## 17. Estrategia de desenvolvimento e promocao

Esta evolucao nao deve ser implementada diretamente sobre a versao oficial em
producao. O mesmo processo de release ja adotado pelo LeadFlow permanece
obrigatorio:

1. preservar a versao oficial de producao como referencia estavel;
2. criar uma branch especifica para a integracao SavWin e a evolucao das metas;
3. desenvolver e revisar as mudancas nessa branch, sem publicar artefatos de
   desenvolvimento em producao;
4. validar localmente com dados ficticios, emuladores e `dry-run` do n8n;
5. publicar a integracao somente no ambiente de homologacao;
6. executar testes unitarios, regras do Firestore, integracao, interface,
   permissoes, privacidade, idempotencia e conciliacao financeira;
7. gerar uma versao candidata identificada como release candidate;
8. testar a candidata com os perfis reais de operacao e uma amostra conciliada
   com o SavWin;
9. corrigir problemas em uma nova candidata, sem modificar silenciosamente a
   candidata ja testada;
10. promover para producao apenas a candidata aprovada;
11. criar a tag e a release oficial, preservando os artefatos publicados;
12. monitorar a primeira sincronizacao e manter um caminho de rollback.

Durante as fases 1 e 2, todo comando Firebase deve informar explicitamente
`--project demo-leadflow` e usar a configuracao do emulador. Nao se deve
executar `firebase deploy`, carregar credenciais administrativas remotas nem
usar o projeto padrao de `.firebaserc` para validar a integracao.

Frontend, Security Rules, indices, Functions e workflows n8n possuem ciclos de
publicacao independentes. Uma release so pode ser promovida quando as versoes
compativeis de todos os componentes estiverem identificadas no checklist de
publicacao.

O workflow n8n do LeadFlow deve ser criado inicialmente desativado ou em modo
manual. Alteracoes devem ocorrer em copia ou workflow de homologacao, nunca no
workflow financeiro publicado. A ativacao do agendamento em producao acontece
somente depois do `dry-run`, da conciliacao e da aprovacao da release candidate.

Antes da promocao, devem existir:

- backup ou exportacao recente dos dados afetados;
- identificacao da ultima release oficial estavel;
- plano para desativar o workflow n8n sem interromper o LeadFlow;
- procedimento para recalcular agregados depois de uma correcao;
- checklist dos componentes que realmente foram publicados;
- responsavel pela validacao tecnica e responsavel pelo aceite dos numeros.

Uma falha na integracao SavWin deve permitir desativar apenas o workflow e os
indicadores financeiros. Captacao, agenda, operacao offline e metas antigas de
quantidade devem continuar funcionando durante rollback ou manutencao.

## 18. Estrategia de testes

### 18.1 Unidade

- CPF com e sem zeros a esquerda;
- datas e horas brasileiras;
- valores com virgula, ponto e campo vazio;
- agrupamento de varias linhas na mesma OS;
- OS iguais em lojas diferentes;
- deduplicacao de reprocessamentos;
- soma de itens e deteccao de divergencia;
- janela de atribuicao e preferencia de unidade;
- multiplas OSs para o mesmo cliente;
- cancelamento e alteracao retroativa.

### 18.2 Integracao

- n8n com resposta normal, vazia, parcial e indisponivel;
- credencial invalida sem vazamento em log;
- escrita idempotente no Firestore;
- recalculo de agregados;
- bloqueio de acesso por captador, gestor e unidade;
- reprocessamento do mesmo periodo;
- interrupcao no meio da execucao e retomada segura.

### 18.3 Aceitacao

- amostra conciliada manualmente com o SavWin;
- total por unidade e periodo igual ao relatorio aprovado;
- uma OS contabilizada somente uma vez;
- captador visualizando apenas os proprios resultados;
- gestor visualizando somente as unidades permitidas;
- falha da integracao sem afetar captacao e agenda;
- indicador claro de ultima atualizacao e dados pendentes.

## 19. Observabilidade e operacao

Cada execucao deve registrar:

- inicio, fim, duracao e modo (`dry_run` ou `apply`);
- periodo e lojas consultadas;
- quantidade de linhas, OSs e correspondencias;
- criacoes, atualizacoes e registros inalterados;
- ambiguidades, divergencias e erros por categoria;
- versao do normalizador e das regras de atribuicao;
- proximo passo recomendado em caso de falha.

Alertas devem ocorrer apenas para falhas acionaveis, como credencial invalida,
mudanca de contrato, execucao incompleta ou divergencia acima do limite. Dados
pessoais nao devem aparecer na notificacao.

## 20. Decisoes pendentes

- significado e regra de credito para vendedor 1, 2 e 3;
- campo definitivo do valor oficial da OS;
- estados que representam cancelamento, devolucao ou venda invalida;
- limite e politica de requisicoes do SavWin;
- fonte inicial: JSON comercial protegido ou consulta direta;
- janela de atribuicao definitiva;
- regra quando o cliente compra em outra unidade;
- tratamento de varias captacoes do mesmo CPF;
- prazo de retencao e base operacional para os dados financeiros;
- tolerancia de divergencia entre OS e produtos;
- frequencia desejada: duas vezes ao dia ou intervalo menor;
- necessidade futura de distinguir valor vendido de valor recebido.

## 21. Fora da primeira versao

- calculo de comissoes;
- distribuicao de valor entre vendedores SavWin;
- margem e lucro por captador;
- conciliacao de parcelas e recebimentos;
- escrita ou alteracao de vendas no SavWin;
- consulta direta do SavWin pelo navegador;
- atualizacao verdadeiramente em tempo real;
- uso dos dados comerciais para bloquear ou alterar a captacao offline.

## 22. Criterio de conclusao

A evolucao so podera ser considerada concluida quando:

- o contrato da API estiver validado e versionado;
- a consolidacao por OS estiver coberta por testes;
- o dry-run estiver conciliado com o SavWin;
- a escrita for idempotente e auditavel;
- regras de privacidade e permissao estiverem testadas;
- metas antigas continuarem funcionando;
- captadores e gestores visualizarem somente os dados autorizados;
- cancelamentos e reprocessamentos corrigirem os agregados;
- a operacao possuir procedimento de suporte e recuperacao;
- nenhum segredo ou dado pessoal estiver no repositorio ou nos logs;
- custo e plano do Firebase e do n8n estiverem explicitamente aprovados.
