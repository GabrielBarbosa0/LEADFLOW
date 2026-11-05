# AGENTS.md - FascinLead

> LEIA ESTE ARQUIVO ANTES DE ANALISAR, PLANEJAR OU ALTERAR O PROJETO.

Este documento fornece contexto e regras permanentes para qualquer pessoa ou agente de IA que trabalhe neste repositorio. Depois desta leitura, consulte obrigatoriamente [`docs/TDD.md`](docs/TDD.md), que e a especificacao tecnica principal do produto.

## 1. Identidade do projeto

- **Nome:** FascinLead
- **Empresa:** Oticas Fascinante
- **Tipo:** Progressive Web App (PWA)
- **Publico principal:** colaboradores que captam potenciais clientes na rua
- **Objetivo:** substituir fichas de papel por um pre-cadastro digital rapido, confiavel e utilizavel sem internet
- **Estado atual:** fundacao tecnica e primeiro fluxo de captacao em desenvolvimento

O FascinLead deve fazer uma coisa pequena muito bem: registrar um contato durante uma abordagem, preservar esse registro no aparelho quando nao houver conexao e sincroniza-lo com a nuvem quando a internet voltar.

## 2. O que o produto e

O FascinLead e uma ferramenta operacional de pre-cadastro. O fluxo essencial e:

1. O colaborador entra com uma conta Google autorizada.
2. Abre um formulario curto durante a abordagem.
3. Informa os dados minimos do potencial cliente.
4. Salva o cadastro mesmo sem internet.
5. Consulta no proprio aparelho o que ja cadastrou.
6. O sistema sincroniza os registros com o Firebase quando houver conexao.
7. Um gestor autorizado consulta ou exporta os registros da sua loja.

Simplicidade e confiabilidade offline sao mais importantes do que quantidade de funcionalidades.

## 3. O que o produto nao e

O FascinLead **nao e um CRM completo**. Nao ampliar o projeto silenciosamente para incluir:

- funil de vendas;
- atendimento ou disparos pelo WhatsApp;
- confirmacoes automaticas ou lembretes de consultas e exames; o lead registra um pre-agendamento opcional, exibido aos gestores em uma agenda mensal;
- anamnese;
- recomendacao de lentes;
- provador virtual;
- metas de vendas, comissoes ou faturamento; metas individuais de quantidade de leads captados fazem parte do escopo aprovado;
- conciliacao de vendas;
- integracao com Savwin;
- integracao com AppOk;
- integracoes externas de escrita nao aprovadas; a API de saida de leads para CRMs e uma fronteira aprovada e documentada no TDD;
- aplicativo nativo para Play Store ou App Store.

Uma solicitacao futura pode alterar o escopo, mas isso deve ser uma decisao explicita e refletida primeiro no TDD.

## 4. Ordem obrigatoria de leitura

Antes de fazer qualquer mudanca:

1. Leia este `AGENTS.md` por completo.
2. Leia [`docs/TDD.md`](docs/TDD.md) por completo.
3. Leia o `README.md` e os arquivos diretamente relacionados a tarefa.
4. Verifique `git status` e preserve alteracoes existentes do usuario.
5. Inspecione a implementacao atual antes de propor novas estruturas.

Nao suponha que as imagens usadas como referencia visual representam requisitos completos. Elas servem para orientar o fluxo e a ergonomia, nao para copiar marca, codigo ou funcionalidades de terceiros.

## 5. Fontes de verdade

Em caso de divergencia, use esta prioridade:

1. Pedido atual e explicito do responsavel pelo projeto.
2. Decisoes aprovadas e registradas no [`docs/TDD.md`](docs/TDD.md).
3. Este `AGENTS.md`.
4. Testes automatizados e contratos de dados existentes.
5. Implementacao atual.
6. `README.md` e comentarios auxiliares.

Se uma nova decisao mudar arquitetura, escopo, seguranca, modelo de dados ou fluxo offline, atualize o TDD na mesma entrega.

## 6. Arquitetura aprovada

A arquitetura inicial e deliberadamente pequena:

- HTML5;
- CSS3;
- JavaScript com ES Modules;
- Vite como ferramenta de desenvolvimento e build;
- PWA com Web App Manifest e Service Worker;
- Firebase Authentication com login Google;
- Cloud Firestore com persistencia offline em IndexedDB;
- Firebase Hosting;
- Firebase Emulator Suite para desenvolvimento e testes;
- Vitest para testes unitarios;
- Playwright para testes de interface e fluxos offline;
- Lucide para icones de interface.

Nao introduza framework de UI, banco adicional ou gerenciador de estado complexo sem uma necessidade demonstrada e uma alteracao aprovada no TDD. O servidor local da API de integracao e a excecao aprovada para preparar o consumo de leads por CRMs.

