// Casca do app (etapa 2 da nova interface): rotas, cabeçalho, barra inferior, botão "+", lista de itens por tela,
// folha de item e importações. Grava as mesmas chaves e o mesmo formato de antes (familia365-v1).
import { parseRoute, hashFor } from './router.js';
import { itemsForScreen, groupPlanos, defaultTab, fabAction, summary, needsBackupReminder, headerDate, dueLabel, openFirst, isoDay } from './telas.js';
import { toggleDone, removeById, upsertItem } from './itens.js';
import { validItem } from './backup.js';
import { mergeGoals } from './goals.js';
import { $, el, icon, aviso, abrirFolha, fecharFolha, prepararFolhas } from './ui.js';
import { iniciarSonhos } from './sonhos.js';

const KEY = 'familia365-v1', META = 'familia365-meta-v1';
let items = [], bloqueado = false, rotaAtual = null, editando = null;

// ---------- Dados da lista ----------
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(validItem)) throw Error();
    items = data;
  }
} catch {
  bloqueado = true;
  $('alerta').textContent = 'Não foi possível ler os dados locais. Faça um backup em Dados antes de continuar; nada será gravado por cima.';
  $('alerta').hidden = false;
}

// Grava a lista; com "texto", mostra o aviso com Desfazer (volta exatamente ao estado de antes desta ação).
function persist(next, texto) {
  if (bloqueado) return false;
  const antes = items;
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { aviso('Não foi possível salvar. Verifique o espaço disponível e faça um backup.'); return false; }
  items = next;
  renderListas();
  if (texto) aviso(texto, () => { if (persist(antes)) aviso('Desfeito.'); });
  return true;
}

// ---------- Itens ----------
function itemRow(x, today) {
  const meta = [x.area, x.horizon, x.due && 'prazo ' + dueLabel(x.due, today)].filter(Boolean);
  const caixa = el('input', { type: 'checkbox', className: 'caixa', 'aria-label': (x.done ? 'Reabrir: ' : 'Concluir: ') + x.title });
  caixa.checked = x.done;
  caixa.addEventListener('change', () => persist(toggleDone(items, x.id), (x.done ? 'Reaberto: ' : 'Concluído: ') + x.title));
  const corpo = el('button', { type: 'button', className: 'item-corpo', 'aria-label': 'Editar: ' + x.title, onclick: () => abrirItem(x) },
    el('span', { className: 'item-titulo', text: x.title }),
    meta.length ? el('span', { className: 'item-meta', text: meta.join(' · ') }) : null,
    x.notes ? el('span', { className: 'item-nota', text: x.notes }) : null);
  return el('li', { className: 'item' + (x.done ? ' item--feito' : '') }, el('label', { className: 'caixa-alvo' }, caixa), corpo);
}
function lista(list, today, vazio) {
  if (!list.length) return el('p', { className: 'vazio-curto', text: vazio });
  return el('ul', { className: 'lista' }, ...openFirst(list).map(x => itemRow(x, today)));
}
function renderListas() {
  const today = isoDay();
  const hoje = itemsForScreen(items, 'hoje', today);
  $('resumo-hoje').textContent = summary(hoje);
  $('lista-hoje').replaceChildren(hoje.length ? lista(hoje, today) : el('div', { className: 'vazio' },
    el('h2', { text: 'Nada para hoje por enquanto' }), el('p', { text: 'Toque em + para anotar uma pequena ação.' })));
  $('lista-planos').replaceChildren(...groupPlanos(items).map(g => el('section', { className: 'secao', 'aria-label': g.tab },
    el('h2', { className: 'secao-titulo', text: g.tab }), lista(g.items, today, 'Nada aqui ainda.'))));
  $('lista-sonhos').replaceChildren(lista(itemsForScreen(items, 'sonhos', today), today, 'Nenhum item de Sonhos na lista.'));
  $('lista-familia').replaceChildren(lista(itemsForScreen(items, 'familia', today), today, 'Nada anotado para a revisão da semana.'));
}

// ---------- Folha de item ----------
const CAMPOS = ['title', 'tab', 'area', 'horizon', 'due', 'notes'];
function abrirItem(x) {
  if (bloqueado) return;
  editando = x ? x.id : null;
  $('form-item').reset();
  $('item-erro').hidden = true;
  $('item-tab').value = x ? x.tab : defaultTab(rotaAtual);
  if (x) for (const k of CAMPOS) if (k !== 'tab') $('item-' + k).value = x[k]; // valor fora da lista fica em branco e é mantido
  $('item-mais').open = !!(x && (x.due || x.notes));
  $('folha-item-titulo').textContent = x ? 'Editar' : 'Anotar';
  $('item-salvar').textContent = x ? 'Salvar' : 'Anotar';
  $('item-excluir').hidden = !x;
  abrirFolha($('folha-item'));
  $('item-title').focus();
}
$('form-item').addEventListener('submit', e => {
  e.preventDefault();
  const form = Object.fromEntries(CAMPOS.map(k => [k, $('item-' + k).value]));
  let r;
  try { r = upsertItem(items, form, { editingId: editando, newId: crypto.randomUUID() }); }
  catch { $('item-erro').hidden = false; $('item-title').focus(); return; }
  fecharFolha($('folha-item'));
  persist(r.items, (r.created ? 'Anotado: ' : 'Salvo: ') + r.item.title);
});
$('item-excluir').addEventListener('click', () => {
  const x = items.find(y => y.id === editando);
  fecharFolha($('folha-item'));
  if (!x) return;
  persist(removeById(items, x.id), 'Excluído: ' + x.title);
  focarTitulo();
});

