# Família365 v0.1 local
Decisão: HTML/CSS/JS puro, sem build, servidor de API, banco remoto ou login. Branch local-first derivada de main; develop preservada, não é a versão ativa. Hospedar arquivos estáticos por HTTPS. GitHub Pages pode usar branch local-first / root se plano permitir; alternativamente servidor estático no Dokploy. Dados locais por origem e perfil do navegador, sem criptografia ou sincronização. Exportar JSON regularmente; importar substitui registros. Não guardar informações clínicas ou íntimas em dispositivo compartilhado. Testar instalação, offline, edição e backup antes de uso. Ícone SVG inicial; PNG e compatibilidade iOS/Android ainda não testados.
## Privacidade dos nomes (2026-11-25)
O código publicado não traz mais nomes de familiares: o seletor "De quem é a visão?" tem apenas opções genéricas e as pessoas
são cadastradas no próprio aparelho (`familia365-people-v1` no LocalStorage). Sonhos já salvos com um nome continuam visíveis,
pois os nomes gravados localmente entram no seletor automaticamente. Cache do service worker: `familia365-static-v5`.
Observação: versões anteriores do `index.html` permanecem no histórico público do Git; reescrever o histórico exige decisão
do responsável (force push não é feito por agentes).

## Metas financeiras nos sonhos (2026-11-25)
Cada sonho pode ter valor-alvo e valor já reservado (gravados em centavos inteiros: `target_cents`, `reserved_cents`) e prazo
(`due`, AAAA-MM-DD). O card mostra progresso, quanto falta e o aporte mensal simples (sem juros) até o prazo. Tudo continua no
aparelho; o backup do painel valida os campos novos e aceita backups antigos sem eles. Base para a integração autenticada futura
com o FiscalFlow (goal_id, valor-alvo, prazo, reserva, progresso), que ainda não existe. Cache do service worker: `familia365-static-v6`.

## Backup completo v2 e restauração com prévia (2026-11-26, etapa 1 da nova interface)
"Fazer backup completo" gera um arquivo só (`familia365-backup-AAAA-MM-DD.json`, compartilhado pelo `navigator.share` quando
o aparelho permite, senão baixado) no formato `{format:"familia365.backup", version:2, exported_at, items, dreams, people}`:
lista, sonhos com as fotos e pessoas. A data do último backup fica em `familia365-meta-v1` e o app pede
`navigator.storage.persist()`. "Restaurar de um arquivo" lê o v2 e os backups antigos (lista `{version:1, items}` e painel
`{version:1, vision}`), mostra a prévia arquivo × aparelho e oferece **Juntar** (padrão: entra só o que falta, por id; pessoas
por nome; nada é apagado nem sobrescrito) ou **Substituir tudo** (só as partes que o arquivo traz: um backup antigo da lista
não apaga os sonhos). Antes de gravar, o estado atual vai para `familia365-undo-v1`, e "Desfazer a última restauração" fica na
seção até a próxima restauração; sem espaço para essa cópia, "Substituir" não acontece. Importações avançadas (código colado,
link `#import=`, metas do FiscalFlow) ficam em "Outras importações"; "Exportar metas" usa `target_cents`/`reserved_cents` dos
sonhos do painel e ainda aceita os itens de Sonhos com valor no título. Lógica pura em `js/backup.js` e `js/goals.js`
(`node --test tests/*.test.mjs`); interface em `js/dados.js` e `dados.css`. Cache do service worker: `familia365-static-v7`.

## Estrutura nova da interface (2026-11-26, etapa 2 da nova interface)
O app virou uma casca com cinco telas em rotas por hash: `#/hoje` (padrão), `#/planos`, `#/sonhos`, `#/familia` e `#/dados`.
O link `#import=` continua funcionando (abre em Hoje e pede confirmação antes de juntar), e as âncoras antigas `#dados` e
`#vision` levam a Dados e Sonhos. Barra inferior fixa com Hoje, Planos, Sonhos e Família (`aria-current="page"` na ativa);
cabeçalho com a data e "Dados" (escudo), com um ponto ocre quando o último backup tem mais de 7 dias ou não existe. Ao trocar
de tela, o foco vai para o título. Conteúdo provisório: Hoje = a lista da antiga aba Hoje; Planos = Plano de vida, Família e
Pendências, agrupados por aba; Sonhos = o Painel de Visão do Futuro e, abaixo, os itens da aba Sonhos; Família = Revisão
semanal; Dados = a seção da etapa 1. Criar e editar itens e sonhos acontece numa folha (`<dialog>`: Fechar, Esc e "voltar"
fecham; Excluir só dentro da edição), aberta pelo botão "+" (escondido em Dados). Concluir, excluir e salvar mostram um aviso
com "Desfazer" por cerca de 5 s; a exclusão não pede mais `confirm()`.

