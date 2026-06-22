# Plano de migração — CRM legacy → CRM novo

**Data prevista:** 2026-06-23
**Responsável:** Miranda
**Estado:** Pendente

---

## Pré-requisitos (confirmar antes de começar)

- [ ] Docker novo a correr e saudável: `docker compose ps`
- [ ] Health check responde: `curl http://localhost:18080/health`
- [ ] 88 testes a passar: `cd api && npm test`
- [ ] Backup da DB legacy feito (ver secção abaixo)
- [ ] Utilizadores notificados da janela de manutenção

---

## Fase 1 — Backup do legacy

### 1.1 Backup da base de dados legacy

O legacy usa Postgres na porta 5432 (container n4a-crm-db-1).
Fazer dump antes de qualquer alteração:

docker exec n4a-crm-db-1 pg_dump -U postgres n4a_crm \
  > /Users/server/backups/n4a_crm_legacy_$(date +%Y%m%d_%H%M%S).sql

Confirmar que o ficheiro foi criado e tem tamanho > 0.

### 1.2 Backup dos ficheiros de upload do legacy

Os uploads do legacy estão em:
/Users/server/atlas/platform/n4a-crm/api/uploads/ (confirmar path)

cp -r /Users/server/atlas/platform/n4a-crm/api/uploads/ \
  /Users/server/backups/uploads_legacy_$(date +%Y%m%d_%H%M%S)/

---

## Fase 2 — Migração de dados (se necessário)

O CRM novo tem schema diferente do legacy (decomposição financeira,
campos novos, enum unificado). A migração de dados é OPCIONAL —
os dados de produção do legacy podem ser migrados ou o novo CRM
pode arrancar limpo com os utilizadores reais.

Decisão: [ ] Migrar dados legacy  [ ] Arrancar limpo

Se arrancar limpo:
- Correr seed de produção (sem passwords demo)
- Criar utilizadores reais via UI

Se migrar dados:
- Script de migração a escrever antes desta fase
- Validar dados após migração antes de continuar

---

## Fase 3 — Desligar o legacy

### 3.1 Parar os containers do legacy

cd /Users/server/atlas/platform/n4a-crm
docker compose down

Confirmar que pararam:
docker ps | grep n4a-crm

### 3.2 Verificar portas livres

lsof -i :8080
lsof -i :3000

---

## Fase 4 — Apontar tráfego para o novo

### 4.1 Actualizar CORS_ORIGIN

Se o domínio de produção for diferente de localhost:5173,
actualizar .env.docker com o URL real do frontend:
CORS_ORIGIN=https://crm.n4a-lab.pt (ou o domínio real)

### 4.2 Actualizar nginx / Cloudflare / proxy

O legacy estava exposto em porta 8080 via nginx.
O novo está em porta 18080 internamente.

Opções:
a) Actualizar nginx para apontar para 18080
b) Mudar o compose do novo para expor na 8080

Decisão a tomar no momento.

### 4.3 Actualizar o control-plane registry

cd /Users/server/n4a-lab/platform/n4a-crm
# Actualizar docs/SESSAO_ABRIR.md e control-plane com:
# - migration_status: active
# - environment: production
# - lifecycle: active

---

## Fase 5 — Validação pós-migração

- [ ] Login funciona com utilizadores reais
- [ ] Pipeline carrega
- [ ] Dashboard mostra dados correctos
- [ ] Criar oportunidade funciona
- [ ] Upload de documento funciona
- [ ] Transição de estado funciona

---

## Rollback

Se algo correr mal antes de Fase 3:
- O legacy continua a correr — não há impacto

Se algo correr mal após Fase 3:
1. Parar o novo: `docker compose down`
2. Rearrancar o legacy: `cd /Users/server/atlas/platform/n4a-crm && docker compose up -d`
3. Restaurar DB se necessário: `docker exec -i n4a-crm-db-1 psql -U postgres n4a_crm < backup.sql`

---

## Notas

- O novo CRM usa DB separada (n4a_crm no container n4a-crm-db)
- O legacy usa DB em n4a-crm-db-1 (container separado)
- Os dois podem correr em paralelo sem conflito de porta de DB
- Uploads do novo ficam em volume Docker crm-uploads
- Após migração confirmada, apagar containers e volumes do legacy
