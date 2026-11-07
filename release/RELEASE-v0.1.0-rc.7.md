# LeadFlow v0.1.0-rc.7

Status: versao candidata congelada para homologacao. Nao aprovada para producao.

## Identificacao

- Data: 2026-11-07
- Branch de origem: `chore/docker-homologacao`
- Commit-fonte da aplicacao: `816a72a`
- Projeto Firebase do build: `fascinlead`

## Correcao desde a rc.6

- O ZIP da Hostinger agora usa separadores portateis `/` nos nomes internos.
- A pasta `assets/` e extraida como diretorio real pela Hostinger, em vez de gerar arquivos soltos com nomes como `assets\\index-*.js`.
- O frontend, as regras e o codigo da aplicacao sao os mesmos validados na `rc.6`; somente o empacotamento foi corrigido.

## Congelamento

A `rc.6` permanece imutavel e deve ser considerada invalida para publicacao na
Hostinger por causa do formato dos caminhos internos do ZIP. Esta `rc.7` a
substitui como candidata atual.

## Validacoes automatizadas

- Testes unitarios: 292 aprovados.
- Testes de regras do Firestore: 113 aprovados.
- Playwright completo: 30 aprovados em desktop e mobile; 2 pulados intencionalmente por serem transacoes executadas uma vez por seed.
- Verificacao Docker e builds de homologacao e producao aprovados.
- ZIP verificado com 0 entrada contendo barra invertida e 16 entradas sob `assets/`.
- Conteudo extraido verificado arquivo a arquivo contra o `dist`, incluindo `.htaccess`.

## Artefatos

- `LeadFlow-Hostinger-v0.1.0-rc.7.zip`: frontend estatico corrigido para publicacao na Hostinger.
- `firestore-v0.1.0-rc.7.rules`: regras que devem acompanhar esta versao do frontend.
- `SHA256-v0.1.0-rc.7.txt`: integridade dos artefatos.

## Publicacao na Hostinger

1. Remover de `public_html` os arquivos soltos cujo nome comeca com `assets\\`.
2. Extrair `LeadFlow-Hostinger-v0.1.0-rc.7.zip` diretamente em `public_html`, substituindo os arquivos existentes.
3. Confirmar que existe o diretorio real `public_html/assets`.
4. Confirmar dentro dele `index-DJfAj5ct.js` e `index-BW6yttb0.css`.
5. Limpar o cache da Hostinger e abrir `https://leadflow.icu` em janela anonima.

## Criterio de bloqueio

Nao manter a publicacao se `/assets/index-DJfAj5ct.js` ou
`/assets/index-BW6yttb0.css` responderem com erro HTTP.
