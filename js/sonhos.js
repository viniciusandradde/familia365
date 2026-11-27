// Tela Sonhos (etapa 4): um lugar só para os sonhos do painel (familia365-vision-v1) e as pessoas (familia365-people-v1).
// Cartão com foto (ou ilustração neutra), selo de escopo, valor guardado, aporte simples e próximo passo; filtros por
// escopo e pessoa; folhas de sonho, "Guardar valor", "Mudar prazo" e opções. Fotos novas vão para o IndexedDB
// (js/fotos.js) e o sonho guarda só a referência; as antigas em base64 continuam valendo e são movidas aos poucos.
import { upsertDream, removeById, peopleList, toCents } from './itens.js';
import { FKEY, lerFamilia, coresDasPessoas } from './familia.js';
import { personKey } from './backup.js';
import { estadoSonho, seloDoSonho, ESCOPO_ICONE, filtrosSonhos, filtrarSonhos, jaGuardado, reais, guardarValor, pausarSonho, mudarPrazo } from './painel.js';
import { abrirFotos, moverFotos, fotosOrfas } from './fotos.js';
import { isoDay } from './telas.js';
import { $, el, icon, aviso, abrirFolha, fecharFolha } from './ui.js';

const KEY = 'familia365-vision-v1', PKEY = 'familia365-people-v1', UNDO = 'familia365-undo-v1';
const SVG = 'http://www.w3.org/2000/svg';

async function reduzirFoto(file) {
  if (!file.type.startsWith('image/') || file.size > 20000000) throw Error('foto');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * scale));
  c.height = Math.max(1, Math.round(bitmap.height * scale));
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c.toDataURL('image/jpeg', 0.65);
}
function svg(tag, attrs) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
// Ilustração neutra (céu, sol e morros) para sonho sem foto; cores pelos tokens (claro e escuro).
function ilustracao() {
  const s = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true', focusable: 'false', class: 'ilustra' });
  s.append(svg('rect', { width: 100, height: 100, class: 'il-ceu' }), svg('circle', { cx: 70, cy: 32, r: 11, class: 'il-sol' }),
    svg('path', { d: 'M0 70 Q25 50 52 64 T100 58 V100 H0Z', class: 'il-morro' }), svg('path', { d: 'M0 84 Q30 70 62 82 T100 78 V100 H0Z', class: 'il-morro2' }));
  return s;
}
// Fecha uma folha e abre outra depois que o "voltar" da primeira terminar (senão ele fecharia a segunda).
function trocarFolha(de, abrirOutra) {
  const comHistorico = !!de.dataset.historico && history.state?.folha === de.id;
  fecharFolha(de);
  if (comHistorico) window.addEventListener('popstate', () => setTimeout(abrirOutra, 0), { once: true }); else abrirOutra();
}
const focarOpcoes = id => document.querySelector(`[data-opcoes="${CSS.escape(id)}"]`)?.focus();

