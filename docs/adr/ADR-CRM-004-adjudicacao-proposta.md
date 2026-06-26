# ADR-CRM-004 — Adjudicação de Proposta

Estado: Aprovado
Data: 2026-06-27
Autores: Miranda + Codex
Contexto: Fecho v1.0 após testes manuais

## Contexto

Os testes manuais da v1.0 mostraram que o fecho positivo de uma oportunidade deve estar ligado à proposta adjudicada, não a uma transição manual genérica para GANHA.

O ADR-CRM-001 define que a proposta adjudicada confirma o valor final de venda. O ADR-CRM-002 define que qualquer alteração de estado tem de escrever `Opportunity.status` e `OpportunityStatusHistory` na mesma transacção.

## Decisão

### 1. Uma proposta por oportunidade

Cada oportunidade pode ter uma única proposta activa (`AttachmentType.PROPOSTA`).

Novo upload de `PROPOSTA` substitui a proposta anterior:

- remove o attachment anterior da base de dados
- remove o ficheiro físico anterior
- cria o novo attachment com `adjudicada=false`

Documentos `COMPRA` e `FATURA` continuam livres e podem existir vários por oportunidade.

Se a oportunidade estiver GANHA, a substituição da `PROPOSTA` é bloqueada. É necessário desadjudicar primeiro.

### 2. Adjudicar é o único caminho para GANHA

Adjudicar uma proposta é uma acção só de admin.

A transição manual para GANHA deixa de existir na UI e é bloqueada no backend com:

```json
{ "error": "ganha_requer_adjudicacao" }
```

### 3. Dados pedidos na adjudicação

O formulário de adjudicação pede apenas:

- `finalServices`
- `finalSoftware`
- `finalHardware`
- `finalMaintenance`
- `billingStartDate`

Os quatro campos de venda final são pré-preenchidos com os valores estimados da oportunidade e continuam editáveis antes de confirmar a adjudicação.

A adjudicação não pede `realCostPrice`.

### 4. Transacção de adjudicação

Ao adjudicar, numa única transacção:

1. grava `finalServices`, `finalSoftware`, `finalHardware`, `finalMaintenance`
2. grava `billingStartDate`
3. desmarca outras propostas da oportunidade
4. marca a proposta escolhida com `adjudicada=true`
5. actualiza a oportunidade para `status=GANHA`, `archived=false`, `lossReason=null`
6. cria `OpportunityStatusHistory` com transição para GANHA

Isto cumpre o ADR-CRM-002: estado e histórico são escritos atomicamente.

### 5. Após GANHA

Depois de uma oportunidade ficar GANHA:

- a venda final fica fixa na UI normal
- `realCostPrice` continua editável
- a margem efectiva continua sempre calculada a partir de venda final e custo real
- `COMPRA` e `FATURA` continuam a poder ser carregadas para consolidar o custo real

A margem efectiva nunca é persistida, conforme ADR-CRM-001.

### 6. Desadjudicar

Desadjudicar é uma acção só de admin.

Quando permitido:

- desmarca a proposta adjudicada
- volta a oportunidade para `NEGOCIACAO`
- regista `OpportunityStatusHistory` com nota `Adjudicação revertida`
- mantém os valores finais e `billingStartDate`

Desadjudicar é bloqueado se:

- `realCostPrice > 0`
- existir algum documento `COMPRA` ou `FATURA`

Estes bloqueios evitam reabrir uma oportunidade que já entrou em execução financeira.

## Limitação assumida v1.0

A proposta-documento não guarda valores próprios.

Os valores finais usados na adjudicação vêm dos valores estimados da oportunidade, são editados no formulário de adjudicação e ficam gravados na própria oportunidade.

## Futuro v1.1

- Guardar valores próprios por proposta-documento.
- Alertar quando valores adjudicados diferem dos valores lidos/registados na proposta.
- Permitir ver/download da proposta a partir da ficha do cliente.

## Consequências

Para a API:

- `POST /api/opps/:id/status` recusa `toStatus=GANHA`.
- `PATCH /api/opps/:id/attachments/:attId/adjudicar` passa a ser o fluxo canónico de fecho positivo.
- `PATCH /api/opps/:id/attachments/:attId/desadjudicar` reverte adjudicação com bloqueios financeiros.
- `POST /api/opps/:id/attachments` substitui proposta anterior apenas para `PROPOSTA`.

Para a UI:

- o selector de estado deixa de mostrar GANHA
- o botão Adjudicar abre formulário financeiro final
- a venda final fica bloqueada após GANHA
- o custo real continua editável após GANHA

Para testes:

- cobertura adicionada para substituição de proposta
- adjudicação com valores finais, data, histórico e estado GANHA
- bloqueios de permissão, valores, data, GANHA manual e desadjudicação
