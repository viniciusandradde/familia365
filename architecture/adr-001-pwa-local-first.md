# ADR-001 — PWA local-first compartilhada
Data: 2026-11-25. Status: proposta para aprovação.
## Decisão
Priorizar aplicação utilizável por dois adultos com contas individuais. Adiar Paperclip, Hermes, Perplexity e demais integrações IA. React + TypeScript + Vite, PWA com service worker, IndexedDB via Dexie, Supabase Auth/Postgres/RLS/Storage. Hospedagem estática GitHub Pages ou Dokploy; preferir Dokploy se necessário restringir exposição ou controlar infraestrutura. GitHub Pages não fornece autenticação de aplicação nem backend. Não publicar dados pessoais no bundle ou Git. Verificar disponibilidade Pages para repositório privado conforme plano.
## Sincronização
IndexedDB por usuário; fila outbox com UUID, versão, timestamps de servidor, retries idempotentes, tombstones e resolução explícita de conflitos. Realtime apenas como sinal para buscar alterações. Não cachear respostas autenticadas no service worker; limpar dados locais no logout e permitir remoção. Offline após login inicial; não prometer armazenamento permanente no navegador. Backup e exportação autorizados.
## Privacidade
Contas por convite, sem cadastro público. RLS por membership e owner; visibilidade private/shared explícita; nenhum administrador familiar lê registros privados de outro adulto. Buckets privados, URLs temporárias, sem service-role no frontend. Dados clínicos e fotos de menores fora do MVP. Testes de isolamento entre contas e famílias, revogação e logout. HTTPS obrigatório.
## MVP
Login, instalação, onboarding familiar, dashboard Hoje, planos individuais e compartilhados, projetos, tarefas, calendário, hábitos pessoais, revisão semanal, mural dos sonhos, catálogo de livros e planejamento de experiências. Finanças básicas sem credenciais bancárias. Memórias inicialmente metadados, sem upload de fotos. 
## Fases
1 fundação/auth/RLS/offline; 2 projetos/tarefas/planos; 3 calendário/hábitos/revisão; 4 finanças e memórias com avaliação de privacidade; 5 integrações IA futuras.
## Aceitação
Dois usuários em dispositivos distintos; criar tarefa offline, sincronizar após reconexão, testar edição concorrente e impedir acesso cruzado a conteúdo privado; instalar Android/iOS; exportar e restaurar dados autorizados. 
Nenhum deploy, banco ou código executável criado nesta decisão. Custos, domínio e escolha de hospedagem pendentes.