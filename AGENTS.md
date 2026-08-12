# Instruções do projeto

## Arquitetura obrigatória

- Siga a matriz descrita em `docs/arquitetura-e-responsabilidades.md` em toda implementação e revisão.
- UX pertence principalmente ao frontend.
- A API é responsável por autenticação, validação de contrato e orquestração.
- Regras centrais, cálculos e transições de estado pertencem à lógica de domínio.
- O banco deve garantir integridade, atomicidade, concorrência, permissões, RLS e menor privilégio.
- Nunca confie no frontend para autorização, segurança, regras centrais ou integridade.
- Sempre valide mudanças nas camadas afetadas e entregue um resumo do que foi feito, verificado e do que ficou pendente.