## 7. Restricao de custos

O projeto deve utilizar inicialmente apenas recursos gratuitos do Firebase, no plano Spark.

No MVP:

- nao usar Cloud Functions;
- nao usar Cloud Run;
- nao usar Firebase Storage;
- nao ativar extensoes ou produtos que exijam faturamento;
- nao exigir conta de cobranca;
- nao fazer consultas amplas ou listeners em tempo real sobre toda a base;
- desenvolver e testar preferencialmente com a Emulator Suite;
- manter a API de CRM apenas local enquanto nao houver decisao explicita sobre hospedagem e custos;
- paginar consultas gerenciais;
- monitorar leituras, escritas e armazenamento.

Se uma funcionalidade exigir o plano Blaze ou outro servico pago, pare e apresente o impacto antes de implementar.

## 8. Regra central: offline primeiro

O funcionamento offline nao e um extra; e o requisito principal do produto.

Qualquer mudanca no fluxo de cadastro deve preservar estas garantias:

- depois do primeiro acesso online, o PWA abre sem internet;
- o formulario pode ser preenchido e salvo offline;
- o cadastro salvo aparece imediatamente na lista local;
- fechar e reabrir o aplicativo nao apaga itens pendentes;
- a interface diferencia `Pendente`, `Sincronizando`, `Sincronizado` e `Erro`;
- a reconexao envia os itens sem criar duplicatas;
- uma falha remota nao limpa o formulario nem remove o dado local;
- o usuario sempre consegue ver quantos registros aguardam envio.

Use UUID gerado no dispositivo como identificador do cadastro. O mesmo UUID deve ser reutilizado em novas tentativas de envio para garantir idempotencia.

Nao dependa de Background Sync para o fluxo principal. Navegadores moveis podem suspender completamente o PWA fechado. A sincronizacao deve ocorrer ao salvar online, abrir o app, recuperar conexao, voltar ao primeiro plano e acionar `Sincronizar agora`.

## 9. Autenticacao e autorizacao

Login e permissao sao conceitos diferentes.

- O Firebase Authentication confirma a identidade Google.
- A colecao `allowedEmails` determina se o e-mail pode entrar.
- A colecao `users` registra UID, perfil, loja e estado do usuario.
- Um captador acessa somente os proprios registros.
- Um gestor acessa somente os registros da sua loja.
- Um administrador pode gerenciar todas as lojas e acessos.

Nunca confie apenas em verificacoes da interface. Toda permissao deve ser aplicada tambem por `firestore.rules` e coberta por testes no emulador.

Um usuario nao pode alterar o proprio perfil, elevar seu papel nem trocar seu `storeId` pelo frontend.

## 10. Dados e privacidade

O produto trata nome, telefone e outros dados pessoais. Colete o minimo necessario.

Campos obrigatorios previstos para o MVP:

- nome;
- telefone ou WhatsApp.

Campos opcionais previstos:

- apelido;
- bairro;
- cidade e UF;
- interesse principal;
- observacao curta.

Nao adicionar ao MVP sem aprovacao explicita:

- CPF;
- receita oftalmologica;
- informacoes de saude;
- fotografias;
- documentos;
- geolocalizacao exata.

Regras permanentes:

- nunca colocar dados pessoais em URLs;
- nunca registrar nome, telefone ou observacoes em `console.log`;
- nunca incluir dados reais em fixtures, exemplos ou testes;
- nunca versionar credenciais, chaves privadas ou contas de servico;
- validar tamanho, tipo e campos permitidos tambem no Firestore;
- considerar exclusao e retencao de dados no desenho de qualquer funcionalidade.

A configuracao web publica do Firebase nao e uma credencial administrativa. Mesmo assim, o acesso aos dados deve estar protegido por Authentication, lista de autorizacao e Security Rules.

## 11. Modelo de dados

As colecoes iniciais previstas sao:

- `stores`: lojas da Oticas Fascinante;
- `allowedEmails`: e-mails autorizados, perfil e loja;
- `users`: usuarios autenticados por UID;
- `interests`: opcoes ativas de interesse;
- `leads`: pre-cadastros captados.
- `appointmentSlots`: reservas minimas de horario, sem dados pessoais do cliente;
- `goals`: metas individuais de quantidade de leads atribuidas a captadores.

A agenda gerencial nao cria uma colecao propria: ela consulta `appointmentDate` e `appointmentTime` nos documentos de `leads` para manter uma unica fonte de verdade.
Gestores podem atualizar somente o estado de comparecimento dos pre-agendamentos da propria loja; essa permissao nao se estende aos demais campos do lead.
Cada documento em `stores` pode definir `schedulingMode`, `appointmentDurationMinutes`, `openingTime` e `closingTime`. Na ausencia desses campos, a agenda controlada usa 20 minutos e expediente das 08:00 as 18:00.

