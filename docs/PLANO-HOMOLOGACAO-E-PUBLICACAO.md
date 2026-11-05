# Plano de homologacao, testes e publicacao

## Objetivo

Este documento define uma rotina segura para desenvolver, testar e publicar alteracoes no LeadFlow sem interromper a versao em producao.

Os principais objetivos sao:

- manter a `main` sempre igual a versao publicada;
- impedir testes locais contra dados reais;
- validar permissoes com todos os perfis relevantes;
- testar regras do Firestore antes de qualquer publicacao;
- criar versoes reproduziveis e faceis de reverter;
- concentrar as publicacoes em uma janela planejada no fim de semana.

## Por que alteracoes simples podem quebrar o sistema

Uma funcionalidade aparentemente pequena pode atravessar varias camadas:

1. A interface decide se exibe ou habilita uma acao.
2. O servico JavaScript valida o perfil e prepara a gravacao.
3. As regras do Firestore autorizam ou negam a operacao.
4. Uma transacao pode alterar lead, vaga, historico e outros documentos.
5. Cadastros antigos podem nao possuir todos os campos atuais.
6. O Service Worker pode manter arquivos antigos em cache.

As regras de autorizacao nao devem ser duplicadas de formas diferentes. Interface, servicos e Firestore precisam usar o mesmo modelo de permissoes e devem possuir testes equivalentes.

## Organizacao do Git

### Main

A branch `main` deve representar exatamente o codigo em producao. Ela nao deve ser usada como ambiente de experimentacao.

### Branches de funcionalidade

Cada funcionalidade ou correcao deve ser desenvolvida em uma branch curta e independente, por exemplo:

```text
feat/comparecimento-reversivel
fix/permissao-reagendamento
```

### Integracao e homologacao

Uma branch `develop` pode reunir apenas as funcionalidades candidatas ao proximo ciclo de homologacao. A entrada de uma mudanca na `develop` nao autoriza sua entrada na `main`.

### Versoes e rollback

Toda publicacao aprovada deve receber uma tag, por exemplo:

```text
v1.4.0
```

O pacote da Hostinger deve ser gerado a partir dessa tag. O ZIP anterior deve ser preservado para rollback imediato.

## Ambiente local descartavel

O ambiente local deve usar Firebase Emulator Suite e dados ficticios. Nenhum teste automatizado deve depender do Firebase de producao.

Um ambiente descartavel deve incluir:

- frontend do LeadFlow;
- Authentication Emulator;
- Firestore Emulator;
- Functions Emulator, quando necessario;
- regras locais do Firestore;
- dados iniciais de teste;
- testes Playwright;
- usuarios de todos os perfis relevantes.

### Dados iniciais

O seed deve criar, no minimo:

- um administrador;
- um gestor;
- um atendente de balcao;
- um colaborador;
- um MEI;
- todas as lojas;
- leads novos e antigos;
- agendamentos pendentes, confirmados, cancelados e reagendados;
- cadastros com e sem transporte e acompanhante.

O seed deve ser repetivel. Reiniciar o ambiente deve sempre produzir a mesma base conhecida.

## Uso do Docker Compose

O Docker Compose pode padronizar as versoes do Node.js, Java, Firebase CLI e demais dependencias. Ele tambem pode iniciar todos os servicos com um unico comando.

Estrutura desejada:

```text
frontend
firebase-emulators
seed
testes-e2e
```

### Vantagens

- ambiente reproduzivel;
- isolamento dos dados reais;
- mesmas versoes de ferramentas em todas as maquinas;
- inicializacao e encerramento padronizados;
- execucao simplificada em integracao continua;
- menor risco de apontar testes para o projeto errado.

### Limitacoes

Docker Compose nao corrige erros de logica e nao substitui testes em navegadores e celulares reais. No Windows, o desenvolvimento com Vite dentro do Docker pode ser mais lento devido ao compartilhamento de arquivos.

O conteiner local nao deve receber credenciais capazes de publicar em producao.

### Uso do Docker nesta branch

A infraestrutura inicial fica na branch `chore/docker-homologacao` e executa a
mesma aplicacao da `main`, sem portar funcionalidades das branches de backup.

Pre-requisitos:

- Docker Desktop aberto e operacional;
- `.env.staging.local` configurado para `leadflowtest-d32c2`;
- porta local `5175` disponivel.

Comandos principais:

```powershell
# Iniciar a homologacao
docker compose up --build

# Executar testes unitarios, regras e build de homologacao
docker compose run --rm app npm run verify:docker

# Encerrar e remover os conteineres
docker compose down
```

No Windows, `INICIAR-LEADFLOW-DOCKER.bat` inicia o primeiro comando. O script
`verify:staging` bloqueia a inicializacao quando o projeto Firebase configurado
nao for exatamente `leadflowtest-d32c2`.

