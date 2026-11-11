# FascinLead - Technical Design Document

| Campo | Valor |
| --- | --- |
| Documento | Technical Design Document (TDD) |
| Projeto | FascinLead |
| Versao | 3.3 |
| Status | Em implementacao |
| Data | 08/11/2026 |
| Responsavel | Oticas Fascinante |

### Manutencao deste documento

- O TDD e a fonte tecnica principal do FascinLead e descreve o comportamento implementado, nao apenas intencoes futuras.
- Toda entrega que altere arquitetura, fluxo offline, autorizacao, modelo de dados, agenda, integracoes, seguranca ou requisitos permanentes deve atualizar este arquivo na mesma alteracao.
- Decisoes ainda nao implementadas devem ser identificadas como proposta ou pendencia; nao podem ser descritas como comportamento atual.
- A versao deve subir quando houver mudanca estrutural. A data deve refletir a ultima revisao funcional relevante.
- Codigo, regras do Firestore e testes prevalecem como evidencia durante auditorias; divergencias encontradas devem ser reconciliadas no TDD antes de concluir a tarefa.
- Riscos estruturais, prioridades e criterios de conclusao sao mantidos no [registro de dividas tecnicas](DIVIDAS-TECNICAS.md).

## 1. Visao geral

O FascinLead e uma aplicacao web progressiva (PWA) para substituir fichas de papel usadas por colaboradores durante a captacao de potenciais clientes na rua.

O sistema permite cadastro rapido e oferece uma capacidade experimental de captacao sem internet, controlada por loja e desativada por padrao. Quando habilitada, os registros pendentes sao sincronizados com a nuvem ao restabelecer a conexao. A reserva de data e horario sempre exige conexao para evitar dupla ocupacao. O produto nao e um CRM completo: seu foco e registrar, consultar, agendar e encaminhar contatos captados para a equipe responsavel.

### 1.1 Objetivos

- Reduzir o tempo gasto no cadastro durante uma abordagem.
- Eliminar perda, rasura e digitacao posterior de fichas em papel.
- Evoluir o uso sem internet de forma controlada, sem comprometer o fluxo online.
- Identificar colaborador, loja, data e origem de cada captacao.
- Centralizar os registros na nuvem quando houver conexao.
- Entregar uma interface simples para celular e instalavel como aplicativo.
- Manter o consumo do Firebase previsivel e dentro das cotas definidas para o piloto, aprovando previamente qualquer recurso faturavel.
- Permitir encaminhamento incremental e seguro dos leads para CRMs externos, sem transformar o FascinLead em CRM.

### 1.2 Fora do escopo

- CRM completo, funil comercial ou automacao de vendas.
- Atendimento ou campanhas pelo WhatsApp.
- Confirmacoes automaticas antes de consultas e exames. O pre-agendamento pode ser consultado na agenda, e faltas confirmadas geram retorno interno para o captador.
- Anamnese, recomendacao de lentes ou provador virtual.
- Metas de vendas, comissoes, faturamento ou conciliacao de vendas permanecem fora da versao atual. A evolucao aprovada para descoberta e implementacao faseada de conversoes e faturamento esta documentada em `docs/PLANO-INTEGRACAO-SAVWIN-E-METAS.md` e nao deve ser tratada como funcionalidade entregue.
- Integracoes de escrita com SavWin, AppOk ou CRMs externos.
- Automacoes, funis e operacao de CRM dentro do FascinLead; a API de saida de leads e uma fronteira de integracao aprovada.
- Envio de notificacoes push na primeira versao.
- Funcionamento como aplicativo nativo publicado nas lojas Android e iOS.

## 2. Usuarios e permissoes

| Perfil | Responsabilidade | Permissoes iniciais |
| --- | --- | --- |
| Colaborador Interno | Atuar no balcao, telemarketing e demais rotinas internas | Criar e corrigir cadastros das unidades permitidas, consultar agenda, registrar comparecimento ou falta e gerenciar encaixes |
| Colaborador Externo | Realizar abordagens externas | Criar, consultar e corrigir os proprios cadastros; realizar retornos, acompanhar metas e consultar a Operacao Externa |
| MEI | Atuar como colaborador externo contratado como MEI | Mesmas permissoes do Colaborador Externo, com dias e cotas de agendamento configuraveis por loja e periodo do dia |
| Gestor | Acompanhar unidades permitidas | Consultar e exportar registros, administrar metas, agenda, relatorios, retornos e Operacao Externa |
| Administrador | Administrar o FascinLead | Todas as permissoes sempre ativas; gerencia acessos, cargos, configuracoes, metas e todos os registros |

Os perfis padrao podem ter permissoes restauradas ao padrao; perfis personalizados possuem nome, alcance (`own` ou `stores`) e permissoes editaveis. O perfil Administrador nao pode perder permissoes. As permissoes sao aplicadas pelas regras do Firestore; ocultar botoes na interface nao substitui a autorizacao no banco.

## 3. Requisitos funcionais

### RF-01 - Autenticacao

- O acesso pode ser feito por e-mail e senha ou por uma conta Google autorizada.
- O primeiro login de um dispositivo exige internet.
- Apenas e-mails previamente autorizados poderao utilizar o sistema.
- A sessao devera permanecer salva no dispositivo para usos posteriores.
- Usuarios inativos deverao perder acesso na proxima verificacao online.
- Contas operacionais criadas pela administracao recebem inicialmente a senha padrao `mudar123`, exceto o administrador; o usuario pode altera-la pelo fluxo de recuperacao de senha.

### RF-02 - Novo cadastro

Campos minimos propostos:

| Campo | Obrigatorio | Regra |
| --- | --- | --- |
| Loja de destino | Sim | Fixa para captador de uma unidade; escolhida entre as unidades permitidas para Administrador, Gestor multi-loja e MEI |
| Nome | Sim | Entre 2 e 120 caracteres |
| Telefone/WhatsApp | Sim | Normalizado para telefone brasileiro |
| RG | Nao | Texto normalizado; placeholder `0.000.000` |
| CPF | Nao | Validado quando informado |
| Data de nascimento | Sim | Data valida, nao futura; calcula a idade para regras de triagem |
| Sexo | Nao | Valor enumerado |
| Apelido | Nao | Ate 60 caracteres |
| Rua e numero | Nao | Numero vazio e normalizado como `S/N` |
| Bairro | Nao | Ate 80 caracteres |
| Cidade | Nao | Ate 80 caracteres |
| UF | Nao | Duas letras; padrao configuravel por loja |
| Tipo de estrategia | Sim | `external`, `after-sales`, `telemarketing`, `social-media` ou `spontaneous-visit` |
| Interesse principal | Nao | Opcao de uma lista administrada pelo sistema |
| Servico | Nao | Servico ativo e disponivel na unidade, com duracao propria |
| Ametropias | Nao | Exibicao configuravel por loja |
| Patologias | Nao | Opcoes clinicas usadas pela triagem |
| Cirurgia nos olhos | Condicional | Obrigatoria a partir da idade configurada; informa o tipo quando a resposta for positiva |
| Tipo do exame | Sim | `paid` ou `courtesy`; o padrao e exame pago |
| Transporte | Nao | Sem transporte ou com transporte; aceita no maximo um acompanhante |
| Data do pre-agendamento | Nao | Data prevista; exige horario quando informada |
| Horario do pre-agendamento | Nao | Horario previsto; exige data quando informado |
| Observacao rapida | Nao | Ate 500 caracteres |

O sistema preenchera automaticamente:

- identificador do registro;
- colaborador responsavel;
- loja de destino escolhida ou vinculada ao colaborador;
- data e hora da captacao no dispositivo;
- origem `rua`;
- versao do esquema e versao do aplicativo.

Receita, fotos e geolocalizacao exata nao fazem parte do MVP. CPF, RG e os dados clinicos estritamente necessarios a triagem foram incorporados e devem receber o mesmo tratamento de seguranca e minimizacao dos demais dados pessoais.

Novos cadastros exigem data de nascimento tanto na interface quanto nas regras do Firestore. Registros legados sem essa informacao continuam consultaveis e podem ser corrigidos ou reagendados; quando a data for informada, ela tambem sera validada nas edicoes.

Novos cadastros tambem exigem o tipo de estrategia. Registros legados sem essa informacao continuam consultaveis e aparecem como `Nao informado` nos indicadores; ao serem editados, exigem a selecao de uma estrategia valida antes do salvamento.

Ao trocar a loja de destino durante um novo cadastro, o formulario preserva os dados pessoais, endereco, interesse, triagem, transporte e observacoes. Data e horario sao limpos porque dependem da agenda da nova unidade; o servico permanece selecionado somente quando tambem estiver disponivel nela.

Quando houver conexao, informar um CEP completo consulta o ViaCEP e preenche rua, bairro, cidade e UF nos formularios de cadastro, edicao e novo agendamento. Os campos permanecem editaveis, o numero do imovel nunca e alterado pela consulta e falhas externas nao bloqueiam o preenchimento manual nem o salvamento offline.

O titular da compra e independente do cliente atendido. Por padrao, a compra fica em nome do proprio cliente; quando outra pessoa for selecionada, o cadastro exige nome e CPF do titular e permite registrar vinculo e telefone. Essa escolha nao substitui os dados pessoais ou clinicos do cliente e permanece disponivel offline.

O valor do exame nao e digitado nem persistido como uma segunda fonte de verdade. A interface e as exportacoes o calculam a partir de `examPaymentType` e do encaminhamento efetivo: optometrista pago custa R$ 150, oftalmologista pago custa R$ 200 e cortesia custa R$ 0. Alterar o encaminhamento recalcula o valor imediatamente.

Quando um CPF valido e informado em um novo cadastro online, o sistema consulta se existe um agendamento ativo vinculado ao documento. Um aviso em texto aparece junto ao CPF assim que a consulta encontra uma data atual ou futura ainda nao encerrada. No salvamento, a consulta e repetida e uma confirmacao explicita pergunta se o usuario deseja criar outro cadastro/agendamento. A ocorrencia nao bloqueia a operacao: continuar permanece uma decisao explicita do usuario. A verificacao nao e executada no modo offline e nao devolve dados pessoais do cadastro encontrado.

### RF-03 - Operacao offline

- O cadastro offline e uma capacidade experimental por loja, desativada por padrao.
- Com a capacidade desativada, novos cadastros exigem conexao.
- Um administrador pode ativar a capacidade em `Configuracoes > Agenda > Cadastro offline`.
- Quando ativa, a capacidade permite salvar somente os dados do lead sem conexao; data e horario ficam ocultos e vazios.
- O lead offline aparece imediatamente em `Meus cadastros` como `Aguardando agendamento`; nao existe uma pagina separada de sincronizacao.
- A sincronizacao confirma somente o cadastro. Ela nao preenche data ou horario e nao cria blocos em `appointmentSlots`.
- A mudanca de conectividade com o formulario aberto nao pode apagar os demais campos preenchidos.
- Desativar a capacidade nao apaga escritas que ja estejam pendentes no cache do Firestore.

### RF-04 - Sincronizacao

A sincronizacao sera tentada:

- automaticamente ao salvar quando houver internet;
- ao abrir o aplicativo;
- quando o navegador disparar o evento `online`;
- quando o aplicativo voltar ao primeiro plano.

`navigator.onLine` e apenas um sinal de interface. A liberacao dos campos da agenda exige um snapshot do servidor (`fromCache === false`) tanto para a configuracao da loja quanto para os compromissos do dia.