O modelo detalhado, os campos e os indices estao em [`docs/TDD.md`](docs/TDD.md). Nao renomeie colecoes, mude tipos ou introduza campos obrigatorios sem avaliar:

- registros offline ainda pendentes;
- compatibilidade com dados existentes;
- Security Rules;
- indices do Firestore;
- exportacao CSV;
- versao `schemaVersion`.

Alteracoes incompativeis exigem estrategia de migracao documentada.

## 12. Experiencia do usuario

O usuario principal estara na rua, usando uma mao, sob luz externa e possivelmente com internet instavel. A interface deve ser direta e tolerante a erros.

Diretrizes:

- priorizar celular e largura minima de 360 px;
- manter `Novo cadastro` acessivel em um toque;
- usar campos grandes, rotulos permanentes e alvos de toque com pelo menos 44 px;
- evitar formularios longos e informacoes que possam ser preenchidas automaticamente;
- mostrar claramente o estado online/offline e o estado real da sincronizacao;
- preservar dados digitados ao ocorrer qualquer erro;
- evitar modais desnecessarios;
- usar linguagem simples em portugues brasileiro;
- garantir foco visivel, contraste e navegacao por teclado;
- usar icones Lucide quando houver um icone adequado;
- evitar elementos decorativos que prejudiquem a leitura.

`navigator.onLine` e apenas um indicio de conectividade. Nunca apresentar o selo `Online` como garantia de que o Firebase respondeu.

## 13. Convencoes de implementacao

Ao iniciar o codigo:

- use JavaScript moderno com ES Modules;
- mantenha componentes e servicos pequenos e focados;
- separe UI, acesso ao Firebase, validacao e regras de negocio;
- prefira funcoes puras para normalizacao e validacao;
- use nomes de codigo em ingles e textos da interface em portugues brasileiro;
- mantenha configuracoes por ambiente fora da logica de negocio;
- nao duplique o mesmo estado em varios armazenamentos sem necessidade;
- use timestamps do cliente para ordenar itens offline e timestamps do servidor para auditoria remota;
- trate estados de carregamento, vazio, offline, acesso negado e erro;
- evite abstracoes prematuras e dependencias para problemas pequenos.

Comentarios devem explicar decisoes nao obvias, especialmente em cache, sincronizacao e seguranca. Nao descreva em comentarios aquilo que o codigo ja diz claramente.

## 14. Service Worker e cache

O Service Worker cuida do app shell, nao do banco de clientes.

- arquivos estaticos versionados podem usar `cache first`;
- o HTML principal deve preferir rede com fallback em cache;
- o Firestore e o Authentication devem permanecer sob controle dos SDKs oficiais;
- nao copie documentos do Firestore para Cache Storage;
- atualizacoes nao podem recarregar a pagina enquanto houver formulario nao salvo;
- toda mudanca no cache deve ser testada em atualizacao de versao, nao apenas em primeira instalacao.

## 15. Uso do RTK no Codex Desktop

Para reduzir o consumo de tokens neste repositorio, use o RTK explicitamente
nos comandos de terminal compativeis. O hook global pode nao interceptar os
comandos executados pela ferramenta interna do Codex Desktop.

Exemplos:

- `rtk git status`, `rtk git diff` e `rtk git log`;
- `rtk npm test` para suites de testes;
- `rtk docker ps` e outros comandos Docker suportados.

Continue usando as ferramentas normais de pesquisa e leitura de codigo. No
Windows, o executavel `rg` fornecido internamente pelo Codex pode nao estar
visivel para o processo filho do RTK.

Use o comando original ou `rtk bypass <comando>` quando a saida condensada
estiver vazia, contradizer o codigo de saida, estiver ilegivel ou omitir um
detalhe necessario para diagnosticar uma falha. O RTK reduz ruido, mas nao deve
substituir evidencias completas em investigacoes de permissao, Firestore ou
publicacao.

## 16. Fluxo de trabalho para qualquer alteracao

Antes de editar:

1. Entenda o pedido e identifique se ele pertence ao escopo.
2. Leia os arquivos afetados e os testes relacionados.
3. Verifique o estado do Git e preserve mudancas que nao sao suas.
4. Identifique impactos offline, de permissao, privacidade e cota Firebase.
5. Escolha a menor mudanca que entregue o comportamento completo.

Durante a implementacao:

1. Siga os padroes ja presentes no repositorio.
2. Atualize Security Rules e indices quando o acesso a dados mudar.
3. Adicione testes proporcionais ao risco.
4. Nao inclua refatoracoes ou dependencias sem relacao com o pedido.
5. Atualize a documentacao quando uma decisao permanente mudar.

