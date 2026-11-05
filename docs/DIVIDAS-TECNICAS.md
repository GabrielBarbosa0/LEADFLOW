# FascinLead - Registro de dividas tecnicas

| Campo | Valor |
| --- | --- |
| Documento | Registro de dividas tecnicas |
| Projeto | FascinLead |
| Status | Ativo |
| Ultima revisao | 26/10/2026 |
| Documento principal relacionado | [TDD](TDD.md) |

## 1. Objetivo

Este documento registra riscos tecnicos conhecidos, impacto operacional, prioridade e criterio de conclusao. Ele deve ser revisado sempre que uma regressao revelar uma fragilidade estrutural, uma nova integracao for criada ou um item for mitigado.

Uma divida so pode ser marcada como concluida quando houver evidencia no codigo, testes automatizados e, quando aplicavel, validacao no ambiente publicado.

## 2. Situacao atual resumida

- As regras locais do Firestore nao usam leitura e escrita publicas. Caminhos nao previstos terminam em negacao por padrao.
- O frontend publicado no GitHub Pages nao publica automaticamente regras, indices ou Functions do Firebase.
- O repositorio possui testes unitarios, testes de regras no Emulator Suite e testes de interface com Playwright.
- Os testes de regras passaram a fazer parte do workflow do GitHub Pages em 25/10/2026.
- Os testes de interface ainda nao cobrem todo o fluxo real usando Authentication e Firestore Emulator em conjunto.
- O cadastro offline usa IndexedDB, cache do Firestore e Service Worker. Essa combinacao exige testes especificos de concorrencia, migracao e reconexao.
- Docker ainda nao e necessario para executar o projeto, mas pode ser adotado para padronizar Node.js, Java, Firebase CLI e navegadores de teste.

## 3. Criterios de prioridade

| Prioridade | Definicao |
| --- | --- |
| P0 - Critica | Pode causar perda de dados, indisponibilidade do cadastro, acesso indevido ou publicacao de uma regressao grave |
| P1 - Alta | Aumenta significativamente risco de seguranca, manutencao ou falha operacional |
| P2 - Media | Melhora previsibilidade, velocidade de desenvolvimento e recuperacao, mas possui contorno operacional |
| P3 - Baixa | Melhoria desejavel sem impacto imediato no piloto |

## 4. Dividas abertas

### TD-001 - Teste ponta a ponta com Firebase real emulado

| Campo | Valor |
| --- | --- |
| Prioridade | P0 - Critica |
| Area | Qualidade e Firebase |
| Problema | Os testes E2E autenticam usuarios semeados no Emulator, mas ainda cobrem apenas os fluxos essenciais de acesso e agenda. |
| Impacto | A interface pode passar nos testes e ainda falhar ao criar, sincronizar ou agendar um lead por causa das regras reais. |
| Conclusao | Playwright autentica usuarios semeados no Auth Emulator, usa Firestore Emulator e valida cadastro online, offline, reconexao, agendamento e permissoes. |

### TD-002 - Barreira unica de qualidade antes da publicacao

| Campo | Valor |
| --- | --- |
| Prioridade | P0 - Critica |
| Area | CI/CD |
| Problema | Unitarios e regras sao executados no workflow, mas o E2E integrado, o build e a compatibilidade entre frontend e regras ainda nao formam uma promocao atomica. Regras continuam com deploy separado. |
| Impacto | Uma versao do frontend pode exigir regras ainda nao publicadas, produzindo erros falsos de permissao ou bloqueio de cadastros. |
| Conclusao | Um comando `test:full` e o pipeline bloqueiam a entrega por unitarios, regras, integracao, E2E e build; a versao das regras implantadas e registrada e conferida. |

### TD-003 - Estado offline sem modelo formal de transicao

| Campo | Valor |
| --- | --- |
| Prioridade | P0 - Critica |
| Area | Offline e sincronizacao |
| Problema | IndexedDB, cache persistente do Firestore, estado em memoria e Service Worker participam do mesmo fluxo sem uma maquina de estados formal e persistida. |
| Impacto | Um cadastro pode aparecer, desaparecer, duplicar ou permanecer em erro dependendo da ordem de reconexao, assinatura de snapshots e atualizacao do PWA. |
| Conclusao | Estados e transicoes sao documentados e testados; o mesmo UUID e idempotente; 100 ciclos automatizados de salvar, fechar, reabrir, reconectar e agendar terminam sem perda ou duplicacao. |

### TD-004 - Observabilidade insuficiente de falhas

