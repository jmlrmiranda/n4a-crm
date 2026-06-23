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

## Actualização 2026-06-23 — fecho sessão 2

### Completado nesta sessão

#### Backend
- GET /api/clients/:id com oportunidades (alinha com UI)

#### Frontend — acções do detalhe de oportunidade
- Transições de estado com painel inline, nota, motivo de perda obrigatório
- Edição inline de valores financeiros com recálculo em tempo real
- Upload de documentos PDF com tipo PROPOSTA/COMPRA/FATURA
- Adicionar contacto com formulário inline

#### Frontend — novas funcionalidades
- Modal de criar cliente
- Modal de criar utilizador
- Adjudicar proposta com badge Adjudicada em magenta
- Porta Vite fixada em 5173 (strictPort: true)

#### Infraestrutura
- git init + primeiro commit (dcaf1b8, 67 ficheiros)
- .gitignore na raiz cobre node_modules, .env, .env.docker, uploads, web/dist

### Decisões técnicas tomadas
- Mantidos modais React sem bibliotecas externas, reutilizando o estilo visual do NewOppModal.
- As acções novas actualizam estado local quando possível, evitando reload completo da página.
- Vite fica fixo em 5173 para manter CORS estável com a API.
- `CORS_ORIGIN` local da API fica em `http://localhost:5173`.

### Estado no fim desta sessão
- CRM operacionalmente funcional end-to-end
- Backend versionado no git
- Todas as acções core disponíveis na UI
- CORS_ORIGIN da API deve ficar em localhost:5173 permanentemente
- Testes executados no fecho: 53 passed, 53 total

### Pendente para próxima sessão
- Editar cliente (UI — API existe)
- Testes de integração para as novas routes (clients, opps)
- Seed actualizado com dados de documentos e contactos
- Variáveis de produção (.env.docker com valores reais)
- Registo no control-plane actualizado

## Actualização 2026-06-23 — fecho sessão 3

### Completado nesta sessão

#### Frontend
- Editar cliente: edição inline com PATCH /api/clients/:id
- Arquivar/desarquivar oportunidade: toggle no header da oportunidade

#### Backend
- PATCH /api/opps/:id aceita archived: boolean
- Bloqueio de alterações manuais em estados terminais GANHA/PERDIDA

#### Testes
- routes.clients.test.js: cobertura de GET, POST, PATCH, GET/:id
- routes.opps.test.js: cobertura de GET, POST, GET/:id, POST/:id/status, GET /dashboard
- Total: 88 testes, 5 suites, todos a passar

#### Infraestrutura
- .env.docker criado com valores de produção (JWT_SECRET e CRM_DB_PASSWORD reais)
- Docker validado end-to-end: build, migration automática, health check
- docs/MIGRACAO_LEGACY.md: plano completo de migração com fases, backup, rollback

#### Git
- Commit 8435e72: acções de detalhe, formulários, testes
- Commit 89cf443: editar cliente, arquivar opp, 88 testes, Docker validado, plano de migração

### Decisões técnicas tomadas
- Arquivar/desarquivar usa PATCH /api/opps/:id com `archived: boolean`, sem alterar schema.
- Estados terminais GANHA/PERDIDA continuam bloqueados para alterações manuais de arquivo.
- Testes de integração usam mocks de Prisma e transitions para não tocar na DB real.
- Multi-empresa foi identificado como decisão arquitectural futura, sem implementação nesta sessão.

### Estado no fim desta sessão
- CRM operacionalmente completo para migração
- Docker testado e funcional em produção
- Plano de migração documentado e pronto a executar
- 88 testes a passar

### Pendente para próxima sessão (migração)
- Executar MIGRACAO_LEGACY.md: backup, desligar legacy, apontar tráfego
- Decidir: migrar dados legacy ou arrancar limpo
- Actualizar CORS_ORIGIN para domínio de produção
- Actualizar nginx/proxy para apontar para novo CRM

### Funcionalidade futura prioritária identificada
- Multi-empresa: o CRM precisa de suportar múltiplas empresas/organizações
  com isolamento de dados, utilizadores e dashboard por empresa.
  Impacto: schema (tenant_id em todas as tabelas), auth (JWT com empresa),
  dashboard (agregações por empresa), UI (selector de empresa).
  Decisão arquitectural antes de qualquer implementação.

## Actualização 2026-06-23 — multi-empresa

### Completado
- ADR-CRM-003: modelo multi-empresa documentado e aprovado
- Schema: Company, companyId em User/Client/Opportunity,
  roles N4A_SUPPORT e N4A_ADMIN
- Migration: 20260623072538_add_multi_tenant aplicada
- API: requireTenant, switch-company, /admin/companies
- Seed: 2 companies (N4A + Cliente Demo), Support User
- UI: empresa activa no header, dropdown para N4A_SUPPORT
- 97 testes a passar
- Isolamento validado end-to-end no browser

### Estado
- Multi-empresa funcional e testado
- Pronto para migração do legacy
- Migração cria company N4A e associa todos os dados existentes

### Próxima sessão
- Executar docs/MIGRACAO_LEGACY.md
- Decidir: migrar dados legacy ou arrancar limpo

## Actualização 2026-06-23 — multi-empresa e fecho

### Completado nesta sessão
- ADR-CRM-003: modelo multi-empresa documentado e aprovado
- Schema: Company, companyId em User/Client/Opportunity,
  roles N4A_SUPPORT e N4A_ADMIN
- Migration: 20260623072538_add_multi_tenant aplicada
- API: requireTenant, switch-company, /admin/companies
- Seed: 2 companies (N4A + Cliente Demo), Support User
- UI: empresa activa no header, dropdown para N4A_SUPPORT
- 97 testes a passar
- Isolamento de tenant validado end-to-end no browser

### Estado no fim desta sessão
- Multi-empresa funcional e testado
- CRM pronto para migração do legacy
- Migração cria company N4A e associa todos os dados existentes

### Próxima sessão — migração
- Executar docs/MIGRACAO_LEGACY.md fase a fase
- Decisão: migrar dados legacy ou arrancar limpo
- Actualizar CORS_ORIGIN para domínio de produção
- Actualizar nginx/proxy

## Actualização 2026-06-23 — fecho sessão migração

### Completado nesta sessão
- Frontend servido pela API Express (express.static + catch-all React Router)
- app.set("trust proxy", 1) para rate-limit atrás de nginx
- VITE_API_URL= (URLs relativas em produção)
- Docker exposto na porta 8080 (alinhado com nginx legacy)
- CORS_ORIGIN=https://crm.n4a-lab.pt
- Seed corrido em produção (4 users, 5 clients, 8 opps)
- fixup-tenant.js: associou clients e opps ao tenant N4A
- Cloudflare Access removido de todas as aplicações
- CRM acessível em https://crm.n4a-lab.pt (login funcional)
- Pipeline bloqueado por Cloudflare Access com degraded performance (incidente activo)

### Estado
- CRM em produção em https://crm.n4a-lab.pt
- Cloudflare Access removido — só Tunnel activo
- Pipeline vai funcionar quando Cloudflare resolver o incidente
- DB de produção com dados do seed + fixup de tenant

### Próxima sessão (nova thread)
- Verificar que pipeline carrega após Cloudflare resolver
- Criar utilizadores reais (Miranda e equipa)
- Remover dados demo do seed de produção
- Commit e push do estado actual
