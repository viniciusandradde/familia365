// Casca do app (etapas 2 e 3 da nova interface): rotas, cabeçalho, barra inferior, botão "+", tela Hoje (captura em uma
// linha, seções, concluir com done_at), listas das outras telas, folha Anotar/Editar e importações. Grava as mesmas chaves
// de antes (familia365-v1); os campos novos dos itens (done_at, scope, time, night) são opcionais.
import { parseRoute, hashFor } from './router.js';
import { itemsForScreen, groupPlanos, fabAction, needsBackupReminder, headerDate, dueLabel, openFirst, isoDay, proximosDias, diaCurto } from './telas.js';
import { toggleDone, removeById, upsertItem, trazerParaHoje, ficaParaAmanha } from './itens.js';
import { secoesHoje, scopeOf, SCOPE_LABEL, SCOPE_ICON, timeLabel, mostrarRevisao, whenOf, tabForWhen, horizonForWhen, SUGESTOES } from './hoje.js';
import { reconhecerData } from './datas.js';
import { validItem } from './backup.js';
import { mergeGoalsDreams } from './goals.js';
import { migrarSonhosDaLista } from './painel.js';
import { $, el, icon, aviso, abrirFolha, fecharFolha, prepararFolhas } from './ui.js';
import { iniciarSonhos } from './sonhos.js';

const KEY = 'familia365-v1', META = 'familia365-meta-v1', VKEY = 'familia365-vision-v1';
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
  if (migrarSonhos()) sonhos.recarregar();
  renderListas();
  if (texto) aviso(texto, () => { if (persist(antes)) aviso('Desfeito.'); });
  return true;
}

// Itens da antiga aba "Sonhos" viram sonhos do painel: primeiro grava a cópia no painel e só depois tira da lista.
// Idempotente (mesmo id): se a segunda gravação falhar, a próxima abertura termina sem duplicar.
function migrarSonhos() {
  if (bloqueado || !items.some(x => x.tab === 'Sonhos')) return false;
  let dreams;
  try { dreams = JSON.parse(localStorage.getItem(VKEY) || '[]'); } catch { return false; }
  if (!Array.isArray(dreams)) return false;
  const r = migrarSonhosDaLista(items, dreams);
  if (!r.migrados) return false;
  try { localStorage.setItem(VKEY, JSON.stringify(r.dreams)); } catch { return false; }
  try { localStorage.setItem(KEY, JSON.stringify(r.items)); items = r.items; } catch { /* fica na lista até a próxima vez */ }
  return true;
}

