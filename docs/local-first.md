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