| Campo | Valor |
| --- | --- |
| Prioridade | P0 - Critica |
| Area | Operacao |
| Problema | Mensagens ao usuario sao amigaveis, mas ainda faltam codigos de correlacao e diagnostico estruturado de operacao, etapa, versao, dispositivo e resposta do Firebase. |
| Impacto | Erros diferentes parecem iguais e dependem de reproducao manual para serem investigados. |
| Conclusao | Erros possuem codigo estavel, contexto sem dados pessoais, trilha de sincronizacao e mecanismo de consulta operacional com politica de retencao. |

### TD-005 - Firebase App Check ausente

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | Seguranca Firebase |
| Problema | Authentication e Security Rules protegem os dados, mas ainda nao existe atestacao de que as requisicoes partiram de uma instancia valida do aplicativo. |
| Impacto | Clientes externos podem tentar automatizar requisicoes, explorar contas comprometidas ou consumir cota. |
| Conclusao | App Check configurado primeiro em monitoramento, metricas revisadas e enforcement ativado para os servicos compativeis sem bloquear o PWA legitimo. |

### TD-006 - Ausencia de ambiente de homologacao isolado

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | Ambientes |
| Problema | Validacoes manuais tendem a usar emuladores ou o mesmo projeto associado ao uso real. |
| Impacto | Testes podem afetar dados operacionais e diferencas de configuracao aparecem somente em producao. |
| Conclusao | Projeto Firebase de homologacao com dados sinteticos, regras equivalentes, dominios separados e promocao documentada. |

### TD-007 - Concentracao de comportamento no `src/app/app.js`

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | Arquitetura frontend |
| Problema | Renderizacao, navegacao, formularios, assinaturas, modais e parte da orquestracao de dominio estao fortemente acoplados em um arquivo central. |
| Impacto | Alteracoes locais provocam efeitos colaterais, tornam revisoes extensas e aumentam regressao por estado compartilhado. |
| Conclusao | Fluxos de cadastro, agenda, acessos, configuracoes e sincronizacao possuem controladores isolados e testes de contrato, sem reescrita total da interface. |

### TD-008 - Migracao e compatibilidade do armazenamento local

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | PWA e IndexedDB |
| Problema | A evolucao do formato local precisa de versoes, migracoes e recuperacao explicitas para aparelhos que ficaram dias sem abrir o PWA. |
| Impacto | Uma atualizacao pode tornar cadastros pendentes ilegiveis ou incompativeis com as regras novas. |
| Conclusao | Schema local versionado, migracoes testadas, rollback seguro e teste de atualizacao partindo das duas versoes anteriores. |

### TD-009 - Auditoria, exclusao e historico de alteracoes

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | Governanca de dados |
| Problema | Edicoes e exclusoes definitivas nao possuem uma trilha operacional completa e consultavel. |
| Impacto | Fica dificil distinguir erro humano, sincronizacao, correcao legitima e remocao indevida. |
| Conclusao | Eventos relevantes registram ator, data, acao e identificador do registro sem duplicar dados sensiveis; retencao e acesso sao definidos. |

### TD-010 - Backup, restauracao e retencao sem ensaio

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | Continuidade |
| Problema | Nao existe evidencia de um procedimento periodicamente testado para restaurar dados e configuracoes. |
| Impacto | Exclusao acidental, regra incorreta ou incidente pode gerar perda prolongada. |
| Conclusao | Politica aprovada, backups compativeis com o plano contratado, restauracao ensaiada e tempos RPO/RTO registrados. |

### TD-011 - Administrador principal acoplado a e-mail nas regras

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | Autorizacao |
| Problema | Existe tratamento especial para um e-mail de administrador principal nas Security Rules. |
| Impacto | Troca de responsavel exige alteracao e deploy de regras; uma conta comprometida possui alcance elevado. |
| Conclusao | Recuperacao administrativa baseada em procedimento controlado, claims ou configuracao segura, com MFA e sem identidade pessoal fixa no codigo. |

### TD-012 - Protecao operacional das APIs e integracoes futuras

| Campo | Valor |
| --- | --- |
| Prioridade | P1 - Alta |
| Area | API e CRM |
| Problema | Contratos estao documentados, mas publicacao futura ainda depende de gestao de segredos, rotacao, rate limit, auditoria e isolamento por consumidor. |
| Impacto | Um token vazado pode expor dados ou gerar consumo inesperado. |
| Conclusao | Segredos fora do repositorio, tokens rotacionaveis, escopos minimos, limites, logs, revogacao e testes de autorizacao implementados antes da abertura externa. |

### TD-013 - Cobertura limitada de aparelhos e navegadores reais

| Campo | Valor |
| --- | --- |
| Prioridade | P2 - Media |
| Area | Compatibilidade |
| Problema | Playwright emula viewport, toque, user agent e rede offline, mas nao reproduz integralmente suspensao do Android, descarte de armazenamento ou Safari real. |
| Impacto | Falhas especificas do aparelho podem escapar da automacao. |
| Conclusao | Matriz minima com Android Chrome e iPhone Safari reais executada antes de releases relevantes, com roteiro e evidencia. |