O navegador nao garante execucao quando o PWA estiver completamente fechado. Portanto, o sistema nao dependera de Background Sync para cumprir sua funcao principal.

### RF-05 - Meus cadastros

- Listar os registros criados pelo usuario no dispositivo e/ou carregados de sua conta.
- Buscar por nome ou telefone.
- Filtrar por estado de sincronizacao e data.
- Permitir correcao de dados pelo proprio captador.
- Nao permitir exclusao definitiva pelo captador no MVP.

### RF-06 - Visao do gestor

- Consultar registros da loja por periodo e captador.
- Buscar por nome ou telefone.
- Exibir totais por dia e colaborador.
- Exportar CSV detalhado, com uma linha por captacao e somente dados pertencentes ao escopo do FascinLead.
- Permitir que administradores visualizem, corrijam e excluam qualquer lead.
- Manter gestores somente com consulta e exportacao dos leads da propria loja.
- Paginar resultados para evitar leituras desnecessarias no Firestore.

O CSV detalhado inclui identificadores do lead e do captador, dados do cliente, loja, data e hora da captacao, pre-agendamento opcional, tipo e valor calculado do exame, comparecimento, interesse, endereco, origem e observacoes. Nao inclui consentimento, status de funil, etapa de Kanban ou valor de venda, pois esses dados nao sao controlados pelo FascinLead.

Esta tela e administrativa e nao transforma o produto em CRM: nao havera etapas de funil, tarefas comerciais ou historico de atendimento.

### RF-07 - Administracao basica

- Autorizar ou bloquear um e-mail.
- Vincular usuario a uma loja e perfil.
- Permitir que apenas administradores criem ou alterem acessos pela interface.
- Sincronizar perfil, loja e estado entre `allowedEmails` e um usuario que ja realizou o primeiro login.
- Impedir que o administrador bloqueie ou remova o proprio perfil administrativo.
- Manter `oticasfascinantes.financeiro@gmail.com` como conta administradora principal de recuperacao, sempre sujeita ao login Google verificado.
- Ativar ou inativar uma loja.
- Manter a lista de interesses disponiveis no formulario.

O cadastro e o bloqueio de acessos sao feitos na tela `Acessos da equipe`. Lojas e interesses ainda podem ser mantidos diretamente no Firebase Console durante o MVP.

### RF-08 - Metas de captacao

- Administradores podem criar metas de quantidade de leads para captadores de qualquer loja.
- Gestores podem criar metas somente para captadores ativos da propria loja.
- Uma mesma configuracao pode ser atribuida a um ou mais captadores, gerando uma meta individual para cada pessoa.
- Captadores visualizam somente as proprias metas e o proprio progresso.
- Na visao pessoal, os tres indicadores de resumo aparecem no topo e os objetivos atribuidos sao apresentados logo abaixo, sem cabecalho ou acao manual de atualizacao redundantes.
- Gestores visualizam somente metas e desempenho da propria equipe; administradores visualizam todas as lojas.
- O progresso considera somente leads sincronizados, atribuidos ao captador e cuja data de captacao esteja dentro do periodo da meta.
- Metas podem ser excluidas por administradores ou pelo gestor da loja correspondente sem alterar os leads contabilizados.
- Ranking, premiacoes e gamificacao ficam reservados para uma etapa posterior.

### RF-09 - Agenda gerencial de exames

- Gestores e administradores visualizam em calendario mensal os leads que possuem data e horario de pre-agendamento.
- O gestor consulta somente os pre-agendamentos da propria loja.
- O administrador consulta todas as lojas ou filtra pelas lojas 02, 04, 05 e 06.
- Cada dia informa a quantidade de exames e apresenta os detalhes em ordem de horario.
- Enquanto a agenda estiver aberta, novos pre-agendamentos e alteracoes aparecem em tempo real, sem recarregar a pagina.
- Gestores podem marcar cada agendamento como `Compareceu` ou `Nao compareceu`; enquanto nenhuma opcao for escolhida, o estado e `Aguardando`.
- A alteracao de comparecimento registra data e usuario responsavel e nao concede ao gestor permissao para editar os demais dados do lead.
- A agenda reutiliza os campos do lead e nao cria uma segunda fonte de dados.
- Uma falta aparece em `Retornos` para o captador responsavel depois da tolerancia configurada para a loja.
- Quando a automacao da loja estiver ativa, um agendamento ainda sem confirmacao tambem aparece em `Retornos` depois da tolerancia.
- Agendamentos sem confirmacao nao geram retorno automatico quando a chave da loja estiver desativada.
- O retorno oferece uma mensagem pronta no WhatsApp e desaparece quando o cliente e reagendado.
- Ao abrir o WhatsApp, o sistema registra o inicio do contato para o agendamento atual.
- O gestor acompanha, em modo somente leitura, os retornos da propria loja agrupados por captador e o estado de cada contato; o administrador possui a mesma visao para todas as lojas.
- Na visao por captadores, o nome abre um modal com todos os leads daquele captador que ainda aguardam o inicio do contato, mantendo as acoes de WhatsApp e reagendamento.
- A tela inicial oferece o atalho `Confirmacoes` aos perfis que podem consultar a agenda. A tela lista os atendimentos de hoje ate os proximos seis dias, com nome, telefone, profissional, horario e unidade.
- Cada item possui `Abrir WhatsApp`, que abre uma conversa individual com uma mensagem humanizada ja preenchida em nome do usuario conectado. O envio permanece manual e depende da confirmacao da pessoa responsavel pela agenda.
- Depois do envio, a pessoa responsavel usa `Marcar como feito`. A tela separa `Pendentes` e `Feitos` e registra data, usuario e a chave do agendamento atual; um reagendamento futuro volta a ficar pendente automaticamente. Em caso de marcacao acidental, `Desfazer` remove somente essa conclusao e devolve o lembrete para `Pendentes`.
- Esta primeira versao nao usa API oficial ou nao oficial do WhatsApp, nao dispara mensagens em lote e nao registra automaticamente que o cliente confirmou. A abertura do link tambem nao deve ser tratada como comprovante de envio.
- O administrador configura, em `Acessos da equipe`, as unidades permitidas e uma unidade principal para cada acesso. A unidade principal sempre precisa pertencer a lista permitida; quando ela for removida, o sistema assume outra unidade permitida. Somente Administradores recebem automaticamente todas as unidades.
- A consulta e limitada a um mes e a 500 resultados para preservar as cotas gratuitas do Firestore.
- Administradores configuram por loja o modo controlado ou livre, a duracao da consulta e o inicio e fim do expediente.
- O modo controlado e o padrao e oferece ao captador somente intervalos livres que caibam integralmente no expediente.
- Um intervalo ocupado deixa de ser oferecido aos demais captadores assim que o agendamento aparece no Firestore.

### RF-10 - Servicos e reserva por blocos

- Administradores cadastram, editam, ativam, inativam e excluem servicos.
- Cada servico possui nome, duracao em multiplos de 10 minutos e unidades atendidas.
- A agenda usa blocos basicos de 10 minutos. Um servico ocupa a quantidade necessaria de blocos consecutivos.
- O inicio pode ocorrer em qualquer bloco livre no qual o servico caiba integralmente no expediente.
- As cotas contam clientes/agendamentos, nao blocos de tempo.
- Agendamentos anteriores ao modelo por blocos sao preservados e considerados no calculo de ocupacao.

### RF-11 - Configuracao detalhada da agenda

- Cada loja possui escala semanal propria, com dias ativos e horarios de inicio e fim independentes.
- Limites de vagas podem ser configurados por dia da semana, com capacidade diferente em cada dia.
- O cargo MEI pode ser limitado a dias especificos e cotas diferentes para manha e tarde em cada dia.
- A cota consumida e determinada pelo horario do atendimento agendado, nao pelo horario em que o captador realizou o cadastro.
- O alerta de atraso e o limite para sugerir reagendamento sao tempos separados.
- Loja 02 e Loja 06 compartilham a agenda do consultorio de Surubim. Um horario ocupado por qualquer uma das duas lojas fica indisponivel para ambas.
- Loja 04 - Carpina e Loja 05 - Limoeiro permanecem com agendas independentes. O compartilhamento nao altera a loja de destino do lead, sua atribuicao, seus relatorios ou suas permissoes.
- As reservas de Loja 02 e Loja 06 usam a chave de recurso `consultorio-surubim`; a consulta de disponibilidade le os blocos originados pelas duas lojas, inclusive os registros anteriores a esta regra.

### RF-12 - Triagem oftalmologica

- A partir da idade configurada, inicialmente 55 anos, o formulario exige informar se o cliente realizou cirurgia nos olhos.
- Quando a resposta for positiva, o tipo da cirurgia e obrigatorio.
- Catarata informada como patologia ou cirurgia encaminha automaticamente ao oftalmologista, salvo alteracao manual por perfil autorizado.
- A agenda oftalmologica possui escala semanal propria por loja e mostra apenas dias e horarios compativeis.
- Novos criterios clinicos devem ser adicionados por configuracao e validacao, sem espalhar condicionais pela interface.

### RF-13 - Transporte

- O lead informa se precisa de transporte e se levara um acompanhante, limitado a um.
- O consumo de capacidade e representado por `transportSeats`: um assento para o cliente e dois com acompanhante.
- Cada loja configura os dias e horarios em que o transporte esta disponivel.
- Quando o transporte estiver desativado para a loja, os campos de transporte e acompanhante nao aparecem nos fluxos de novo cadastro e novo agendamento.
- Em acessos multi-loja, o formulario aguarda a configuracao da unidade de destino antes de liberar os campos, evitando usar a escala padrao ou a resposta atrasada de outra loja.
- Um agendamento com transporte so pode usar data e intervalo integralmente compativeis com essa escala.
- Loja 02 e Loja 06 compartilham o mesmo transporte de Surubim, incluindo escala e disponibilidade. Uma alteracao nessa configuracao e gravada para as duas lojas.
- Loja 04 - Carpina e Loja 05 - Limoeiro permanecem com configuracoes de transporte independentes.
- Durante a leitura, o sistema combina a configuracao de transporte de Surubim e prefere a configuracao ativa. Isso preserva dados anteriores ate que as duas lojas sejam novamente salvas e fiquem convergentes.
- Capacidade do veiculo, numero minimo de passageiros e fechamento de viagens permanecem pendentes de definicao operacional.

### RF-14 - Relatorios e dashboard

- Perfis autorizados consultam indicadores por periodo, unidade e captador.
- Os relatorios exibem cadastros, agendamentos, comparecimentos, faltas e taxa de comparecimento.
- A analise inclui distribuicao de agendamentos por dia da semana e periodo do dia.
- O dashboard exibe a distribuicao dos cadastros por tipo de estrategia, incluindo `Nao informado` para registros legados.
- O seletor de periodo usa data inicial, data final e aplicacao explicita do intervalo.

### RF-15 - Perfis e permissoes

