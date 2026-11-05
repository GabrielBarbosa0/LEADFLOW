# LeadFlow

Cadastro offline para as equipes de captacao das **Oticas Fascinante**.

> **Status:** fundacao tecnica e primeiro fluxo de captacao em desenvolvimento.

O LeadFlow sera uma Progressive Web App (PWA) para substituir as fichas de papel usadas por colaboradores durante abordagens na rua. O usuario podera registrar um potencial cliente mesmo sem internet, consultar os cadastros no proprio aparelho e sincroniza-los com a nuvem quando a conexao voltar.

O projeto tem um foco deliberadamente pequeno: facilitar a captacao. Ele nao pretende ser um CRM completo.

## Objetivos

- tornar o cadastro rapido e simples no celular;
- funcionar em locais com conexao instavel ou inexistente;
- evitar perda, rasura e redigitacao de fichas em papel;
- identificar o colaborador, a loja e a data de cada captacao;
- centralizar os registros na nuvem depois da sincronizacao;
- operar inicialmente apenas com recursos gratuitos do Firebase.

## Fluxo principal

1. O colaborador entra com uma conta Google autorizada.
2. Inicia uma nova abordagem pelo celular.
3. Informa nome, telefone e os dados opcionais relevantes.
4. O cadastro e salvo localmente, mesmo sem internet.
5. O sistema mostra o registro como pendente.
6. Quando a conexao retorna, o registro e sincronizado com o Firestore.
7. O gestor consulta ou exporta os registros autorizados da sua loja.

## Funcionalidades do MVP

- login com Google;
- autorizacao por e-mail, perfil e loja;
- formulario curto de cadastro;
- funcionamento offline depois do primeiro acesso;
- armazenamento persistente de registros pendentes;
- sincronizacao automatica e manual;
- estados `Pendente`, `Sincronizando`, `Sincronizado` e `Erro`;
- listagem e pesquisa dos cadastros do colaborador;
- detalhamento e correcao dos proprios cadastros, inclusive offline;
- pre-agendamento opcional com data e horario;
- alerta local de possivel telefone duplicado;
- consulta gerencial por loja, colaborador e periodo;
- exportacao detalhada para CSV;
- visualizacao, correcao e exclusao de leads por administradores;
- metas individuais de quantidade de leads, com acompanhamento restrito por usuario e equipe;
- agenda mensal dos pre-agendamentos para gestores e administradores;
- atualizacao dinamica da agenda enquanto novos pre-agendamentos sao sincronizados;
- registro direto de comparecimento ou falta pela equipe gerencial;
- retorno de faltas para o captador responsavel, com tolerancia por loja, automacao opcional e mensagem pronta no WhatsApp;
- acompanhamento gerencial dos retornos por colaborador, diferenciando contatos aguardando acao e ja iniciados; gestores veem a propria loja e administradores veem todas as unidades;
- hierarquia de acesso por perfil: administradores acessam todas as unidades, gestores acessam as unidades permitidas e captadores ficam restritos a operacao basica da loja principal;
- configuracao administrativa da duracao e do expediente de exames por loja;
- oferta de horarios livres no cadastro, com bloqueio dos intervalos ja ocupados;
- instalacao como PWA em celular e desktop.
- consulta experimental somente leitura ao SavWin por proxy local durante o desenvolvimento.
- API local versionada e somente leitura para integracao futura com sistemas de CRM.

## Fora do escopo

O FascinLead nao tera, no MVP:

- funil de vendas ou CRM completo;
- atendimento e campanhas pelo WhatsApp;
- confirmacoes automaticas ou lembretes de consultas e exames;
- anamnese ou recomendacao de lentes;
- provador virtual;
- metas de vendas, comissoes ou conciliacao de vendas;
- ranking, premiacoes ou gamificacao na primeira versao das metas de captacao;
- integracao SavWin publicada para uso em producao;
- integracao com AppOk;
- aplicativo nativo para Android ou iOS.

## Telas previstas