// ---------- Itens ----------
const lerMeta = () => { try { return JSON.parse(localStorage.getItem(META) || 'null') || {}; } catch { return {}; } };
function gravarMeta(patch) {
  try { localStorage.setItem(META, JSON.stringify({ ...lerMeta(), ...patch })); return true; } catch { return false; }
}
const caixasVisiveis = () => [...document.querySelectorAll('.tela:not([hidden]) .caixa[data-id]')].filter(c => c.getClientRects().length);
function focarItem(id) {
  const c = caixasVisiveis().find(y => y.dataset.id === id);
  if (c) c.focus(); else focarTitulo();
}
// Concluir ou reabrir; o foco fica no mesmo item (se ainda visível) ou no item que ocupou o lugar dele.
function concluir(x, caixa) {
  const i = caixasVisiveis().indexOf(caixa);
  if (!persist(toggleDone(items, x.id), (x.done ? 'Reaberto: ' : 'Concluído: ') + x.title)) { caixa.checked = x.done; return; }
  const depois = caixasVisiveis(), alvo = depois.find(c => c.dataset.id === x.id) || depois[Math.min(Math.max(i, 0), depois.length - 1)];
  if (alvo) alvo.focus(); else focarTitulo();
}
function itemRow(x, today, naHoje, diaEscrito = false) {
  const sc = scopeOf(x);
  const partes = [el('span', { className: 'quem' }, icon(SCOPE_ICON[sc]), SCOPE_LABEL[sc]), x.area, naHoje ? '' : x.horizon,
    x.time ? el('time', { datetime: x.time, text: timeLabel(x.time) }) : '',
    diaEscrito ? el('time', { datetime: x.due, text: diaCurto(x.due, today) }) : x.due && (x.due !== today || !naHoje) ? 'prazo ' + dueLabel(x.due, today) : '', naHoje && x.tab !== 'Hoje' ? x.tab : ''].filter(Boolean);
  const meta = el('span', { className: 'item-meta' });
  partes.forEach((p, i) => { if (i) meta.append(el('span', { className: 'sep', 'aria-hidden': 'true', text: '·' })); meta.append(p); });
  const caixa = el('input', { type: 'checkbox', className: 'caixa', 'data-id': x.id, 'aria-label': (x.done ? 'Reabrir: ' : 'Concluir: ') + x.title });
  caixa.checked = x.done;
  caixa.addEventListener('change', () => concluir(x, caixa));
  const corpo = el('button', { type: 'button', className: 'item-corpo', 'aria-label': 'Editar: ' + x.title, onclick: () => abrirItem(x) },
    el('span', { className: 'item-titulo', text: x.title }), meta, x.notes ? el('span', { className: 'item-nota', text: x.notes }) : null);
  return el('li', { className: 'item' + (x.done ? ' item--feito' : '') }, el('label', { className: 'caixa-alvo' }, caixa), corpo);
}
function lista(list, today, vazio, naHoje = false) {
  if (!list.length) return el('p', { className: 'vazio-curto', text: vazio });
  return el('ul', { className: 'lista' }, ...(naHoje ? list : openFirst(list)).map(x => itemRow(x, today, naHoje)));
}
function adicionarHoje({ title, scope = 'eu', area = '' }) {
  let r;
  try { r = upsertItem(items, { title, tab: 'Hoje', area, horizon: 'Hoje', due: '', notes: '', scope }, { newId: crypto.randomUUID(), atStart: true }); }
  catch { return null; }
  return persist(r.items, 'Adicionado: ' + r.item.title) ? r.item : null;
}

// ---------- Tela Hoje ----------
let abertos = { concluidos: false, antes: false };
const secaoHoje = (id, ic, titulo, list, today) => el('section', { className: 'secao', 'aria-labelledby': id },
  el('h2', { className: 'secao-titulo', id }, icon(ic, 'i--18'), titulo), lista(list, today, '', true));