- O sistema fornece os perfis padrao Colaborador Interno, Colaborador Externo, MEI, Gestor e Administrador.
- Todo perfil operacional fica vinculado a uma ou mais unidades permitidas e possui uma unidade principal usada como contexto inicial.
- Todos os acessos possuem uma unidade principal, escolhida pela administracao e sempre contida em `storeIds`. Para perfis com uma unica unidade permitida, ela e usada automaticamente nos novos cadastros. Para perfis com mais de uma unidade permitida, a pessoa escolhe a loja de destino quando o fluxo exigir essa decisao.
- Gestores podem receber uma ou mais unidades permitidas; quando possuirem mais de uma, escolhem a loja de destino em cada captacao. Se a unidade principal for desmarcada, o sistema usa outra unidade permitida.
- Administradores possuem todas as unidades permitidas. Os demais perfis usam somente as unidades selecionadas em seu acesso.
- Todo lead conserva um unico `storeId`; o vinculo multi-loja pertence ao usuario e nunca torna o lead compartilhado entre lojas.
- Perfis nao administrativos podem ter permissoes ativadas ou desativadas individualmente.
- Perfis personalizados podem ser criados, editados e inativados com nome, alcance e permissoes proprias.
- Os perfis padrao possuem acao de restauracao; Administrador conserva todas as permissoes.
- Dependencias de permissao sao normalizadas, por exemplo relatorios e dashboard exigem acesso a gestao.

### RF-16 - Fila de encaixes

- Gestores, administradores e Colaboradores Internos podem acessar a fila de encaixes das unidades permitidas; Colaborador Externo e MEI nao possuem esse acesso.
- A entrada e acessada pelo atalho `Novo encaixe rapido` na pagina inicial e representa somente clientes presenciais do dia, sem ocupar um horario regular da agenda.
- A pessoa responsavel pode pesquisar pelo nome ou CPF, reutilizar um cadastro existente ou criar o cliente rapidamente sem sair da tela. O cadastro rapido exige nome e telefone; CPF e opcional, e dados clinicos permanecem incompletos ate a complementacao posterior.
- Cada entrada registra unidade, servico, profissional, motivo, observacao opcional, chegada e responsavel pela criacao.
- Um mesmo lead nao pode entrar duas vezes na fila da mesma data. O fluxo de estado permitido e `waiting -> called -> in_service -> completed`, com encerramentos alternativos `gave_up`, `not_accommodated` e `cancelled` que exigem justificativa quando aplicavel.
- Cada criacao e transicao gera um evento imutavel no historico do lead. A fila permanece separada dos horarios regulares e nao cria documentos em `appointmentSlots`.
- Prioridade manual, alerta de risco contra o proximo horario regular, conversao para agendamento futuro e indicadores por periodo permanecem como evolucoes posteriores.

## 4. Requisitos nao funcionais

| Categoria | Requisito |
| --- | --- |
| Plataforma | Chrome/Edge Android como alvo principal; Safari iOS e navegadores desktop como alvos secundarios |
| Responsividade | Interface utilizavel a partir de 360 px de largura |
| Desempenho | Formulario interativo em ate 3 segundos em conexao movel apos o primeiro acesso |
| Gravacao local | Confirmacao visual em ate 1 segundo em aparelho compativel |
| Confiabilidade | Um cadastro confirmado nao pode desaparecer por falha temporaria de rede |
| Acessibilidade | Controles com rotulos, foco visivel, contraste adequado e alvos de toque de pelo menos 44 px |
| Seguranca | Negacao por padrao, menor privilegio e validacao de campos nas regras do Firestore |
| Privacidade | Coleta minima e ausencia de dados pessoais em logs tecnicos |
| Manutencao | JavaScript modular, formatacao automatica e testes dos fluxos criticos |

## 5. Arquitetura implementada

```text
+------------------------------+
| Celular do colaborador       |
|                              |
| HTML + CSS + JavaScript      |
| PWA / Service Worker         |
| Firebase Auth                |
| Firestore SDK + IndexedDB    |
+---------------+--------------+
                |
                | HTTPS, quando online
                v
+------------------------------+
| Firebase                     |
|                              |
| Authentication (Google)      |
| Cloud Firestore              |
| Firebase Hosting             |
| Security Rules               |
+---------------+--------------+
                |
                v
+------------------------------+
| Gestor / Administrador       |
| Consulta e exportacao CSV    |
+------------------------------+
```

### 5.1 Tecnologias

| Camada | Tecnologia | Motivo |
| --- | --- | --- |
| Interface | HTML5, CSS3 e JavaScript ES Modules | Mantem o projeto pequeno e sem framework de UI |
| Ferramentas | Node.js LTS, npm e Vite | Servidor local, empacotamento e build estatico |
| Icones | Lucide | Biblioteca consistente, leve e acessivel |
| PWA | Web App Manifest e Service Worker | Instalacao, cache do app shell e abertura offline |
| Login | Firebase Authentication com Google e E-mail/Senha | Login conhecido, contas operacionais e persistencia de sessao |
| Dados | Cloud Firestore | Persistencia offline no navegador e sincronizacao automatica |
| Hospedagem | Firebase Hosting | HTTPS, CDN e deploy estatico |
| Funcoes protegidas | Firebase Functions callable | Operacoes administrativas e consultas exatas que nao podem depender de leitura ampla do cliente |
| Testes unitarios | Vitest | Integracao simples com o Vite |
| Testes de interface | Playwright | Validacao dos fluxos online, offline e responsivos |
| Testes locais Firebase | Firebase Emulator Suite | Testes sem consumir cota e validacao das regras |

Cloud Run, Storage e extensoes pagas nao fazem parte do MVP. Firebase Functions e usada para operacoes administrativas e consultas protegidas, incluindo pesquisa de agendamentos e verificacao exata de CPF. Sua publicacao exige confirmar previamente o plano e o custo do projeto Firebase.

### 5.2 API de integracao com CRM

O ambiente de desenvolvimento disponibiliza uma API Node local e somente leitura sob `/api/v1`. Ela permite que um CRM consulte leads por pagina, loja e instante da ultima atualizacao. A consulta incremental usa `updatedAtServer`, de modo que correcoes, comparecimento e inicio de retorno reaparecem para o consumidor.

A API nao faz parte do bundle da PWA nem do GitHub Pages. A versao local usa Firebase Admin com Firestore Emulator, Application Default Credentials ou conta de servico mantida fora do repositorio. Uma publicacao futura exigira um backend HTTPS, armazenamento seguro de segredos, rotacao de tokens, limites de requisicao e auditoria; essa publicacao nao sera feita no plano Spark sem decisao explicita sobre custos.

O contrato inicial e versionado em `/api/v1` e documentado em `docs/fascinlead-api.openapi.yaml`. CPF, RG e informacoes de saude ficam excluidos por padrao e exigem habilitacao no servidor e solicitacao explicita do consumidor.

O proxy local do SavWin segue a mesma fronteira: ele existe apenas no servidor de desenvolvimento Vite, depende de credenciais mantidas fora do bundle e alimenta uma consulta experimental no Dashboard. Nem o proxy, nem a API `/api/v1`, nem a fundacao `leadSales` estao disponiveis numa publicacao puramente estatica.

O inventario completo das interfaces de rede esta em `docs/API-CATALOG.md`. O proxy SavWin possui contrato proprio em `docs/savwin-local-proxy.openapi.yaml`; a Callable Function administrativa e documentada no catalogo porque usa o protocolo do Firebase Functions, nao uma rota REST publica. Rotas novas ou alteradas devem atualizar contrato, catalogo, testes e este TDD na mesma entrega.

### 5.3 Canais de publicacao

- `Firebase Hosting`: canal previsto para producao, configurado em `firebase.json`, com regras, indices e Functions publicados separadamente quando aplicavel.
- `GitHub Pages`: demonstracao estatica gerada por `npm run build:pages` e publicada pelo workflow `.github/workflows/deploy-pages.yml` apos os testes unitarios.
- Servidor Vite local: unico canal que inclui os middlewares da API de CRM e do proxy SavWin.

A publicacao do frontend nao publica automaticamente regras, indices ou Functions. Cada artefato deve ser implantado e validado de forma explicita no ambiente correto.

### 5.4 Ponte SavWin de homologacao

A primeira fronteira n8n -> LeadFlow e a Function HTTP `savwinDryRunMatch`. No
estado atual ela e exclusivamente local, somente leitura e aceita apenas
`mode = dry_run`. A execucao exige Firebase Emulator Suite, projeto
`demo-leadflow`, `FIRESTORE_EMULATOR_HOST` e token local; qualquer ambiente
remoto e recusado antes da inicializacao de uma consulta ao Firestore.
O export da rota tambem e condicional ao emulador, portanto ela nao aparece no
manifesto de Functions publicaveis fora desse ambiente.

O contrato recebe no maximo 200 OSs previamente consolidadas pelo n8n. A
Function procura leads por CPF, aplica data, janela e unidade, nao resolve
ambiguidades automaticamente e devolve somente identificadores internos,
estado da correspondencia e totais. Nome e CPF nao aparecem na resposta. Nao
ha escrita, modo `apply`, fallback para projeto remoto ou deploy aprovado.

Como o n8n Cloud nao consegue acessar o emulador em `127.0.0.1`, a validacao
ponta a ponta depende de uma decisao posterior entre tunel temporario
autenticado e projeto separado de homologacao. O projeto de producao nao pode
ser usado como substituto. O contrato operacional e os passos estao em
`docs/PLANO-INTEGRACAO-SAVWIN-E-METAS.md` e `docs/API-CATALOG.md`.

### 5.5 Estrutura atual de diretorios

```text
FASCINLEAD/
|-- .github/
|   `-- workflows/deploy-pages.yml
|-- docs/
|   |-- API-CATALOG.md
|   |-- fascinlead-api.openapi.yaml
|   |-- ORCAMENTO-INFRAESTRUTURA.md
|   |-- TDD.md
|   |-- PLANO-PRE-ATENDIMENTO-CLINICO.md
|   |-- PLANO-SERVICOS-AGENDA.md
|   `-- savwin-local-proxy.openapi.yaml
|-- functions/
|   `-- index.js
|-- public/
|   |-- favicon-32.png
|   |-- apple-touch-icon.png
|   |-- leadflow-logo.png
|   |-- pwa-192.png
|   |-- pwa-512.png
|   `-- LOGO OTICAS FASCINANTE.png
|-- scripts/
|   |-- migrate-appointment-blocks.js
|   |-- migrate-appointment-services.js
|   |-- migrate-captar-schedule.js
|   |-- reset-team-default-password.js
|   `-- sync-captar-team.js
|-- server/
|   |-- fascinlead-api.js
|   |-- lead-api-contract.js
|   `-- savwin-local-proxy.js
|-- src/
|   |-- app/
|   |   |-- app.js
|   |   |-- pwa.js
|   |   `-- router.js
|   |-- firebase/
|   |   |-- auth.js
|   |   `-- client.js
|   |-- services/
|   |   |-- lead-service.js
|   |   |-- schedule-service.js
|   |   |-- service-catalog-service.js
|   |   |-- role-profile-service.js
|   |   `-- demais servicos de dominio
|   |-- styles/
|   |-- utils/
|   `-- main.js
|-- tests/
|   |-- e2e/
|   |-- rules/
|   `-- unit/
|-- firestore.indexes.json
|-- firestore.rules
|-- firebase.json
|-- index.html
|-- package.json
`-- vite.config.js
```

## 6. Experiencia e navegacao

### 6.1 Telas do MVP

