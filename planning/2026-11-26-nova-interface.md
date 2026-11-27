# Plano — nova interface do Família365 (aprovado em 26/11/2026)

Proposta aprovada: documento "Família365 — proposta de nova interface". Telas de referência (HTML + `tokens.css`, dados
fictícios) fora do repositório, em `~/.local/share/familia365-design/design/`; relatórios de UX e de referências na mesma pasta.

## Restrições globais
- HTML, CSS e JS puros, **sem build e sem dependências**; módulos ES (`<script type="module">`), CSP restrita
  (`default-src 'self'`, sem estilo ou script inline, sem CDN, sem fontes externas); funciona offline (service worker
  com cache versionado — subir a versão a cada etapa).
- **Compatibilidade de dados:** continuar lendo `familia365-v1` (lista), `familia365-vision-v1` (sonhos) e
  `familia365-people-v1` (pessoas) e os backups já exportados (lista `{version:1, items}` e o backup do painel). Nunca
  apagar dado sem confirmação com "Desfazer".
- Repositório público: nenhum nome real, telefone ou dado pessoal em código, testes ou capturas.
- Princípios: sem estrelas, placar, sequências, vermelho de "atrasado" ou linguagem que culpe.
- **Branch `feat/nova-interface`.** O GitHub Pages publica `local-first`: nada vai para lá sem autorização explícita do dono
  e um backup completo feito antes no aparelho da família.
- Testes: lógica pura em módulos testáveis com `node --test tests/*.test.mjs` (TDD: teste que falha primeiro); capturas
  com dados fictícios (celular 390 px e computador) a cada etapa visual.

## Etapas (uma de cada vez, cada uma com commit próprio)
1. ✅ **Backup seguro.** (feita em 26/11/2026) Um arquivo só (`version: 2`) com lista, sonhos (com fotos), pessoas e data de exportação; lê os
   formatos antigos. Restaurar: prévia arquivo × aparelho, "Juntar" (padrão, por id, nunca apaga) ou "Substituir tudo"
   (cópia automática do estado atual antes, com Desfazer). "Último backup: há N dias"; `navigator.storage.persist()`.
   Exportação de metas para o FiscalFlow passa a usar `target_cents`/`reserved_cents` dos sonhos do painel (e continua
   aceitando os "Sonhos" da lista com valor no título).
2. ✅ **Estrutura.** (feita em 26/11/2026; conteúdo das telas ainda provisório, ver `docs/local-first.md`) Rotas por hash (`#/hoje`, `#/planos`, `#/sonhos`, `#/familia`, `#/dados`; manter `#import=`), barra
   inferior com 4 destinos e `aria-current`, cabeçalho compacto com data e "Dados" (ponto ocre se o backup tiver mais de
   7 dias), folhas com `<dialog>`, aviso global com Desfazer (`role="status"`), tokens de cor corrigidos (claro e escuro).
3. ✅ **Hoje.** (feita em 26/11/2026; ver `docs/local-first.md`) Captura em uma linha (Enter), caixa de concluir de 48 px, "À noite", "Concluídos hoje" recolhido, `done_at`,
   botão "+" com a folha "Anotar" (Para quem: Para mim/Casal/Família; Quando: Hoje/Semana/Algum dia; "Mais detalhes"),
   reconhecimento local de "amanhã" e dias da semana.
4. ✅ **Sonhos num lugar só.** (feita em 26/11/2026; ver `docs/local-first.md`) Itens da aba "Sonhos" aparecem no painel; cartão com foto, `<progress>`, "≈ R$/mês até
   mm/aaaa", "+ Guardar valor", "Pausar"/"Mudar prazo"; filtros Todos/Meu/Casal/Família; fotos no IndexedDB.
5. **Família.** Revisão da semana guiada (5 passos, todos puláveis, "Modo conversa"), Conversa de domingo (3 perguntas,
   guarda só os combinados), pessoas com cor (paleta segura para daltonismo, sempre com o nome).
6. **Acabamento.** Planos agrupados por horizonte com filtros, estados vazios, primeiro uso, tema escuro, revisão de
   acessibilidade (foco, leitores de tela, contraste).
