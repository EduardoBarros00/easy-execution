
# LabProt — Sistema de Gestão de Laboratório de Prótese (MVP)

## Objetivo desta fase

Entregar um sistema enxuto, rápido e bonito, focado no fluxo diário real do laboratório: cadastrar cliente, abrir OS, acompanhar produção, registrar pagamentos e ver o resultado no dashboard. Demais módulos do escopo (nota fiscal, fornecedores, estoque, integrações bancárias, multiusuário com permissões, etc.) ficam planejados para fases seguintes.

## Módulos incluídos na Fase 1

1. **Autenticação** — login simples (e-mail + senha), recuperação de senha.
2. **Dashboard** — fluxo de caixa (dia/semana/mês), entradas, saídas, lucro líquido, OS em andamento, entregues e atrasadas, gráfico de receita x despesa, alertas de pagamentos e entregas.
3. **Clientes (Dentistas/Clínicas)** — CRUD completo, histórico de OS e situação financeira, botão WhatsApp.
4. **Protéticos** — CRUD, especialidade, comissão padrão, ranking simples de produtividade.
5. **Ordens de Serviço (OS)** — número automático, paciente, dentista, tipo de prótese, datas (envio/previsto/entrega), status, valor, custos, lucro, fotos anexadas, observações, responsável técnico, histórico de mudanças de status.
6. **Tipos de prótese** — PPR, PT, fixa, coroa, implante, ortodontia, outros — com margem e tempo médio agregados nos relatórios.
7. **Financeiro básico** — receitas e despesas, contas a pagar/receber vinculadas a OS, categorias, marcação de pago/pendente, anexo de comprovante, recibo em PDF.
8. **Relatórios essenciais** — financeiro por período, por dentista, por protético, por tipo de prótese, exportação PDF/CSV.

## Identidade visual

- Estilo clínico/profissional: branco como base, azul como cor primária, cinzas neutros.
- Tipografia limpa (Inter).
- Layout com sidebar colapsável + header com busca global.
- Cards de dashboard com números grandes e gráficos discretos (Recharts).
- Totalmente responsivo (mobile usa sidebar off-canvas).
- Dark mode incluído (toggle no header).

## Estrutura de telas

```
/login
/                       Dashboard
/os                     Lista de Ordens de Serviço
/os/nova                Nova OS
/os/$id                 Detalhe / edição de OS
/clientes               Lista
/clientes/$id           Detalhe (dados + histórico + financeiro)
/proteticos             Lista
/proteticos/$id         Detalhe (produção + comissões)
/financeiro             Visão geral (caixa, a pagar, a receber)
/financeiro/lancamentos Lista de lançamentos
/relatorios             Filtros e exportação
/configuracoes          Perfil, tipos de prótese, categorias
```

## Integração WhatsApp

Botão em cliente/OS que abre `https://wa.me/<telefone>?text=<mensagem prontificada>`. Sem API oficial, sem custos.

## Detalhes técnicos

- **Frontend**: TanStack Start + React + Tailwind + shadcn/ui + Recharts (já é o stack do projeto).
- **Backend**: Lovable Cloud (Postgres + Auth + Storage) — habilitado nesta fase.
- **Auth**: e-mail/senha do Lovable Cloud, sem perfis distintos por enquanto (todo usuário logado é admin).
- **Banco** (tabelas principais):
  - `profiles` (1×1 com auth.users)
  - `clients` (dentistas/clínicas)
  - `technicians` (protéticos)
  - `prosthesis_types` (catálogo: PPR, PT, etc.)
  - `service_orders` (OS) + `service_order_photos` + `service_order_history`
  - `service_order_costs` (materiais/mão de obra por OS)
  - `finance_categories`
  - `finance_entries` (receitas/despesas, com FK opcional para OS e cliente)
  - `attachments` (comprovantes/fotos, no Storage)
- **RLS**: ativado em todas as tabelas; políticas escopadas ao usuário autenticado.
- **Storage**: bucket privado `os-photos` e `comprovantes`.
- **PDF/CSV**: geração no cliente (jspdf / papaparse).
- **Numeração de OS**: sequência no banco, formato `OS-2026-0001`.

## Fora desta fase (registrado para depois)

Nota fiscal, fornecedores, prestadores de serviço, estoque/validade de materiais, agenda de entregas/coletas, PIX/integração bancária, multiusuário com perfis e permissões, assinatura digital, log de atividades, metas, comissão automática avançada, backup/exportação completa, criptografia adicional.

## Próximos passos após sua aprovação

1. Habilitar Lovable Cloud e criar o schema do banco com RLS.
2. Configurar tema visual (tokens azuis/brancos + dark mode) e layout base com sidebar.
3. Implementar auth + telas de login/recuperação.
4. Construir CRUDs: Clientes, Protéticos, Tipos de Prótese.
5. Construir módulo de OS (lista, criar, detalhe, upload de fotos, histórico).
6. Construir módulo financeiro (lançamentos, a pagar/receber, recibo).
7. Construir Dashboard com queries agregadas e gráficos.
8. Construir Relatórios com filtros e exportação.

Quer ajustar algum item antes de eu começar a implementação?
