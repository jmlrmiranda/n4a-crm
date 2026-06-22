# Protocolo de fecho de sessão — CRM n4a

## Antes de terminar

1. Corre os testes e confirma que passam:
   cd api && npm test

2. Actualiza o checkpoint:
   Adiciona secção "Actualização YYYY-MM-DD — fecho" em
   docs/CHECKPOINT_2026-06-22.md com:
   - O que foi completado nesta sessão
   - O que ficou pendente
   - Decisões técnicas tomadas
   - Estado no fim da sessão

3. Confirma que não há secrets em ficheiros tracked:
   grep -r "password\|secret\|token" api/src/ --include="*.js" \
     | grep -v "process.env\|passwordHash\|checkPassword\|hashPassword\
     |signToken\|verifyToken\|JWT_SECRET\|Bearer\|Authorization"

4. Confirma .gitignore cobre:
   - .env
   - .env.docker
   - node_modules/
   - uploads/

5. Reporta resumo de fecho para passar ao Claude

## O que reportar ao Claude no fecho
- Testes: N passed, N total
- Ficheiros criados/alterados nesta sessão
- Decisões tomadas
- O que fica para a próxima sessão
