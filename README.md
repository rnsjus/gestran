# GESTRAN · CEDAT

Sistema de Gestão Estratégica de Transações — PROFAZ/CEDAT · PGM Fortaleza
Operacionaliza a Instrução Normativa nº 001/2026.

## Início rápido

1. Abra `index.html` no navegador (não precisa de servidor nem build).
2. Entre como **Dra. Valéria Lopes — Administrador**, senha `admin`.
3. Explore: Dashboard · Registro (lista e Kanban) · Sessões · Monitorar · Relatórios · Auditoria · Admin.

Atalhos: `Ctrl+K` busca global · `Alt+1..7` troca de aba · `Alt+M` recolhe o menu · `Esc` fecha modais.

## O que o sistema faz

- **Registro** dos eventos processuais com os campos mínimos do art. 9º, linha do tempo por processo
  e busca de empresa por CNPJ para atualizar cadastro.
- **Sessões** das turmas com calendário, controle de quórum, detecção de conflito de horário,
  e módulo de afastamentos com redistribuição automática do acervo (arts. 5º a 7º).
- **Monitoramento** dos acordos: parcelas, adimplência, perda por 90 dias de atraso (ato formal,
  reversível) e relatório em PDF por empresa.
- **Dashboard** com as métricas do art. 10 derivadas dos dados reais, prescrição/decadência
  (CTN arts. 173/174), gargalos por etapa e fluxo de valores.
- **Governança**: perfis de acesso (RBAC), gestão de contas pelo Administrador, trilha de auditoria
  e diagnóstico de integridade.

## Estrutura

```
gestran-cedat/
├── index.html      → a aplicação inteira (HTML + CSS + JS)
├── CLAUDE.md       → contexto de arquitetura e regras (leia antes de alterar)
├── backend/        → Apps Script + guia de implantação + planilha modelo
├── brand/          → marca em SVG
├── docs/           → estudo técnico e a IN nº 001/2026
└── tests/          → teste de fumaça da inicialização
```

## Desenvolvimento

Antes de qualquer commit que toque no `<script>`:

```bash
node tests/smoke-init.mjs     # precisa terminar com "✅ init OK"
```

Sintaxe válida não garante execução — esse teste existe porque um `ReferenceError`
na inicialização já derrubou a tela de login inteira.

## Persistência (opcional)

Por padrão os dados vivem na memória do navegador (modo demonstração, com base simulada
que cobre todos os cenários: prescrição crítica, acordo perdido, afastamento longo etc.).

Para persistir de verdade, siga `backend/GESTRAN-Sheets-Guia-de-Implantacao.md`:
publique o `Code.gs` como App da Web e cole a URL em **Admin → Integração Google Sheets**.
A partir daí toda alteração é enfileirada, sincronizada com retentativa e auditada no servidor.

## Aviso

Protótipo funcional para avaliação. Antes de uso em produção com dados reais de contribuintes:
autenticação institucional (OAuth), revisão de LGPD e testes das regras jurídicas com a área técnica.