| Tela | Finalidade |
| --- | --- |
| Login | Autenticar a conta Google e validar o acesso |
| Inicio | Exibir atalhos, loja, conectividade e pendencias |
| Novo | Registrar rapidamente um potencial cliente |
| Cadastros | Consultar e pesquisar os registros do colaborador |
| Sincronizacao | Exibir contagens, erros e acao de envio manual |
| Gestao | Filtrar, acompanhar e exportar registros autorizados |
| Agenda | Visualizar por mes os pre-agendamentos autorizados para o perfil |
| Retornos | Captadores iniciam o reagendamento pelo WhatsApp; gestores acompanham o andamento por colaborador |
| Configuracoes | Definir agenda, expediente, tolerancia e retorno automatico por loja |
| Metas | Criar metas de captacao e acompanhar o progresso permitido ao perfil |

## Arquitetura

```text
Celular / navegador
  |
  |-- HTML + CSS + JavaScript
  |-- PWA + Service Worker
  |-- Firestore SDK + IndexedDB
  |
  `---- HTTPS, quando online ----> Hostinger (frontend estatico)
                                      |
                                      `-------------> Firebase
                                      |-- Authentication
                                      |-- Cloud Firestore
                                      |-- Security Rules
                                      `-- Cloud Functions
```

### Tecnologias planejadas

- HTML5, CSS3 e JavaScript com ES Modules;
- Vite;
- Web App Manifest e Service Worker;
- Firebase Authentication com Google e E-mail/Senha;
- Cloud Firestore com persistencia offline;
- Hostinger para hospedagem do frontend estatico;
- Firebase Emulator Suite;
- Vitest;
- Playwright;
- Lucide Icons.

Cloud Run e Storage nao fazem parte do MVP. As Callable Functions atendem operacoes administrativas e consultas protegidas de agendamento; sua publicacao exige aprovacao de faturamento, controle de acesso e alerta de custo.

## SavWin local

Durante o desenvolvimento, o servidor do Vite disponibiliza um proxy local somente leitura para consultas por produtos/OS e vendas por CPF. As credenciais permanecem no processo Node e nao sao enviadas no bundle do navegador.

Configure no `.env.local`:

```text
SAVWIN_API_BASE_URL=https://cliapi.savwinweb.com.br
SAVWIN_IDENTIFICADOR=
SAVWIN_AUTHORIZATION=
SAVWIN_TIMEOUT_SECONDS=30
```

Inicie pelo `INICIAR-FASCINLEAD.bat`, entre como gestor ou administrador e use **Consultar SavWin** no Dashboard. Esse recurso existe apenas no servidor de desenvolvimento e nao e publicado no GitHub Pages.

Endpoints locais:

- `POST /api/savwin/products-by-os`;
- `POST /api/savwin/sales-by-cpf`.

O contrato completo esta em [`docs/savwin-local-proxy.openapi.yaml`](docs/savwin-local-proxy.openapi.yaml).

## API de integracao com CRM

Durante o desenvolvimento, o Vite expoe uma API servidor-a-servidor somente leitura em `/api/v1`. Ela nao e incluida no GitHub Pages e nao altera o funcionamento offline do aplicativo.

Endpoints iniciais:

- `GET /api/v1/health`;
- `GET /api/v1/leads` com `updated_since`, `store_id`, `limit` e `cursor`;
- `GET /api/v1/leads/{leadId}`.

As rotas de leads exigem `Authorization: Bearer <token>`. Configure `FASCINLEAD_API_TOKEN` com pelo menos 32 caracteres e restrinja as unidades em `FASCINLEAD_API_ALLOWED_STORES`. Use credenciais administrativas somente no processo Node. Para desenvolvimento sem custo, a API pode apontar para o Firestore Emulator por meio de `FASCINLEAD_API_FIRESTORE_EMULATOR_HOST=127.0.0.1:8180`. Para consultar o projeto remoto localmente, use Application Default Credentials ou uma conta de servico em `FASCINLEAD_API_SERVICE_ACCOUNT_JSON`; nunca use prefixo `VITE_` nem versione esse valor.

CPF, RG, nascimento, sexo, ametropias e condicoes de saude ficam fora da resposta padrao. Eles somente sao retornados quando `FASCINLEAD_API_SENSITIVE_FIELDS=true` e a requisicao inclui `include_sensitive=true`. O contrato completo esta em [`docs/fascinlead-api.openapi.yaml`](docs/fascinlead-api.openapi.yaml).

A versao `v1` usa consulta ativa do CRM (polling) e nao oferece webhooks nem eventos de exclusao. O consumidor deve guardar `updatedAt` e o `cursor` para continuar a sincronizacao sem reler toda a base. Webhooks, credenciais separadas por parceiro e tombstones de exclusao ficam previstos para a etapa de hospedagem da API.

O indice de todas as interfaces, incluindo as Callable Functions, dependencias externas e fronteiras que nao sao APIs publicas, esta em [`docs/API-CATALOG.md`](docs/API-CATALOG.md).

## Operacao offline controlada

O cadastro offline e um recurso experimental configurado por loja e permanece desativado por padrao. Com o recurso desligado, novos cadastros exigem internet e a pagina **Sync** fica oculta.

Quando um administrador ativa o recurso em **Configuracoes > Agenda > Cadastro offline**, o aplicativo permite salvar somente os dados do lead sem conexao. Data e horario continuam bloqueados, pois o agendamento depende da disponibilidade atual da loja, do transporte, das cotas e das escalas. Os dados pendentes sao mantidos pelo cache persistente do SDK do Firestore e enviados quando a conexao retorna.

Cada cadastro tera um UUID criado no dispositivo. Novas tentativas usarao o mesmo identificador para evitar duplicacao.

O sistema nao depende de sincronizacao em segundo plano com o aplicativo fechado, pois navegadores moveis nao garantem essa execucao.

## Seguranca e privacidade

- login Google nao substitui a autorizacao interna;
- somente e-mails previamente autorizados poderao acessar o sistema;
- captadores acessarao apenas os proprios registros;
- gestores acessarao apenas a loja vinculada;
- regras do Firestore validarao acesso, tipos e campos permitidos;
- dados pessoais nao deverao aparecer em URLs, logs ou fixtures de teste;
- o MVP coletara apenas os dados necessarios ao contato;
- CPF, dados de saude, fotos e geolocalizacao exata nao serao coletados inicialmente;
- o formulario coletara somente os dados necessarios para a captacao e o pre-agendamento.

## Estrutura planejada

```text
FASCINLEAD/
|-- docs/
|   `-- TDD.md
|-- public/
|   |-- icons/
|   `-- manifest.webmanifest
|-- src/
|   |-- app/
|   |-- components/
|   |-- firebase/
|   |-- pages/
|   |-- services/
|   |-- styles/
|   `-- utils/
|-- tests/
|   |-- e2e/
|   |-- rules/
|   `-- unit/
|-- AGENTS.md
|-- firestore.indexes.json
|-- firestore.rules
|-- firebase.json
|-- index.html
|-- package.json
`-- vite.config.js
```

