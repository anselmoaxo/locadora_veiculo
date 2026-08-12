# Axo Locadoras

Aplicação de locação de veículos com frontend React e backend Supabase.

## Sobre o projeto

Este projeto foi desenvolvido para fins educacionais, com base no projeto apresentado no curso de Supabase da [Alura](https://www.alura.com.br/).

O código inicial e a proposta de estudo pertencem ao material do curso. A implementação deste repositório foi expandida e adaptada por Anselmo Xavier (`anselmoaxo`) durante o aprendizado, preservando no histórico Git os créditos dos autores do projeto-base.

Este é um projeto pessoal de estudo e não é um produto oficial da Alura.

## Alterações e recursos implementados

- integração do frontend React com o Supabase;
- autenticação e gerenciamento da sessão do usuário;
- cadastro e aprovação de perfis de motoristas;
- cadastro, edição e administração de veículos;
- fluxo de pesquisa e reserva de veículos;
- reservas atômicas e validações de disponibilidade no banco de dados;
- políticas de acesso, RLS e permissões administrativas;
- funções Supabase para operações sensíveis;
- personalização visual e identidade Axo Locadoras;
- documentação das responsabilidades entre frontend, API, domínio e banco de dados.

## Documentação

- [Matriz de arquitetura e responsabilidades](docs/arquitetura-e-responsabilidades.md)

Essa matriz é obrigatória para novas funcionalidades, correções e revisões do projeto.

## Executar localmente

Crie o arquivo `.env.local` com base no `.env.example` e configure as credenciais do seu projeto Supabase. Depois execute:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

O servidor local normalmente estará disponível em `http://127.0.0.1:5173`.

## Build

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build
```
