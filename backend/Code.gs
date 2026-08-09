/*************************************************************************
 * GESTRAN · CEDAT — Backend (Google Apps Script + Google Sheets)
 * API Web App para persistir os dados do painel e registrar auditoria.
 *
 * COMO USAR (resumo — ver guia):
 *  1. Crie uma planilha no Google Sheets.
 *  2. Extensões > Apps Script. Cole este arquivo.
 *  3. Rode a função setup() uma vez (cria as abas).
 *  4. Implantar > Nova implantação > Tipo "App da Web".
 *     - Executar como: Eu    - Quem pode acessar: Qualquer pessoa
 *  5. Copie a URL /exec e cole no app (Admin > Integração Google Sheets).
 *************************************************************************/

// Estrutura das abas (colunas). O Evento é a fonte da verdade (event-sourcing).
const SHEETS = {
  Processos:  ['num','contrib','cnpj','trib','turma','rel','valor','vtrans','desc','parc','cond','adimp','rev','atualizadoPor','atualizadoEm'],
  Eventos:    ['num','evento','data','result','registradoPor','registradoEm'],
  Sessoes:    ['id','turma','data','hora','pres','vot','proc','serv','status','criado','criadoPor','criadoEm','rev'],
  Acordos:    ['proc','emp','cnpj','trib','turma','relator','cons','desc','parc','venc','anchor','parcelas','rescindido','perda','rev','atualizadoPor','atualizadoEm'],
  Usuarios:   ['nome','papel','senha','av','senhaPadrao','ativo'],
  Permissoes: ['papel','dash','registro','agenda','monitor','relatorios','audit','admin'],
  Auditoria:  ['ts','user','role','tipo','detalhe','origem']
};

/* Permissão exigida por ação — validada no SERVIDOR (o cliente não é confiável) */
const EXIGE = {
  upsertProcesso:'registro', appendEvento:'registro',
  upsertSessao:'agenda',     deleteSessao:'agenda',
  upsertAcordo:'monitor',
  users:'admin', perms:'admin', seed:'admin', setup:'admin'
};
function permitido_(action, papel){
  const aba = EXIGE[action];
  if (!aba) return true;                    // leitura e auditoria são livres
  if (papel === 'Administrador') return true;
  const linhas = readSheet_('Permissoes');
  if (!linhas.length) return true;          // planilha ainda não configurada
  const p = linhas.filter(function(r){ return String(r.papel) === String(papel); })[0];
  if (!p) return false;
  var v = p[aba];
  return v === true || v === 1 || v === '1' || String(v).toUpperCase() === 'TRUE';
}

// Executar UMA VEZ para criar as abas com cabeçalhos.
function setup(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function(name){
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0){ sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); }
  });
  const s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  return 'Abas criadas com sucesso.';
}

