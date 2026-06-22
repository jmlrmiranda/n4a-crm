# Checkpoint 2026-06-22 — CRM n4a novo

## Estado no início da sessão
- CRM legacy a correr em /Users/server/atlas/platform/n4a-crm
- /Users/server/n4a-lab/platform/n4a-crm/ vazio

## O que foi feito nesta sessão

### Fundações
- Auditoria completa do legacy: AUDIT_2026-06-22.md
- ADR-CRM-001: modelo financeiro canónico (decomposição por componente,
  custo global, margens calculadas, contrato JSON Atlas Suite)
- ADR-CRM-002: estado canónico (transições, fonte de verdade,
  transacção dupla campo+histórico, evento publicado)

### Backend core (Fase 1)
- api/prisma/schema.prisma: schema novo com modelo financeiro completo
- Prisma ^6.19.3 (Prisma 7 incompatível com url = env())
- Migration inicial aplicada: 20260622164129_init
- Base de dados: n4a_crm_dev (Postgres local, role postgres criada)
- api/package.json + dependências instaladas
- api/.env configurado (porta 18080 — 8080 ocupada pelo OrbStack)
- api/src/index.js: Express, CORS, rate limit login, health
- api/src/auth.js: JWT sem fallback, bcrypt rounds 12
- api/src/middleware.auth.js: requireAuth, requireAdmin, requireRole

### API routes (Fase 2)
- api/src/prisma.js: singleton Prisma Client
- api/src/finance.js: cálculos canónicos (ADR-CRM-001)
  calcEstSellPrice, calcFinalSellPrice, calcEstMargin, calcFinalMargin,
  calcEstMarginPct, calcFinalMarginPct, serializeOpp
- api/src/transitions.js: transições canónicas (ADR-CRM-002)
  TRANSITIONS map, isValidTransition, transitionStatus (transaccional)
- api/src/routes.auth.js: POST /auth/login
- api/src/routes.users.js: GET/POST/PATCH /api/users (admin-only)
- api/src/routes.clients.js: GET/POST/PATCH/GET:id /api/clients
- api/src/routes.opps.js: CRUD + /status + /contacts + /attachments
- api/src/routes.dashboard.js: GET /api/dashboard (contrato ADR-CRM-001)

### Smoke test
- Todos os endpoints responderam correctamente
- Auth, RBAC e serialização validados

## Decisões técnicas registadas
- Prisma ^6.19.3 (não 7)
- Porto 18080 (OrbStack ocupa 8080)
- CommonJS (consistência com legacy)
- Express 5
- JWT_SECRET obrigatório sem fallback
- CORS_ORIGIN e PORT obrigatórios sem fallback
- NIF não-unique no schema — verificação explícita na route
- nextOppNo/nextClientNo sem transacção (risco de colisão aceitável por agora)
- margin nunca persistida — sempre calculada
- updatedAt como proxy de closedAt (closedAt não existe no schema ainda)
- shared-auth: lifecycle planned, não implementado — CRM usa JWT próprio por agora

## Próximas sessões (Fase 3)
- Testes unitários: finance.js, transitions.js
- Testes de integração: routes principais
- Seed de dados demo
- Docker + env de produção
- Registo no control-plane/registry

## Stack
- Node.js / CommonJS
- Express 5
- Prisma 6.19.3 / PostgreSQL
- JWT (jsonwebtoken 9)
- bcrypt 6
- multer 2
- express-rate-limit 8

## Paths relevantes
- Novo CRM: /Users/server/n4a-lab/platform/n4a-crm/
- Legacy (a correr): /Users/server/atlas/platform/n4a-crm/
- DB: postgresql://postgres:postgres@localhost:5432/n4a_crm_dev
- Uploads: /Users/server/n4a-lab/platform/n4a-crm/uploads/
- ADRs: docs/adr/

## Actualização 2026-06-22 — fim de sessão

### Completado após checkpoint inicial
- Fase 3: 53 testes unitários e de integração (finance, transitions, auth)
- Seed determinístico com 3 users, 5 clientes, 8 oportunidades
- Dashboard validado com dados reais (pipeline 293k€, win rate 66.67%)
- Docker: Dockerfile, docker-compose.yml, entrypoint.sh com migrate automático
- .env.docker.example documentado
- control-plane/registry/apps.yaml actualizado (n4a-crm → in-progress, development)

### Estado no fim desta sessão
- Backend 100% funcional e testado
- Docker pronto mas não iniciado em produção
- Legacy continua a correr em /Users/server/atlas/platform/n4a-crm
- Próxima sessão: Fase 4 — UI (N4A Design System)