Arquivos: `index.html` (sem estilo ou script inline; CSP `style-src 'self'` também no nginx), `tokens.css` (tokens claro e
escuro e componentes do desenho), `app.css` (casca), `dados.css` (seção Dados). Módulos: `js/main.js` (rotas, cabeçalho,
listas, folha de item, importações), `js/sonhos.js` (painel e pessoas), `js/ui.js` (aviso e folhas), `js/dados.js` (backup);
lógica pura testada em `js/router.js`, `js/telas.js`, `js/itens.js`, `js/backup.js` e `js/goals.js`. `app.js`, `vision.js` e
`style.css` saíram. Chaves e formato gravado não mudaram (`familia365-v1`, `familia365-vision-v1`, `familia365-people-v1`,
`familia365-meta-v1`, `familia365-undo-v1`). Cache do service worker: `familia365-static-v8`.

## Tela Hoje (2026-11-26, etapa 3 da nova interface)
**Captura em uma linha:** "Adicionar para hoje…" no topo; Enter grava na aba Hoje (Para mim), o item entra no topo, aparece
"Adicionado" com Desfazer e o campo continua focado. **Folha Anotar** (botão "+"): "Para quem?" (Para mim, Casal, Família),
"Quando?" (Hoje, Semana, Algum dia) e "Mais detalhes" recolhido (área, horário, prazo, "À noite", nota, "Onde fica").
"Quando?" escolhe a aba e o horizonte: Hoje → aba Hoje (ou prazo hoje, se outra aba for escolhida à mão); Semana → Pendências
(7 dias); Algum dia → Plano de vida; em Família, a aba continua Revisão semanal. **Datas no texto**, reconhecidas no aparelho:
"amanhã", "depois de amanhã" e dias da semana ("sábado", "na segunda", "até sexta"; o mesmo dia da semana é o da semana que vem)
viram prazo e põem "Quando?" em Semana; o termo só sai do título se estiver no fim ou no começo da frase, sem "de" antes
("presente de sábado" fica como está). Dia da semana solto no meio da frase não é data ("a segunda via"), e dois dias diferentes
não viram nada. "Não é data" desfaz o reconhecimento; mexer no prazo à mão tem prioridade. Itens já existentes não são relidos.

**Seções:** "Para hoje" (abertos da aba Hoje sem prazo ou com prazo hoje e, de qualquer aba, os com prazo hoje), "À noite"
(horário a partir de 18h ou marcado "À noite"), cartão "Quer trazer para hoje?" (abertos com prazo vencido, menos Sonhos;
"Trazer" põe o prazo em hoje; nada de vermelho ou "atrasado"), "Concluídos hoje" recolhido com contagem e, se houver,
"Concluídos antes" (da aba Hoje, concluídos em outro dia ou em versões sem `done_at`, para não sumirem). Sem horário primeiro,
na ordem da lista; depois os com horário, pela hora. Item da aba Hoje com prazo futuro (ex.: "Fica para amanhã") sai de Hoje até
o dia. Concluir grava `done_at` e mostra "Concluído · Desfazer"; desmarcar reabre e apaga `done_at`. Cada item mostra de quem é
(ícone e rótulo escrito; itens antigos contam como Para mim), área, horário e, para itens de outra aba, o nome da aba. Tocar no
item abre "Editar" com Salvar, "Fica para amanhã" e Excluir. Hoje vazio: "Nada para hoje ainda. Que tal uma pequena ação?" com
3 sugestões de um toque. Aos domingos, cartão "Revisão da semana" ("Agora não" guarda `revisao_agora_nao` em
`familia365-meta-v1` e some até o domingo seguinte; "Começar" abre `#/familia`).

