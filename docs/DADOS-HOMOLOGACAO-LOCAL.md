# Dados do ambiente local descartavel

Estes acessos existem somente no Firebase Emulator Suite executado pelo Docker.
Eles nao funcionam no Firebase de homologacao nem em producao.

Senha compartilhada dos perfis ativos: `LeadFlow@123`

| Perfil | E-mail | Unidade |
| --- | --- | --- |
| Administrador | `admin@leadflow.test` | Todas |
| Gestor | `gestor@leadflow.test` | Lojas 02 e 06 |
| Atendente Balcao | `balcao@leadflow.test` | Loja 02 |
| Atendente de outra unidade | `balcao.loja05@leadflow.test` | Loja 05 |
| Telemarketing | `telemarketing@leadflow.test` | Todas |
| Colaborador | `colaborador@leadflow.test` | Loja 02 |
| MEI | `mei@leadflow.test` | Lojas 02 e 05 |
| Usuario bloqueado | `bloqueado@leadflow.test` | Loja 02 |

O usuario bloqueado existe para validar a recusa de acesso e nao consegue entrar.

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
