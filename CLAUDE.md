# GESTRAN · CEDAT — contexto do projeto

Sistema de **Gestão Estratégica de Transações** da Procuradoria da Fazenda Pública Municipal
(PROFAZ/CEDAT — PGM Fortaleza). Operacionaliza a **Instrução Normativa nº 001/2026**:
composição das turmas das Câmaras de Prevenção e Resolução de Conflitos, sessões,
monitoramento das transações e prestação de contas.

## Como rodar

O app é um **arquivo único** (`index.html`), sem build e sem dependências além do Chart.js (CDN).

```bash
# abrir direto no navegador
start index.html          # Windows
open index.html           # macOS

# teste de fumaça (obrigatório após qualquer alteração no <script>)
node tests/smoke-init.mjs
```

**Credenciais de demonstração:** gestor `admin` · CEDAT `cedat` · demais `123`.

## Arquitetura

Quatro camadas dentro do mesmo arquivo:

| Camada | Onde | Responsabilidade |
|---|---|---|
| Dados | topo do `<script>` | `processos[]`, `acordos[]`, `sess[]`, `afastamentos[]`, `usuarios[]`, `perms{}` |
| Regras | funções `calc`, `calcPrescricao`, `montarBase` | derivam estado a partir dos eventos |
| Apresentação | funções `render*` | escrevem HTML nas tabelas/painéis |
| Sincronização | objeto `GS` | fila persistente → Apps Script → Google Sheets |

### Princípio central: event-sourcing

O **evento processual é a fonte da verdade**. Nada de estado duplicado:

- `processos[].eventos[]` guarda a linha do tempo (Protocolo → Distribuição → Sessão →
  Deliberação → Acordo celebrado → Pagamento → Rescisão).
- `calc(acordo)` deriva pago, saldo, atraso e situação **a partir de `acordo.parcelas[]`**.
- `montarBase()` deriva a base do Dashboard de `processos` + `acordos`.
  **Nunca** criar uma segunda fonte de números para o Dashboard — esse foi um bug corrigido.

### Chave de ligação

O **número do processo** (`num` / `proc`) liga Registro ↔ Monitoramento ↔ Kanban.
`vincularRegistro(evento, dados)` é o ponto único de integração:
`Acordo celebrado` cria o acordo · `Pagamento` baixa parcela · `Rescisão` encerra.

## Regras de negócio (não alterar sem base normativa)

- **Quórum** — removido por decisão do usuário (não normativa): o sistema não controla mais nº de
  votantes por sessão. Não reintroduzir campo/validação de quórum sem pedido explícito.
- **Afastamento > 30 dias** — exige redistribuição do acervo (art. 6º); abaixo disso, suplente (art. 7º).
- **Perda da negociação** — `LIMITE_PERDA = 90` dias de atraso. O sistema **sinaliza**
  (`c.perdaDevida`) mas a perda só vale como **ato formal** (`acordo.perda = {data, por, papel, motivo}`),
  reversível com justificativa.
- **Prescrição** — 5 anos da constituição definitiva (CTN art. 174). Interrompida pela confissão
  no acordo; suspensa por parcelamento adimplente (art. 151, VI); **volta a correr a partir da perda**.
- **Administrador** — acesso irrestrito, ignora a matriz de permissões; é quem cria logins.
  Salvaguarda: o sistema impede ficar sem nenhum Administrador ativo.

## Convenções de código

- Português nos identificadores de domínio (`processos`, `acordos`, `renderProc`).
- Valores monetários em **reais** nas entidades; a base do Dashboard usa **R$ mil**
  (`fMi()` divide por 1000). Atenção ao misturar.
- Datas como string `YYYY-MM-DD`; `iso()`, `addDays()`, `dDays()`, `fD()`, `fDataBR()` são os helpers.
- Toda ação que altera dados deve: atualizar o estado → `GS.push(...)` → `log(tipo, detalhe)` → `toast(...)`.
- Tokens de cor em `:root` (teal `--azul`, coral `--dourado`, navy `--navy`); tema escuro em `[data-theme="dark"]`.
- **Nunca** usar `window.open` para relatórios — usar `imprimirHTML(html, titulo)` (iframe, à prova de bloqueador).

## Armadilhas conhecidas

1. **`applyFilters()` tinha uma variável local `acordos`** que sombreava a lista global.
   Foi renomeada para `ac`. Cuidado ao reintroduzir sombreamento — um `ReferenceError` ali
   derruba a inicialização inteira e o login some.
2. A inicialização é feita por `passo(nome, fn)`, que isola falhas. **Mantenha esse padrão**:
   credenciais e `initSelects()` vêm primeiro, para o login nunca depender do resto.
3. `crypto.subtle` pode não existir em contexto inseguro — `hashSenha()` tem fallback determinístico.
4. Sintaxe válida ≠ app funcionando. Rode `tests/smoke-init.mjs`.

## Backend (opcional)

`backend/Code.gs` publica um App da Web no Apps Script sobre uma planilha Google.
Valida o papel **no servidor** antes de gravar, carimba usuário/data e usa controle
de concorrência otimista (`rev`) com `LockService`. Passo a passo em
`backend/GESTRAN-Sheets-Guia-de-Implantacao.md`. Sem URL configurada, o app roda em memória.

## Estado atual e próximos passos

Concluído: Dashboard unificado aos dados reais · prescrição/decadência · afastamentos e
redistribuição · perda formal · Kanban · busca global (Ctrl+K) · paginação · auditoria ·
RBAC com gestão de contas · tema escuro · responsivo · diagnóstico de integridade (aba Admin).

Pendente: notificações por e-mail · anexos e assinatura de atas · integração com Dívida Ativa
e Tesouraria · escore de propensão à adimplência · testes unitários das regras.