**Dados:** campos novos opcionais nos itens, gravados só quando têm valor: `done_at` (ISO), `scope` (`eu`, `casal`, `familia`),
`time` (HH:MM) e `night` (true). A validação dos itens, o `parseBackup` e o backup v2 aceitam e guardam esses campos; itens e
backups antigos sem eles continuam válidos. Mesmas chaves no LocalStorage. Lógica pura em `js/datas.js` e `js/hoje.js` (e
`js/itens.js`, `js/backup.js`), com testes em `tests/datas.test.mjs` e `tests/hoje.test.mjs`. Cache do service worker:
`familia365-static-v9`.

## Sonhos num lugar só (2026-11-26, etapa 4 da nova interface)
**Uma tela só:** os itens antigos da aba "Sonhos" da lista viram sonhos do painel (`familia365-vision-v1`) com o mesmo id
(e `origin_id` com o id do item). A cópia é gravada no painel primeiro e só depois o item sai da lista; a migração roda ao abrir
o app e depois de gravar a lista, e é idempotente: um backup antigo restaurado depois devolve o item à lista, mas ele sai de novo
sem virar outro sonho. Se já existe sonho com o mesmo id (a meta duplicada de antes), o item só completa valor-alvo, prazo e
descrição que faltarem. Item concluído vira sonho alcançado (`achieved`). A folha "Anotar" não oferece mais a aba Sonhos.

**Cartão:** foto grande com selo de escopo (Meu, Casal, Família ou o nome da pessoa) ou, sem foto, cartão compacto com uma
ilustração neutra; título, área e prazo ("até dez/2027"). Com meta: "R$ 1.500 de R$ 6.000", `<progress>` com rótulo
acessível, "≈ R$ 346/mês até dez/2027" (aporte simples, sem juros: falta ÷ meses até o prazo) e "+ Guardar valor" (folha curta
que soma ao já guardado). Sem meta: o próximo passo (`next_step`, novo campo opcional na folha do sonho) ou "Anotar um passo".
Menu "⋯" (folha de opções): Editar, Mudar prazo (ou ficar sem prazo), Pausar/Retomar e Excluir (com Desfazer). Pausado não
cobra aporte e mostra "Pausado. Retome quando fizer sentido."; meta alcançada mostra "Vocês chegaram lá."; prazo passado
mostra "Quer ajustar a data?" (abre Mudar prazo). Nada em vermelho; os cartões não esticam até a altura do vizinho.
**Filtros** Todos / Meu / Casal / Família / cada pessoa e a linha "Já guardado: R$ X em N sonhos" (do filtro escolhido).

**Fotos no IndexedDB** (banco `familia365-fotos`, API nativa): foto nova é reduzida (800 px, JPEG) e gravada no IndexedDB; o
sonho guarda só `photo_ref`. Sem IndexedDB, fica em base64 como antes. Fotos antigas em base64 continuam aparecendo e vão para
o IndexedDB aos poucos (3 por abertura, só se nada mudou no meio). Fotos que nenhum sonho nem a cópia de "Desfazer a última
restauração" usam são apagadas ao abrir. **Backup completo:** a exportação lê as fotos do IndexedDB e põe em base64 no arquivo
(formato v2 de sempre, sem `photo_ref`); a restauração grava as fotos do arquivo no IndexedDB antes de gravar os sonhos.

**Metas do FiscalFlow:** "Importar metas" grava nos sonhos do painel pelo id (atualiza valor-alvo e prazo, este só quando a meta
traz um; meta nova vira sonho de Família com o valor já guardado; nunca apaga), com Desfazer; acabou a duplicação de uma meta
com o mesmo id de um sonho. "Exportar metas" usa o painel.

**Planos › Próximos dias:** itens da aba Hoje com prazo futuro (antes sumiam até o dia) aparecem no topo de Planos, pela data,
com o dia escrito ("sáb, 28/11").

**Dados:** campos novos opcionais nos sonhos, gravados só quando têm valor: `paused`, `achieved`, `next_step`, `photo_ref` e
`origin_id`; a validação, o `parseBackup` e o backup v2 aceitam e guardam esses campos, e backups antigos continuam abrindo.
Mesmas chaves no LocalStorage. Lógica pura em `js/painel.js` e `js/fotos.js` (e `js/goals.js`, `js/telas.js`, `js/itens.js`,
`js/backup.js`), com testes em `tests/painel.test.mjs`, `tests/fotos.test.mjs` (armazenamento falso no lugar do IndexedDB) e
nos testes existentes. Cache do service worker: `familia365-static-v10`.
