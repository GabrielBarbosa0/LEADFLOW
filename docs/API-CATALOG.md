# FascinLead - Catalogo de APIs e integracoes

| Campo | Valor |
| --- | --- |
| Versao | 1.2 |
| Data | 07/11/2026 |
| Escopo | Interfaces de rede mantidas ou consumidas pelo FascinLead |

Este catalogo identifica quais interfaces sao contratos publicos, locais, administrativos ou apenas dependencias operacionais. Os contratos OpenAPI sao a fonte dos formatos HTTP; o TDD permanece como fonte das decisoes arquiteturais.

## 1. Resumo

| Interface | Direcao | Ambiente | Autenticacao | Contrato |
| --- | --- | --- | --- | --- |
| API CRM `/api/v1` | FascinLead fornece | Vite local; hospedagem futura | Bearer Token | `docs/fascinlead-api.openapi.yaml` |
| Proxy `/api/savwin` | FascinLead fornece ao proprio frontend | Somente Vite local | Mesma origem; credenciais apenas no Node | `docs/savwin-local-proxy.openapi.yaml` |
| Callable `updateTeamMemberPassword` | FascinLead fornece a administradores | Firebase Functions | Firebase Auth e perfil administrador | Secao 4 deste documento |
| Callable `searchLeadAppointments` | FascinLead fornece a usuarios ativos | Firebase Functions | Firebase Auth, perfil ativo e permissao de consulta | Secao 4 deste documento |
| Callable `checkCpfActiveAppointment` | FascinLead fornece a usuarios ativos | Firebase Functions | Firebase Auth, perfil ativo e permissao de consulta | Secao 4 deste documento |
| HTTP `savwinDryRunMatch` | FascinLead fornece ao workflow de homologacao | Somente Firebase Emulator Suite | Token local e travas de ambiente | Secao 5 deste documento |
| Firestore e Authentication | FascinLead consome | Firebase | SDK Firebase e Security Rules | Nao sao API publica do produto |
| Captar | Scripts operacionais consomem | Execucao administrativa local | Credenciais em variaveis de ambiente | Nao e API publica do produto |
| WhatsApp `wa.me` | Navegador abre link externo | Cliente | Fluxo do usuario | Nao e API de integracao servidor-a-servidor |

## 2. API de integracao com CRM

### 2.1 Endpoints

- `GET /api/v1/health`: saude do processo; nao exige token.
- `GET /api/v1/leads`: sincronizacao incremental paginada.
- `GET /api/v1/leads/{leadId}`: consulta individual dentro das lojas permitidas.

O contrato completo, parametros, schemas, respostas e erros esta em `docs/fascinlead-api.openapi.yaml`.

### 2.2 Seguranca e dados

- As rotas de leads exigem `Authorization: Bearer <token>` com token servidor de pelo menos 32 caracteres.
- `FASCINLEAD_API_ALLOWED_STORES` limita as lojas acessiveis. Um lead de outra loja e ocultado como `404`.
- CPF, RG, nascimento, sexo e saude sao omitidos por padrao. A liberacao exige simultaneamente `FASCINLEAD_API_SENSITIVE_FIELDS=true` no servidor e `include_sensitive=true` na requisicao.
- As respostas usam `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Vary: Authorization` e `X-Request-Id`.
- O cursor e opaco. O consumidor deve armazena-lo e nao interpretar ou alterar seu conteudo.

### 2.3 Sincronizacao e limitacoes

- A ordenacao e crescente por `updatedAtServer` e ID do documento.
- Cada pagina possui de 1 a 100 registros; o padrao e 50.
- A versao atual usa polling. Nao existem webhooks, tombstones de exclusao ou credenciais independentes por parceiro.
- A API e somente leitura e nao cria, atualiza nem exclui leads.
- A implementacao atual e middleware do Vite. Publica-la exige backend HTTPS, cofre de segredos, rate limiting, auditoria e aprovacao de custo.

