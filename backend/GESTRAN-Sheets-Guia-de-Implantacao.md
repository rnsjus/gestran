# GESTRAN · CEDAT — Implantação do backend (Google Sheets + Apps Script)

Este guia conecta o painel GESTRAN a uma planilha do Google, para que os dados **persistam** e toda ação fique **auditada** (usuário + data), sem sair do ecossistema Google.

## Visão geral

- O **Google Sheets** é o banco de dados (uma aba por entidade).
- O **Apps Script** (`Code.gs`) é a API que lê e grava na planilha, expondo um *App da Web*.
- O **painel** (`index.html`) chama essa API: carrega os dados ao abrir e grava a cada alteração.
- O **Evento** é a fonte da verdade (event-sourcing): o estado dos processos, acordos e adimplência é reconstruído a partir do histórico de eventos.

## Passo a passo

1. **Crie a planilha.** Em [sheets.google.com](https://sheets.google.com), crie uma planilha nova (ex.: "GESTRAN CEDAT — Base").
2. **Abra o editor de script.** Menu **Extensões → Apps Script**.
3. **Cole o código.** Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de **`Code.gs`** (nesta mesma pasta). Salve (💾).
4. **Crie as abas.** No editor, selecione a função **`setup`** na barra superior e clique em **Executar**. Autorize o acesso quando solicitado. Isso cria as abas: Processos, Eventos, Sessoes, Acordos, Usuarios, Permissoes, Auditoria.
5. **Publique a API.** Clique em **Implantar → Nova implantação**. Em *Tipo*, escolha **App da Web**. Configure:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** Qualquer pessoa (ou "Usuários da sua organização", recomendado)
   Clique em **Implantar** e **copie a URL** que termina em `/exec`.
6. **Conecte o painel.** Abra o painel, entre como **Administrador**, vá em **Admin → Integração Google Sheets**, cole a URL e clique em **Conectar / Sincronizar**.
7. **Primeira carga.** Como as abas estão vazias, clique em **Enviar dados atuais** — o painel envia os dados de demonstração para a planilha e passa a trabalhar sobre eles. A partir daí, tudo o que você registrar é gravado no Sheets.

## Estrutura das abas

| Aba | Colunas |
|---|---|
| **Processos** | num, contrib, cnpj, trib, turma, rel, valor, vtrans, desc, parc, cond, adimp, rev, atualizadoPor, atualizadoEm |
| **Eventos** | num, evento, data, result, registradoPor, registradoEm |
| **Sessoes** | id, turma, data, hora, pres, vot, proc, serv, status, criado, criadoPor, criadoEm, rev |
| **Acordos** | proc, emp, cnpj, trib, turma, relator, cons, desc, parc, venc, anchor, parcelas, rescindido, perda, rev, atualizadoPor, atualizadoEm |
| **Usuarios** | nome, papel, email, senha (hash SHA-256), av, senhaPadrao, ativo |
| **Permissoes** | papel, dash, registro, agenda, monitor, relatorios, audit, admin |
| **Auditoria** | ts, user, role, tipo, detalhe, origem |

A aba **Eventos** registra automaticamente `registradoPor` (e-mail da conta Google) e `registradoEm` (data/hora do servidor) — a espinha dorsal da governança. A aba **Auditoria** guarda toda modificação relevante, inclusive as tentativas negadas pelo servidor.

## Garantias implementadas

- **Autorização no servidor.** Antes de qualquer escrita, o `Code.gs` confere o papel do usuário
  contra a aba Permissoes (`permitido_`). O cliente não é confiável; tentativa negada vira registro
  de auditoria com origem "servidor". O perfil Administrador tem acesso irrestrito.
- **Concorrência.** Escritas usam `LockService` e controle otimista pela coluna `rev`: se o
  servidor já tiver revisão igual ou maior, devolve `conflito` e o app recarrega em vez de sobrescrever.
- **Fila no cliente.** O painel enfileira as alterações em `localStorage`, com retentativa em
  backoff exponencial e reenvio automático ao voltar a conexão. Nada se perde offline.
- **Senhas.** Só trafega e é armazenado o **hash SHA-256**; a senha em claro nunca sai do navegador.

## Boas práticas de segurança

- **Login institucional:** publique o App da Web com "Usuários da sua organização" e use as contas
  @pgm/@fortaleza, aproveitando o `registradoPor` real. O ideal em produção é dispensar as senhas
  próprias do app e confiar apenas no login Google.
- **Permissões:** proteja as abas Usuarios/Permissoes para que só o gestor edite.
- **LGPD:** a base tem dados de contribuintes (CNPJ, valores, situação fiscal). Restrinja o
  compartilhamento da planilha, defina retenção e anonimize relatórios agregados.
- **Backups:** o histórico de versões do Google Sheets serve de backup; para retenção formal, exporte periodicamente.

## Atualizando o `Code.gs` (nova versão)

Sempre que o `Code.gs` deste repositório mudar (ex.: nova ação, nova coluna),
repita:

1. Abra o projeto no editor do Apps Script (Extensões → Apps Script, a
   partir da mesma planilha).
2. Apague o conteúdo do arquivo e cole o `Code.gs` atualizado. Salve.
3. **Implantar → Gerenciar implantações → ✏️ editar a implantação existente
   → Versão: Nova versão → Implantar.** A URL `/exec` **não muda**.
4. Se a mudança usa um recurso novo do Google (ex.: `MailApp.sendEmail`
   para enviar credenciais por e-mail), o Google pode pedir uma nova
   autorização na primeira execução — aceite normalmente (é a mesma conta
   que já autorizou o script antes).
5. Esta versão adiciona a coluna **email** na aba **Usuarios**. Não precisa
   editar a planilha manualmente: a aba Usuarios é inteiramente reescrita
   (cabeçalho incluído) toda vez que uma conta é criada ou alterada pelo
   Admin — então, assim que você criar ou editar qualquer usuário depois de
   reimplantar, a coluna aparece sozinha.

## Observações técnicas

- As chamadas usam `POST` com `Content-Type: text/plain` de propósito, para evitar *preflight* de CORS com o Apps Script.
- Se você reimplantar o script (novo código), **gere uma nova versão** da implantação ou atualize a existente — a URL `/exec` permanece a mesma se você usar "Gerenciar implantações → Editar → Nova versão".
- Enquanto nenhuma URL estiver configurada, o painel funciona normalmente em **modo demonstração** (dados em memória, com a base simulada).
