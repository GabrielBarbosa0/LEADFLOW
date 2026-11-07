# LeadFlow v0.1.0-rc.8

Status: versao candidata congelada para publicacao controlada.

## Identificacao

- Data: 2026-11-07
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte da aplicacao: `08ed20e`
- Projeto Firebase do build: `fascinlead`

## Alteracoes desde a rc.7

- O CEP no modo offline deixa de exibir a mensagem para preenchimento manual e apenas nao realiza o preenchimento automatico.
- Removido o texto auxiliar abaixo de Loja de destino.
- Removido o texto auxiliar abaixo de Ja realizou cirurgia nos olhos.
- Validacoes, obrigatoriedade dos campos e comportamento online permanecem inalterados.

## Validacoes

- Testes diretamente afetados: 21 aprovados.
- Suite unitaria completa: 292 aprovados.
- Build de producao: aprovado.
- ZIP com caminhos portateis `/`, pasta `assets/` real e `.htaccess` preservado.
- Conteudo extraido comparado arquivo a arquivo com o build de producao.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.8.zip`: frontend estatico para a Hostinger.
- `firestore-v0.1.0-rc.8.rules`: regras correspondentes, sem alteracoes desde a candidata anterior.
- `SHA256-v0.1.0-rc.8.txt`: integridade dos artefatos.

## Publicacao na Hostinger

1. Extrair o ZIP diretamente em `public_html`, substituindo os arquivos existentes.
2. Confirmar que `assets/`, `index.html`, `.htaccess` e `sw.js` estao diretamente em `public_html`.
3. Limpar o cache da Hostinger e testar em janela anonima.