1. `Login`: entrar com Google ou e-mail e senha e informar quando a conta nao estiver autorizada.
2. `Inicio`: atalhos, usuario/loja, conectividade e quantidade pendente.
3. `Novo`: formulario curto de cadastro.
4. `Cadastros`: lista pesquisavel dos registros do colaborador.
5. `Gestao`: filtros, totais e exportacao para perfis autorizados.
6. `Dashboard`: indicadores do periodo e consulta local experimental ao SavWin.
7. `Relatorios`: indicadores, agrupamentos por unidade/captador e distribuicoes por dia e periodo do dia.
8. `Acessos`: autorizacao, alteracao de perfil, unidades, telefone, codigo SavWin e bloqueio de usuarios por administradores.
9. `Agenda`: calendario mensal dos pre-agendamentos para gestores e administradores.
10. `Confirmacoes`: lista dos proximos atendimentos e abertura manual do WhatsApp com lembrete preenchido.
11. `Retornos`: faltas vencidas, acesso do captador ao WhatsApp e acompanhamento da equipe pelo gestor.
12. `Metas`: criacao em modal, edicao, duplicacao, exclusao e acompanhamento individual ou da equipe.
13. `Configuracoes`: agenda, servicos, perfis e permissoes, restritos a administradores.
14. `Encaixes`: fila diaria de clientes presenciais, separada da agenda regular e restrita a Colaborador Interno, Gestor e Administrador.

### 6.2 Navegacao mobile

A barra inferior e montada conforme as permissoes. Ela pode exibir `Inicio`, `Novo`, `Cadastros`, `Retornos` e `Gestao`, limitada aos destinos aplicaveis ao perfil. A acao principal `Novo` deve ficar disponivel em um toque para quem possui `leads.create`. O cabecalho identifica a unidade unica, a quantidade de lojas permitidas ou o acesso a todas as unidades.

### 6.3 Estado de conectividade

O selo `Online` ou `Offline` descrevera apenas a conectividade detectada pelo navegador. Ele nao comprova que o Firebase esta acessivel. O resultado real da sincronizacao devera ser mostrado separadamente.

## 7. Modelo de dados

### 7.1 Colecao `stores`

