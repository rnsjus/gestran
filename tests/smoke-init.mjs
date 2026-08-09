/**
 * Teste de fumaça — executa o <script> do app contra um DOM simulado
 * e falha se a inicialização lançar erro.
 *
 * Por que existe: `node --check` valida sintaxe, mas não execução. Um ReferenceError
 * dentro de applyFilters() já derrubou a inicialização inteira (login sumiu).
 *
 *   node tests/smoke-init.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextEncoder } from 'node:util';
import crypto from 'node:crypto';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = ['index.html', 'painel-profaz-cedat.html']
  .map(f => path.join(raiz, f)).find(fs.existsSync);
if (!arquivo) { console.error('❌ index.html não encontrado em', raiz); process.exit(1); }

const html = fs.readFileSync(arquivo, 'utf8');
const i = html.lastIndexOf('<script>'), j = html.lastIndexOf('</script>');
const codigo = html.slice(i + 8, j);

/* ---------- DOM mínimo ---------- */
const els = {};
const mk = (id) => ({
  id, value: '', textContent: '', innerHTML: '', style: {}, dataset: {}, checked: false,
  type: 'text', offsetParent: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, remove() {}, addEventListener() {}, setAttribute() {},
  getAttribute: () => null, querySelector: () => mk('q'), querySelectorAll: () => [],
  focus() {}, reset() {}, getContext: () => ({}),
});
const doc = {
  getElementById: (id) => els[id] || (els[id] = mk(id)),
  querySelector: (s) => mk(s), querySelectorAll: () => [],
  createElement: (t) => mk(t), addEventListener() {}, body: mk('body'),
  documentElement: { setAttribute() {}, getAttribute: () => 'light' },
  activeElement: null, readyState: 'complete',
};
class ChartStub {
  constructor() { this.data = { datasets: [{ data: [] }, { data: [] }] }; }
  update() {}
}
ChartStub.defaults = {};

let t = Date.now();
Object.assign(globalThis, {
  document: doc,
  window: { addEventListener() {}, Chart: ChartStub },
  navigator: { onLine: true },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  crypto: { subtle: { digest: async (_a, b) => crypto.createHash('sha256').update(Buffer.from(b)).digest().buffer } },
  TextEncoder,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
  alert() {}, confirm: () => true, prompt: () => 'x',
  Chart: ChartStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => { t += 5000; cb(t); },   // conclui as animações na hora
  setInterval: () => 0,
});

/* IDs viram globais implícitas no navegador — replicamos aqui */
const IDS = `fTurma fTrib fRel fPer fDe fAte filtroInfo wrapDe wrapAte kRec kExito kRecup kNeg kDesc kTempo
kAdimp kRecD kExitoD tblRel alertList alCnt railBadge mTot mAd mIn mQt mPerd mRec mSaldo mData mAlertList
mAlCnt mBusca mStatus mTurma mCnt buscaEmp modal overlay audBusca audUser audTipo audCnt audData aTot aHoje
aUsers aDel uAv uName lEmail lSenha lErr lBtn nuNome nuEmail nuPapel nuSenha admUCnt tblMatrix tblUsers gsUrl gsStatus
r_kpi r_rel r_aco r_ses r_aud r_per r_turma r_trib repPreview sTurma sData sPres sServ sPauta pTurma
sCnt selInfo calLabel afMembro afTipo afIni afFim backdrop sAtual sNova sConf sErr`.split(/\s+/).filter(Boolean);
for (const id of IDS) {
  Object.defineProperty(globalThis, id, { get: () => doc.getElementById(id), configurable: true });
}

try {
  new Function(codigo)();
  console.log('✅ init OK —', path.basename(arquivo), 'carregou sem erro de runtime');
} catch (e) {
  console.error('❌ ERRO NA INICIALIZAÇÃO:', e.message);
  console.error(String(e.stack).split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}