function recolhidoHoje(chave, titulo, list, today) {
  const d = el('details', { className: 'secao recolhido recolhido--lista' },
    el('summary', {}, el('span', {}, titulo + ' ', el('span', { className: 'contagem', text: '· ' + list.length })), icon('baixo')),
    lista(list, today, '', true));
  d.open = abertos[chave];
  d.addEventListener('toggle', () => { abertos[chave] = d.open; });
  return d;
}
function cartaoTrazer(list, today) {
  const MAX = 5;
  return el('section', { className: 'secao cartao-discreto trazer', 'aria-labelledby': 's-trazer' },
    el('span', { className: 'icone-redondo', 'aria-hidden': 'true' }, icon('planos', 'i--20')),
    el('div', {}, el('h2', { id: 's-trazer', text: 'Quer trazer para hoje?' }), el('p', { text: 'Ficaram de outros dias. Traga só o que couber.' })),
    el('ul', { className: 'trazer-lista' }, ...list.slice(0, MAX).map(x => el('li', {},
      el('span', { className: 'trazer-texto' }, el('span', { className: 'trazer-titulo', text: x.title }),
        el('span', { className: 'trazer-meta', text: SCOPE_LABEL[scopeOf(x)] + ' · prazo ' + dueLabel(x.due, today) })),
      el('button', { className: 'btn btn-tonal', type: 'button', 'aria-label': 'Trazer para hoje: ' + x.title,
        onclick: () => { if (persist(trazerParaHoje(items, x.id, today), 'Trazido para hoje: ' + x.title)) focarItem(x.id); } }, 'Trazer')))),
    list.length > MAX ? el('p', { className: 'trazer-mais', text: 'E mais ' + (list.length - MAX) + '.' }) : null);
}
function cartaoRevisao(today) {
  const agoraNao = () => {
    if (!gravarMeta({ revisao_agora_nao: today })) { aviso('Não foi possível guardar. Tente de novo.'); return; }
    renderListas();
    focarTitulo();
    aviso('Combinado. A revisão volta na próxima semana.', () => { gravarMeta({ revisao_agora_nao: '' }); renderListas(); });
  };
  return el('section', { className: 'secao cartao-discreto', 'aria-labelledby': 's-rev' },
    el('span', { className: 'icone-redondo', 'aria-hidden': 'true' }, icon('revisao', 'i--20')),
    el('div', {}, el('h2', { id: 's-rev', text: 'Revisão da semana' }), el('p', { text: 'Uns 10 minutos, quando for bom para vocês.' })),
    el('div', { className: 'acoes' }, el('button', { className: 'btn btn-texto btn-texto--neutro', type: 'button', onclick: agoraNao }, 'Agora não'),
      el('a', { className: 'btn btn-tonal', href: '#/familia' }, 'Começar')));
}
const vazioHoje = () => el('div', { className: 'vazio' }, icon('sol'),
  el('h2', { text: 'Nada para hoje ainda.' }), el('p', { text: 'Que tal uma pequena ação?' }),
  el('div', { className: 'chips sugestoes' }, ...SUGESTOES.map(sg => el('button', { className: 'chip', type: 'button',
    onclick: () => { const n = adicionarHoje(sg); if (n) focarItem(n.id); } }, icon('mais'), sg.title))));
function renderHoje(today) {
  const s = secoesHoje(items, today), blocos = [];
  if (s.paraHoje.length) blocos.push(secaoHoje('s-hoje', 'sol', 'Para hoje', s.paraHoje, today));
  if (s.noite.length) blocos.push(secaoHoje('s-noite', 'lua', 'À noite', s.noite, today));
  if (!s.paraHoje.length && !s.noite.length) {
    blocos.push(s.concluidos.length ? el('p', { className: 'vazio-curto secao', text: 'Nada mais para hoje. O que foi feito está em “Concluídos hoje”.' }) : vazioHoje());
  }
  if (s.trazer.length) blocos.push(cartaoTrazer(s.trazer, today));
  if (mostrarRevisao(today, lerMeta().revisao_agora_nao)) blocos.push(cartaoRevisao(today));
  if (s.concluidos.length) blocos.push(recolhidoHoje('concluidos', 'Concluídos hoje', s.concluidos, today));
  if (s.antes.length) blocos.push(recolhidoHoje('antes', 'Concluídos antes', s.antes, today));
  $('lista-hoje').replaceChildren(...blocos);
}
function renderListas() {
  const today = isoDay();
  renderHoje(today);
  const proximos = proximosDias(items, today);
  $('lista-planos').replaceChildren(...(proximos.length ? [el('section', { className: 'secao proximos', 'aria-labelledby': 't-proximos' },
    el('h2', { className: 'secao-titulo', id: 't-proximos', text: 'Próximos dias' }),
    el('ul', { className: 'lista' }, ...proximos.map(x => itemRow(x, today, false, true))))] : []),
  ...groupPlanos(items).map(g => el('section', { className: 'secao', 'aria-label': g.tab },
    el('h2', { className: 'secao-titulo', text: g.tab }), lista(g.items, today, 'Nada aqui ainda.'))));
  $('lista-familia').replaceChildren(lista(itemsForScreen(items, 'familia', today), today, 'Nada anotado para a revisão da semana.'));
}
// Captura em uma linha: Enter grava na aba Hoje, o item entra no topo e o campo continua focado.
$('form-captura').addEventListener('submit', e => {
  e.preventDefault();
  const t = $('captura').value.trim();
  if (t && adicionarHoje({ title: t })) $('captura').value = '';
  $('captura').focus();
});

