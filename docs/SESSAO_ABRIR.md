# Protocolo de abertura de sessão — CRM n4a

## Antes de começar

1. Posiciona o Codex em:
   /Users/server/n4a-lab/platform/n4a-crm

2. Lê obrigatoriamente:
   - docs/CHECKPOINT_2026-06-22.md (estado actual)
   - docs/adr/ADR-CRM-001-modelo-financeiro.md
   - docs/adr/ADR-CRM-002-estado-canonico.md

3. Confirma o estado da DB e servidor:
   - DB local: postgresql://postgres:postgres@localhost:5432/n4a_crm_dev
   - Porta API: 18080
   - Legacy a correr em: /Users/server/atlas/platform/n4a-crm (não tocar)

4. Corre os testes para confirmar que a base está estável:
   cd api && npm test

5. Reporta:
   - Resultado dos testes
   - Última linha do checkpoint (o que ficou pendente)
   - Pronto para receber instruções

## Regras fixas desta sessão (sempre activas)
- Zero novas funcionalidades sem aprovação explícita
- Não tocar na DB sem confirmação
- Secrets nunca hardcoded
- Não tocar no legacy em /Users/server/atlas/
- Qualquer alteração ao schema Prisma requer confirmação antes de migrate