A estrutura sera criada durante a fundacao do projeto e podera receber pequenos ajustes conforme a implementacao real.

## Documentacao

| Documento | Conteudo |
| --- | --- |
| [Technical Design Document](docs/TDD.md) | Escopo, arquitetura, requisitos, modelo de dados, seguranca, testes e implantacao |
| [Plano futuro de pre-atendimento clinico](docs/PLANO-PRE-ATENDIMENTO-CLINICO.md) | Separacao entre captacao, recepcao e atendimento medico; agenda clinica, alertas e privacidade |
| [Plano futuro de evolucoes operacionais](docs/PLANO-EVOLUCOES-OPERACIONAIS.md) | Historico do lead, duplicidades, confirmacoes, lista de espera, alertas e busca global |
| [Plano da fila de encaixes](docs/PLANO-FILA-DE-ENCAIXES.md) | Atendimento presencial no mesmo dia, fila operacional, auditoria, permissoes e indicadores |
| [Guia para agentes](AGENTS.md) | Contexto e regras obrigatorias para pessoas e agentes de IA que alterarem o repositorio |

Leia o `AGENTS.md` e o TDD antes de iniciar qualquer desenvolvimento.

## Desenvolvimento local

Requisitos:

- Node.js 20.19 ou superior;
- npm 10 ou superior;
- Java para executar a Firebase Emulator Suite.

Instale as dependencias e inicie o servidor:

```bash
npm install
npm run dev
```

No Windows, tambem e possivel iniciar com dois cliques em `INICIAR-FASCINLEAD.bat`. O arquivo instala as dependencias quando necessario, inicia o servidor e abre o navegador automaticamente. Para desligar, pressione `Ctrl+C` na janela do terminal.