// ---------- Folha de item (Anotar / Editar) ----------
// "Quando?" escolhe a aba e o horizonte; a data reconhecida no texto vira prazo (e "Semana"), a menos que alguém
// tenha mexido no campo à mão ou tocado em "Não é data".
let tabManual = false, whenManual = false, dueManual = false, ignorarData = false, reconhecido = null, whenPadrao = 'hoje';
const radio = nome => document.querySelector(`input[name="${nome}"]:checked`)?.value;
const marcar = (nome, v) => { for (const r of document.querySelectorAll(`input[name="${nome}"]`)) r.checked = r.value === v; };
function dataLonga(day) {
  const [y, m, d] = day.split('-').map(Number), t = headerDate(new Date(y, m - 1, d));
  return t.charAt(0).toLocaleLowerCase('pt-BR') + t.slice(1);
}
function mostrarDica() {
  const caixa = $('item-data');
  caixa.hidden = !!editando; // a dica de datas só vale para itens novos
  if (editando) { caixa.replaceChildren(); return; }
  if (!reconhecido) { caixa.replaceChildren(el('p', { className: 'data-texto', text: 'Dica: “amanhã” ou “sábado” já viram data.' })); return; }
  caixa.replaceChildren(el('p', { className: 'data-texto data-texto--ok' }, icon('planos', 'i--18'),
    el('span', { text: '“' + reconhecido.termo + '” vira prazo: ' + dataLonga(reconhecido.due) + (reconhecido.clear ? ' e sai do título' : '') })),
  el('button', { className: 'btn btn-texto', type: 'button', onclick: () => { ignorarData = true; atualizarData(); $('item-title').focus(); } }, 'Não é data'));
}
function definirWhen(w) {
  marcar('item-when', w);
  if (!tabManual) $('item-tab').value = tabForWhen(w, rotaAtual);
}
function atualizarData() {
  if (editando) return;
  reconhecido = ignorarData ? null : reconhecerData($('item-title').value, isoDay());
  if (!dueManual) $('item-due').value = reconhecido ? reconhecido.due : '';
  if (!whenManual) definirWhen(reconhecido ? 'semana' : whenPadrao);
  mostrarDica();
}
function abrirItem(x) {
  if (bloqueado) return;
  editando = x ? x.id : null;
  $('form-item').reset();
  $('item-erro').hidden = true;
  tabManual = whenManual = dueManual = !!x;
  ignorarData = false;
  reconhecido = null;
  whenPadrao = rotaAtual === 'hoje' ? 'hoje' : 'semana';
  marcar('item-scope', x ? scopeOf(x) : 'eu');
  if (x) {
    const area = $('item-area');
    if (x.area && ![...area.options].some(o => o.value === x.area)) area.append(el('option', { text: x.area })); // valor antigo fora da lista
    for (const k of ['title', 'area', 'due', 'notes', 'time']) $('item-' + k).value = x[k] || '';
    $('item-tab').value = x.tab;
    $('item-night').checked = x.night === true;
    marcar('item-when', whenOf(x));
  } else definirWhen(whenPadrao);
  $('item-mais').open = !!(x && (x.due || x.notes || x.time || x.night));
  $('folha-item-titulo').textContent = x ? 'Editar' : 'Anotar';
  $('item-salvar').textContent = x ? 'Salvar' : 'Anotar';
  $('item-excluir').hidden = !x;
  $('item-amanha').hidden = !x || x.done;
  mostrarDica();
  abrirFolha($('folha-item'));
  $('item-title').focus();
}
$('item-title').addEventListener('input', atualizarData);
$('item-tab').addEventListener('change', () => { tabManual = true; });
$('item-due').addEventListener('input', () => { dueManual = true; });
for (const r of document.querySelectorAll('input[name="item-when"]')) r.addEventListener('change', () => {
  whenManual = true;
  const w = radio('item-when');
  if (!editando && !tabManual) $('item-tab').value = tabForWhen(w, rotaAtual);
  else if (w === 'hoje') $('item-tab').value = 'Hoje';
  else if ($('item-tab').value === 'Hoje') $('item-tab').value = tabForWhen(w, rotaAtual);
});
$('form-item').addEventListener('submit', e => {
  e.preventDefault();
  const old = items.find(y => y.id === editando), when = radio('item-when') || whenPadrao, tab = $('item-tab').value;
  let due = $('item-due').value;
  if (when === 'hoje' && tab !== 'Hoje' && !due) due = isoDay(); // "Hoje" fora da aba Hoje: prazo hoje, para aparecer em Hoje
  const limpa = !editando && reconhecido?.clear && due === reconhecido.due;
  const form = { title: limpa ? reconhecido.title : $('item-title').value, tab, area: $('item-area').value,
    horizon: old && when === whenOf(old) ? old.horizon : horizonForWhen(when), due, notes: $('item-notes').value,
    scope: radio('item-scope'), time: $('item-time').value, night: $('item-night').checked };
  let r;
  try { r = upsertItem(items, form, { editingId: editando, newId: crypto.randomUUID(), atStart: !editando && rotaAtual === 'hoje' }); }
  catch { $('item-erro').hidden = false; $('item-title').focus(); return; }
  fecharFolha($('folha-item'));
  if (persist(r.items, (r.created ? 'Anotado: ' : 'Salvo: ') + r.item.title)) focarItem(r.item.id);
});
$('item-amanha').addEventListener('click', () => {
  const x = items.find(y => y.id === editando);
  fecharFolha($('folha-item'));
  if (!x) return;
  persist(ficaParaAmanha(items, x.id, isoDay()), 'Fica para amanhã: ' + x.title);
  focarTitulo();
});
$('item-excluir').addEventListener('click', () => {
  const x = items.find(y => y.id === editando);
  fecharFolha($('folha-item'));
  if (!x) return;
  persist(removeById(items, x.id), 'Excluído: ' + x.title);
  focarTitulo();
});