```json
{
  "code": "LOJA_06",
  "name": "Loja 06",
  "defaultCity": "",
  "defaultState": "PE",
  "schedulingMode": "controlled",
  "appointmentDurationMinutes": 20,
  "storeHoursRules": [{ "weekday": 1, "openingTime": "08:00", "closingTime": "18:00" }],
  "noShowGraceMinutes": 5,
  "rescheduleAfterMinutes": 30,
  "automaticPendingFollowUp": false,
  "showAmetropiaFields": false,
  "limitedDaysEnabled": false,
  "limitedDayRules": [{ "weekday": 3, "capacity": 10 }],
  "meiQuotaEnabled": false,
  "meiQuotaRules": [{ "weekday": 3, "morningQuota": 4, "afternoonQuota": 6 }],
  "ophthalmologyRoutingEnabled": true,
  "ophthalmologyMinimumAge": 55,
  "ophthalmologyHoursRules": [{ "weekday": 6, "openingTime": "08:00", "closingTime": "12:00" }],
  "transportEnabled": false,
  "transportHoursRules": [],
  "offlineCaptureEnabled": false,
  "openingTime": "08:00",
  "closingTime": "18:00",
  "active": true,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

#### Reservas de horario em `appointmentSlots`

Cada bloco controlado de 10 minutos possui um documento minimo e deterministico (`slot-{recursoDeAgenda}-{data}-{hora}`), sem nome, telefone ou observacoes. O recurso e `consultorio-surubim` para Loja 02 e Loja 06 e corresponde ao proprio `storeId` para Loja 04 e Loja 05. Um atendimento de 20 minutos reserva dois documentos consecutivos; um de 10 minutos reserva um. Esses blocos sao uma protecao interna: as opcoes visiveis avancam conforme a duracao completa do servico, sem sobreposicao. Assim, um servico de 20 minutos oferece `08:00-08:20`, `08:20-08:40` e assim por diante. Uma reserva existente nao pode ser sobrescrita, evitando dupla ocupacao por captadores simultaneos, inclusive entre as duas lojas de Surubim.

No fluxo online atual, o cadastro e todos os blocos exigidos pelo servico sao gravados no mesmo lote. Se qualquer bloco ja estiver ocupado, o lote inteiro falha e o usuario escolhe outro horario. O cadastro offline nunca inclui data, horario ou documentos em `appointmentSlots`.

```json
{
  "storeId": "loja-06",
  "appointmentDate": "2026-10-20",
  "appointmentTime": "08:00",
  "blockTime": "08:00",
  "durationMinutes": 20,
  "leadId": "uuid-do-lead",
  "capturedByUid": "firebase-uid",
  "createdAt": "Timestamp"
}
```

### 7.2 Colecao `appointmentServices`

```json
{
  "name": "Exame de vista",
  "durationMinutes": 20,
  "storeIds": ["loja-02", "loja-04", "loja-05", "loja-06"],
  "active": true,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Somente servicos ativos e associados a unidade aparecem em novos cadastros. A exclusao remove o servico do catalogo, mas nao apaga o nome e a duracao copiados para leads anteriores.

### 7.3 Colecao `allowedEmails`

O identificador do documento sera o e-mail normalizado em letras minusculas.

```json
{
  "email": "colaborador@exemplo.com",
  "displayName": "Nome do colaborador",
  "role": "captor",
  "roleProfileId": "system-captor",
  "permissions": ["leads.create", "leads.view_own", "leads.edit_own"],
  "storeId": "store-id",
  "storeIds": ["store-id"],
  "phone": "+5581999999999",
  "savwinCode": "codigo-opcional",
  "active": true,
  "createdAt": "Timestamp",
  "createdBy": "uid-admin"
}
```

Essa colecao resolve a autorizacao do primeiro acesso: o e-mail e liberado antes do login, e o usuario autenticado cria seu perfil somente se os dados coincidirem com a autorizacao.

`storeIds` representa as unidades que o usuario pode acessar e usar como destino. `storeId` e a unidade principal de todos os acessos, sempre incluida em `storeIds`; para um acesso de unidade unica, os dois campos coincidem. Administradores recebem todas as unidades em `storeIds`; os demais cargos recebem somente as unidades selecionadas.

### 7.4 Colecao `users`

O identificador do documento sera o UID entregue pelo Firebase Authentication.

```json
{
  "email": "colaborador@exemplo.com",
  "displayName": "Nome do colaborador",
  "photoUrl": "https://...",
  "role": "captor",
  "roleProfileId": "system-captor",
  "permissions": ["leads.create", "leads.view_own", "leads.edit_own"],
  "storeId": "store-id",
  "storeIds": ["store-id"],
  "phone": "+5581999999999",
  "savwinCode": "codigo-opcional",
  "active": true,
  "createdAt": "Timestamp",
  "lastLoginAt": "Timestamp"
}
```

`allowedEmails` e a autorizacao administrativa; `users` e o perfil materializado para o UID autenticado. Alteracoes de cargo, permissoes, unidades e estado sao propagadas para ambos quando o usuario ja realizou o primeiro login. A exclusao de um acesso remove `allowedEmails`, mas inativa o documento historico em `users`.

As regras do Firestore autorizam leitura da agenda e criacao de leads somente quando o `storeId` de destino pertence a `storeIds` do usuario, ou quando o usuario e Administrador. Para a disponibilidade compartilhada, usuarios da Loja 02 ou Loja 06 podem ler os blocos e as configuracoes de agenda da outra unidade de Surubim, sem ampliar seu acesso aos leads ou relatorios da outra loja. A chave compartilhada protege os blocos em `appointmentSlots` contra reservas simultaneas.

### 7.5 Colecao `interests`

```json
{
  "label": "Oculos completo",
  "order": 10,
  "active": true
}
```

### 7.6 Colecao `leads`

O identificador sera um UUID gerado no dispositivo. Isso torna a gravacao idempotente: repetir o envio do mesmo cadastro atualiza o mesmo documento e nao cria outra linha.

```json
{
  "fullName": "Maria da Silva",
  "preferredName": "Maria",
  "phone": "+5581999999999",
  "phoneSearch": "81999999999",
  "customerCpf": "52998224725",
  "customerRg": "1.234.567",
  "birthDate": "1985-04-12",
  "sex": "female",
  "street": "Rua das Flores",
  "streetNumber": "S/N",
  "neighborhood": "Centro",
  "city": "Recife",
  "state": "PE",
  "strategyType": "external",
  "interestId": "oculos-completo",
  "interestLabel": "Oculos completo",
  "appointmentServiceId": "service-id",
  "appointmentServiceName": "Exame de vista",
  "appointmentDurationMinutes": 20,
  "appointmentSchedulingMode": "controlled",
  "appointmentDate": "2026-10-02",
  "appointmentTime": "14:30",
  "appointmentStatus": "scheduled",
  "appointmentAttendance": "pending",
  "appointmentAttendanceUpdatedAt": "Timestamp opcional",
  "appointmentAttendanceUpdatedByUid": "firebase-uid-gestor opcional",
  "appointmentCancelledAtServer": "Timestamp opcional",
  "appointmentCancelledByUid": "firebase-uid opcional",
  "appointmentCancelledByName": "Nome do responsavel opcional",
  "appointmentCancellationReason": "codigo opcional",
  "appointmentCancellationDetails": "texto opcional",
  "notes": "Prefere contato pela manha",
  "ametropiaIds": ["myopia"],
  "pathologyIds": ["cataract"],
  "eyeSurgeryStatus": "yes",
  "eyeSurgeryType": "cataract",
  "careRoute": "ophthalmologist",
  "examPaymentType": "paid",
  "needsTransport": true,
  "hasCompanion": false,
  "transportSeats": 1,
  "source": "street",
  "recordOrigin": "captar_import (opcional; imutavel)",
  "capturedAtClient": "2026-09-28T13:45:00.000Z",
  "createdAtServer": "Timestamp ou null enquanto offline",
  "updatedAtServer": "Timestamp ou null enquanto offline",
  "capturedByUid": "firebase-uid",
  "capturedByName": "Nome do colaborador",
  "storeId": "store-id",
  "installationId": "uuid-da-instalacao",
  "appVersion": "1.0.0",
  "schemaVersion": 1
}
```

`phoneSearch` facilita a busca autorizada, mas nao deve ser exibido como campo separado. Nao sera criada uma chave unica baseada no telefone, pois uma mesma pessoa pode ser abordada legitimamente em momentos diferentes.

`source` descreve o canal operacional da captacao, enquanto `recordOrigin` descreve a procedencia do documento. Os registros trazidos da agenda legada recebem `recordOrigin: "captar_import"`; esse campo e imutavel para usuarios comuns, aparece como marcador visual e sera a referencia para o arquivamento do ciclo anterior. A rotina `mark:captar-leads` reconhece registros legados pelo ID iniciado em `captar-` ou por `installationId: "captar-migration"`, executa em simulacao por padrao e somente grava quando recebe `--apply`.

Para leads captados offline, `appointmentDate` e `appointmentTime` permanecem vazios. A escolha posterior de horario ocorre somente online e cria os documentos correspondentes em `appointmentSlots`.

#### Cancelamento de agendamento

O cancelamento preserva o lead, a data e o horario originalmente registrados. A acao online exige motivo padronizado; para `Outro motivo`, a observacao se torna obrigatoria. A operacao grava `appointmentStatus` e `appointmentAttendance` como `cancelled`, registra ator, data e justificativa, remove os blocos de horario da agenda controlada e acrescenta o evento imutavel `appointment_cancelled` em `leads/{leadId}/history` no mesmo lote atomico. Agendamentos cancelados deixam de aparecer como ativos em agenda, confirmacoes, retornos e alertas de CPF.

O reagendamento formal pode reativar um agendamento cancelado quando o responsavel autorizado escolhe uma nova data ou horario e confirma motivo e observacao. A mesma transacao muda o estado para `scheduled` e `pending`, reserva os novos blocos da agenda e grava `appointment_rescheduled` no historico. As regras rejeitam a simples troca de estado sem os metadados formais e continuam impedindo o reagendamento de um atendimento ja marcado como comparecido.

No envio do cadastro, a interface aguarda a confirmacao da gravacao online antes de limpar o formulario ou informar sucesso. Falhas de validacao preservam os valores digitados, exibem uma mensagem visivel e levam o foco ao primeiro campo invalido. Falhas do Firestore tambem preservam o formulario e mostram uma mensagem de permissao ou conexao; nenhum erro de gravacao deve terminar silenciosamente.

#### Conclusao manual em `appointmentReminders`

Cada documento representa o lembrete concluido para um agendamento especifico. O identificador combina lead, data e horario, permitindo que um reagendamento futuro gere outra pendencia sem apagar o historico anterior.

```json
{
  "leadId": "lead-uuid",
  "storeId": "loja-06",
  "appointmentDate": "2026-10-27",
  "appointmentTime": "14:30",
  "appointmentKey": "2026-10-27|14:30",
  "completedAt": "Timestamp",
  "completedByUid": "firebase-uid",
  "completedByName": "Nome do responsavel",
  "schemaVersion": 1
}
```

Essa colecao evita aumentar a complexidade das regras de atualizacao de `leads`. Apenas administradores e perfis de gestao com `appointments.view` para a unidade podem consultar ou concluir lembretes; a identidade gravada deve coincidir com o usuario autenticado.

### 7.7 Colecao `roleProfiles`

```json
{
  "name": "Analista regional",
  "scope": "stores",
  "baseRole": "manager",
  "permissions": ["management.view", "appointments.view"],
  "system": false,
  "active": true
}
```

Perfis do sistema usam IDs estaveis: `system-captor` para Colaborador Interno, `system-external-leader` para Colaborador Externo, `system-mei`, `system-manager` e `system-admin`. Os IDs antigos `system-telemarketing` e `system-receptionist` sao convertidos automaticamente para Colaborador Interno; `system-supervisor` e convertido para Gestor. Perfis personalizados sao documentos do Firestore. O administrador sempre recebe todas as permissoes conhecidas independentemente do vetor salvo.

O esquema de permissoes atual e a versao 6. `walkins.manage` permite criar, consultar e transicionar a fila de encaixes das unidades permitidas e esta presente em Colaborador Interno, Gestor e Administrador. Colaborador Externo e MEI compartilham as mesmas permissoes e podem consultar a Operacao Externa. Gestor e Administrador tambem possuem essa consulta. A interface aplica o mesmo conjunto de permissoes e as regras do Firestore limitam cada operacao ao cargo e as unidades autorizadas.

A acao de excluir um lead e controlada pela permissao `leads.delete`, disponivel para perfis personalizados de dados proprios e de unidades, e nao pela rota usada para abrir o cadastro. Em qualquer tela de detalhes autorizada, o botao permanece logo abaixo de `Salvar alteracoes` e usa o mesmo modal de confirmacao. O alcance do perfil continua limitando quais leads podem ser visualizados e excluidos. A exclusao definitiva remove no mesmo lote o lead e os blocos reservados em `appointmentSlots`; cadastros ainda exclusivamente locais sao removidos da fila offline.

### 7.8 Colecao `leadSales` - fundacao experimental

O repositorio possui servico e regras para associar, por lead, um CPF e uma venda consultada no SavWin. Essa fundacao ainda nao e importada pela interface principal e nao deve ser tratada como funcionalidade entregue.

```json
{
  "leadId": "uuid-do-lead",
  "storeId": "loja-06",
  "capturedByUid": "firebase-uid",
  "customerCpf": "52998224725",
  "purchaseInterest": true,
  "matchStatus": "interest_registered ou sale_linked",
  "savwinStoreCode": "06",
  "savwinOsNumber": "",
  "savwinSaleCode": "",
  "savwinCustomerCode": "",
  "savwinSaleDate": "2026-10-22",
  "savwinSaleValue": 0,
  "createdByUid": "uid-gestor",
  "createdAt": "Timestamp",
  "updatedByUid": "uid-gestor",
  "updatedAt": "Timestamp",
  "schemaVersion": 1
}
```

Antes de ligar esse recurso a uma tela, devem ser aprovados escopo, base legal, permissao granular, retencao, relatorios e o impacto na afirmacao de que o FascinLead nao realiza conciliacao de vendas.

O modelo de um documento por lead nao comporta adequadamente varias OSs para o mesmo cliente. A evolucao planejada deve consolidar as linhas do SavWin por loja e OS, manter a atribuicao separada da venda e gerar agregados autorizados para leitura. O contrato observado, as regras propostas e as etapas de migracao estao em `docs/PLANO-INTEGRACAO-SAVWIN-E-METAS.md`.

#### 7.8.1 Modelo SavWin protegido de homologacao

Os nomes `savwinSales`, `leadSaleAttributions`, `savwinSyncRuns`,
`captorSalesStats`, `storeCaptorSalesStats` e `savwinReviewCases` ficam reservados para o modelo v1
da integracao. Nao ha endpoint de escrita nem importacao no frontend. Vendas,
atribuicoes e execucoes permanecem integralmente bloqueadas para clientes.

Cada OS usa um ID deterministico derivado de loja e numero da OS. O mesmo ID e
usado na atribuicao, permitindo reprocessar uma venda sem criar duplicatas e
permitindo que um lead receba varias OSs distintas. `savwinSales` nao armazena o
CPF integral: apenas HMAC-SHA-256 com chave externa ao repositorio. A venda e a
decisao de atribuicao permanecem separadas, e resultados sem correspondencia nao
geram documentos de atribuicao.

O gerador puro em `functions/savwin-persistence-plan.js` produz um plano de
escrita para testes e homologacao, mas nao executa o plano. Qualquer futura
fronteira de aplicacao deve continuar restrita ao emulador ate a aprovacao de
retencao, acesso, cancelamentos, reprocessamento e conciliacao financeira.

O executor em `functions/savwin-persistence-executor.js` ainda nao e exportado
como Function ou rota. Ele exige simultaneamente o projeto `demo-leadflow`, um
`FIRESTORE_EMULATOR_HOST` e `SAVWIN_PERSISTENCE_APPLY_MODE=emulator_only`. Cada
execucao possui uma assinatura; repetir o mesmo `runId` e a mesma assinatura e
um `no-op`, enquanto reutilizar o `runId` para outro plano e rejeitado. Uma nova
execucao pode atualizar a mesma OS sem duplica-la. Se uma atribuicao automatica
deixar de ser valida, o documento e marcado como inativo e revogado, preservando
o historico em vez de ser excluido.

Os agregados mensais separam duas bases temporais. `capturedLeads`,
`convertedCapturedLeads` e `conversionRate` usam a coorte de leads captados no
mes; `convertedLeads`, `salesCount`, `netRevenue` e `averageTicket` usam as OSs
vendidas no mes. `averageDaysToFirstConversion` considera somente a primeira OS
ativa de cada lead. Os campos `captureCohortBasis = lead_capture_month` e
`salesBasis = sale_month` tornam essa diferenca explicita no documento.

O calculador e o reconstrutor em `functions/savwin-stats.js` continuam sem rota
publica e exigem as mesmas travas de emulador do executor. Os agregados sao uma
projecao reconstruivel: repetir o calculo substitui o mesmo ID deterministico e
remove apenas agregados obsoletos do periodo recalculado.

`captorSalesStats` e a projecao pessoal, agregada por captador e periodo. Sua
leitura exige usuario ativo, `goals.view_own` e `captorUid` igual ao UID
autenticado; administradores tambem podem ler. Como esse documento pode reunir
mais de uma unidade, ele nunca e usado para a visao gerencial.

`storeCaptorSalesStats` e a projecao gerencial, particionada por `storeId`,
captador e periodo. A coorte de captacao usa `capture_store`, enquanto vendas e
receita usam `sale_store`; os campos `captureStoreBasis` e `salesStoreBasis`
registram essa semantica. Gestores precisam de `dashboard.view` e acesso a
`storeId`; administradores tambem podem ler. Toda escrita nas duas projecoes e
negada pelas Security Rules e permanece exclusiva do reconstrutor protegido.

O SDK cliente consulta essas projecoes somente por
`src/services/sales-stats-service.js`. A consulta pessoal sempre combina
`captorUid == profile.uid`, `period == YYYY-MM` e limite de um documento. A
consulta gerencial sempre combina um unico `storeId` previamente autorizado e
`period == YYYY-MM`. O normalizador devolve apenas os campos publicos do
agregado e descarta qualquer campo inesperado.

O dashboard gerencial integra `storeCaptorSalesStats` apenas quando o filtro
seleciona uma unidade explicita e as datas pertencem ao mesmo mes. Sem loja ou
com intervalo entre meses, a interface exibe orientacao e nao consulta o
Firestore. A secao de homologacao mostra somente vendas conciliadas, receita
liquida, ticket medio e conversao da coorte; nenhum documento individual e
carregado. Mudancas de sessao, permissao, rota, loja ou periodo invalidam o
estado local antes de uma nova consulta autorizada.

O seed local v9 cria exclusivamente no projeto `demo-leadflow` agregados
ficticios por loja para o mes corrente. O smoke E2E autenticado valida que um
gestor consulta somente unidades autorizadas, recebe os totais agregados e nao
ve CPF nem identificadores individuais de OS. Esse caminho usa Auth e Firestore
Emulator; nao possui fallback para projeto Firebase remoto.

As projecoes publicas tambem carregam somente metadados agregados de cobertura:
`coverageStartDate`, `coverageEndDate`, `salesReceived`, `salesEligible`,
`salesReconciled` e `lastSuccessfulSyncAt`. O cliente usa esses campos para
classificar atualidade e completude sem ler `savwinSyncRuns`, que permanece
privada. A interface apresenta a mesma faixa de confiabilidade nas visoes
pessoal e gerencial, sem expor CPF, OS ou itens de venda.

`savwinReviewCases` e uma projecao operacional separada das vendas protegidas.
Cada documento contem apenas `storeId`, `period`, data e valor liquido da venda,
estados de correspondencia e conciliacao, estado da revisao, justificativa,
identidade do revisor, timestamps e versao do esquema. CPF integral, hash de
CPF e numero de OS nao fazem parte desse contrato. Resultados sem atribuicao
criam ou atualizam o caso; uma correspondencia posterior remove a pendencia.
Uma decisao ja concluida e preservada em reprocessamentos enquanto o tipo da
pendencia permanecer igual.

A leitura exige perfil administrador ou gestor ativo com `savwin.review` e
acesso a `storeId`. O servico cliente sempre combina uma loja autorizada,
`period == YYYY-MM` e limite de 200 documentos. A interface oferece filtros por
loja, mes e estado e usa uma representacao responsiva para tabela e cartoes. O
cliente pode alterar somente `reviewStatus`, `reviewReason`, `reviewedByUid` e
`reviewedAt` de um caso `pending`; a decisao deve ser `resolved` ou `dismissed`,
a justificativa deve ter entre 5 e 500 caracteres, o revisor deve ser o usuario
autenticado e o horario deve vir do servidor. Criacao, exclusao, segunda decisao
e alteracao dos campos de origem sao negadas pelas Security Rules.

Os testes de regras, persistencia e navegador usam somente o projeto
`demo-leadflow`, Auth/Firestore Emulator e registros ficticios. Nao existe
deploy, acesso ao Firebase de producao ou consulta ao SavWin real nesse fluxo.

A tela de metas tambem consulta `captorSalesStats` para o proprio UID quando o
perfil possui `goals.view_own`. O resumo mensal pessoal mostra apenas conversao,
quantidade de vendas, receita e ticket medio. Falhas dessa projecao possuem
estado separado e nao impedem a leitura das metas de captacao. O smoke E2E do
captador confirma que CPF e numero de OS nao aparecem na interface.

Para calcular corretamente a coorte, o processo privilegiado deve fornecer ao
calculador todas as atribuicoes ativas potencialmente ligadas aos leads da
coorte, inclusive quando a primeira compra ocorreu em outro mes. Consultar
somente as vendas do mes produziria uma taxa de conversao incompleta e nao e um
modo de uso permitido para essa metrica.

### 7.9 Colecao `accessAuditEvents`

A Callable Function registra redefinicoes administrativas de senha com acao, UID/e-mail do administrador, UID/e-mail do alvo e data do servidor. A colecao nao possui acesso pelo cliente nas regras atuais; leitura e retencao dependem de operacao administrativa pelo Firebase Admin/Console.

### 7.10 Colecao `goals`

Cada documento representa a meta individual de um captador. Uma atribuicao em massa compartilha o mesmo `groupId`, mas cria documentos independentes para preservar autorizacao e leitura simples.

```json
{
  "title": "Meta de captacoes",
  "metric": "leads_captured",
  "targetCount": 20,
  "startDate": "2026-10-01",
  "endDate": "2026-10-31",
  "storeId": "loja-06",
  "assigneeUid": "firebase-uid-captador",
  "assigneeName": "Nome do captador",
  "createdByUid": "firebase-uid-gestor",
  "createdByName": "Nome do gestor",
  "createdAt": "Timestamp",
  "groupId": "uuid-da-atribuicao",
  "schemaVersion": 1
}
```

O progresso nao e gravado no documento. Ele e calculado a partir dos leads sincronizados para evitar contadores divergentes e operacoes privilegiadas no plano Spark.

Uma versao futura podera adicionar metas de conversao e faturamento a partir de agregados conciliados do SavWin. Essa mudanca exige `schemaVersion` novo, compatibilidade com `targetCount`, migracao em `dry-run`, regras de acesso e aceite dos dados antes de alterar a interface oficial de metas. Consulte `docs/PLANO-INTEGRACAO-SAVWIN-E-METAS.md`.

### 7.11 Indices

- `leads`: `capturedByUid ASC, capturedAtClient DESC`.
- `leads`: `storeId ASC, capturedAtClient DESC`.
- `leads`: `storeId ASC, capturedByUid ASC, capturedAtClient DESC`.
- `leads`: `storeId ASC, appointmentDate ASC`.
- `leads`: `storeId ASC, updatedAtServer ASC` para a API incremental.
- `appointmentSlots`: `storeId ASC, appointmentDate ASC`.
- `appointmentReminders`: `storeId ASC, appointmentDate ASC`.
- `appointmentServices`: `storeIds ARRAY_CONTAINS, active ASC`.

### 7.12 Colecao `appointmentWalkIns`

Cada documento representa uma entrada operacional na fila de encaixes da data e do lead. O identificador e deterministico (`{queueDate}__{leadId}`), impedindo uma segunda entrada para o mesmo cliente na mesma data. A colecao nao replica dados pessoais ou clinicos: essas informacoes continuam no documento referenciado em `leads`.

```json
{
  "leadId": "uuid-do-lead",
  "storeId": "loja-06",
  "queueDate": "2026-11-02",
  "serviceId": "service-id",
  "serviceName": "Exame de vista",
  "professionalType": "optometrist",
  "reason": "Cliente presencial solicitou exame imediato",
  "notes": "",
  "status": "waiting",
  "priority": 0,
  "priorityReason": "",
  "arrivedAt": "Timestamp",
  "calledAt": null,
  "startedAt": null,
  "completedAt": null,
  "closedReason": "",
  "convertedAppointmentLeadId": "",
  "createdAt": "Timestamp",
  "createdByUid": "firebase-uid",
  "createdByName": "Nome do usuario",
  "updatedAt": "Timestamp",
  "updatedByUid": "firebase-uid",
  "schemaVersion": 1
}
```

As transicoes de estado sao protegidas pelas regras do Firestore e usam timestamp do servidor. A operacao atual permite `waiting -> called -> in_service -> completed`; tambem permite encerrar como `gave_up`, `not_accommodated` ou `cancelled`, com motivo de encerramento. A fila pode ser filtrada pela unidade permitida e mantem a ordem por prioridade e chegada. A criacao e cada transicao escrevem eventos no subdocumento `leads/{leadId}/history`.

Novos indices somente deverao ser adicionados a partir de consultas reais. Cada tela de gestao deve exigir periodo para evitar consultas amplas.

## 8. Fluxo offline e sincronizacao

### 8.1 Persistencia

O Firestore e inicializado com cache persistente em IndexedDB. Para impedir que uma escrita rejeitada pela nuvem faca o cadastro desaparecer, a aplicacao tambem mantem uma caixa de saida propria em IndexedDB. Quando o cadastro offline estiver habilitado para a loja:

1. O formulario valida e normaliza os dados.
2. O navegador gera um UUID, com alternativa compativel para navegadores moveis que nao exponham `crypto.randomUUID` em origens HTTP.
3. Data e horario sao removidos da gravacao offline.
4. A aplicacao grava o documento na caixa de saida local e o exibe em `Meus cadastros`.
5. Quando houver conexao, a aplicacao envia o mesmo UUID ao Firestore, sem data e horario.
6. A copia local so e removida depois da confirmacao do servidor; o snapshot remoto assume o mesmo item sem causar desaparecimento ou duplicidade visual.
7. Se a nuvem rejeitar a escrita, o cadastro permanece no aparelho com indicacao de falha e sera tentado novamente em uma proxima reconexao.

O agendamento nao opera offline:

1. Sem conexao, data e horario ficam ocultos e vazios.
2. Ao voltar online, o captador abre o cadastro e consulta a disponibilidade atual.
3. A tela de detalhes usa a escala controlada da loja e exibe somente horarios disponiveis; nao transforma o primeiro agendamento em horario livre.
4. O horario escolhido e salvo junto com os blocos de 10 minutos exigidos pelo servico.
5. Se algum bloco estiver ocupado, o lote falha e o usuario deve escolher outro horario.
6. A sincronizacao grava o UUID aleatorio gerado no aparelho sem fazer uma leitura previa do documento inexistente, pois essa leitura e corretamente negada ao captador pelas regras de privacidade. Depois da escrita, uma leitura direta do servidor confirma a autoria antes de remover a copia local. O agendamento e o reagendamento feitos pelo autor gravam o lead e todos os blocos em um lote atomico, sem tentar ler previamente blocos que ainda nao existem; as regras impedem que um bloco ocupado por outro lead seja sobrescrito. Perfis sem `leads.edit_own` enviam somente os campos da agenda, mantendo os demais dados protegidos e evitando que diferencas de normalizacao bloqueiem a operacao.

### 8.2 Estados exibidos

| Estado | Significado | Acao disponivel |
| --- | --- | --- |
| Aguardando agendamento | Cadastro local ou confirmado, ainda sem data e horario | Entrar em contato e agendar quando estiver online |
| Agendado | Cadastro confirmado com data, horario e blocos reservados | Consultar na agenda |

O estado tecnico de sincronizacao e metadado local; nao sera salvo como verdade global dentro do proprio documento. Enquanto a nuvem nao confirmar o documento, a interface prioriza `Pendente de sincronizacao`, `Sincronizando` ou `Nao sincronizado`. `Aguardando agendamento` so pode ser exibido depois da confirmacao no servidor.

Enquanto o formulario de nova captacao estiver aberto, uma mudanca de conectividade atualiza somente o aviso e os controles da agenda, preservando os demais campos preenchidos.

### 8.3 Processamento automatico da caixa de saida

Ao detectar conexao, o aplicativo envia os cadastros locais do usuario autenticado em uma unica execucao de sincronizacao e aguarda a confirmacao individual. Depois da gravacao, uma leitura direta do servidor deve comprovar que o documento existe no Firestore e pertence ao mesmo usuario antes de remove-lo da caixa de saida. Chamadas simultaneas sao consolidadas e a aplicacao nao reinicia a rede do Firestore quando o navegador ja esta online. Falhas permanecem na caixa de saida para nova tentativa; nao existe mensagem de sucesso antes dessa confirmacao.

Depois de confirmado, o cadastro passa a ser consultavel em outros dispositivos. O autor continua vendo os proprios registros; administradores podem listar, editar e excluir qualquer cadastro, e gestores acessam os registros das lojas autorizadas pelo painel de gestao.

### 8.4 Conflitos

Edicoes comuns do mesmo documento usam a ultima alteracao aceita. Reservas de agenda nao usam `ultima escrita vence`: documentos deterministicos de `appointmentSlots` impedem sobrescrever blocos ocupados. Como a reserva exige conexao, o cadastro offline nunca cria ou disputa blocos da agenda.

Transporte, escala da loja, agenda oftalmologica, limite diario e cotas do MEI sao validados novamente no momento da escolha do horario. A interface filtra opcoes, enquanto regras e lotes do Firestore protegem a disputa entre dispositivos.

### 8.5 Duplicidade

- Antes de salvar, o aplicativo alertara se encontrar o mesmo telefone nos registros locais recentes.
- O aviso nao bloqueara a captacao.
- O gestor podera identificar repeticoes na consulta centralizada.
- Nao sera feita uma leitura global a cada digitacao, preservando privacidade, operacao offline e cota gratuita.

## 9. PWA e cache

### 9.1 App shell

O Service Worker gerado pelo `vite-plugin-pwa` precacheia os artefatos versionados produzidos no build e usa `index.html` como fallback de navegacao. Isso permite reabrir o app shell ja instalado sem rede.

Novas versoes do Service Worker ativam automaticamente os caches atualizados. Uma aba que ja esteja aberta exibe a acao `Atualizar agora` antes de recarregar, evitando interromper silenciosamente um formulario em preenchimento; ao fechar e abrir o aplicativo, a versao ativa mais recente passa a ser usada.

- HTML principal e chunks versionados de CSS e JavaScript;
- favicon e demais ativos incluidos no build;
- manifest da PWA.

Dados dos clientes permanecerao sob responsabilidade do cache persistente do Firestore, sem duplicacao no Cache Storage.

### 9.2 Estrategias de cache

| Recurso | Estrategia |
| --- | --- |
| Arquivos e ativos versionados do build | Precache gerenciado pelo Workbox |
| Navegacao da SPA | Fallback para `index.html` precacheado |
| Recursos externos em tempo de execucao | Sem regra customizada de `runtimeCaching` |
| Firestore e Authentication | SDK oficial; nao interceptar no Service Worker |

O registro usa o modo `autoUpdate` com `skipWaiting` ativado, evitando que uma versao nova permaneca indefinidamente em espera. Quando uma aba ja aberta precisa recarregar, o aplicativo apresenta `Atualizar agora`; fechar e abrir o aplicativo tambem passa a usar a versao ativa mais recente.

## 10. Autenticacao e autorizacao

### 10.1 Primeiro acesso

1. O administrador cadastra o e-mail em `allowedEmails`.
2. O colaborador acessa online com Google ou e-mail e senha.
3. O sistema exige e-mail verificado e consulta a autorizacao.
4. O perfil em `users/{uid}` e criado com os mesmos `role` e `storeId` autorizados.
5. A sessao passa a ser persistida no navegador.

O login Google usara popup em computadores e celulares. No GitHub Pages, o redirecionamento entre dominios pode perder o estado da autenticacao por restricoes modernas de armazenamento do navegador. Em navegadores internos de outros aplicativos, a interface orientara abrir o FascinLead diretamente no Chrome ou Safari quando o popup for bloqueado.

No fluxo por senha, a administracao salva primeiro a autorizacao e depois tenta criar a conta em uma instancia secundaria do Firebase Authentication, preservando a sessao do administrador. Contas operacionais recebem `mudar123`; administradores exigem senha propria. O Firebase envia verificacao de e-mail. Se a conta ja existir ou a criacao falhar, a autorizacao permanece salva e a interface mostra um aviso para tratamento manual.

O backend inclui a Callable Function `updateTeamMemberPassword`, protegida pela validacao do administrador, com revogacao de sessoes e auditoria. Ela ainda nao esta conectada a um comando da interface principal; no estado atual, recuperacao individual usa o e-mail do Firebase Authentication e redefinicoes em massa usam o script administrativo documentado na implantacao.

### 10.2 Principios das regras do Firestore

- Negar qualquer operacao nao autorizada explicitamente.
- Exigir usuario autenticado, verificado, ativo e previamente autorizado.
- Captador cria registros apenas com seu proprio UID e sua loja.
- Captador le e altera apenas registros proprios.
- Gestor le registros apenas das unidades permitidas em `storeIds`.
- Administrador acessa todas as lojas e configuracoes.
- Permissoes granulares complementam `role` e `roleProfileId`; nenhuma permissao de interface amplia o que as regras autorizam.
- Blocos de agenda somente podem ser criados para um lead e uma unidade permitidos e nao podem substituir uma reserva existente.
- Nenhum cliente pode elevar seu proprio perfil, trocar `storeId` ou alterar `role`.
- Validar chaves permitidas e os campos de seguranca e consistencia no Firestore; validacoes de apresentacao e textos derivados permanecem no dominio para que uma criacao completa nao ultrapasse o limite de 1.000 expressoes das regras.
- Permitir exclusao definitiva de `leads` somente para perfis com `leads.delete`, respeitando autoria ou unidades permitidas; o administrador possui essa permissao globalmente.
- Correcoes administrativas de leads podem alterar somente os campos editaveis; `capturedByUid`, `storeId` e `createdAtServer` permanecem imutaveis. Essa rota evita revalidar integralmente documentos legados para nao ultrapassar o limite de 1.000 expressoes das regras do Firestore.
- Captadores leem apenas suas metas; gestores leem e administram metas da propria loja; administradores administram todas.

Testes automatizados de regras serao obrigatorios antes do deploy.

## 11. Seguranca e privacidade

### 11.1 Controles tecnicos

- HTTPS obrigatorio pelo Firebase Hosting.
- Content Security Policy restrita aos dominios necessarios.
- Configuracao do Firebase separada por ambiente.
- Nenhum segredo administrativo, chave privada ou conta de servico no frontend.
- Tokens da API e credenciais administrativas existem apenas no processo servidor, nunca no bundle ou em URLs.
- A API externa e negada por padrao, exige Bearer token e nao libera campos sensiveis sem configuracao dupla.
- Nenhum dado pessoal em `console.log`, telemetria ou mensagens tecnicas.
- Dependencias atualizadas e auditadas com `npm audit`.
- Firebase App Check sera avaliado apos o MVP, sem ser requisito de lancamento.

A chave web publica do Firebase identifica o projeto, mas nao concede acesso administrativo. As regras do Firestore e a autorizacao dos usuarios formam a barreira efetiva contra acesso indevido.

### 11.2 LGPD e operacao

- Coletar apenas dados necessarios a captacao, pre-agendamento, transporte e triagem aprovada.
- CPF, RG, patologias, ametropias e historico cirurgico sao dados pessoais ou sensiveis e exigem acesso restrito, finalidade definida e revisao periodica da necessidade.
- Definir responsavel interno por solicitacoes de acesso, correcao e exclusao.
- Definir prazo de retencao antes da producao; proposta inicial: revisar ou excluir cadastros sem evolucao apos 180 dias.
- Orientar usuarios a protegerem o aparelho com senha ou biometria.
- Disponibilizar comando de sair e procedimento para revogar aparelhos perdidos.

O FascinLead nao registra um campo especifico de consentimento. A empresa deve validar a base legal aplicavel ao tratamento dos contatos e definir o prazo de retencao antes do uso real.

## 12. Uso e custo do Firebase

O aplicativo principal continua desenhado para baixo consumo de Authentication, Firestore e Hosting. Segundo a documentacao oficial consultada em setembro de 2026, esses produtos possuem cotas gratuitas sujeitas a alteracoes do Firebase. Os numeros devem ser revistos antes de cada implantacao, em vez de serem tratados como contrato permanente neste documento.

A Callable Function de redefinicao administrativa de senha e uma excecao ao frontend estatico. Antes de publica-la, a equipe deve confirmar os requisitos atuais de faturamento, definir alertas de custo e limitar seu uso a administradores autenticados. Sem essa funcao publicada, captacao, sincronizacao, agenda e gestao de dados continuam operacionais; apenas a troca administrativa direta de senha fica indisponivel.

Medidas para controlar consumo:

- nao manter listeners em tempo real sobre toda a base;
- limitar listas e usar paginacao;
- exigir periodo nas consultas gerenciais;
- carregar apenas campos e documentos necessarios;
- evitar consultas repetidas a cada tecla;
- executar desenvolvimento com Emulator Suite;
- acompanhar consumo no Firebase Console;
- nao habilitar produtos que exijam faturamento sem aprovacao formal.

No Spark, atingir uma cota pode interromper aquele recurso ate o fim do periodo aplicavel. O limite deve ser monitorado desde o piloto.

### 12.1 Limites atuais de consulta

| Fluxo | Limite defensivo atual |
| --- | --- |
| Gestao, Dashboard e Relatorios | 300 leads por consulta |
| Agenda mensal | 500 agendamentos |
| Retornos da equipe | 500 leads elegiveis |
| Calculo de progresso das metas | 1.000 leads |
| Lista local de cadastros do captador | 100 leads |
| API `/api/v1/leads` | ate 100 itens por pagina |

Quando uma consulta de interface atinge o limite, a tela deve sinalizar truncamento e orientar a reducao do periodo. Esses valores sao protecoes operacionais, nao capacidades contratadas, e podem ser revistos junto com paginacao, volume e custo.

## 13. Tratamento de erros

| Situacao | Comportamento esperado |
| --- | --- |
| Sem internet ao abrir pela primeira vez | Explicar que o primeiro acesso requer conexao |
| Conta nao autorizada | Bloquear dados e orientar contato com o administrador |
| Falha ao salvar localmente | Nao limpar o formulario e exibir acao para tentar novamente |
| Permissao revogada | Bloquear novas operacoes e encerrar dados protegidos da sessao |
| Quota Firebase excedida | Preservar pendencias locais e informar indisponibilidade temporaria |
| Nova versao disponivel | Oferecer atualizacao sem descartar formulario ou escrita pendente |
| Cache do navegador indisponivel | Alertar que o modo offline nao esta garantido naquele dispositivo |

Mensagens ao usuario devem ser simples e acionaveis. Detalhes tecnicos podem usar codigos internos sem incluir dados pessoais.

## 14. Testes

### 14.1 Unitarios

- normalizacao e validacao de telefone;
- validacao e serializacao do formulario;
- filtros de busca;
- estados de sincronizacao;
- geracao e escapamento do CSV;
- verificacao de permissoes na interface.
- calculo de blocos consecutivos, escalas semanais e duracao por servico;
- limites diarios e cotas do MEI por manha e tarde;
- triagem oftalmologica, transporte e retornos;
- serializacao de leads pendentes sem data e horario;
- normalizacao do sinalizador de cadastro offline, desativado por padrao.
- origem de registro importado do Captar e compatibilidade com documentos legados identificados por migracao;
- estados, validacao e apresentacao da fila de encaixes, incluindo o cadastro rapido presencial.

### 14.2 Regras e integracao

- usuario nao autorizado nao cria perfil;
- captador nao acessa registro de outro captador;
- gestor nao acessa outra loja;
- usuario nao altera seu perfil ou papel;
- lead invalido e rejeitado;
- documento completo produzido pelo formulario, com reserva atomica, e aceito sem exceder o limite de expressoes das regras;
- UUID repetido nao cria duplicata;
- cadastro offline e rejeitado pela interface quando a capacidade da loja esta desativada;
- lead offline habilitado e aceito sem data, horario ou reserva;
- reserva concorrente nao sobrescreve blocos ocupados e nao remove o lead;
- administrador conserva todas as permissoes e demais perfis respeitam o escopo configurado;
- API rejeita token ausente ou invalido;
- API pagina os leads e valida filtros, lojas e cursores;
- CPF e informacoes de saude nao aparecem na resposta padrao.
- fila de encaixes aceita somente perfis e transicoes permitidos para a unidade do usuario.

### 14.3 Ponta a ponta

- primeiro login online;
- instalacao do PWA;
- cadastro online;
- bloqueio do cadastro offline por padrao;
- cadastro e consulta offline quando a capacidade da loja estiver ativa;
- data e horario bloqueados quando a agenda nao foi confirmada pelo servidor;
- cadastro offline exibido diretamente em `Meus cadastros`, sem rota `Sync`;
- disputa de horario entre dispositivos preserva o lead perdedor;
- retorno da conexao e confirmacao da sincronizacao;
- correcao de cadastro pendente;
- busca por nome e telefone;
- exportacao do gestor;
- sessao expirada ou acesso revogado;
- layout em 360 x 800, 390 x 844, tablet e desktop.
- fluxo de encaixe com cliente existente e com cadastro rapido presencial.

### 14.4 Criterios para piloto

- zero perda em 100 ciclos automatizados de cadastro offline e reconexao;
- regras do Firestore com todos os testes aprovados;
- Lighthouse PWA sem erros impeditivos;
- fluxo principal aprovado em ao menos um Android e um iPhone reais;
- nenhum dado pessoal exposto em logs, URLs ou mensagens de erro.

## 15. Implantacao

### 15.1 Ambientes

- Desenvolvimento: Firebase Emulator Suite.
- Producao: um projeto Firebase exclusivo para o FascinLead.

Um projeto de homologacao separado e desejavel quando o volume ou a equipe aumentar. Para o MVP, o emulador evita custo e mistura de dados.

### 15.2 Configuracao inicial

1. Criar projeto Firebase da empresa.
2. Escolher a localizacao do Firestore mais adequada antes de criar o banco; essa decisao nao deve ser tratada como facilmente reversivel.
3. Habilitar os provedores Google e E-mail/Senha no Authentication.
4. Configurar dominios autorizados.
5. Criar Firestore e publicar regras e indices.
6. Configurar Firebase Hosting e cabecalhos de seguranca.
7. Cadastrar lojas e os primeiros administradores.
8. Quando a redefinicao administrativa de senha for usada, publicar a Callable Function e validar plano, regiao e custo.
9. Executar testes e publicar o build estatico.

### 15.3 Deploy

O deploy completo pode ser executado manualmente pelo Firebase CLI. O repositorio tambem possui GitHub Actions para publicar somente o frontend estatico no GitHub Pages quando houver `push` na `main` ou disparo manual. O workflow instala dependencias, executa os testes unitarios e de regras do Firestore, valida a configuracao Firebase e gera o build com a base `/FASCINLEAD/`.

Rules, indices e Callable Functions nao fazem parte desse workflow estatico. A promocao para producao deve executar os testes de regras, revisar o projeto Firebase selecionado e publicar esses componentes separadamente.

Evolucoes da integracao SavWin e do sistema de metas devem ser desenvolvidas em branch separada da versao oficial, validadas em homologacao e congeladas como release candidate. A producao so recebe uma candidata aprovada depois dos testes funcionais, de permissao, privacidade, idempotencia e conciliacao. Frontend, regras, indices, Functions e workflows n8n possuem publicacoes independentes e devem ter suas versoes compativeis registradas no checklist da release. O procedimento detalhado esta em `docs/PLANO-INTEGRACAO-SAVWIN-E-METAS.md`.

### 15.4 Migracoes e rotinas administrativas

| Comando | Finalidade |
| --- | --- |
| `npm run migrate:appointment-services` | Preencher o servico de agendamento em registros anteriores |
| `npm run migrate:appointment-blocks` | Converter agendamentos existentes para reservas em blocos de 10 minutos |
| `npm run migrate:captar` | Importar agenda do Captar para o FascinLead |
| `npm run mark:captar-leads` | Identificar os leads legados importados do Captar; use `-- --apply` somente apos revisar a simulacao |
| `npm run sync:captar-team` | Sincronizar membros da equipe do Captar com os acessos autorizados |
| `npm run reset:team-passwords` | Aplicar a senha inicial aos usuarios nao administradores existentes |

Todos esses scripts iniciam em `dry-run` e somente gravam com `--apply`. Eles exigem autenticacao previa no Firebase CLI; as rotinas que consultam o Captar tambem exigem suas variaveis de ambiente e usam Playwright. Antes de aplicar em producao, deve-se revisar o resumo do `dry-run`, confirmar o projeto Firebase, garantir backup/exportacao recente e evitar execucoes concorrentes. O reset de senhas revoga sessoes existentes e nunca deve atingir administradores.

## 16. Observabilidade e suporte

- Exibir versao do aplicativo e hora da ultima sincronizacao na tela de suporte.
- Exibir quantidade de itens pendentes e com erro.
- Registrar apenas eventos tecnicos anonimizados no navegador durante o MVP.
- Monitorar Authentication, Firestore e Hosting pelo Firebase Console.
- Criar procedimento de suporte para exportar codigo de erro, sem exportar dados do cliente.
- Manter rotina de backup/exportacao definida antes de ampliar o piloto.

### 16.1 Limitacoes tecnicas conhecidas

- O navegador nao garante sincronizacao com o PWA fechado; pendencias sao retomadas quando o aplicativo volta ao primeiro plano.
- O selo de conectividade reflete o navegador, enquanto agenda e reservas dependem de leitura confirmada pelo servidor.
- Uma publicacao estatica nao oferece a API de CRM nem o proxy SavWin local.
- A Callable Function de senha existe no backend, mas ainda nao possui acao correspondente na interface principal.
- As consultas gerenciais atuais usam limites defensivos e podem exigir periodos menores ate que todos os fluxos tenham paginacao completa.
- Capacidade e fechamento de viagens de transporte continuam desabilitados ate a definicao das regras operacionais.

## 17. Plano de entrega

### Fase 1 - Fundacao

- estrutura Vite e identidade visual;
- PWA instalavel e app shell offline;
- Firebase Emulator Suite;
- login Google ou E-mail/Senha e autorizacao por e-mail;
- regras iniciais do Firestore.

### Fase 2 - Captacao offline

- formulario curto;
- persistencia offline;
- lista `Meus cadastros`;
- estados e acao de sincronizacao;
- testes unitarios, de regras e offline.

### Fase 3 - Gestao

- filtros por loja, colaborador e periodo;
- indicadores simples de quantidade;
- exportacao CSV;
- administracao minima de acessos.
- metas individuais de quantidade de leads com visibilidade por equipe.

### Fase 4 - Piloto

- uso com um grupo pequeno de colaboradores;
- teste em areas com conectividade ruim;
- ajuste de campos e linguagem;
- avaliacao das cotas do Firebase;
- decisao de liberar para todas as lojas.

## 18. Criterios de aceitacao do MVP

O MVP estara apto para piloto quando:

1. Um usuario autorizado e com e-mail verificado conseguir entrar com Google ou e-mail e senha.
2. Um captador conseguir cadastrar um cliente sem internet.
3. O registro permanecer no aparelho depois de fechar e reabrir o PWA.
4. O registro sincronizar sem duplicacao quando a internet voltar.
5. O captador conseguir pesquisar e corrigir os proprios registros.
6. O gestor conseguir consultar apenas sua loja e exportar CSV.
7. Um usuario de outra loja nao conseguir acessar os dados pelas APIs do Firestore.
8. O aplicativo informar claramente conectividade, pendencias e erros.
9. O fluxo funcionar em celular Android e iPhone reais.
10. Nenhum recurso faturavel estiver publicado sem aprovacao formal, limite de acesso e alerta de custo.

## 19. Decisoes arquiteturais

| ID | Decisao | Justificativa |
| --- | --- | --- |
| ADR-001 | Usar PWA, nao aplicativo nativo | Distribuicao simples e um unico codigo para celulares e desktop |
| ADR-002 | Usar JavaScript sem framework de UI | Escopo pequeno, menor peso e menor curva de manutencao |
| ADR-003 | Usar Firestore como armazenamento local e remoto | SDK oferece cache persistente e sincronizacao offline |
| ADR-004 | Manter o aplicativo principal sem backend obrigatorio | Captacao, operacao offline e telas continuam independentes da API de integracao |
| ADR-005 | Autorizar e-mails antes do primeiro acesso | Login Google sozinho nao restringe contas a colaboradores |
| ADR-006 | Coletar CPF e RG apenas como campos opcionais | Atende a operacao sem bloquear a captacao e exige tratamento reforcado de privacidade |
| ADR-007 | Nao depender de sincronizacao em segundo plano | Navegadores, especialmente no iOS, nao garantem execucao com o app fechado |
| ADR-008 | Gerar UUID no dispositivo | Permite salvar offline e repetir o envio sem duplicar o documento |
| ADR-009 | Usar `#003070` como cor principal | E a cor oficial informada para a marca Oticas Fascinante |
| ADR-010 | Disponibilizar Loja 02 - Surubim, Loja 04 - Carpina, Loja 05 - Limoeiro e Loja 06 - Surubim | Sao as unidades e cidades definidas para a operacao inicial do FascinLead |
| ADR-011 | Registrar pre-agendamento opcional e exportar CSV detalhado | Permite encaminhar a captacao com contexto util sem transformar o produto em CRM |
| ADR-012 | Nao solicitar nem exportar um campo de consentimento | O fornecimento dos dados durante a captacao sera tratado operacionalmente sem uma confirmacao separada no formulario |
| ADR-013 | Permitir edicao e exclusao global de leads somente para administradores | Viabiliza correcao operacional e remocao de registros sem ampliar o poder dos gestores ou captadores |
| ADR-014 | Modelar atribuicoes em massa como uma meta individual por captador | Simplifica as regras por usuario, preserva a visibilidade por loja e prepara o progresso para futura gamificacao |
| ADR-015 | Derivar a agenda mensal dos leads e proteger horarios com `appointmentSlots` | Evita duplicar os dados do cliente e separa a visao operacional da reserva atomica dos blocos |
| ADR-016 | Configurar intervalos de atendimento no documento da loja | Mantem regras diferentes por unidade e permite calcular os horarios livres sem duplicar a agenda |
| ADR-017 | Expor uma API versionada e somente leitura para CRMs | Separa captacao de operacao comercial, permite sincronizacao incremental e preserva um contrato estavel |
| ADR-018 | Usar blocos atomicos de 10 minutos para a agenda | Permite combinar servicos com duracoes diferentes e impedir sobreposicoes parciais |
| ADR-019 | Nao permitir reservar agenda offline | Disponibilidade, transporte, cotas e escalas dependem do estado atual do servidor |
| ADR-020 | Persistir o lead antes de reservar os blocos | Uma disputa de horario pode falhar sem apagar os dados captados |
| ADR-021 | Exigir snapshot do servidor para liberar data e horario | `navigator.onLine` pode indicar rede local sem acesso real ao Firebase |
| ADR-022 | Modelar autorizacao com perfis e permissoes granulares | Permite cargos personalizados sem multiplicar papeis fixos nas regras e na interface |
| ADR-023 | Manter Administrador com todas as permissoes | Evita bloquear acidentalmente a administracao e a recuperacao operacional |
| ADR-024 | Separar escala da loja, oftalmologista e transporte | Cada recurso possui disponibilidade semanal independente e precisa |
| ADR-025 | Separar unidades permitidas do usuario e loja de destino do lead | Suporta gestores multi-loja e MEI externo sem perder o isolamento e a atribuicao operacional de cada captacao |
| ADR-026 | Compartilhar agenda do consultorio e transporte entre Loja 02 e Loja 06 | As duas unidades ficam em Surubim e utilizam os mesmos recursos; Loja 04 e Loja 05 permanecem independentes |
| ADR-027 | Modelar encaixes como uma fila diaria separada | Preserva a agenda regular e seus blocos de reserva, enquanto registra clientes presenciais, seus estados e a auditoria operacional sem inventar horarios |

## 20. Pendencias de produto e operacao

- As ideias de historico do lead, deteccao de duplicidade, confirmacao de agendamento, motivos de perda, lista de espera, alertas de capacidade e busca global estao registradas no [plano futuro de evolucoes operacionais](PLANO-EVOLUCOES-OPERACIONAIS.md). Elas nao representam funcionalidades implementadas.
- Qual sera o prazo definitivo de retencao e exclusao?
- Qual e a capacidade de passageiros de cada veiculo?
- Qual e o numero minimo de leads para fechar uma viagem e qual acao ocorre quando esse minimo nao e atingido?
- Havera mais patologias ou cirurgias que encaminham obrigatoriamente ao oftalmologista?
- A senha inicial padrao devera ser substituida futuramente por convite ou senha temporaria de uso unico?
- Qual sera a estrategia definitiva de hospedagem e custo da API local e da Callable Function?
- Quais alertas, auditoria e backups serao exigidos antes do piloto ampliado?

Essas decisoes nao impedem a evolucao tecnica, mas devem ser respondidas antes do uso ampliado com dados reais.

## 21. Referencias tecnicas

- [Firebase Authentication com Google](https://firebase.google.com/docs/auth/web/google-signin)
- [Acesso offline do Cloud Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Precos e cotas do Cloud Firestore](https://firebase.google.com/docs/firestore/pricing)
- [Planos de faturamento do Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Precos dos produtos Firebase](https://firebase.google.com/pricing)

As cotas e condicoes comerciais devem ser verificadas novamente no inicio da implantacao, pois podem mudar.
