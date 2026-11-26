// Seção "Dados e backup": backup completo (v2), restauração com prévia (Juntar ou Substituir tudo, com Desfazer)
// e exportação de metas. Lê e grava as mesmas chaves que app.js e vision.js; depois de gravar, recarrega a página
// (os dois scripts guardam o estado em closures).
import { buildBackup, parseBackup, summarize, merge, replace, describeLastBackup, validItem, BackupError, MAX_BYTES } from './backup.js';
import { goalsFile } from './goals.js';

const K = { items: 'familia365-v1', dreams: 'familia365-vision-v1', people: 'familia365-people-v1', meta: 'familia365-meta-v1', undo: 'familia365-undo-v1' };
const FLASH = 'familia365-aviso';
const $ = id => document.getElementById(id);
const say = (id, text) => { $(id).textContent = text; };

function store() { return window.localStorage; }
function readArray(key) {
  const raw = store().getItem(key);
  if (raw === null) return [];
  const v = JSON.parse(raw);
  if (!Array.isArray(v)) throw Error(key);
  return v;
}
// Lança erro se algo gravado não puder ser lido: nesse caso não gravamos por cima.
function readDevice() {
  const items = readArray(K.items), dreams = readArray(K.dreams), people = readArray(K.people).filter(n => typeof n === 'string');
  if (!items.every(validItem) || !dreams.every(x => x && typeof x.id === 'string')) throw Error('dados locais');
  return { items, dreams, people };
}
function readJSON(key) { try { const v = JSON.parse(store().getItem(key) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } }
// Grava as três partes; se faltar espaço no meio, volta ao que estava.
function writeState(s) {
  const keys = ['items', 'dreams', 'people'], old = {};
  for (const k of keys) old[k] = store().getItem(K[k]);
  try { for (const k of keys) store().setItem(K[k], JSON.stringify(s[k])); }
  catch (e) {
    for (const k of keys) { try { old[k] === null ? store().removeItem(K[k]) : store().setItem(K[k], old[k]); } catch { /* segue */ } }
    throw e;
  }
}
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const size = b => (b >= 1e6 ? (b / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
const longDate = iso => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const stamp = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function download(blob, name) {
  const a = document.createElement('a'), u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function flashAndReload(text) {
  try { sessionStorage.setItem(FLASH, text); } catch { /* sem aviso depois de recarregar */ }
  location.hash = '#dados';
  location.reload();
}

// ---------- Último backup e proteção do armazenamento ----------
function renderLast() {
  const d = describeLastBackup(readJSON(K.meta)?.last_backup_at), el = $('backup-quando');
  if (!d) { el.textContent = 'Nenhum backup ainda'; $('backup-lembrete').hidden = true; return; }
  const span = document.createElement('span');
  span.textContent = '· ' + d.date;
  el.replaceChildren(d.when + ' ', span);
  $('backup-lembrete').hidden = d.days <= 7;
}
async function protect(ask) {
  try {
    if (!navigator.storage?.persisted) return;
    let ok = await navigator.storage.persisted();
    if (!ok && ask && navigator.storage.persist) ok = await navigator.storage.persist();
    $('backup-protegido').hidden = !ok;
  } catch { /* navegador sem suporte: segue sem proteção */ }
}

$('backup-fazer').onclick = async () => {
  const b = $('backup-fazer');
  say('backup-status', '');
  protect(true);
  let device;
  try { device = readDevice(); } catch { say('backup-status', 'Não foi possível ler os dados deste aparelho. Nada foi alterado.'); return; }
  b.disabled = true;
  try {
    const now = new Date(), name = 'familia365-backup-' + now.toLocaleDateString('sv-SE') + '.json';
    const blob = new Blob([JSON.stringify(buildBackup({ ...device, exportedAt: now.toISOString() }))], { type: 'application/json' });
    let shared = false;
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Backup do Família365' }); shared = true; }
    } catch (e) {
      if (e?.name === 'AbortError') { say('backup-status', 'Backup não enviado. Dá para tentar de novo quando quiser.'); return; }
    }
    if (!shared) download(blob, name);
    try { store().setItem(K.meta, JSON.stringify({ ...(readJSON(K.meta) || {}), last_backup_at: now.toISOString() })); } catch { /* data não guardada */ }
    renderLast();
    say('backup-status', shared ? 'Backup enviado. Guarde o arquivo fora deste aparelho.' : 'Backup salvo como ' + name + '. Guarde uma cópia fora deste aparelho.');
  } finally { b.disabled = false; }
};

// ---------- Restaurar ----------
let pending = null;
const KIND = { v2: 'Backup completo', lista: 'Backup antigo da lista', painel: 'Backup antigo do painel' };
function hidePreview() { pending = null; $('restore-preview').hidden = true; $('restore-trocar').hidden = true; $('restore-escolher').hidden = false; $('restore-ajuda').hidden = false; }
function modo() { return document.querySelector('input[name="restore-modo"]:checked').value; }
function syncButton() { $('restore-aplicar').textContent = modo() === 'juntar' ? 'Juntar dados' : 'Substituir tudo'; }

function showPreview(device, parsed, file) {
  const s = summarize(device, parsed);
  $('restore-nome').textContent = KIND[parsed.kind] + (parsed.exportedAt ? ' de ' + longDate(parsed.exportedAt) : '');
  $('restore-sub').replaceChildren(file.name, document.createElement('br'), size(file.size));
  const rows = [['Tarefas', s.items], ['Sonhos', s.dreams], ['Fotos', s.photos], ['Pessoas', s.people]].filter(([, r], i) => parsed.kind === 'v2' || r.file || r.device || i < 2);
  $('restore-tabela').replaceChildren(...rows.map(([label, r]) => {
    const tr = document.createElement('tr'), th = document.createElement('th');
    th.scope = 'row'; th.textContent = label; tr.append(th);
    for (const [v, bold] of [[r.file, r.file > r.device], [r.device, r.device > r.file], [r.new, false]]) {
      const td = document.createElement('td'); td.textContent = v; if (bold) td.className = 'mais'; tr.append(td);
    }
    return tr;
  }));
  const parts = { lista: ' Este arquivo antigo traz só as tarefas.', painel: ' Este arquivo antigo traz só os sonhos.', v2: '' };
  $('restore-nota').textContent = (s.totalNew ? plural(s.totalNew, 'item só existe', 'itens só existem') + ' no arquivo e entra' + (s.totalNew === 1 ? '' : 'm') + ' ao juntar. O que está em negrito é o lado que tem mais.'
    : 'Tudo o que está no arquivo já existe neste aparelho.') + parts[parsed.kind];
  $('restore-substituir-texto').textContent = parsed.kind === 'v2'
    ? 'O aparelho fica igual ao arquivo. Antes, guardamos uma cópia automática, e dá para desfazer.'
    : 'Troca só as ' + (parsed.kind === 'lista' ? 'tarefas; sonhos e pessoas' : 'sonhos; tarefas e pessoas') + ' ficam como estão. Antes, guardamos uma cópia automática, e dá para desfazer.';
  document.querySelector('input[name="restore-modo"][value="juntar"]').checked = true;
  syncButton();
  $('restore-preview').hidden = false; $('restore-trocar').hidden = false; $('restore-escolher').hidden = true; $('restore-ajuda').hidden = true;
  $('restore-nome').focus();
}

for (const input of document.querySelectorAll('input[data-restore]')) input.onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  say('restore-status', '');
  try {
    if (f.size > MAX_BYTES) throw new BackupError('Arquivo grande demais para ser um backup do Família365 (limite de 25 MB).');
    const parsed = parseBackup(await f.text());
    let device;
    try { device = readDevice(); } catch { throw new BackupError('Os dados deste aparelho não puderam ser lidos; para não perder nada, a restauração foi bloqueada.'); }
    pending = parsed;
    showPreview(device, parsed, f);
  } catch (err) {
    hidePreview();
    say('restore-status', err instanceof BackupError ? err.message + ' Nada foi alterado.' : 'Não foi possível ler este arquivo. Nada foi alterado.');
  }
};
for (const r of document.querySelectorAll('input[name="restore-modo"]')) r.onchange = syncButton;
$('restore-cancelar').onclick = () => { hidePreview(); say('restore-status', 'Restauração cancelada. Nada foi alterado.'); $('restore-escolher').focus(); };

$('restore-aplicar').onclick = () => {
  if (!pending) return;
  const mode = modo();
  let device;
  try { device = readDevice(); } catch { say('restore-status', 'Os dados deste aparelho não puderam ser lidos. Nada foi alterado.'); return; }
  const result = mode === 'juntar' ? merge(device, pending) : replace(device, pending);
  if (mode === 'juntar' && !result.added.items && !result.added.dreams && !result.added.people) {
    hidePreview(); say('restore-status', 'Nada novo no arquivo: este aparelho já tinha tudo. Nada foi alterado.'); return;
  }
  // Cópia do estado atual antes de gravar (o "Desfazer" vale até a próxima restauração).
  try { store().setItem(K.undo, JSON.stringify({ saved_at: new Date().toISOString(), mode, ...device })); }
  catch {
    if (mode === 'substituir') { say('restore-status', 'Não há espaço para guardar a cópia de segurança antes de substituir. Nada foi alterado. Use "Juntar" ou faça antes um backup completo.'); return; }
    try { store().removeItem(K.undo); } catch { /* segue: juntar não apaga nada */ }
  }
  try { writeState({ items: result.items, dreams: result.dreams, people: result.people }); }
  catch { try { store().removeItem(K.undo); } catch { /* segue */ } say('restore-status', 'Não foi possível gravar (espaço insuficiente neste aparelho). Nada foi alterado.'); return; }
  const a = result.added;
  flashAndReload(mode === 'juntar'
    ? 'Dados juntados: entraram ' + plural(a.items, 'tarefa', 'tarefas') + ', ' + plural(a.dreams, 'sonho', 'sonhos') + ' (' + plural(a.photos, 'foto', 'fotos') + ') e ' + plural(a.people, 'pessoa', 'pessoas') + '. Nada foi apagado.'
    : 'Pronto: o aparelho ficou igual ao arquivo. Guardamos uma cópia de como estava antes.');
};

function renderUndo() {
  const u = readJSON(K.undo);
  const ok = u && Array.isArray(u.items) && Array.isArray(u.dreams) && Array.isArray(u.people) && !Number.isNaN(Date.parse(u.saved_at));
  $('undo-box').hidden = !ok;
  if (ok) say('undo-texto', 'Cópia de antes da restauração de ' + stamp(u.saved_at) + (u.mode === 'substituir' ? ' (substituir tudo)' : ' (juntar)') + '. Ao desfazer, o que foi anotado depois dela não fica.');
}
$('undo-fazer').onclick = () => {
  const u = readJSON(K.undo);
  if (!u) { renderUndo(); return; }
  try { writeState({ items: u.items, dreams: u.dreams, people: u.people }); store().removeItem(K.undo); }
  catch { say('restore-status', 'Não foi possível desfazer agora. Nada foi alterado.'); return; }
  flashAndReload('Restauração desfeita: o aparelho voltou a ficar como estava antes.');
};

// ---------- Metas para o FiscalFlow ----------
$('exportGoals').onclick = () => {
  let device;
  try { device = readDevice(); } catch { say('status', 'Não foi possível ler os dados deste aparelho.'); return; }
  const f = goalsFile(device.items, device.dreams);
  if (!f.goals.length) { say('status', 'Nenhum sonho com valor para exportar. Informe o valor-alvo no sonho do painel (ou "R$ 6.000" no título de um item de Sonhos).'); return; }
  download(new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' }), 'familia365-metas-goal-v1.json');
  say('status', plural(f.goals.length, 'meta exportada', 'metas exportadas') + ' para o FiscalFlow.');
};

// ---------- Início ----------
try {
  renderLast(); renderUndo(); protect(false);
  const msg = sessionStorage.getItem(FLASH);
  if (msg) {
    sessionStorage.removeItem(FLASH);
    say('restore-status', msg);
    $('restore-status').scrollIntoView({ block: 'center' });
    $('restore-status').focus({ preventScroll: true });
  }
} catch { say('backup-status', 'Este navegador não permite guardar dados aqui.'); }