O Compose nao possui comando de deploy. A publicacao de regras e o build de
producao continuam sendo etapas separadas e deliberadas.

### Modo local descartavel

O perfil `disposable` executa uma segunda instancia totalmente local. Ele nao
usa o projeto `fascinlead` nem o projeto remoto `leadflowtest-d32c2`:

| Servico | Endereco | Finalidade |
| --- | --- | --- |
| LeadFlow local | `http://localhost:5176/` | Aplicacao conectada somente aos emuladores |
| Emulator UI | `http://localhost:4000/` | Inspecao dos usuarios e documentos ficticios |
| Functions Emulator | `127.0.0.1:5001` | Funcoes locais usadas por acessos e pesquisas |
| Firestore Emulator | `127.0.0.1:8180` | Banco descartavel com as regras do repositorio |
| Authentication Emulator | `127.0.0.1:9099` | Contas locais descartaveis |

Para iniciar:

```powershell
docker compose --profile disposable up --build app-emulator
```

No Windows, o mesmo comando pode ser iniciado por
`INICIAR-LEADFLOW-EMULADORES.bat`. Para remover todos os usuarios e documentos
locais e recriar o ambiente vazio, use `RESETAR-LEADFLOW-EMULADORES.bat`.

O script `verify:emulator` exige o projeto ficticio `demo-leadflow`, exige os
emuladores ativados e bloqueia IDs conhecidos dos projetos remotos. O arquivo
`.firebaserc` nao e utilizado pelo comando dos emuladores, que sempre informa o
projeto local explicitamente.

O modo descartavel e complementar ao ambiente remoto de homologacao. O proximo
passo implementado e um seed repetivel com perfis, lojas, leads e agendamentos
ficticios. Os acessos e a senha local estao registrados em
[`DADOS-HOMOLOGACAO-LOCAL.md`](DADOS-HOMOLOGACAO-LOCAL.md). Os proximos testes de
fluxo completo devem usar sempre essa mesma base conhecida.

## Controle das regras do Firestore

O arquivo `firestore.rules` do repositorio deve ser a unica fonte oficial das regras.

Regras operacionais:

1. Nao editar regras manualmente no Console do Firebase.
2. Toda alteracao deve possuir teste automatizado no emulador.
3. O deploy deve informar explicitamente o projeto de destino.
4. As regras locais e publicadas devem ser comparadas por hash.
5. A publicacao em producao deve exigir confirmacao manual.
6. Regras e frontend devem ser versionados na mesma release quando dependerem um do outro.

Exemplo conceitual de fluxo:

```text
testar regras no emulador
publicar regras na homologacao
validar todos os perfis
aprovar a release
publicar regras na producao
publicar o frontend correspondente
```

## Matriz alvo de permissoes

Esta tabela representa a direcao funcional a ser refinada, nao uma afirmacao de
que todos os fluxos ja existem no baseline. O comportamento implementado e as
lacunas atuais estao registrados em
[`MATRIZ-PERFIS-E-FLUXOS-HOMOLOGACAO.md`](MATRIZ-PERFIS-E-FLUXOS-HOMOLOGACAO.md).
Cancelamento regular, arquivamento e outras funcoes ausentes devem ser
implementados e aprovados antes de passarem a constar como comportamento atual.

Cada operacao deve ser testada com unidade permitida e unidade proibida.

| Operacao | Administrador | Gestor | Atendente Balcao | Colaborador | MEI |
| --- | --- | --- | --- | --- | --- |
| Criar cadastro | Sim | Sim | Sim | Sim | Sim |
| Visualizar cadastros da unidade | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Editar cadastro da unidade | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Agendar cadastro existente | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Reagendar atendimento | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Cancelar atendimento | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Registrar comparecimento | Sim | Sim | Sim | Nao | Nao |
| Registrar falta | Sim | Sim | Sim | Nao | Nao |
| Criar encaixe rapido | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Consultar historico | Sim | Sim | Sim | Conforme permissao | Conforme permissao |
| Arquivar lead | Sim | Conforme permissao | Conforme permissao | Nao | Nao |

Esta tabela deve ser atualizada sempre que um perfil ou permissao for alterado.

## Fluxos automatizados obrigatorios

Os testes automatizados devem cobrir, no minimo:

1. Criacao de cadastro online.
2. Criacao de cadastro offline.
3. Sincronizacao depois de recuperar a conexao.
4. Agendamento de cadastro novo.
5. Agendamento de cadastro existente.
6. Alteracao de data e horario.
7. Reagendamento com motivo.
8. Cancelamento com motivo.
9. Marcacao de comparecimento e falta.
10. Desmarcacao, quando a funcionalidade estiver habilitada.
11. Criacao e atualizacao de encaixe rapido.
12. Leitura do historico do lead.
13. Restricao por perfil e unidade.
14. Compatibilidade com documentos antigos.
15. Atualizacao da PWA sem manter codigo antigo em cache.

