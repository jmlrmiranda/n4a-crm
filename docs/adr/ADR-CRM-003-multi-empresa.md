# ADR-CRM-003 — Modelo Multi-Empresa (Multi-Tenant)

Estado: Proposto
Data: 2026-06-23
Autores: Miranda + Claude (Anthropic)
Contexto: Decisão arquitectural antes de ir para produção

## Contexto

O CRM n4a é uma plataforma SaaS onde cada cliente da N4A é um tenant independente com isolamento completo de dados. A N4A é ela própria um tenant. O provisioning é feito pela N4A — não há registo self-service.
Este ADR define o modelo de dados, auth, e UI antes de qualquer dado de produção entrar no sistema.

## Decisão

### 1. Entidade Company (tenant)

Nova tabela Company como raiz de isolamento:

```prisma
model Company {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique  // ex: "n4a", "cliente-abc"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  users         User[]
  clients       Client[]
  opportunities Opportunity[]
}
```

Regras:

* Criada pela N4A via script de provisioning ou endpoint admin
* slug é único e imutável após criação
* Desactivar uma company bloqueia o acesso de todos os seus utilizadores

### 2. tenant_id em todas as tabelas de negócio

Todas as tabelas com dados de negócio recebem companyId:

| Tabela | Campo adicionado |
| --- | --- |
| User | companyId (FK → Company) |
| Client | companyId (FK → Company) |
| Opportunity | companyId (FK → Company) |
| Attachment | herdado via Opportunity |
| Contact | herdado via Opportunity |
| OpportunityStatusHistory | herdado via Opportunity |

Regra: companyId é obrigatório e imutável após criação. Nenhum registo existe sem empresa.

### 3. Roles

| Role | Descrição |
| --- | --- |
| ADMIN | Gestão total dentro do seu tenant |
| VENDEDOR | Acesso às suas oportunidades dentro do tenant |
| N4A_SUPPORT | Acesso total ao tenant do cliente (utilizado pela N4A para manutenção) |

Nota: N4A_SUPPORT tem acesso total funcional. Ofuscação de dados sensíveis para este role é feature futura — a arquitectura prepara o terreno (role identificado no JWT) mas a implementação da ofuscação é diferida.

### 4. JWT com empresa

O token passa a incluir companyId:

```json
{
  "sub": "user_id",
  "companyId": "company_id",
  "role": "ADMIN | VENDEDOR | N4A_SUPPORT",
  "name": "Nome do utilizador",
  "iat": 0,
  "exp": 0
}
```

Regra: Todos os pedidos autenticados têm companyId no token. O middleware injeta automaticamente o filtro de tenant em todas as queries.

### 5. Middleware de tenant

Novo middleware requireTenant que:

1. Lê companyId do token JWT
2. Verifica que a company existe e está activa
3. Injeta req.companyId para uso nas routes
4. Bloqueia qualquer pedido sem companyId válido

Todas as routes de negócio (/api/clients, /api/opps, /api/dashboard) passam por requireTenant.

### 6. Queries filtradas por tenant

Todas as queries Prisma nas routes de negócio incluem companyId:

```js
// Antes
prisma.client.findMany({ where: { ... } })

// Depois
prisma.client.findMany({ where: { companyId: req.companyId, ... } })
```

Regra: Nenhuma query de negócio é executada sem filtro de companyId. Isto é verificado em code review.

### 7. Selector de empresa na UI (para N4A_SUPPORT)

Um utilizador N4A_SUPPORT pode ter acesso a múltiplos tenants — mas o token JWT contém sempre um companyId activo de cada vez.

Fluxo:

1. Login normal → token com companyId da empresa do utilizador (N4A)
2. Se role === N4A_SUPPORT: UI mostra selector de empresa no header
3. Ao seleccionar outra empresa: pedido ao endpoint POST /auth/switch-company com targetCompanyId
4. API valida que o utilizador tem acesso a esse tenant e devolve novo token com o companyId da empresa seleccionada
5. Frontend substitui o token e recarrega os dados

UI: Badge no header mostra a empresa activa. Selector dropdown abre lista de empresas acessíveis.

### 8. Provisioning de tenant

Endpoint de admin (só acessível com role especial N4A_ADMIN ou via script):

```http
POST /admin/companies
{ name, slug }
```

→ Cria Company + primeiro utilizador ADMIN
→ Devolve credenciais iniciais

```http
POST /admin/companies/:id/support-user
```

→ Cria utilizador N4A_SUPPORT no tenant do cliente
N4A_ADMIN é um role de sistema, não exposto na UI normal.

## Contrato de Dados — JSON para Atlas Suite

O contrato existente (ADR-CRM-001) mantém-se. Passa a incluir company_id e company_name em todos os objectos de agregação:

```json
{
  "company_id": "string",
  "company_name": "string",
  "period": "YYYY-MM",
  "pipeline_total": 0.00
}
```

## Consequências

Para o schema Prisma:

* Criar modelo Company
* Adicionar companyId a User, Client, Opportunity
* Adicionar role N4A_SUPPORT e N4A_ADMIN ao enum Role
* Nova migration

Para a API:

* signToken passa a incluir companyId
* Novo middleware requireTenant
* Todas as routes de negócio usam req.companyId
* Novo endpoint POST /auth/switch-company
* Novos endpoints /admin/companies/* protegidos por N4A_ADMIN

Para a UI:

* Login mantém-se igual (companyId vem do token automaticamente)
* Header mostra empresa activa
* Selector de empresa para N4A_SUPPORT
* Todas as páginas já filtram por tenant (transparente para o utilizador)

Para os testes:

* Seed actualizado com pelo menos 2 companies (N4A + 1 cliente demo)
* Testes de isolamento: utilizador de um tenant não vê dados de outro
* Testes de switch-company para N4A_SUPPORT

Para a migração do legacy:

* Este ADR deve ser implementado antes da migração do legacy
* A migração cria a Company da N4A e associa todos os dados existentes a esse tenant

## Alternativas consideradas

JWT sem companyId — filtrar só no middleware
Rejeitado — o companyId no token é essencial para o selector de empresa e para auditoria. Sem ele, o switch-company seria impossível sem reauth completo.

Row-Level Security no Postgres
Rejeitado por complexidade operacional. O filtro por companyId nas queries é suficiente e mais simples de auditar.

Utilizador pertence a múltiplos tenants simultaneamente
Rejeitado — o modelo de um tenant activo por sessão (com switch explícito) é mais simples e mais seguro. Evita fugas de dados por queries sem filtro.

## Estado das dependências

* ADR-CRM-001 (modelo financeiro) — aprovado, contrato JSON estável
* ADR-CRM-002 (estado canónico) — aprovado, não afectado
* Schema Prisma novo: requer migration após aprovação deste ADR
* Migração do legacy: bloqueada até este ADR estar implementado
