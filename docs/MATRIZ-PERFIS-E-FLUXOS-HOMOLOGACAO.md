# Matriz de perfis e fluxos de homologacao

## Objetivo

Este documento registra o comportamento da versao funcional usada como base da
homologacao. Ele nao concede novas permissoes e nao substitui as regras do
Firestore. Seu objetivo e transformar o comportamento atual em um contrato para
os proximos seeds e testes automatizados.

O codigo funcional corresponde ao baseline de producao `a2d90e1`. Os commits
posteriores da branch `chore/docker-homologacao` adicionam somente documentacao
e infraestrutura de desenvolvimento.

## Fontes de verdade auditadas

- `functions/system-role-profiles.json`: permissoes padrao dos perfis;
- `src/utils/role-profile.js`: normalizacao e verificacoes da interface;
- `firestore.rules`: autorizacao efetiva dos dados;
- `tests/unit/role-profile.test.js`: contrato unitario dos perfis;
- `tests/rules/*.rules.test.js`: cobertura atual das regras;
- `docs/TDD.md`: comportamento de negocio aprovado.

Em caso de divergencia, a regra publicada no Firestore decide se a operacao e
aceita. A interface nunca deve ser tratada como barreira de seguranca.

## Perfis padrao

| Perfil | ID | Papel base | Escopo |
| --- | --- | --- | --- |
| Colaborador | `system-captor` | `captor` | Proprios dados |
| MEI | `system-mei` | `captor` | Proprios dados |
| Gestor de Unidades | `system-manager` | `manager` | Unidades permitidas |
| Telemarketing | `system-telemarketing` | `manager` | Unidades permitidas |
| Atendente Balcao | `system-receptionist` | `manager` | Unidades permitidas |
| Administrador | `system-admin` | `admin` | Todas as unidades |

Todos os perfis precisam de usuario autenticado, e-mail verificado, documento
ativo em `users/{uid}` e unidades coerentes com `storeId` e `storeIds`.

## Permissoes padrao

### Colaborador e MEI

- `leads.create`;
- `leads.view_own`;
- `leads.edit_own`;
- `appointments.cancel` para agendamentos proprios;
- `followups.own`;
- `goals.view_own`.

MEI usa as mesmas permissoes do Colaborador. As diferencas de agenda sao
configuracoes de dias e cotas, nao ampliacao de acesso aos dados.

### Gestor de Unidades

- todas as permissoes pessoais do Colaborador;
- `leads.edit_all` e `leads.delete`;
- `management.view` e `leads.clinical_update`;
- `appointments.view`, `appointments.attendance` e `appointments.cancel`;
- `walkins.manage` e `followups.team`;
- `goals.manage`, `dashboard.view` e `leads.export`.

### Telemarketing

- `leads.create`, `leads.view_own` e `leads.edit_own`;
- `followups.own`;
- `leads.view_stores`;
- `appointments.view`;
- `followups.team`.

As regras e a interface aplicam uma lista rigida para este perfil. Permissoes
extras gravadas acidentalmente no usuario nao liberam gestao, exclusao ou
encaixes.

### Atendente Balcao

- `leads.create`, `leads.view_own` e `leads.edit_own`;
- `followups.own` e `followups.team`;
- `management.view`, `leads.edit_all` e `leads.clinical_update`;
- `appointments.view`, `appointments.attendance` e `appointments.cancel`;
- `walkins.manage`.

O perfil nao recebe por padrao exclusao de leads, dashboard, exportacao, metas
da equipe ou administracao do sistema.

### Administrador

O Administrador recebe todas as permissoes conhecidas e possui acesso global.
Seu conjunto de permissoes nao pode ser reduzido pela interface.

## Matriz operacional atual

Legenda:

- `SIM`: comportamento permitido pelo perfil padrao;
- `PROPRIO`: somente lead criado pelo usuario e unidade permitida;
- `UNIDADE`: somente unidades presentes no acesso;
- `NAO`: comportamento negado ou ausente;
- `PARCIAL`: existe suporte tecnico, mas o fluxo nao esta completo na interface.

| Operacao | Colaborador | MEI | Gestor | Telemarketing | Balcao | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Criar cadastro | SIM | SIM | SIM | SIM | SIM | SIM |
| Consultar cadastro proprio | SIM | SIM | SIM | SIM | SIM | SIM |
| Corrigir cadastro proprio | SIM | SIM | SIM | SIM | SIM | SIM |
| Consultar cadastros da unidade | NAO | NAO | UNIDADE | UNIDADE | UNIDADE | SIM |
| Editar cadastro de outra pessoa | NAO | NAO | UNIDADE | NAO | UNIDADE | SIM |
| Excluir lead | NAO | NAO | UNIDADE | NAO | NAO | SIM |
| Agendar lead proprio | PROPRIO | PROPRIO | PROPRIO | PROPRIO | PROPRIO | SIM |
| Agendar lead existente de outra pessoa | NAO | NAO | UNIDADE | NAO | UNIDADE | SIM |
| Reagendar lead proprio | PROPRIO | PROPRIO | PROPRIO | PROPRIO | PROPRIO | SIM |
| Reagendar lead de outra pessoa | NAO | NAO | UNIDADE | NAO | UNIDADE | SIM |
| Cancelar agendamento regular com motivo | PROPRIO | PROPRIO | UNIDADE | NAO | UNIDADE | SIM |
| Visualizar agenda da unidade | NAO | NAO | UNIDADE | UNIDADE | UNIDADE | SIM |
| Marcar comparecimento ou falta | NAO | NAO | UNIDADE | NAO | UNIDADE | SIM |
| Voltar comparecimento para pendente | NAO | NAO | PARCIAL | NAO | PARCIAL | PARCIAL |
| Criar e operar encaixe | NAO | NAO | UNIDADE | NAO | UNIDADE | SIM |
| Consultar retornos da equipe | NAO | NAO | UNIDADE | UNIDADE | UNIDADE | SIM |
| Exportar CSV e acessar dashboard | NAO | NAO | UNIDADE | NAO | NAO | SIM |
| Administrar metas da equipe | NAO | NAO | UNIDADE | NAO | NAO | SIM |
| Configurar agenda, acessos e perfis | NAO | NAO | NAO | NAO | NAO | SIM |

