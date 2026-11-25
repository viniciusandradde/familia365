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
