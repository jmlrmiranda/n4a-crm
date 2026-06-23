# Prompt de abertura — Claude Desktop — CRM n4a

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
2. Ler e executar `docs/SESSAO_ABRIR.md`.
3. Ler:
   - `docs/CHECKPOINT_2026-06-22.md`
   - `docs/adr/ADR-CRM-001-modelo-financeiro.md`
   - `docs/adr/ADR-CRM-002-estado-canonico.md`
   - `docs/adr/ADR-CRM-003-multi-empresa.md`
4. Confirmar:
   - `git status --short`
   - `docker ps --filter name=n4a-crm --format "table {{.Names}}\t{{.Status}}"`
   - `curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:8080/health`
5. Correr:
   - `cd api && npm test`

Estado conhecido:
- API com 97 testes a passar.
- CRM em produção em `https://crm.n4a-lab.pt`.
- Docker local expõe a API/frontend em `http://localhost:8080`.
- Últimas funcionalidades concluídas:
  - d3: filtros por período no dashboard.
  - d5: export Excel com `exceljs`.
  - me5: CRUD backend de empresas.
  - u4: alteração backend de password.

d3 — dashboard:
- `GET /api/dashboard` aceita `dateFrom` e `dateTo`.
- Os filtros só afectam métricas históricas de oportunidades `GANHA`/`PERDIDA` por `updatedAt`.
- Pipeline activo continua sem filtro temporal.
- Forecast mantém próximos 90 dias.
- UI tem date pickers `De` / `Até` e botão `Limpar`.

d5 — Excel:
- Export Excel está no frontend com `exceljs`.
- Sheets exportadas:
  - `KPIs`
  - `Por Vendedor`
  - `Por Tipo`
- `xlsx` foi removido por vulnerabilidade high sem fix.
- `exceljs@4.4.0` mantém vulnerabilidade moderada transitiva via `uuid@8.3.2`.
- Não correr `npm audit fix --force` sem decisão, porque o npm indica downgrade/breaking change para `exceljs@3.4.0`.

me5 — empresas:
- Implementado em `api/src/routes.admin.js`.
- Rotas:
  - `GET /admin/companies`
  - `POST /admin/companies`
  - `PATCH /admin/companies/:id`
  - `DELETE /admin/companies/:id`
- `PATCH` permite alterar `name`, `slug`, `isActive`.
- `DELETE` é soft delete: coloca `Company.isActive=false` e desactiva utilizadores da empresa.
- Requer `N4A_ADMIN` para criar/editar/desactivar empresas.
- A UI ainda não tem página de gestão de empresas.

u4 — alteração de password:
- Implementado em `api/src/routes.users.js`.
- Rota:
  - `PATCH /api/users/:id/password`
- Utilizador pode alterar a própria password.
- `ADMIN` pode alterar password de utilizadores da mesma empresa.
- Password mínima: 8 caracteres.
- Usa `hashPassword`.
- Não altera schema Prisma.
- A UI ainda não tem formulário de alteração de password.

Validação já feita:
- `npm test` na API: 97 passed.
- Testes funcionais por API para me5/u4:
  - empresa temporária criada;
  - empresa temporária editada;
  - validações de erro em PATCH;
  - passwords de admin/vendedor temporários alteradas;
  - permissões de vendedor validadas;
  - empresa temporária desactivada por soft delete;
  - utilizadores temporários ficaram inactivos;
  - login dos utilizadores temporários passou a `401`.
- A API foi reiniciada depois dos testes para limpar rate-limit em memória.
- Health final: `http://localhost:8080/health -> 200`.

Notas importantes:
- `support@n4a.pt` existe no seed com password demo `n4a-support-2026`.
- `support@n4a.pt` tem role `N4A_SUPPORT`, não `N4A_ADMIN`; consegue seleccionar empresas, mas não vê UI de Dashboard/Utilizadores e não cria empresas pela UI.
- A UI actual ainda não expõe criação/edição/desactivação de empresas.
- Para operar empresas no browser, é preciso implementar página frontend própria para `N4A_ADMIN`.
- Continuam passwords demo no seed; remover quando terminar a janela de testes.

Pendentes recomendados:
1. Confirmar `git status --short`.
2. Confirmar o último commit com `git log -1 --oneline`.
3. Decidir se se implementa UI para:
   - gestão de empresas;
   - alteração de password.
4. Decidir política para vulnerabilidade moderada transitiva de `exceljs`.
5. Configurar remote Git e fazer push dos commits locais.
6. Continuar validação pós-migração em `docs/MIGRACAO_LEGACY.md` fase 5.

Formato de resposta esperado:
- Reportar protocolo executado.
- Reportar testes.
- Reportar `git status`.
- Reportar próximo passo proposto.
- Não alterar produção, Prisma, Docker ou legacy sem autorização explícita.
