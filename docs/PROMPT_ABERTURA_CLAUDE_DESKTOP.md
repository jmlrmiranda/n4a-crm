# Prompt de abertura — próxima sessão CRM n4a

Contexto:
- Repo: `/Users/server/n4a-lab/platform/n4a-crm`
- Produção: `https://crm.n4a-lab.pt`
- Legacy: `/Users/server/atlas/platform/n4a-crm`
- Não tocar no legacy.
- Não fazer migrations Prisma sem confirmação explícita.
- Não alterar schema Prisma sem confirmação explícita.
- Não apagar dados.
- Não fazer commit sem confirmação explícita.

Primeiro passo obrigatório:
1. Entrar no repo:
   `cd /Users/server/n4a-lab/platform/n4a-crm`
2. Ler e executar:
   `docs/SESSAO_ABRIR.md`
3. Ler:
   - `docs/CHECKPOINT_2026-06-22.md`
   - `docs/adr/ADR-CRM-001-modelo-financeiro.md`
   - `docs/adr/ADR-CRM-002-estado-canonico.md`
   - `docs/adr/ADR-CRM-003-multi-empresa.md`
4. Confirmar:
   - `git status --short`
   - `git log --oneline -8`
   - `docker ps --filter name=n4a-crm --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
   - `curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:8080/health`
5. Correr:
   - `cd api && npm test`

Estado esperado:
- Working tree deve estar limpo.
- API deve ter 97 testes a passar.
- Docker actual expõe CRM em `http://localhost:8080`.
- O protocolo antigo menciona porta 18080, mas o estado pós-migração usa 8080.
- Repositório ainda não tem remote Git configurado.

Commits recentes importantes:
- `fc269ba` — `docs: checkpoint fecho Sessão B`
- `c87afd2` — `feat: UI alterar password (u4)`
- `898c33c` — `feat: UI gestão de empresas (me5) + N4A_ADMIN ganha switch-company`
- `bc00021` — `feat: CRUD empresas e alteração de password`
- `8879d66` — `feat: dashboard — filtros por período (d3) e export Excel exceljs (d5)`
- `fad1afe` — `chore: script criar-utilizadores-reais, fecho sessão pós-migração`
- `cb8e031` — `feat: produção — frontend estático, trust proxy, CORS produção, fixup tenant`
- `603f0be` — `feat: multi-empresa completo — ADR-003, schema, API, UI, 97 testes`

Estado funcional concluído:
- d3: dashboard com filtros por período:
  - `GET /api/dashboard?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
  - filtros aplicam-se a GANHA/PERDIDA por `updatedAt`
  - pipeline activo continua intemporal
  - forecast mantém próximos 90 dias
- d5: export Excel no frontend com `exceljs`
  - sheets: `KPIs`, `Por Vendedor`, `Por Tipo`
  - `xlsx` removido por vulnerabilidade high sem fix
  - `exceljs@4.4.0` aceite apesar de vulnerabilidade moderada transitiva `uuid@8.3.2`
- me5 backend:
  - `GET /admin/companies`
  - `POST /admin/companies`
  - `PATCH /admin/companies/:id`
  - `DELETE /admin/companies/:id`
- me5 UI:
  - `CompaniesPage`
  - rota `/empresas`
  - guard `N4AAdminRoute`
  - link “Empresas” no menu
  - listar, criar, editar, desactivar tenants
  - apenas `N4A_ADMIN`
- permissões Opção C:
  - `switch-company` aceita `N4A_ADMIN` e `N4A_SUPPORT`
  - `support@n4a.pt` foi promovido para `N4A_ADMIN` na DB de produção
- u4 backend:
  - `PATCH /api/users/:id/password`
  - próprio utilizador pode alterar a própria password
  - `ADMIN` pode alterar password de utilizadores da mesma empresa
  - mínimo 8 caracteres
- u4 UI:
  - `ChangePasswordModal`
  - botão `Password` no topbar para qualquer utilizador
  - botão `Password` por linha na `UsersPage` para `ADMIN`

Roles actuais:
- `ADMIN`: admin de empresa. Vê dashboard, utilizadores e pode alterar passwords da empresa.
- `VENDEDOR`: comercial. Pode alterar apenas a própria password.
- `N4A_SUPPORT`: pode fazer switch de empresa.
- `N4A_ADMIN`: pode fazer switch de empresa e gerir tenants pela UI.

Credenciais demo conhecidas:
- `support@n4a.pt` tem role `N4A_ADMIN`.
- Password seed do suporte: `n4a-support-2026`.
- `ana@n4a.pt` tem password seed: `n4a-vendas-2026`.
- Existem utilizadores reais criados via script com password definida por env, não hardcoded.

Notas de dados:
- Empresa de teste `teste-ui` ficou desactivada por soft delete na DB.
- Dados demo continuam presentes e só devem ser removidos após a janela de testes.
- Passwords demo continuam no `api/src/seed.js`; isto é pendência conhecida.

Validações já feitas:
- API: 97 testes a passar.
- Testes funcionais por API:
  - me5: criar/listar/editar/desactivar empresa.
  - permissões: `N4A_ADMIN` consegue `switch-company`.
  - u4: ADMIN altera password de vendedor; vendedor não altera password de outro; password curta dá 400; password da Ana reposta ao seed.
- UI compilou e passou lint nos blocos implementados.

Pendentes recomendados para próxima sessão:
1. Verificar acesso externo em `https://crm.n4a-lab.pt` após Cloudflare resolver.
2. Configurar remote Git e fazer push de TODOS os commits locais.
3. Remover dados demo do seed + empresa de teste `teste-ui` depois da janela de testes.
4. Decidir política para vulnerabilidade moderada transitiva de `exceljs`.
5. d4: relatório PDF, pendente e mais pesado; provável `pdfkit` no backend, sem mexer em Prisma salvo confirmação.
6. Continuar validação pós-migração em `docs/MIGRACAO_LEGACY.md` fase 5.

Se a próxima sessão for sobre d4 relatório PDF:
- Antes de implementar, auditar:
  - `api/src/routes.dashboard.js`
  - `api/src/routes.opps.js`
  - `web/src/pages/DashboardPage.jsx`
  - `web/src/pages/OpportunityPage.jsx`
- Confirmar exactamente que relatório se quer:
  - dashboard agregado por período?
  - oportunidade individual?
  - pipeline completo?
- Não instalar dependências novas sem reportar o impacto.

Formato esperado de resposta inicial:
- Reportar protocolo executado.
- Reportar testes.
- Reportar estado Docker/health.
- Reportar `git status`.
- Reportar último checkpoint/pendências.
- Aguardar instruções antes de alterações.
