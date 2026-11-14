# LeadFlow v0.1.2

Status: release oficial correspondente a versao candidata validada e atualmente em producao na Hostinger.

## Identificacao

- Data: 2026-11-13
- Branch de origem: `feature/confirmacao-venda-manual`
- Tag: `v0.1.2`
- Projeto Firebase: `fascinlead`

## Alteracoes desde a v0.1.1

### Compras e vendas

- Adicionada a confirmacao manual de vendas, sem incluir indicadores no dashboard nesta versao.
- Adicionado historico com multiplas compras por cliente.
- Cada compra registra data, colaborador responsavel, OS ou pedido, valor e observacao.
- O valor da venda passou a ser obrigatorio no registro da compra.
- Adicionadas as acoes de criar, editar, cancelar, reativar e excluir compras.
- Compras canceladas deixam de compor os totais e podem ser reativadas.
- O resumo de compras do cadastro agora abre diretamente o mesmo historico completo.
- Formularios e confirmacoes de compra foram separados em modais proprios, sem confirmacoes nativas do navegador.
- Corrigido o fechamento indevido do modal ao clicar em seu conteudo.

### Cadastros e filtros

- Compactado o resumo de status, loja, compras e historico do lead.
- Reorganizadas as acoes do cadastro em duas colunas no desktop e uma coluna no mobile.
- Campos de pai, mae e telefone auxiliar passaram a ficar sempre visiveis abaixo de data de nascimento e sexo.
- Adicionado filtro de cidade aos cadastros.
- Adicionados filtros de perfil e estado ativo/inativo aos acessos da equipe.
- Ajustados espacamentos e alinhamentos dos filtros de loja, datas e compra.
- Compactada a pesquisa de clientes no mobile, com botao de lupa ao lado do campo.

### Responsividade e interface

- Corrigida a navegacao horizontal do kanban no mobile.
- Corrigida a responsividade do modal de arquivamento de leads.
- Corrigida a responsividade dos cards de status das confirmacoes.
- Resumido o texto da acao de arquivamento para `Arquivar`.
- Ajustados icones, hierarquia visual e espacamentos dos modais e acoes.
- Removido o botao textual redundante de fechar no modal de retornos; o fechamento permanece no `X` do cabecalho.

### Permissoes e estabilidade

- Corrigidos reagendamento e cancelamento de cadastros legados.
- Permitida a edicao de cadastros ainda sem agendamento.
- Corrigida a edicao de dados cadastrais por Gestor e Colaborador Interno.
- Corrigida a edicao apos troca de perfil, inclusive quando o dispositivo mantinha dados de permissao desatualizados.
- As permissoes efetivas passaram a respeitar o perfil canonico do sistema.
- Reforcados os testes das regras do Firestore para os fluxos de criacao, edicao, reagendamento e compras.

## Validacoes

- Suite unitaria: 311 testes aprovados em 49 arquivos.
- Regras do Firestore: 132 testes aprovados em 5 arquivos.
- Build de producao: aprovado com Vite 8.3.1.
- ZIP da Hostinger gerado diretamente do conteudo de `dist/`, sem uma pasta intermediaria.
- Caminhos internos do ZIP usam `/`, evitando barras invertidas durante a extracao na Hostinger.
- Integridade dos artefatos registrada em SHA-256.

## Artefatos

- `LeadFlow-Hostinger-v0.1.2.zip`: frontend estatico para publicacao na Hostinger.
- `firestore-v0.1.2.rules`: regras do Firestore correspondentes a esta versao.
- `SHA256-v0.1.2.txt`: hashes para verificacao de integridade.

## Publicacao

1. Fazer backup do conteudo atual de `public_html` antes da substituicao.
2. Extrair o ZIP diretamente em `public_html`.
3. Confirmar que `assets/`, `index.html`, `.htaccess` e `sw.js` estao diretamente em `public_html`.
4. Limpar o cache da Hostinger e testar em janela anonima.
5. Publicar regras e funcoes do Firebase separadamente apenas quando a mudanca for autorizada.