### TD-014 - Ambiente de desenvolvimento nao conteinerizado

| Campo | Valor |
| --- | --- |
| Prioridade | P2 - Media |
| Area | Ferramentas |
| Problema | Node.js, Java, Firebase CLI e navegadores dependem da configuracao da maquina local. |
| Impacto | Diferencas de versao podem gerar falhas dificeis de reproduzir entre desenvolvimento e CI. |
| Conclusao | Imagem ou `docker compose` reproduzivel inicia emuladores, aplica seeds e executa testes. Docker nao substitui os testes em aparelhos reais. |

### TD-015 - Monitoramento de uso, cota e custo

| Campo | Valor |
| --- | --- |
| Prioridade | P2 - Media |
| Area | Firebase e custos |
| Problema | O consumo esperado esta documentado, mas alertas e limites operacionais ainda precisam ser validados no projeto. |
| Impacto | Loop de leitura, abuso ou crescimento pode elevar consumo sem deteccao rapida. |
| Conclusao | Dashboard, alertas de orcamento/cota e responsavel por resposta configurados e testados. |

## 5. Plano recomendado

### Etapa A - Confiabilidade imediata

1. Implementar E2E conectado ao Auth e Firestore Emulator.
2. Criar `npm run test:full` e tornar o resultado obrigatorio no CI.
3. Cobrir cadastro online, cadastro offline, reabertura, reconexao e agendamento posterior.
4. Registrar erros estruturados e identificadores de correlacao sem dados pessoais.

### Etapa B - Seguranca e operacao

1. Conferir automaticamente regras locais e regras promovidas.
2. Implantar App Check em monitoramento antes do enforcement.
3. Criar homologacao isolada.
4. Definir auditoria, backup, restauracao, retencao e recuperacao administrativa.

### Etapa C - Sustentabilidade

1. Separar gradualmente os fluxos hoje concentrados em `app.js`.
2. Versionar e testar migracoes do IndexedDB e Service Worker.
3. Conteinerizar emuladores e testes quando a automacao integrada estiver estavel.
4. Manter uma rotina de teste em Android e iPhone reais.

## 6. Cenarios minimos da regressao automatizada

- cadastro online sem agendamento;
- cadastro online com agendamento e reserva atomica;
- cadastro offline sem campos de data e horario;
- fechamento e reabertura do PWA ainda offline;
- reconexao sincronizando exatamente um documento;
- agendamento posterior do cadastro sincronizado;
- disputa do mesmo horario por dois usuarios;
- usuario sem permissao tentando criar, editar, excluir e consultar;
- gestor tentando acessar loja nao permitida;
- troca de versao do PWA com cadastro local pendente;
- perda de rede durante gravacao e durante reserva de horario;
- repeticao de 100 ciclos offline e online sem perda ou duplicacao.

## 7. Itens mitigados recentemente

| Item | Evidencia | Estado |
| --- | --- | --- |
| Documento completo excedia 1.000 expressoes das regras e retornava falso erro de permissao | Teste integrado do documento produzido pelo formulario e deploy das regras em 25/10/2026 | Mitigado |
| Autor nao conseguia reagendar e o erro generico escondia limite de expressoes | Regra exclusiva para campos da agenda, avaliacao antecipada de `affectedKeys()` e 78 testes de regras em 27/10/2026 | Mitigado |
| Atualizacao do PWA podia permanecer em espera e ZIP Windows podia omitir `assets` na Hostinger | `autoUpdate`, `skipWaiting`, validacao do chunk publicado e ZIP com caminhos portateis em 27/10/2026 | Mitigado |
| Erro de gravacao limpava o formulario | Formulario preserva os valores e destaca campos invalidos | Mitigado |
| Testes de regras nao faziam parte do workflow do frontend | `npm run test:rules` incluido no GitHub Actions | Mitigado parcialmente; ainda falta E2E integrado |

> **Nota do incidente:** o problema recente foi tecnico: a operacao ultrapassava o limite fixo de **1.000 expressoes avaliadas por requisicao** das regras do Firestore. Esse limite tambem existe no plano pago do Firebase; mudar de plano nao evita essa classe de erro.

## 8. Processo de manutencao

- Toda nova divida recebe identificador, prioridade, impacto e criterio de conclusao.
- Itens mitigados permanecem no historico com a evidencia correspondente.
- Uma regressao grave deve gerar ao menos um teste que falhava antes da correcao.
- Mudancas de prioridade devem registrar a justificativa na revisao do documento.
- O TDD descreve a arquitetura atual; este arquivo registra riscos e trabalho estrutural ainda pendente.