/* ---------------- helpers de planilha ---------------- */
function sh_(name){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function readSheet_(name){
  const sh = sh_(name); if(!sh) return [];
  const vals = sh.getDataRange().getValues(); if(vals.length < 2) return [];
  const head = vals[0];
  return vals.slice(1).map(function(r){ const o={}; head.forEach(function(h,i){ o[h]=r[i]; }); return o; });
}
function rowFor_(name,obj){
  return SHEETS[name].map(function(h){
    const v = obj[h];
    if (v === undefined || v === null) return '';
    return (typeof v === 'object') ? JSON.stringify(v) : v;
  });
}
/* Escrita com bloqueio e controle de concorrência otimista (rev).
   Se a linha no servidor tiver rev maior que a enviada, devolve conflito. */
function upsertRow_(name,keyCol,obj){
  const lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch(e){ return {erro:'servidor ocupado'}; }
  try {
    const sh = sh_(name), head = SHEETS[name];
    const vals = sh.getDataRange().getValues(), ki = head.indexOf(keyCol), ri = head.indexOf('rev');
    for (let i=1;i<vals.length;i++){
      if (String(vals[i][ki]) === String(obj[keyCol])){
        if (ri > -1 && obj.rev !== undefined && obj.rev !== ''){
          const revServidor = Number(vals[i][ri]) || 0;
          if (revServidor >= Number(obj.rev)) return {conflito:true, rev:revServidor};
        }
        sh.getRange(i+1,1,1,head.length).setValues([rowFor_(name,obj)]);
        return {ok:true};
      }
    }
    sh.appendRow(rowFor_(name,obj));
    return {ok:true};
  } finally { lock.releaseLock(); }
}
function appendRow_(name,obj){ sh_(name).appendRow(rowFor_(name,obj)); }
function deleteRow_(name,keyCol,keyVal){
  const sh = sh_(name), head = SHEETS[name], ki = head.indexOf(keyCol);
  const vals = sh.getDataRange().getValues();
  for (let i=vals.length-1;i>=1;i--){ if(String(vals[i][ki])===String(keyVal)) sh.deleteRow(i+1); }
}
function replaceAll_(name,rows){
  const sh = sh_(name); sh.clearContents(); sh.appendRow(SHEETS[name]);
  (rows||[]).forEach(function(o){ appendRow_(name,o); });
}
function who_(){ try{ return Session.getActiveUser().getEmail() || ''; }catch(e){ return ''; } }

/* ---------------- leitura completa ---------------- */
function getAll_(){
  return {
    processos:  readSheet_('Processos'),
    eventos:    readSheet_('Eventos'),
    sessoes:    readSheet_('Sessoes'),
    acordos:    readSheet_('Acordos'),
    usuarios:   readSheet_('Usuarios'),   // 'senha' contém apenas o hash SHA-256
    permissoes: readSheet_('Permissoes'),
    auditoria:  readSheet_('Auditoria').slice(-500)   // limita o volume trafegado
  };
}
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------- endpoints ---------------- */
function doGet(e){ return json_(getAll_()); }

function doPost(e){
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch(err){}
  const a = body.action, p = body.payload || {};
  const quem = who_() || body.usuario || '';     // e-mail da conta Google tem prioridade
  const papel = body.papel || '';
  try {
    // 1. autorização no servidor
    if (!permitido_(a, papel)){
      appendRow_('Auditoria',{ ts:new Date(), user:quem, role:papel, tipo:'Acesso negado',
        detalhe:'Tentativa de '+a+' sem permissão', origem:'servidor' });
      return json_({ error:'Sem permissão para '+a, negado:true });
    }
    // 2. execução
    switch(a){
      case 'getAll':          return json_(getAll_());
      case 'setup':           return json_({ ok:true, msg:setup() });
      case 'upsertProcesso':  p.atualizadoPor=quem; p.atualizadoEm=new Date();
                              return json_(upsertRow_('Processos','num',p));
      case 'appendEvento':    p.registradoPor = quem; p.registradoEm = new Date(); appendRow_('Eventos',p); return json_({ok:true});
      case 'upsertSessao':    if(!p.criadoPor) p.criadoPor = quem; p.criadoEm = new Date();
                              return json_(upsertRow_('Sessoes','id',p));
      case 'deleteSessao':    deleteRow_('Sessoes','id',p.id); return json_({ok:true});
      case 'upsertAcordo':    p.atualizadoPor=quem; p.atualizadoEm=new Date();
                              return json_(upsertRow_('Acordos','proc',p));
      case 'users':           replaceAll_('Usuarios', p.usuarios); return json_({ok:true});
      case 'perms':           replaceAll_('Permissoes', Object.keys(p.perms||{}).map(function(role){ return Object.assign({papel:role}, p.perms[role]); })); return json_({ok:true});
      case 'audit':           appendRow_('Auditoria',{ ts:new Date(), user:(quem||p.user), role:p.role||papel, tipo:p.tipo||'', detalhe:p.detalhe||'', origem:'app' }); return json_({ok:true});
      case 'seed':            seed_(p); return json_({ok:true});
      default:                return json_({ error:'Ação desconhecida: '+a });
    }
  } catch(err){ return json_({ error:String(err) }); }
}

// Carga inicial: envia os dados de demonstração do app para popular as abas vazias.
function seed_(p){
  if(p.processos) p.processos.forEach(function(x){ upsertRow_('Processos','num',x); });
  if(p.eventos)   p.eventos.forEach(function(x){ appendRow_('Eventos',x); });
  if(p.sessoes)   p.sessoes.forEach(function(x){ upsertRow_('Sessoes','id',x); });
  if(p.acordos)   p.acordos.forEach(function(x){ upsertRow_('Acordos','proc',x); });
  if(p.usuarios)  replaceAll_('Usuarios', p.usuarios);
  if(p.perms)     replaceAll_('Permissoes', Object.keys(p.perms).map(function(r){ return Object.assign({papel:r}, p.perms[r]); }));
}