Comandos disponiveis:

| Comando | Finalidade |
| --- | --- |
| `npm start` | Iniciar o sistema e abrir o navegador automaticamente |
| `npm run dev` | Iniciar o servidor Vite |
| `npm run build` | Gerar o build de producao |
| `npm run build:pages` | Gerar o build para o GitHub Pages |
| `npm run preview` | Servir o build localmente |
| `npm test` | Executar os testes unitarios |
| `npm run test:watch` | Executar testes em modo continuo |
| `npm run test:e2e` | Executar os fluxos de interface no Chrome mobile e desktop |
| `npm run emulators` | Iniciar os emuladores Firebase |
| `npm run deploy` | Gerar o build e publicar no Firebase Hosting |

## Publicacao no GitHub Pages

O ambiente inicial pode ser publicado pelo workflow `Deploy GitHub Pages` em:

```text
https://gabrielbarbosa0.github.io/FASCINLEAD/
```

Antes da primeira publicacao:

1. Em `Settings > Secrets and variables > Actions`, crie o segredo `VITE_FIREBASE_API_KEY`.
2. Em `Settings > Pages`, selecione `GitHub Actions` como origem da publicacao.
3. No Firebase Authentication, adicione `gabrielbarbosa0.github.io` aos dominios autorizados.
4. Envie as alteracoes para a branch `main` ou execute manualmente o workflow na aba `Actions`.

O build do GitHub Pages usa o caminho `/FASCINLEAD/`. O desenvolvimento local continua usando a raiz `/`.

Copie `.env.example` para `.env.local` e preencha a configuracao web do projeto Firebase. Para usar os emuladores, defina `VITE_USE_FIREBASE_EMULATORS=true`.

Sem configuracao Firebase, o acesso ao sistema permanece bloqueado. Testes locais autenticados devem usar o Firebase Emulator Suite.

## Plano de entrega

### 1. Fundacao

- inicializar Vite e estrutura modular;
- definir identidade visual e componentes basicos;
- configurar PWA e app shell offline;
- configurar Firebase e Emulator Suite;
- implementar login e autorizacao;
- criar e testar as primeiras Security Rules.

### 2. Captacao offline

- implementar o formulario;
- salvar e consultar registros offline;
- exibir estados de sincronizacao;
- sincronizar sem duplicacao;
- cobrir o fluxo critico com testes.

### 3. Gestao

- adicionar filtros e totais simples;
- restringir dados por perfil e loja;
- implementar exportacao CSV;
- administrar acessos de colaboradores, gestores e administradores.
- criar metas individuais em massa e acompanhar o desempenho por loja e captador.
- exibir os pre-agendamentos em calendario mensal por loja.

## Cadastro de acessos

Um administrador pode abrir `Gestao` e selecionar `Gerenciar acessos`, ou usar o atalho `Acessos da equipe` na tela inicial.

1. Informe o nome e o e-mail da conta Google do colaborador.
2. Escolha `Colaborador`, `Gestor` ou `Administrador`.
3. Escolha entre `Loja 02`, `Loja 04`, `Loja 05` e `Loja 06`.
4. Selecione `Salvar acesso`.

O e-mail fica autorizado imediatamente. No primeiro login com Google, o FascinLead cria o perfil do usuario. Salvar novamente um e-mail existente atualiza seu perfil e sua loja; `Bloquear` impede novos acessos sem excluir o historico de captacoes.

### 4. Piloto

- testar com um grupo pequeno de colaboradores;
- validar Android e iPhone reais;
- simular perda e retorno de conexao;
- acompanhar cotas gratuitas do Firebase;
- corrigir problemas antes da liberacao para todas as lojas.

## Contribuicao

Antes de alterar o repositorio:

1. Leia o [AGENTS.md](AGENTS.md).
2. Leia o [TDD](docs/TDD.md).
3. Verifique o estado atual do Git.
4. Preserve alteracoes existentes que nao pertencem a sua tarefa.
5. Avalie impactos em operacao offline, seguranca, privacidade e cotas do Firebase.
6. Implemente testes proporcionais ao risco da mudanca.
7. Atualize a documentacao quando uma decisao permanente mudar.

## Licenca

Consulte o arquivo [LICENSE](LICENSE) deste repositorio.