export function iniciarSonhos() {
  let data = [], editando = null, alvo = null, filtro = '', bloqueado = false, fotoNova = null;
  const cache = new Map();
  function ler() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(v)) throw Error();
      data = v; bloqueado = false;
    } catch { data = []; bloqueado = true; }
  }
  ler();
  const prontas = abrirFotos().catch(() => null);

  const extras = () => {
    try { const v = JSON.parse(localStorage.getItem(PKEY) || '[]'); return Array.isArray(v) ? v.filter(n => typeof n === 'string') : []; } catch { return []; }
  };
  function preencher(select, valor) {
    const all = peopleList(extras(), data);
    select.replaceChildren(...all.map(n => el('option', { text: n })));
    select.value = all.includes(valor) ? valor : all[0];
  }
  function save(next, texto) {
    if (bloqueado) return false;
    const antes = data;
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch { aviso('Espaço insuficiente. Faça um backup em Dados.'); return false; }
    data = next;
    draw();
    if (texto) aviso(texto, () => { if (save(antes)) aviso('Desfeito.'); });
    return true;
  }
  const achar = id => data.find(d => d.id === id);

  // ---------- Cartão ----------
  function foto(x) {
    const img = el('img', { className: 'sonho-img', alt: '' });
    if (x.photo) img.src = x.photo;
    else if (cache.has(x.photo_ref)) img.src = cache.get(x.photo_ref);
    else prontas.then(s => s && s.get(x.photo_ref)).then(u => { if (u) { cache.set(x.photo_ref, u); img.src = u; } }).catch(() => {});
    return img;
  }
  // Pessoa cadastrada aparece com a cor dela (bolinha com a inicial, decorativa) e o nome escrito; Meu/Casal/Família, com o ícone.
  const cores = () => { let f = null; try { f = JSON.parse(localStorage.getItem(FKEY) || 'null'); } catch { /* sem cores */ } return coresDasPessoas(extras(), lerFamilia(f).cores); };
  const marca = (selo, extra) => {
    const c = !ESCOPO_ICONE[selo] && extras().some(n => personKey(n) === personKey(selo)) ? cores()[personKey(selo)] : '';
    return c ? el('span', { className: 'av p-' + c, 'aria-hidden': 'true', text: selo.trim().charAt(0).toLocaleUpperCase('pt-BR') }) : icon(ESCOPO_ICONE[selo] || 'pessoa', extra);
  };
  const quem = selo => el('span', { className: 'quem' }, marca(selo), selo);
  function linha(className, partes) {
    const p = el('p', { className });
    partes.filter(Boolean).forEach((x, i) => { if (i) p.append(el('span', { className: 'sep', 'aria-hidden': 'true', text: '·' })); p.append(x); });
    return p;
  }
  function cartao(x, i, today) {
    const e = estadoSonho(x, today), selo = seloDoSonho(x), temFoto = !!(x.photo || x.photo_ref), hid = 'sonho-t' + i;
    const corpo = el('div', { className: 'sonho-corpo' }, el('h2', { id: hid, text: x.title }),
      linha('sonho-meta', [temFoto ? '' : quem(selo), x.area, e.prazo ? 'até ' + e.prazo : x.horizon]));
    if (e.alvo) {
      const rotulo = reais(e.guardado) + ' de ' + reais(e.alvo);
      corpo.append(el('p', { className: 'valores' }, el('strong', { text: rotulo }), el('span', { text: e.pct + '%' })),
        el('progress', { className: 'barra-progresso', value: Math.min(e.guardado, e.alvo), max: e.alvo, 'aria-label': 'Guardado: ' + rotulo, text: e.pct + '%' }));
    }
    const acoes = el('div', { className: 'sonho-acoes' });
    if (e.tipo === 'pausado') corpo.append(el('p', { className: 'ritmo', text: 'Pausado. Retome quando fizer sentido.' }));
    else if (e.tipo === 'alcancado') corpo.append(el('p', { className: 'ritmo ritmo--chegou' }, icon('check', 'i--18'), 'Vocês chegaram lá.'));
    else if (e.prazoPassado) {
      corpo.append(el('p', { className: 'ritmo' }, el('button', { className: 'link-ritmo', type: 'button', 'aria-label': 'Quer ajustar a data? Mudar prazo: ' + x.title,
        'data-prazo': x.id, onclick: () => abrirPrazo(x) }, 'Quer ajustar a data?')));
    } else if (e.mensal) corpo.append(el('p', { className: 'ritmo', text: '≈ ' + reais(e.mensal) + '/mês até ' + e.prazo }));
    if (e.tipo === 'passo') {
      if (x.next_step) corpo.append(el('p', { className: 'sem-valor' }, 'Próximo passo: ', el('strong', { text: x.next_step })));
      else acoes.prepend(el('button', { className: 'btn btn-texto', type: 'button', 'aria-label': 'Anotar um passo: ' + x.title, onclick: () => abrir(x, 'vision-step') }, icon('mais', 'i--20'), 'Anotar um passo'));
    }
    if (e.tipo === 'meta') acoes.prepend(el('button', { className: 'btn ' + (temFoto ? 'btn-tonal' : 'btn-texto'), type: 'button', 'aria-label': 'Guardar valor: ' + x.title, onclick: () => abrirGuardar(x) }, icon('mais', 'i--20'), 'Guardar valor'));
    acoes.append(el('button', { className: 'btn-icone', type: 'button', 'aria-label': 'Mais opções: ' + x.title, 'data-opcoes': x.id, onclick: () => abrirOpcoes(x) }, icon('opcoes')));
    corpo.append(acoes);
    const capa = el('div', { className: 'sonho-foto' }, temFoto ? foto(x) : ilustracao());
    if (temFoto) capa.append(el('span', { className: 'selo-foto' }, marca(selo, 'i--18'), selo));
    return el('article', { className: 'sonho' + (temFoto ? '' : ' sonho--compacto') + (x.paused ? ' sonho--pausado' : ''), 'aria-labelledby': hid }, capa, corpo);
  }

  function draw() {
    const pessoas = peopleList(extras(), data);
    if (filtro && !pessoas.includes(filtro)) filtro = '';
    const fs = filtrosSonhos(pessoas);
    $('sonhos-filtros').replaceChildren(...fs.map(f => el('button', { type: 'button', className: 'chip', 'aria-pressed': String(f.id === filtro), 'data-filtro': f.id,
      onclick: () => { filtro = f.id; draw(); document.querySelector(`#sonhos-filtros [data-filtro="${CSS.escape(f.id)}"]`)?.focus(); } }, icon('check', 'chip-check'), f.rotulo)));
    const lista = filtrarSonhos(data, filtro), g = jaGuardado(lista), today = isoDay();
    $('sonhos-guardado').hidden = !g.cents;
    $('sonhos-guardado').replaceChildren(icon('moedas', 'i--20'), el('span', {}, 'Já guardado: ', el('strong', { text: reais(g.cents) }), ' em ' + g.sonhos + (g.sonhos === 1 ? ' sonho' : ' sonhos')));
    const rotulo = fs.find(f => f.id === filtro)?.rotulo;
    $('vision-list').replaceChildren(...(lista.length ? lista.map((x, i) => cartao(x, i, today)) : [el('div', { className: 'vazio' },
      el('h2', { text: bloqueado ? 'Não foi possível ler o painel' : filtro ? 'Nenhum sonho de ' + rotulo + ' ainda' : 'Nenhum sonho aqui ainda' }),
      el('p', { text: bloqueado ? 'Faça um backup em Dados antes de continuar.' : 'Toque em + para guardar um sonho.' }))]));
  }

  // ---------- Folha de sonho (novo / editar) ----------
  function abrir(x, focar = 'vision-title') {
    if (bloqueado) return;
    editando = x ? x.id : null;
    fotoNova = null;
    $('vision-form').reset();
    $('vision-erro').hidden = true;
    $('vision-previa').hidden = true;
    $('vision-previa').removeAttribute('src');
    preencher($('vision-owner'), x ? x.person : filtro || 'Minha visão');
    if (x) {
      for (const k of ['title', 'area', 'horizon', 'notes']) $('vision-' + k).value = x[k] || '';
      $('vision-step').value = x.next_step || '';
      $('vision-target').value = x.target_cents ? x.target_cents / 100 : '';
      $('vision-reserved').value = x.reserved_cents ? x.reserved_cents / 100 : '';
      $('vision-due').value = x.due || '';
    }
    $('vision-mais').open = focar !== 'vision-title' || !!(x && (x.notes || x.target_cents || x.due || x.photo || x.photo_ref || x.next_step));
    $('folha-sonho-titulo').textContent = x ? 'Editar sonho' : 'Novo sonho';
    $('vision-save').textContent = x ? 'Salvar sonho' : 'Guardar sonho';
    $('vision-excluir').hidden = !x;
    abrirFolha($('folha-sonho'));
    $(focar).focus();
  }
  $('vision-photo').addEventListener('change', async () => {
    const f = $('vision-photo').files[0];
    fotoNova = null;
    $('vision-previa').hidden = true;
    if (!f) return;
    try { fotoNova = await reduzirFoto(f); $('vision-previa').src = fotoNova; $('vision-previa').hidden = false; }
    catch { aviso('Não foi possível processar a imagem.'); $('vision-photo').value = ''; }
  });
  $('vision-form').addEventListener('submit', async e => {
    e.preventDefault();
    const b = $('vision-save'), f = $('vision-photo').files[0];
    const form = { title: $('vision-title').value, person: $('vision-owner').value, area: $('vision-area').value, horizon: $('vision-horizon').value,
      notes: $('vision-notes').value, target: $('vision-target').value, reserved: $('vision-reserved').value, due: $('vision-due').value, next_step: $('vision-step').value };
    if (!form.title.trim()) { $('vision-erro').hidden = false; $('vision-title').focus(); return; }
    b.disabled = true;
    try {
      const dataUrl = f ? fotoNova || await reduzirFoto(f) : null;
      let photoRef = '';
      if (dataUrl) {
        const s = await prontas;
        if (s) { const ref = crypto.randomUUID(); try { await s.put(ref, dataUrl); cache.set(ref, dataUrl); photoRef = ref; } catch { photoRef = ''; } }
      }
      // Sem IndexedDB, a foto fica em base64 no sonho, como antes.
      const r = upsertDream(data, form, { editingId: editando, newId: crypto.randomUUID(), photo: dataUrl && !photoRef ? dataUrl : null, photoRef });
      fecharFolha($('folha-sonho'));
      if (filtro && r.dream.person !== filtro) filtro = '';
      save(r.dreams, (r.created ? 'Sonho guardado: ' : 'Sonho salvo: ') + r.dream.title);
    } catch { aviso('Não foi possível processar a imagem.'); }
    finally { b.disabled = false; }
  });
  function excluir(x) {
    save(removeById(data, x.id), 'Sonho excluído: ' + x.title);
    $('h-sonhos').focus();
  }
  $('vision-excluir').addEventListener('click', () => {
    const x = achar(editando);
    fecharFolha($('folha-sonho'));
    if (x) excluir(x);
  });

  // ---------- Opções, "Guardar valor" e "Mudar prazo" ----------
  function abrirOpcoes(x) {
    alvo = x.id;
    $('folha-opcoes-titulo').textContent = x.title;
    $('op-pausar').textContent = x.paused ? 'Retomar' : 'Pausar';
    abrirFolha($('folha-opcoes'));
    $('op-editar').focus();
  }
  const daOpcao = fn => () => { const x = achar(alvo); if (x) trocarFolha($('folha-opcoes'), () => fn(x)); };
  $('op-editar').addEventListener('click', daOpcao(x => abrir(x)));
  $('op-prazo').addEventListener('click', daOpcao(x => abrirPrazo(x)));
  $('op-pausar').addEventListener('click', daOpcao(x => {
    if (save(pausarSonho(data, x.id, !x.paused), (x.paused ? 'Sonho retomado: ' : 'Sonho pausado: ') + x.title)) focarOpcoes(x.id);
  }));
  $('op-excluir').addEventListener('click', daOpcao(excluir));

  function abrirGuardar(x) {
    alvo = x.id;
    $('guardar-form').reset();
    $('guardar-erro').hidden = true;
    $('guardar-contexto').textContent = x.title + ' · já guardado ' + reais(x.reserved_cents || 0) + ' de ' + reais(x.target_cents || 0);
    abrirFolha($('folha-guardar'));
    $('guardar-valor').focus();
  }
  $('guardar-form').addEventListener('submit', e => {
    e.preventDefault();
    const x = achar(alvo), c = toCents($('guardar-valor').value);
    if (!c) { $('guardar-erro').hidden = false; $('guardar-valor').focus(); return; }
    fecharFolha($('folha-guardar'));
    if (x && save(guardarValor(data, x.id, c), reais(c) + ' somados a ' + x.title)) {
      document.dispatchEvent(new CustomEvent('familia365:guardado', { detail: { id: x.id, cents: c } })); // a revisão da semana anota
      focarOpcoes(x.id);
    }
  });

  function abrirPrazo(x) {
    alvo = x.id;
    $('prazo-contexto').textContent = x.title;
    $('prazo-data').value = x.due || '';
    abrirFolha($('folha-prazo'));
    $('prazo-data').focus();
  }
  function gravarPrazo(due) {
    const x = achar(alvo);
    fecharFolha($('folha-prazo'));
    if (x && save(mudarPrazo(data, x.id, due), due ? 'Prazo de ' + x.title + ' mudado.' : 'Sonho sem prazo: ' + x.title)) focarOpcoes(x.id);
  }
  $('prazo-form').addEventListener('submit', e => { e.preventDefault(); gravarPrazo(/^\d{4}-\d{2}-\d{2}$/.test($('prazo-data').value) ? $('prazo-data').value : ''); });
  $('prazo-sem').addEventListener('click', () => gravarPrazo(''));

  // ---------- Pessoas ----------
  $('vision-people').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('vision-new-person').value.trim().slice(0, 40);
    if (!n) return;
    const ex = extras();
    if (!peopleList(ex, []).includes(n)) {
      try { localStorage.setItem(PKEY, JSON.stringify([...ex, n])); } catch { aviso('Espaço insuficiente. Faça um backup em Dados.'); return; }
    }
    $('vision-new-person').value = '';
    draw();
    aviso('Pessoa adicionada: ' + n);
  });

  // ---------- Fotos antigas e órfãs (aos poucos, sem travar a tela) ----------
  prontas.then(async s => {
    if (!s || bloqueado) return;
    if (data.some(d => d.photo)) {
      const antes = JSON.stringify(data), r = await moverFotos(data, s, { limite: 3 });
      // Só grava se ninguém mexeu no painel enquanto as fotos eram copiadas.
      if (r.movidas && JSON.stringify(data) === antes) save(r.dreams);
    }
    let undo = null;
    try { undo = JSON.parse(localStorage.getItem(UNDO) || 'null')?.dreams; } catch { undo = null; }
    for (const k of fotosOrfas(await s.keys(), data, undo)) if (!cache.has(k)) await s.delete(k);
  }).catch(() => {});

  draw();
  return { abrirNovo: () => abrir(null), recarregar: () => { ler(); draw(); }, guardar: id => { const x = achar(id); if (x) abrirGuardar(x); }, lista: () => data.slice() };
}
