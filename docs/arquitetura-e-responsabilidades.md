# Matriz de responsabilidades da aplicação

Esta documentação define onde cada tipo de regra deve ser implementado. Ela deve ser seguida em novas funcionalidades, correções e revisões deste projeto.

| Tipo de regra | Frontend | API | Lógica interna/domínio | Banco de dados |
| --- | --- | --- | --- | --- |
| UX | Responsável principal por máscaras, feedback, estados da tela, acessibilidade e validação rápida. | Pode retornar mensagens e códigos de erro padronizados. | Não deve conter comportamento de apresentação. | Não deve conter comportamento de apresentação. |
| Negócio | Pode apenas espelhar regras para pré-cálculo, preview e resposta imediata da interface. Não é a fonte da verdade. | Valida o contrato de entrada e orquestra o caso de uso. | É a fonte principal das regras centrais, cálculos e transições de estado. | Garante integridade, mas não deve ser a fonte principal do fluxo comum de negócio. |
| Segurança | Pode ocultar controles e apresentar orientações, mas nunca deve ser considerado confiável para autorização. | Deve aplicar autenticação, autorização, validação, rate limit quando necessário e auditoria. | Deve repetir verificações de permissão quando forem invariantes do domínio. | Deve aplicar permissões, papéis, RLS quando aplicável e princípio do menor privilégio. |
| Dados | Valida formato básico: tipos, campos obrigatórios, máscaras e intervalos simples. | Valida schema/contrato, normaliza os dados e garante idempotência em operações mutáveis quando necessário. | Garante consistência do modelo e das operações. | Garante integridade estrutural com PK, FK, UNIQUE, NOT NULL, CHECK, transações e índices apropriados. |

## Regras obrigatórias

- Validar em cada fronteira de confiança relevante.
- Nunca confiar somente na validação do frontend para regras de negócio, segurança ou integridade.
- Manter uma única fonte da verdade para regras centrais, evitando implementações divergentes.
- Colocar invariantes críticas na camada mais profunda adequada, para que clientes alternativos não consigam ignorá-las.
- Usar o frontend para experiência do usuário, não para autorização.
- Usar a API como fronteira de autenticação, validação de contrato e orquestração.
- Usar a camada de domínio para cálculos e transições de estado.
- Usar o banco para integridade, concorrência, atomicidade e controle de acesso.
- Testar proporcionalmente frontend, API, domínio e banco após mudanças.

## Exemplo aplicado à reserva de veículos

1. O frontend valida datas, apresenta mensagens e impede duplo clique.
2. A API valida JWT, contrato, limites e chave de idempotência.
3. A lógica de domínio verifica aprovação do cliente, validade da CNH e transições permitidas.
4. O banco executa a reserva em transação, impede sobreposição e aplica constraints, permissões e RLS.

## Exceções

Uma exceção só deve ser adotada quando houver uma restrição técnica real ou uma decisão explícita do responsável pelo projeto. A justificativa e as proteções equivalentes devem ser documentadas.