### 2.4 Configuracao do servidor

| Variavel | Finalidade |
| --- | --- |
| `FASCINLEAD_API_TOKEN` | Bearer Token com no minimo 32 caracteres |
| `FASCINLEAD_API_FIREBASE_PROJECT_ID` | Projeto lido pela API |
| `FASCINLEAD_API_ALLOWED_STORES` | Lista separada por virgulas das lojas liberadas |
| `FASCINLEAD_API_SERVICE_ACCOUNT_JSON` | Conta de servico JSON ou Base64, somente no processo Node |
| `FASCINLEAD_API_FIRESTORE_EMULATOR_HOST` | Host opcional do emulador, por exemplo `127.0.0.1:8180` |
| `FASCINLEAD_API_SENSITIVE_FIELDS` | Habilitacao global adicional para campos sensiveis |

Na ausencia de conta de servico e emulador, o processo usa Application Default Credentials. Nenhuma dessas variaveis pode receber prefixo `VITE_` ou ser versionada com valor real.

## 3. Proxy local SavWin

### 3.1 Endpoints locais

- `POST /api/savwin/products-by-os`: recebe periodo ISO e codigos das lojas 2, 4, 5 ou 6; aceita no maximo 93 dias.
- `POST /api/savwin/sales-by-cpf`: recebe CPF e dados opcionais de periodo para fallback.

O corpo HTTP e limitado a 32 KiB. As respostas bem-sucedidas informam `count`, `osCount`, `records` e `source`. O contrato completo esta em `docs/savwin-local-proxy.openapi.yaml`.

### 3.2 Endpoints upstream consumidos

| Finalidade | Caminho SavWin | Corpo transformado |
| --- | --- | --- |
| Produtos por OS | `/api/APIRelatoriosCR/ProdutosPorOSGrid` | `DATAINICIAL`, `DATAFINAL`, `LOJAS` |
| Vendas por CPF | `/api/APIVendasEntregues/RetornaVendasCPF` | `CPF` com 11 digitos |

Se o endpoint por CPF responder `404`, o proxy consulta ate cinco periodos pelo endpoint de produtos/OS e filtra o CPF exato localmente. O formato dos itens em `records` pertence ao SavWin e permanece aberto no schema porque pode variar no upstream.

### 3.3 Fronteira de seguranca

- `SAVWIN_IDENTIFICADOR` e `SAVWIN_AUTHORIZATION` nunca usam prefixo `VITE_` e nunca entram no bundle.
- O proxy nao possui autenticacao propria porque foi desenhado apenas para o servidor local de desenvolvimento e mesma origem.
- Ele nao deve ser exposto diretamente na internet. Uma hospedagem futura exige autenticacao, autorizacao por loja, rate limiting, auditoria e tratamento formal dos dados de venda.
- O proxy e somente leitura e nao altera o SavWin.

### 3.4 Configuracao local

| Variavel | Finalidade |
| --- | --- |
| `SAVWIN_API_BASE_URL` | Origem HTTPS do SavWin, sem barra final |
| `SAVWIN_IDENTIFICADOR` | Identificador enviado ao upstream |
| `SAVWIN_AUTHORIZATION` | Credencial de autorizacao do upstream |
| `SAVWIN_TIMEOUT_SECONDS` | Timeout das consultas; padrao de 30 segundos |

Os cabecalhos `identificador` e `Authorization` sao adicionados somente pelo processo Node. O navegador chama apenas as rotas locais e nunca recebe esses valores.

## 4. Callable Functions

### 4.1 `updateTeamMemberPassword`

| Campo | Valor |
| --- | --- |
| Tipo | Firebase Callable Function v2 |
| Regiao | `southamerica-east1` |
| Cliente | Firebase Functions SDK (`httpsCallable`) |
| Estado na interface | Implementada no backend e no modulo de autenticacao, ainda sem comando na interface principal |

Entrada:

```json
{
  "email": "colaborador@exemplo.com",
  "password": "nova-senha"
}
```

Resposta:

```json
{
  "updated": true
}
```

Regras:

- exige sessao Firebase autenticada e e-mail verificado;
- permite a conta administradora principal ou acesso ativo com `role = admin`;
- exige e-mail valido e senha entre 6 e 72 caracteres;
- exige que o e-mail exista em `allowedEmails` e no Firebase Authentication;
- altera a senha, revoga refresh tokens e grava `password_reset_by_admin` em `accessAuditEvents`.

Codigos callable possiveis: `unauthenticated`, `permission-denied`, `invalid-argument` e `not-found`. Falhas inesperadas sao tratadas pelo protocolo da Firebase Functions e nao devem expor credenciais ou dados pessoais.

### 4.2 `searchLeadAppointments`

Pesquisa agendamentos por nome ou CPF para a tela de consulta. Exige sessao autenticada, e-mail verificado, perfil ativo e permissao `leads.view_own`. Administradores pesquisam todas as lojas; os demais usuarios recebem somente resultados das unidades permitidas. A resposta e limitada a 20 itens e informa se o cadastro pode ser aberto pelo solicitante.

### 4.3 `checkCpfActiveAppointment`

Entrada:

```json
{
  "customerCpf": "52998224725"
}
```

Resposta:

```json
{
  "hasAppointment": true
}
```

Regras:

- exige sessao Firebase autenticada, e-mail verificado, perfil ativo e permissao `leads.view_own`;
- aceita somente CPF normalizado com 11 digitos;
- procura correspondencia exata em `customerCpf`;
- considera ativo somente um agendamento com data atual ou futura, horario preenchido e comparecimento ainda nao encerrado como `attended` ou `missed`;
- consulta todas as lojas para impedir duplicidade entre unidades;
- devolve apenas um booleano e nao revela nome, telefone, loja, data ou horario do cadastro correspondente;
- limita a leitura a 20 documentos correspondentes.

Codigos callable possiveis: `unauthenticated`, `permission-denied` e `invalid-argument`.

## 5. HTTP `savwinDryRunMatch`

| Campo | Valor |
| --- | --- |
| Tipo | Firebase HTTP Function v2 |
| Regiao | `southamerica-east1` |
| Ambiente | Exclusivamente Emulator Suite no projeto `demo-leadflow` |
| Metodo | `POST` |
| URL local | `http://127.0.0.1:5001/demo-leadflow/southamerica-east1/savwinDryRunMatch` |
| Autenticacao | Header `x-leadflow-homolog-token` com token local de no minimo 32 caracteres |
| Persistencia | Nenhuma; consulta somente leitura |

Entrada resumida:

```json
{
  "mode": "dry_run",
  "attributionWindowDays": 90,
  "sales": [
    {
      "saleKey": "0004:HOMOLOG-1",
      "storeCode": "0004",
      "osNumber": "HOMOLOG-1",
      "saleDate": "2026-11-07",
      "customerCpf": "52998224725",
      "reconciliationStatus": "matched",
      "reportedSaleNetValue": 100
    }
  ]
}
```

O lote aceita de 1 a 200 OSs consolidadas. Campos desconhecidos, inclusive
nome do cliente, sao descartados pelo contrato. A resposta contem um resumo e
resultados por `saleKey`, com estados como `matched_same_store`, `no_lead`,
`ambiguous`, `missing_cpf`, `invalid_cpf`, `sale_before_capture`,
`outside_window` e `reconciliation_divergent`. Nome e CPF nunca retornam.

Controles obrigatorios:

- exige `FUNCTIONS_EMULATOR=true`;
- exige projeto `demo-leadflow`;
- exige `FIRESTORE_EMULATOR_HOST`;
- exige token local em `SAVWIN_N8N_HOMOLOG_TOKEN`;
- nao e exportada pelo modulo fora do emulador;
- aceita somente `mode = dry_run`;
- nao possui escrita nem fallback para projeto remoto;
- nao resolve duas captacoes elegiveis automaticamente.

