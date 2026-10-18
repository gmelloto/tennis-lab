# Tennis Lab — Ambiente de desenvolvimento

Plataforma de aulas interativas de tenis. Inclui portal, Capitulo 1, demonstracao de voz da Lia, documentacao e referencias visuais.

**Site publicado:** https://gmelloto.github.io/tennis-lab/ (atualiza automaticamente a cada push na `main`, via `.github/workflows/pages.yml`).

## Abrir no GitHub Codespaces (inclusive pelo iPhone)
1. Crie um repositorio GitHub, por exemplo `tennis-lab`.
2. Envie o conteudo DESTA pasta para a raiz do repositorio (nao a pasta que a contem).
3. No repositorio, abra **Code > Codespaces > Create codespace on main**.
4. No terminal, rode `npm run dev`.
5. Abra a porta **3000** em **Ports** e escolha **Open in Browser**.

## Comandos
- `npm run dev`: executa portal e capitulos com recarregamento automatico.
- `npm test`: verifica arquivos e estrutura HTML.
- `npm run build`: gera versao publicavel em `dist/`.
- `npm run check`: testa e compila.

## Estrutura
- `index.html`: portal do projeto.
- `capitulos/01-descobrindo-o-tenis/index.html`: primeira aula.
- `prototipos/lia-voz/index.html`: demonstracao de narracao via navegador.
- `documentacao/`: plano editorial, identidade visual e roadmap.
- `referencias-visuais/`: referencias de arte; NAO sao arquivos GLB articulados.
- `.devcontainer/`: configuracao automatica do Codespaces.
- `.github/workflows/ci.yml`: testes automaticos no GitHub.

## Voz e 3D
O prototipo de voz atual usa sintese do navegador. VoiceStudio NAO esta instalado neste pacote. Modelos de voz podem precisar de GPU e servico separado; adicionar integracao por API depois de testar licencas e requisitos. Nao armazene tokens no GitHub.

## Observacao
GitHub Codespaces pode gerar custos e nao fornece GPU dedicada por padrao. A previa de portas pode ser privada.
