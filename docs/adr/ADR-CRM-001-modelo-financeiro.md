ADR-CRM-001 — Modelo Financeiro Canónico do CRM n4a
Estado: Proposto Data: 2026-06-22 Autores: Miranda + Claude (Anthropic) Contexto: Sessão de auditoria e estabilização do CRM n4a

Contexto
A auditoria de 2026-06-22 identificou ausência de uma definição canónica de receita, custo e margem no CRM legacy. O campo margin existente é calculado com lógicas diferentes conforme o fluxo (criação, fecho, upload de fatura), e o campo costPrice é único sem decomposição. O reporting usa fallbacks (finalValue, amount, profit) que não existem no schema Prisma actual.
Este ADR estabelece as definições canónicas e o contrato de dados que o CRM expõe para o resto da Atlas Suite.

Decisão
1. Preço de Venda — decomposto por componente
O preço de venda de uma oportunidade é composto por quatro componentes independentes. Cada componente existe em duas versões: estimado (durante o pipeline) e real (confirmado no fecho).
Componente	Campo estimado	Campo real
Serviços	est_services	real_services
Software	est_software	real_software
Hardware	est_hardware	real_hardware
Manutenção SW+HW	est_maintenance	real_maintenance
Total	est_sell_price (calculado)	final_sell_price (calculado)
Regras:
* Os totais (est_sell_price, final_sell_price) são sempre calculados a partir dos componentes, nunca introduzidos manualmente.
* Componentes não aplicáveis a uma oportunidade ficam a 0, nunca null.
* O preço de venda estimado reflecte a última proposta enviada ao cliente.
* O preço de venda real reflecte a proposta adjudicada (documento de fecho).
2. Custo — valor global por oportunidade
O custo representa o valor total a pagar a terceiros para entregar a oportunidade (hardware, software, subcontratados). É um valor global, sem decomposição por componente.
Campo	Momento	Fonte
est_cost_price	Durante pipeline	Estimativa do vendedor
real_cost_price	Pós-fecho	Confirmado por faturas de fornecedores
Regra: real_cost_price só deve ser preenchido após existirem faturas de fornecedores registadas na oportunidade.
3. Margens — sempre calculadas, nunca introduzidas manualmente
Margem	Fórmula	Disponível quando
Margem bruta prevista	est_sell_price − est_cost_price	Sempre (durante pipeline)
Margem efectiva	final_sell_price − real_cost_price	Após fecho com custos confirmados
Regra: Nenhum campo de margem é persistido manualmente. As margens são sempre derivadas dos campos de preço e custo no momento do cálculo ou da serialização para API.
4. Documentos que alimentam o modelo
Os Attachment existentes (tipos PROPOSTA, COMPRA, FATURA) são a prova documental de cada momento financeiro:
Tipo de documento	Tipo Attachment	Impacto financeiro
Proposta ao cliente	PROPOSTA	Actualiza campos estimados
Proposta adjudicada	PROPOSTA + flag adjudicada	Confirma final_sell_price
Fatura de fornecedor	COMPRA	Alimenta real_cost_price
Fatura de cliente	FATURA	Confirma receita emitida
Contrato de Dados — JSON para Atlas Suite
O CRM expõe o seguinte contrato para consumo pelo atlas-executive-workspace, atlas-observation e frontend unificado.
Oportunidade — resumo financeiro
{
  "opp_id": "string",
  "opp_no": "string",
  "client_id": "string",
  "client_name": "string",
  "seller_id": "string",
  "seller_name": "string",
  "status": "string",
  "sale_type": "string",
  "pipeline": {
    "est_services": 0.00,
    "est_software": 0.00,
    "est_hardware": 0.00,
    "est_maintenance": 0.00,
    "est_sell_price": 0.00,
    "est_cost_price": 0.00,
    "est_gross_margin": 0.00,
    "est_gross_margin_pct": 0.00
  },
  "closing": {
    "final_services": 0.00,
    "final_software": 0.00,
    "final_hardware": 0.00,
    "final_maintenance": 0.00,
    "final_sell_price": 0.00,
    "real_cost_price": 0.00,
    "effective_margin": 0.00,
    "effective_margin_pct": 0.00
  },
  "dates": {
    "created_at": "ISO8601",
    "expected_close_date": "ISO8601 | null",
    "billing_start_date": "ISO8601 | null",
    "proposal_sent_date": "ISO8601 | null"
  }
}
Agregação — dashboard / reporting
{
  "period": "YYYY-MM",
  "pipeline_total": 0.00,
  "pipeline_count": 0,
  "won_revenue": 0.00,
  "won_count": 0,
  "won_margin": 0.00,
  "won_margin_pct": 0.00,
  "lost_count": 0,
  "win_rate": 0.00,
  "forecast": {
    "next_30": 0.00,
    "next_60": 0.00,
    "next_90": 0.00
  },
  "by_seller": [
    {
      "seller_id": "string",
      "seller_name": "string",
      "pipeline_total": 0.00,
      "won_revenue": 0.00,
      "won_margin": 0.00,
      "win_rate": 0.00
    }
  ],
  "by_type": [
    {
      "sale_type": "string",
      "pipeline_total": 0.00,
      "won_revenue": 0.00
    }
  ]
}
Consumidores declarados
Sistema	O que consome
atlas-executive-workspace	Agregação por período, por vendedor, forecast
atlas-observation	Eventos de fecho, margens efectivas, timeline
Frontend unificado (futuro)	Contrato completo de oportunidade
Consequências
Para o schema Prisma (CRM novo)
* Substituir estSellPrice por quatro campos de estimativa (est_services, est_software, est_hardware, est_maintenance)
* Substituir finalSellPrice por quatro campos reais (real_services, real_software, real_hardware, real_maintenance)
* Manter est_cost_price e adicionar real_cost_price
* Remover o campo margin persistido — a margem passa a ser calculada
Para a API
* Endpoint /opps/:id inclui sempre o bloco pipeline e closing no contrato acima
* Endpoint /dashboard adopta o contrato de agregação acima
* Nenhum endpoint aceita margin como input — é sempre output calculado
Para o reporting
* reportingModel.js passa a ser a única fonte de cálculo de margem, win rate e forecast
* Eliminar fallbacks (finalValue, amount, profit) — campos sem correspondência no schema
Para o CRM legacy
* Este ADR não altera o legacy — o legacy continua a correr como está
* As definições aqui servem de base para o schema do CRM novo em n4a-lab/platform/

Alternativas consideradas
Manter custo decomposto por componente (igual ao preço de venda) Rejeitado por simplicidade operacional — na n4a o custo é facturado globalmente por fornecedor, não componente a componente.
Persistir margens calculadas na DB Rejeitado — margem persistida pode divergir dos campos de preço se algum for actualizado sem recalcular. Margem como campo calculado garante consistência.

Estado das dependências
* ADR-CRM-002 (estado canónico) deve ser aprovado em conjunto
* Schema Prisma novo: pendente de aprovação deste ADR
* Migração do legacy: só após ADR-CRM-001 e ADR-CRM-002 aprovados
