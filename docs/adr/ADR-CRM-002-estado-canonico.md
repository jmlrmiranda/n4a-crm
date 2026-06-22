ADR-CRM-002 — Estado Canónico e Transições de Oportunidade
Estado: Proposto Data: 2026-06-22 Autores: Miranda + Claude (Anthropic) Contexto: Sessão de auditoria e estabilização do CRM n4a

Contexto
A auditoria de 2026-06-22 identificou que o modelo de transições de estado do CRM legacy está bem desenhado conceptualmente, mas a execução é inconsistente:
* mark-won e mark-lost actualizam Opportunity.status mas não criam evento em OpportunityStatusHistory
* Upload de proposta cria histórico mas não actualiza Opportunity.status
* POST /opps/:id/status cria histórico mas não actualiza Opportunity.status
* Upload de fatura actualiza ambos, mas só parcialmente
Resultado: dashboard, KPIs, locks e timeline podem mostrar estados diferentes para a mesma oportunidade.
Este ADR adopta o modelo de estados do legacy e define a regra de execução canónica.

Decisão
1. Estados válidos
Mantém-se o conjunto de estados do legacy:
Estado	Significado
ABERTA	Oportunidade identificada, em qualificação
PROPOSTA_EM_PREPARACAO	Proposta a ser elaborada
PROPOSTA_ENVIADA	Proposta enviada ao cliente
NEGOCIACAO	Em negociação activa
GANHA	Adjudicada — fecho positivo
PERDIDA	Não adjudicada — fecho negativo
2. Fonte de verdade
Opportunity.status é a fonte de verdade de estado.
OpportunityStatusHistory é o registo auditável das transições — existe para rastreabilidade, não como fonte primária de estado para agregações ou locks.
Regra fundamental: qualquer operação que mude o estado de uma oportunidade deve escrever em Opportunity.status e em OpportunityStatusHistory na mesma transacção de base de dados. Se uma falha, ambas falham.
3. Transições permitidas
ABERTA → PROPOSTA_EM_PREPARACAO
ABERTA → PERDIDA

PROPOSTA_EM_PREPARACAO → PROPOSTA_ENVIADA
PROPOSTA_EM_PREPARACAO → PERDIDA

PROPOSTA_ENVIADA → NEGOCIACAO
PROPOSTA_ENVIADA → GANHA
PROPOSTA_ENVIADA → PERDIDA

NEGOCIACAO → GANHA
NEGOCIACAO → PERDIDA

GANHA → (bloqueado)
PERDIDA → (bloqueado)
GANHA e PERDIDA são estados terminais. Uma oportunidade nestes estados não pode ser transitada — apenas lida.
4. Campos associados a transições específicas
Certas transições têm efeitos secundários obrigatórios, executados na mesma transacção:
Transição	Efeito secundário
→ PROPOSTA_ENVIADA	proposalSentDate = data actual (se não preenchida)
→ GANHA	archived = false; lossReason = null
→ PERDIDA	archived = true; lossReason obrigatório
5. Campo archived
archived é um campo de gestão de pipeline, não de estado. Uma oportunidade PERDIDA é automaticamente arquivada. Uma oportunidade GANHA nunca é arquivada — vive no histórico activo. Oportunidades em estados intermédios podem ser arquivadas manualmente pelo ADMIN para limpeza de pipeline, sem alterar o estado.

Contrato de Dados — JSON para Atlas Suite
Oportunidade — estado e histórico
{
  "opp_id": "string",
  "opp_no": "string",
  "status": "ABERTA | PROPOSTA_EM_PREPARACAO | PROPOSTA_ENVIADA | NEGOCIACAO | GANHA | PERDIDA",
  "archived": false,
  "loss_reason": "string | null",
  "status_history": [
    {
      "from_status": "string | null",
      "to_status": "string",
      "note": "string | null",
      "changed_by": "string",
      "changed_at": "ISO8601"
    }
  ],
  "last_status_change": "ISO8601"
}
Evento de transição — publicado para consumidores externos
Quando uma oportunidade muda de estado, o CRM publica o seguinte evento:
{
  "event": "opportunity.status_changed",
  "source": "n4a-crm",
  "timestamp": "ISO8601",
  "payload": {
    "opp_id": "string",
    "opp_no": "string",
    "client_id": "string",
    "seller_id": "string",
    "from_status": "string | null",
    "to_status": "string",
    "changed_by": "string",
    "note": "string | null"
  }
}
Consumidores declarados
Sistema	O que consome
atlas-executive-workspace	Eventos de fecho (GANHA, PERDIDA), win rate, pipeline activo
atlas-observation	Histórico completo de transições, tempo por estado, funil de conversão
Frontend unificado (futuro)	Estado actual + histórico para visualização de timeline
Consequências
Para a API (CRM novo)
* Criar uma função central transitionStatus(oppId, toStatus, userId, note?) que:
    1. Valida a transição (origem → destino permitido)
    2. Aplica efeitos secundários (datas, lossReason, archived)
    3. Escreve em Opportunity e OpportunityStatusHistory na mesma transacção Prisma
    4. Publica o evento para consumidores externos
* Todos os fluxos que mudam estado (mark-won, mark-lost, upload de proposta, upload de fatura, POST /status) passam a chamar esta função — sem excepção
Para o schema Prisma (CRM novo)
* Consolidar os dois enums (OppStatus e OpportunityStatus) num único enum OpportunityStatus
* Garantir que Opportunity.status usa esse enum único
Para o reporting e dashboard
* Todas as agregações de estado usam Opportunity.status — nunca inferem estado a partir do histórico
* OpportunityStatusHistory é usado exclusivamente para timeline, tempo por estado e funil de conversão
Para o CRM legacy
* Este ADR não altera o legacy — o legacy continua a correr como está
* A função transitionStatus é implementada no CRM novo em n4a-lab/platform/

Alternativas consideradas
Usar OpportunityStatusHistory como fonte de verdade (estado = último evento do histórico) Rejeitado — obrigaria todas as queries de agregação a fazer subqueries no histórico, com impacto em performance e complexidade. O campo status persistido na oportunidade é mais simples e directo para leituras.
Manter os dois enums separados Rejeitado — a duplicação (OppStatus e OpportunityStatus) é dívida técnica sem benefício identificado. Um único enum elimina ambiguidade.

Estado das dependências
* ADR-CRM-001 (modelo financeiro) deve ser aprovado em conjunto
* Schema Prisma novo: pendente de aprovação deste ADR
* Migração do legacy: só após ADR-CRM-001 e ADR-CRM-002 aprovados