## Actualização 2026-06-22 — fecho

### Completado nesta sessão
- Protocolo de abertura e fecho documentado em docs/SESSAO_ABRIR.md e docs/SESSAO_FECHAR.md
- Docker finalizado com entrypoint.sh a correr `prisma migrate deploy` antes do servidor
- control-plane/registry/apps.yaml actualizado para apontar n4a-crm para o CRM novo em development/in-progress
- .gitignore da raiz criado e api/.gitignore completado para cobrir .env, .env.docker, node_modules/ e uploads/
- Testes executados no fecho: 53 passed, 53 total

### O que ficou pendente
- Fase 4 — UI com N4A Design System
- Docker pronto mas ainda não iniciado em produção
- Decidir antes de produção se as passwords demo do seed continuam hardcoded ou passam para variáveis de ambiente

### Decisões técnicas tomadas
- Mantido seed determinístico com passwords demo explícitas, conforme requisito do seed
- Supertest requer execução de `npm test` fora do sandbox porque abre listener HTTP temporário
- .gitignore da raiz passou a proteger artefactos runtime de raiz e API

### Estado no fim da sessão
- Backend funcional, testado e documentado
- Legacy continua a correr em /Users/server/atlas/platform/n4a-crm
- Próxima sessão começa pela leitura de docs/SESSAO_ABRIR.md

## Actualização 2026-06-22 — fecho Fase 4 UI

### Completado nesta sessão
- Protocolo de abertura executado e contexto obrigatório lido.
- Frontend React criado em `web/` com Vite, React Router e Axios.
- N4A Design System base criado com tokens CSS e componentes reutilizáveis.
- Auth frontend implementado: `AuthContext`, cliente Axios com Bearer token, login real e rotas privadas.
- Layout shell real implementado: topbar, sidebar, logout, navegação por role.
- Páginas implementadas:
  - Login
  - Pipeline com filtros, lista de oportunidades e modal de nova oportunidade
  - Dashboard com KPIs, forecast e agregações por vendedor/tipo
  - Detalhe de oportunidade com resumo, financeiro, histórico, contactos e anexos
  - Clientes e detalhe de cliente
  - Utilizadores admin-only com activar/desactivar
- Rotas adicionadas em `web/src/App.jsx`: `/`, `/dashboard`, `/opps/:id`, `/clients`, `/clients/:id`, `/users`.
- Testes/validações executados no fecho:
  - API: 53 passed, 53 total
  - Web: `npm run lint` passou
  - Web: `npm run build` passou

### O que ficou pendente
- Backend: alinhar contrato de `GET /api/clients/:id`; a UI espera detalhe com `opportunities`, mas a API actual não expõe esse endpoint. A UI tem fallback via `GET /api/clients` + `GET /api/opps?clientId=...`.
- Completar formulários de criação/edição de clientes, utilizadores e detalhe financeiro da oportunidade.
- Implementar UI de transições de estado, contactos e anexos.
- Validar a UI contra API/DB em execução com sessão real de utilizador.
- Decidir antes de produção se as passwords demo do seed continuam hardcoded ou passam para variáveis de ambiente.

### Decisões técnicas tomadas
- Mantido React funcional com hooks, sem TypeScript, Tailwind ou bibliotecas externas de UI.
- Login usa `/auth/login`, que é a rota real exposta pelo backend actual.
- `VITE_API_URL=http://localhost:18080` definido em `web/.env` e `web/.env.example`.
- `/users` protegido no frontend por role ADMIN e escondido da sidebar para VENDEDOR.
- Modal de nova oportunidade usa `sellerUserId` apenas para ADMIN; VENDEDOR usa o utilizador autenticado no backend.
- Artefacto `web/dist` gerado por build foi removido após validação.
- Supertest continua a requerer `npm test` fora do sandbox porque abre listener HTTP temporário.

### Estado no fim da sessão
- Backend continua funcional e testado.
- Frontend Fase 4 base está implementado e compila.
- `.gitignore` cobre `.env`, `.env.docker`, `node_modules/` e `uploads/`; `web/.gitignore` cobre `node_modules`, `dist` e artefactos locais.
- Verificação de secrets em `api/src` encontrou apenas referências de fluxo auth e passwords demo em `api/src/seed.js`; a decisão sobre mover passwords demo para env continua pendente.
- Legacy continua a correr em /Users/server/atlas/platform/n4a-crm e não foi alterado.
- Próxima sessão deve começar por `docs/SESSAO_ABRIR.md`.
