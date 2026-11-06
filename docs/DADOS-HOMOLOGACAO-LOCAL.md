# Acessos do ambiente local de teste

## Onde usar

Estes acessos existem somente no Firebase Emulator Suite executado pelo Docker:

- aplicacao: `http://localhost:5176`;
- Firebase Emulator UI: `http://localhost:4000`.

Eles nao funcionam em `http://localhost:5175`, no Firebase real de homologacao
ou em producao. Nenhuma destas credenciais deve ser criada nos ambientes reais.

Senha compartilhada dos perfis ativos: `LeadFlow@123`

## Acesso de administrador

```text
E-mail: admin@leadflow.test
Senha: LeadFlow@123
```

Este e o acesso indicado para visualizar todas as telas, todas as unidades,
configuracoes, acessos da equipe, relatorios e operacoes administrativas.

## Lista rapida

| Perfil | E-mail | Senha | Unidades |
| --- | --- | --- | --- |
| Administrador | `admin@leadflow.test` | `LeadFlow@123` | Todas |
| Gestor | `gestor@leadflow.test` | `LeadFlow@123` | Lojas 02 e 06 |
| Colaborador Interno | `balcao@leadflow.test` | `LeadFlow@123` | Loja 02 |
| Colaborador Interno de outra unidade | `balcao.loja05@leadflow.test` | `LeadFlow@123` | Loja 05 |
| Colaborador Interno multi-loja | `telemarketing@leadflow.test` | `LeadFlow@123` | Todas |
| Colaborador Interno | `colaborador@leadflow.test` | `LeadFlow@123` | Loja 02 |
| MEI | `mei@leadflow.test` | `LeadFlow@123` | Lojas 02 e 05 |
| Colaborador Externo | `externa@leadflow.test` | `LeadFlow@123` | Lojas 02 e 06 |
| Usuario bloqueado | `bloqueado@leadflow.test` | `LeadFlow@123` | Loja 02 |

## Blocos para copiar

### Gestor

```text
E-mail: gestor@leadflow.test
Senha: LeadFlow@123
```

### Colaborador Interno - Loja 02

```text
E-mail: balcao@leadflow.test
Senha: LeadFlow@123
```

### Colaborador Interno - Loja 05

```text
E-mail: balcao.loja05@leadflow.test
Senha: LeadFlow@123
```

### Colaborador Interno - multi-loja

```text
E-mail: telemarketing@leadflow.test
Senha: LeadFlow@123
```

### Colaborador Interno

```text
E-mail: colaborador@leadflow.test
Senha: LeadFlow@123
```

### MEI

```text
E-mail: mei@leadflow.test
Senha: LeadFlow@123
```

### Colaborador Externo

```text
E-mail: externa@leadflow.test
Senha: LeadFlow@123
```

### Usuario bloqueado

```text
E-mail: bloqueado@leadflow.test
Senha: LeadFlow@123
```

O usuario bloqueado existe para validar a recusa de acesso e nao consegue entrar.

## Diferencas principais de permissao

| Perfil | Uso principal no teste | Limitacoes importantes |
| --- | --- | --- |
| Administrador | Fluxo completo e configuracao do sistema | Nenhuma limitacao de unidade |
| Gestor | Gestao, agenda, comparecimento, encaixes, metas, dashboard e exportacao | Limitado as Lojas 02 e 06 |
| Colaborador Interno | Cadastro, gestao operacional, agenda, comparecimento e encaixes | Sem exclusao, metas da equipe, dashboard, exportacao ou configuracoes |
| Colaborador Interno Loja 05 | Validar isolamento entre unidades | Pode operar apenas a Loja 05 |
| Colaborador Interno multi-loja | Validar a mesma operacao interna em varias unidades | Limitado as unidades selecionadas no acesso |
| Colaborador Externo | Criar e editar os proprios cadastros e consultar a Operacao Externa | Sem gestao dos cadastros de outras pessoas |
| MEI | Mesmas permissoes do Colaborador Externo, com cotas proprias de agenda | Sem gestao dos cadastros de outras pessoas |
| Usuario bloqueado | Validar bloqueio de autenticacao | Nao consegue entrar |

As permissoes detalhadas e os resultados esperados de cada fluxo estao em
`docs/MATRIZ-PERFIS-E-FLUXOS-HOMOLOGACAO.md`.

## Dados criados

O seed cria as quatro lojas, o servico Exame de vista e exemplos de:

- cliente aguardando definicao de comparecimento;
- cliente que compareceu;
- cliente que faltou;
- cliente sem agendamento;
- cliente de outra unidade;
- cliente reagendado com historico;
- cliente no funil cancelado;
- cliente captado por MEI;
- dois encaixes do dia, um aguardando e outro chamado.

As datas sao relativas ao dia em que o seed e executado, mantendo os registros
uteis na agenda.

## Reinicializacao

`INICIAR-LEADFLOW-EMULADORES.bat` preserva a base quando ela ja existe.
`RESETAR-LEADFLOW-EMULADORES.bat` apaga todos os usuarios e documentos locais e
recria exatamente esta base.