## Observacoes que precisam permanecer visiveis

### Unidade e autoria

Uma permissao nao basta sozinha. As regras tambem verificam autoria, papel base
e unidade. Um perfil `manager` nao pode operar uma loja fora de `storeId` e
`storeIds`.

Loja 02 e Loja 06 compartilham o recurso de agenda do consultorio de Surubim,
mas o lead continua pertencendo a uma unica loja. O compartilhamento da agenda
nao amplia a permissao de leitura ou edicao do cadastro.

### Reagendamento do proprio lead

O proprietario pode agendar ou reagendar seu lead pela rota especifica mesmo
quando nao possui `leads.edit_all`. A operacao protege identidade, loja e campos
nao relacionados ao agendamento.

### Comparecimento reversivel

O servico aceita os estados `pending`, `attended` e `missed`, e as regras
permitem uma atualizacao de comparecimento por perfis autorizados. Entretanto,
a interface do baseline oferece apenas `Compareceu` e `Nao compareceu`; ela nao
envia `pending`. Por isso o retorno ao estado neutro e classificado como
`PARCIAL` e nao deve ser considerado funcionalidade entregue.

### Cancelamento de agendamento

O cancelamento regular exige motivo e permite observacao opcional; em `Outro
motivo`, a observacao e obrigatoria. O lead, a data e o horario originais sao
preservados para auditoria, um evento `appointment_cancelled` e gravado no
historico e os blocos de `appointmentSlots` sao liberados no mesmo lote atomico.
Colaborador e MEI cancelam apenas agendamentos proprios; Gestor e Balcao atuam
nas unidades permitidas; Telemarketing permanece sem essa permissao.

### Encaixes

As regras de encaixe usam uma verificacao adicional de perfil. Administrador,
`system-manager` e `system-receptionist` podem operar a fila. Telemarketing,
Colaborador, MEI e perfis sem a combinacao reconhecida permanecem bloqueados,
mesmo que um documento incorreto contenha `walkins.manage`.

## Cobertura automatizada existente

Ja existem testes para:

- administracao de acessos e primeiro login autorizado;
- permissoes padrao e protecao especial do Telemarketing;
- criacao e correcao de lead pelo proprietario;
- bloqueio de outro captador e de outra unidade;
- cadastro offline sem agendamento;
- criacao e ocupacao atomica de blocos;
- agendamento e reagendamento pelo proprietario;
- consultas de agenda por administrador e gestor;
- comparecimento por gestor sem edicao indevida dos dados pessoais;
- encaixe por gestor e bloqueio de perfis e lojas nao autorizados;
- metas por captador, gestor e administrador.

## Lacunas que os proximos testes devem fechar

1. Exercitar cada fluxo com os seis perfis padrao completos, incluindo seus
   `roleProfileId`, `permissions`, `storeId` e `storeIds` reais.
2. Cobrir Atendente Balcao em cadastro, edicao, agendamento, reagendamento,
   comparecimento e encaixe.
3. Cobrir todas as negacoes do Telemarketing, mesmo quando o documento recebe
   permissoes extras indevidas.
4. Cobrir operacoes iguais em unidade permitida e unidade proibida.
5. Automatizar o ciclo offline: salvar, recarregar, reconectar, sincronizar e
   garantir ausencia de duplicacao.
6. Cobrir o cancelamento regular no roteiro E2E de homologacao para cada perfil.
7. Definir e implementar separadamente o comparecimento reversivel na interface.
8. Criar seeds idempotentes com usuarios e dados ficticios para essas personas.

## Personas previstas para o seed

| E-mail ficticio | Perfil | Unidade principal | Unidades permitidas |
| --- | --- | --- | --- |
| `admin@test.leadflow.local` | Administrador | Loja 02 | Todas |
| `gestor@test.leadflow.local` | Gestor | Loja 02 | Loja 02 e Loja 06 |
| `balcao@test.leadflow.local` | Atendente Balcao | Loja 02 | Loja 02 |
| `telemarketing@test.leadflow.local` | Telemarketing | Loja 02 | Todas |
| `colaborador@test.leadflow.local` | Colaborador | Loja 02 | Loja 02 |
| `mei@test.leadflow.local` | MEI | Loja 02 | Loja 02 e Loja 06 |
| `outra-loja@test.leadflow.local` | Atendente Balcao | Loja 05 | Loja 05 |
| `bloqueado@test.leadflow.local` | Usuario inativo | Loja 02 | Loja 02 |

Essas contas pertencerao somente ao Firebase Authentication Emulator. Nenhuma
senha ou dado ficticio desta tabela deve ser criado automaticamente em producao
ou no projeto real de homologacao.

## Criterio de conclusao desta etapa

Esta etapa fica concluida quando:

- a matriz reflete o JSON de perfis, a interface e as regras atuais;
- diferencas e lacunas estao registradas sem serem silenciosamente corrigidas;
- nenhuma regra, permissao ou dado remoto foi alterado;
- a proxima etapa pode criar emuladores e seeds a partir deste contrato.

## Proxima etapa recomendada

Adicionar Firestore Emulator e Authentication Emulator ao Compose, com volumes
descartaveis e um comando de reset. Depois disso, implementar o seed das
personas desta matriz e apenas entao iniciar os testes ponta a ponta.