// ---------- Rotas ----------
migrarSonhos();
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
// Metas vindas do FiscalFlow: gravadas nos sonhos do painel pelo id (valor-alvo e prazo); meta nova vira sonho; nunca apaga.
$('importGoals').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let antes, r;
  try {
    migrarSonhos();
    antes = localStorage.getItem(VKEY);
    const dreams = JSON.parse(antes || '[]');
    if (!Array.isArray(dreams)) throw Error();
    r = mergeGoalsDreams(dreams, JSON.parse(await f.text()));
  } catch { $('status').textContent = 'Arquivo de metas inválido. Nada foi alterado.'; return; }
  try { localStorage.setItem(VKEY, JSON.stringify(r.dreams)); }
  catch { $('status').textContent = 'Não foi possível salvar (espaço insuficiente). Nada foi alterado.'; return; }
  sonhos.recarregar();
  const msg = (r.count === 1 ? '1 meta do FiscalFlow' : r.count + ' metas do FiscalFlow') + ' nos Sonhos' + (r.created ? ' (' + r.created + (r.created === 1 ? ' nova)' : ' novas)') : '');
  $('status').textContent = msg + '.';
  aviso(msg, () => {
    try { antes === null ? localStorage.removeItem(VKEY) : localStorage.setItem(VKEY, antes); sonhos.recarregar(); aviso('Desfeito.'); } catch { aviso('Não foi possível desfazer.'); }
  });
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
// App aberto de um dia para o outro: ao voltar para a tela, "hoje" é recalculado.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderTopo(); renderListas(); } });
window.addEventListener('storage', e => { if (e.key === META) renderTopo(); });

// ---------- Início ----------
prepararFolhas();
$('captura').disabled = bloqueado;
renderTopo();
renderListas();
rotear();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
