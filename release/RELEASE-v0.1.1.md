# LeadFlow v0.1.1

Status: release oficial correspondente a versao estabilizada em producao na Hostinger.

## Identificacao

- Data: 2026-11-11
- Branch de origem: `hotfix/layout-mobile-producao`
- Commit funcional da aplicacao: `6d95a50`
- Projeto Firebase do build: `fascinlead`

## Alteracoes desde a v0.1.0

- Restauradas as permissoes especificas de Colaborador Interno, Colaborador Externo, Gestor e Administrador.
- Liberada a agenda para os perfis autorizados, incluindo alteracao de comparecimento, cancelamento e reagendamento conforme a matriz de permissoes.
- Corrigido o acesso do Colaborador Interno a fila de encaixes.
- Mantidas as restricoes de Colaborador Externo e MEI sobre operacoes exclusivas da equipe interna.
- Alinhado o botao de pesquisa com o campo de nome ou telefone no painel de leads.
- Corrigida a disposicao do botao Novo agendamento em celulares e tablets.
- Adicionados testes de regressao para regras do Firestore, perfis e layouts responsivos afetados.

## Validacoes

- Suite unitaria: 296 testes aprovados em 48 arquivos.
- Regras do Firestore: 118 testes aprovados em 5 arquivos.
- Build de producao: aprovado com Vite 8.3.1.
- ZIP gerado diretamente do conteudo de `dist/`, com `.htaccess`, `index.html`, `assets/` e Service Worker na raiz.
- Integridade dos artefatos registrada em SHA-256.

## Artefatos

- `LeadFlow-Hostinger-v0.1.1.zip`: frontend estatico oficial publicado na Hostinger.
- `firestore-v0.1.1.rules`: regras do Firestore correspondentes a esta versao.
- `SHA256-v0.1.1.txt`: hashes para verificacao de integridade.

## Publicacao na Hostinger

1. Extrair o ZIP diretamente em `public_html`, substituindo os arquivos existentes.
2. Confirmar que `assets/`, `index.html`, `.htaccess` e `sw.js` estao diretamente em `public_html`.
3. Limpar o cache da Hostinger e testar em janela anonima.
4. Publicar `firestore-v0.1.1.rules` separadamente somente quando for necessario restaurar as regras correspondentes.