// ---------- Rotas ----------
const sonhos = iniciarSonhos();
function focarTitulo() {
  const h = document.querySelector('.tela:not([hidden]) h1');
  if (h) h.focus({ preventScroll: false });
}
function mostrar(rota, focar) {
  for (const s of document.querySelectorAll('.tela')) s.hidden = s.id !== (rota === 'dados' ? 'dados' : 'tela-' + rota);
  for (const a of document.querySelectorAll('.barra a')) {
    if (a.dataset.rota === rota) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (rota === 'dados') $('btn-dados').setAttribute('aria-current', 'page'); else $('btn-dados').removeAttribute('aria-current');
  const acao = fabAction(rota);
  $('fab').hidden = !acao || bloqueado;
  $('fab').setAttribute('aria-label', acao === 'sonho' ? 'Novo sonho' : 'Anotar');
  $('fab').title = acao === 'sonho' ? 'Novo sonho' : 'Anotar';
  const mudou = rotaAtual !== null && rotaAtual !== rota;
  rotaAtual = rota;
  if (mudou) window.scrollTo(0, 0);
  if (mudou || focar) focarTitulo();
}
function rotear() {
  const r = parseRoute(location.hash);
  if (r.importPayload !== null) { importar(r.importPayload); return; }
  if (!r.canonical) history.replaceState(history.state, '', location.pathname + location.search + hashFor(r.route));
  mostrar(r.route);
}
window.addEventListener('hashchange', rotear);
$('fab').addEventListener('click', () => (fabAction(rotaAtual) === 'sonho' ? sonhos.abrirNovo() : abrirItem(null)));

// ---------- Link de importação (#import=) ----------
function importar(raw) {
  const limpar = () => history.replaceState(null, '', location.pathname + location.search + hashFor('hoje'));
  try {
    if (bloqueado) throw Error('Armazenamento indisponível');
    if (raw.length > 30000) throw Error('Link muito grande');
    const d = JSON.parse(decodeURIComponent(raw));
    if (d.version !== 1 || !Array.isArray(d.items) || d.items.length > 100 || !d.items.every(x => validItem(x) && x.id.length <= 100 && x.notes.length <= 4000 && x.title.trim()) || new Set(d.items.map(x => x.id)).size !== d.items.length) throw Error('Dados inválidos');
    const known = new Set(items.map(x => x.id));
    const fresh = d.items.filter(x => !known.has(x.id)).map(x => ({ id: x.id, title: x.title, tab: x.tab, area: x.area, horizon: x.horizon, due: x.due, notes: x.notes, done: x.done }));
    limpar();
    mostrar('hoje');
    if (!fresh.length) { aviso('Registros já importados.'); return; }
    if (!confirm('Adicionar ' + fresh.length + ' registros ao Família365, preservando os atuais?\n\n' + fresh.map(x => x.title).join('\n'))) return;
    persist([...items, ...fresh], fresh.length + (fresh.length === 1 ? ' registro adicionado' : ' registros adicionados'));
  } catch {
    limpar();
    mostrar('hoje');
    aviso('Não foi possível importar este link. Nenhum registro foi alterado.');
  }
}
// Código colado (em Dados › Outras importações): vira o mesmo link de importação.
$('pasteImport').addEventListener('click', () => {
  try { location.hash = 'import=' + encodeURIComponent(JSON.stringify(JSON.parse($('paste').value.trim()))); }
  catch { $('status').textContent = 'Código inválido.'; }
});
// Metas vindas do FiscalFlow: atualiza o item de Sonhos com o mesmo id ou cria um novo; nunca apaga.
$('importGoals').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const r = mergeGoals(items, JSON.parse(await f.text()));
    if (persist(r.items, r.count + ' meta(s) do FiscalFlow em Sonhos')) $('status').textContent = r.count + ' meta(s) do FiscalFlow em Sonhos.';
  } catch { $('status').textContent = 'Arquivo de metas inválido.'; }
});

// ---------- Cabeçalho ----------
function renderTopo() {
  const now = new Date();
  $('topo-data').textContent = headerDate(now);
  $('topo-data').setAttribute('datetime', isoDay(now));
  let iso;
  try { iso = JSON.parse(localStorage.getItem(META) || 'null')?.last_backup_at; } catch { iso = undefined; }
  const lembrar = needsBackupReminder(iso, now);
  $('ponto-backup').hidden = !lembrar;
  $('btn-dados').setAttribute('aria-label', 'Dados e backup' + (lembrar ? '. Backup pendente' : ''));
}
document.addEventListener('familia365:backup', renderTopo);
window.addEventListener('storage', e => { if (e.key === META) renderTopo(); });

// ---------- Início ----------
prepararFolhas();
renderTopo();
renderListas();
rotear();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