Respostas: `200` para simulacao concluida, `400` para contrato invalido, `401`
para token ausente ou incorreto, `403` fora do emulador, `405` para metodo
diferente de `POST` e `500` para falha interna sem ecoar o corpo recebido.

O n8n Cloud nao acessa esta URL local. Qualquer ponte futura exige homologacao
isolada e decisao explicita; o projeto Firebase de producao nao pode ser usado.

Para testes temporarios, `scripts/savwin-homolog-gateway.js` disponibiliza
somente `POST /savwin-dry-run` em `127.0.0.1:5088`. O gateway repete a validacao
do token, limita o corpo a 256 KiB e encaminha exclusivamente para a Function
do projeto emulado. Um tunel temporario deve apontar para essa porta, nunca
diretamente para as portas `4000`, `5001`, `8180` ou `9099` dos emuladores.

## 6. Interfaces que nao sao endpoints publicos

Os agregados SavWin sao lidos diretamente pelo SDK do Firestore, sempre sob
Security Rules. `captorSalesStats` exige consulta filtrada por `captorUid` do
usuario e periodo. `storeCaptorSalesStats` exige consulta filtrada por
`storeId` autorizado e periodo. Ambas sao somente leitura para clientes; as
colecoes de vendas, atribuicoes e execucoes nao possuem acesso pelo SDK cliente.
As consultas ficam centralizadas em `src/services/sales-stats-service.js`; nao
existe operacao de escrita nesse servico.

- O frontend usa Firestore e Authentication pelos SDKs oficiais. Colecoes nao devem ser expostas como uma API REST paralela; Security Rules continuam sendo a barreira de autorizacao.
- Scripts de migracao usam a API REST do Firestore com credencial do Firebase CLI. Sao ferramentas administrativas em `dry-run` por padrao, nao endpoints de produto.
- Os scripts do Captar usam Playwright e interfaces observadas do sistema externo. Essas dependencias podem mudar sem aviso e devem ser executadas apenas por operador autorizado.
- Links `https://wa.me/` apenas abrem uma conversa iniciada pelo usuario; o FascinLead nao envia mensagens pela API do WhatsApp.

### 6.1 Dependencias operacionais observadas

| Sistema | Interface consumida | Uso |
| --- | --- | --- |
| Firestore REST | `GET /v1/projects/{project}/databases/(default)/documents/{collection}` | Leitura paginada por scripts administrativos |
| Firestore REST | `POST /v1/projects/{project}/databases/(default)/documents:commit` | Gravacoes em lote de migracoes |
| Captar | `/login`, `/{tenantId}/schedule` e `/{tenantId}/team` | Login, leitura da agenda e sincronizacao da equipe via Playwright |
| Captar | `GET /api/sales-management` | Resposta observada durante a sincronizacao da equipe |
| Firebase Auth Admin | Operacoes do SDK sobre usuarios | Criacao, redefinicao de senha e revogacao de sessoes |

Essas interfaces nao sao contratos mantidos pelo FascinLead. Mudancas no Firebase seguem a documentacao oficial; mudancas no Captar devem ser tratadas como risco operacional e validadas em `dry-run` antes de qualquer gravacao.

## 7. Evolucao de contratos

- Mudancas incompativeis na API CRM exigem nova versao de caminho, por exemplo `/api/v2`.
- Campos opcionais podem ser acrescentados na mesma versao, desde que consumidores tolerem propriedades desconhecidas.
- Toda rota nova deve ter autenticacao, autorizacao, limite, erros, dados sensiveis e ambiente documentados antes da implementacao ser considerada concluida.
- Alteracoes nos endpoints devem atualizar o OpenAPI correspondente, este catalogo, o TDD e os testes de contrato na mesma entrega.