Antes de concluir:

1. Execute formatacao, lint, testes unitarios e testes relevantes.
2. Teste o fluxo com a rede desativada e depois reativada.
3. Confira pelo menos um viewport mobile.
4. Verifique que nenhum dado pessoal ou segredo foi incluido no diff.
5. Execute `git diff --check` e revise o diff completo.
6. Informe claramente o que mudou e quais verificacoes foram executadas.

Quando o `package.json` existir, use os scripts declarados nele como fonte de verdade para os comandos. Nao invente comandos paralelos que contornem a configuracao do projeto.

### Empacotamento de releases

- Toda nova release deve ser criada dentro da pasta `release/`.
- Arquivos ZIP, pastas empacotadas e demais artefatos destinados a publicacao nao devem ser colocados na raiz do repositorio nem em outras pastas.
- Builds temporarios usados apenas para verificacao podem continuar seguindo os caminhos definidos pelos scripts do projeto, mas o pacote final de publicacao deve sempre ser movido ou gerado em `release/`.
- Nao apagar nem sobrescrever releases anteriores sem solicitacao explicita do responsavel pelo projeto.

## 17. Testes obrigatorios por area

### Formularios e dados

- validacao dos campos obrigatorios;
- normalizacao do telefone;
- limites de texto;
- serializacao do documento;
- protecao contra duplo envio.

### Offline e sincronizacao

- salvar sem rede;
- recarregar a pagina ainda offline;
- manter registros pendentes;
- reconectar e sincronizar;
- repetir tentativa sem duplicacao;
- rejeicao por permissao sem perda silenciosa;
- atualizacao do PWA com item pendente.

### Autorizacao

- e-mail nao autorizado;
- captador tentando acessar outro captador;
- gestor tentando acessar outra loja;
- usuario tentando alterar papel ou loja;
- documento com campos extras ou tipos invalidos;
- administrador executando operacoes permitidas.

### Interface

- largura de 360 px;
- Android e iOS reais antes do piloto;
- navegacao por teclado;
- estados vazio, carregando, offline, erro e sincronizado;
- instalacao e abertura do PWA.

## 18. Criterio de conclusao

Uma tarefa so esta concluida quando:

- o comportamento solicitado esta implementado por inteiro;
- o fluxo offline continua seguro;
- as regras de acesso continuam corretas;
- testes relevantes passam;
- a interface funciona em celular;
- documentacao afetada esta atualizada;
- nao foram adicionados servicos pagos sem aprovacao;
- nao foram incluidos segredos nem dados pessoais;
- limitacoes ou testes nao executados foram comunicados.

## 19. Decisoes que exigem confirmacao

Nao tome sozinho uma decisao que:

- transforme o sistema em CRM;
- adicione integracao externa;
- exija plano pago do Firebase;
- colete nova categoria de dado pessoal;
- altere perfis ou visibilidade entre lojas;
- remova suporte offline;
- altere a politica de consentimento ou retencao;
- introduza backend, framework principal ou novo banco;
- quebre compatibilidade com registros ja salvos.

Apresente a necessidade, alternativas, custo e impacto. Depois da decisao, registre-a no TDD.

## 20. Pendencias de negocio atuais

Antes do piloto ainda precisam ser definidos:

- lojas, codigos e estado padrao;
- e-mails e perfis iniciais;
- lista de interesses;
- prazo de retencao;
- permissao de edicao para gestores;
- inclusao da tela gerencial na primeira entrega;
- logotipo e conjunto final de icones; a cor principal aprovada e `#003070`.

Nao bloqueie a fundacao tecnica por essas respostas quando for possivel usar configuracoes ou dados ficticios seguros. Nao publique para uso real sem resolve-las.

## 21. Resumo rapido para novos agentes

Se voce acabou de chegar ao repositorio, retenha isto:

- FascinLead e um pre-cadastro PWA, nao um CRM.
- Metas de captacao por quantidade de leads sao permitidas; ranking, vendas, comissoes e faturamento exigem nova decisao de escopo.
- O usuario trabalha na rua e precisa salvar sem internet.
- HTML, CSS, JavaScript, Vite e Firebase compoem a arquitetura aprovada.
- Somente recursos gratuitos do Firebase devem ser usados no MVP.
- Login Google nao substitui autorizacao por e-mail, perfil e loja.
- Dados pessoais exigem coleta minima e regras de seguranca testadas.
- Savwin, AppOk e WhatsApp estao fora do escopo.
- Leia [`docs/TDD.md`](docs/TDD.md) antes de implementar qualquer funcionalidade.
- Preserve alteracoes existentes e mantenha este documento e o TDD atualizados.