## Feature flags

Funcionalidades novas devem, quando possivel, ser publicadas inicialmente desativadas.

Exemplo:

```text
reversibleAttendanceEnabled: false
```

Depois dos testes, a funcionalidade pode ser ativada primeiro na homologacao e posteriormente em producao. Uma feature flag nao substitui testes e nao torna segura uma regra incorreta do Firestore.

## Integracao continua

O GitHub Actions deve executar automaticamente em toda branch candidata:

- testes unitarios;
- testes das regras no Firebase Emulator;
- testes de integracao;
- testes Playwright por perfil;
- build de producao;
- verificacao do projeto Firebase embutido no build;
- verificacao de formatacao e analise estatica.

Uma branch com teste falhando nao pode ser integrada.

## Monitoramento

Erros de producao devem possuir informacoes suficientes para diagnostico, sem expor dados pessoais.

Uma ferramenta como Sentry pode registrar:

- versao publicada;
- pagina e acao executada;
- navegador e dispositivo;
- codigo tecnico do erro;
- rastreamento da excecao.

Erros de extensoes do navegador devem ser diferenciados de erros do LeadFlow.

## Rotina semanal

### Segunda a quinta-feira

- coletar feedbacks da equipe;
- registrar cada problema ou melhoria separadamente;
- classificar prioridade e risco;
- desenvolver em branches pequenas;
- escrever testes junto com a alteracao;
- nao publicar em producao.

### Sexta-feira

- congelar o conjunto de funcionalidades da semana;
- integrar somente mudancas prontas;
- criar uma versao candidata;
- gerar o resumo das alteracoes;
- executar todos os testes automatizados;
- preparar backup quando houver mudanca sensivel de dados.

### Sabado

- publicar a versao candidata na homologacao;
- executar o roteiro completo com todos os perfis;
- testar computador e celular;
- testar online, offline e sincronizacao;
- testar permissoes por unidade;
- testar com janela anonima e sem extensoes;
- registrar falhas encontradas.

### Domingo

- corrigir somente falhas da versao candidata;
- repetir todos os testes afetados;
- repetir o roteiro de regressao;
- publicar apenas se todos os criterios estiverem aprovados;
- executar testes rapidos em producao;
- realizar rollback imediato se um fluxo essencial falhar.

Se a versao candidata nao estiver estavel, a publicacao deve ser adiada. A `main` e a producao permanecem inalteradas.

## Checklist de publicacao

Antes da publicacao:

- [ ] Mudancas revisadas e documentadas.
- [ ] Testes unitarios aprovados.
- [ ] Testes de regras aprovados.
- [ ] Testes Playwright aprovados.
- [ ] Matriz de permissoes validada.
- [ ] Fluxo offline e sincronizacao validados.
- [ ] Testes em celular e computador realizados.
- [ ] Regras da homologacao comparadas com o arquivo local.
- [ ] Build de producao gerado do commit aprovado.
- [ ] Build aponta para o Firebase de producao.
- [ ] Nome da aplicacao no build e `LeadFlow`.
- [ ] ZIP anterior preservado.
- [ ] Tag da versao criada.

Depois da publicacao:

- [ ] Login de administrador validado.
- [ ] Login de Atendente Balcao validado.
- [ ] Criacao de cadastro validada.
- [ ] Agendamento e reagendamento validados.
- [ ] Cancelamento validado.
- [ ] Agenda e comparecimento validados.
- [ ] Console verificado sem erros do LeadFlow.
- [ ] Versao publicada registrada.

## Politica de rollback

O rollback deve ser iniciado quando qualquer fluxo essencial deixar de funcionar para um perfil autorizado.

Procedimento:

1. Interromper novas publicacoes.
2. Restaurar o ZIP da ultima versao aprovada.
3. Restaurar regras anteriores somente se elas tiverem sido alteradas.
4. Validar login, cadastro, agenda e permissoes.
5. Registrar a causa e os passos da recuperacao.
6. Manter a funcionalidade com problema fora da `main` ate nova homologacao.

## Ordem recomendada de implantacao deste plano

1. Manter a `main` igual a producao.
2. Documentar o roteiro manual de regressao.
3. Cobrir o comportamento atual com testes automatizados.
4. Configurar GitHub Actions.
5. Criar seeds de usuarios, lojas, leads e agendamentos.
6. Criar Docker Compose com Firebase Emulator Suite.
7. Recriar uma homologacao isolada.
8. Implantar feature flags.
9. Adicionar monitoramento de erros.
10. Portar funcionalidades novas uma por vez.
