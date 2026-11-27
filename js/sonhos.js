// Tela Sonhos: Painel de Visão do Futuro (familia365-vision-v1) e pessoas (familia365-people-v1), com a folha de sonho.
// Mesmo formato gravado do painel antigo; fotos reduzidas para 800 px em JPEG, como antes.
import { upsertDream, removeById, goalText, peopleList } from './itens.js';
import { $, el, aviso, abrirFolha, fecharFolha } from './ui.js';

const KEY = 'familia365-vision-v1', PKEY = 'familia365-people-v1';

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

export function iniciarSonhos() {
  let data = [], editando = null, bloqueado = false;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(data)) throw Error();
  } catch { data = []; bloqueado = true; }

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

  function cartao(x) {
    const meta = [x.area, x.horizon].filter(Boolean).join(' · '), goal = goalText(x);
    return el('article', { className: 'sonho' },
      x.photo ? el('img', { className: 'sonho-foto', src: x.photo, alt: '' }) : null,
      el('div', { className: 'sonho-corpo' },
        el('h3', { className: 'sonho-titulo', text: x.title }),
        meta ? el('p', { className: 'sonho-meta', text: meta }) : null,
        x.notes ? el('p', { className: 'sonho-nota', text: x.notes }) : null,
        goal ? el('p', { className: 'sonho-meta', text: goal }) : null,
        el('button', { className: 'btn btn-texto sonho-editar', type: 'button', 'aria-label': 'Editar sonho: ' + x.title, onclick: () => abrir(x) }, 'Editar')));
  }
  function draw() {
    const pessoa = $('vision-person').value;
    preencher($('vision-person'), pessoa);
    const meus = data.filter(x => x.person === $('vision-person').value);
    $('vision-list').replaceChildren(...(meus.length ? meus.map(cartao) : [el('div', { className: 'vazio' },
      el('h2', { text: bloqueado ? 'Não foi possível ler o painel' : 'Nenhum sonho aqui ainda' }),
      el('p', { text: bloqueado ? 'Faça um backup em Dados antes de continuar.' : 'Toque em + para guardar um sonho.' }))]));
  }

  function abrir(x) {
    if (bloqueado) return;
    editando = x ? x.id : null;
    $('vision-form').reset();
    $('vision-erro').hidden = true;
    preencher($('vision-owner'), x ? x.person : $('vision-person').value);
    if (x) {
      for (const k of ['title', 'area', 'horizon', 'notes']) $('vision-' + k).value = x[k] || '';
      $('vision-target').value = x.target_cents ? x.target_cents / 100 : '';
      $('vision-reserved').value = x.reserved_cents ? x.reserved_cents / 100 : '';
      $('vision-due').value = x.due || '';
    }
    $('vision-mais').open = !!(x && (x.notes || x.target_cents || x.due || x.photo));
    $('folha-sonho-titulo').textContent = x ? 'Editar sonho' : 'Novo sonho';
    $('vision-save').textContent = x ? 'Salvar sonho' : 'Guardar sonho';
    $('vision-excluir').hidden = !x;
    abrirFolha($('folha-sonho'));
    $('vision-title').focus();
  }

  $('vision-person').addEventListener('change', draw);
  $('vision-form').addEventListener('submit', async e => {
    e.preventDefault();
    const b = $('vision-save'), f = $('vision-photo').files[0];
    const form = { title: $('vision-title').value, person: $('vision-owner').value, area: $('vision-area').value, horizon: $('vision-horizon').value,
      notes: $('vision-notes').value, target: $('vision-target').value, reserved: $('vision-reserved').value, due: $('vision-due').value };
    if (!form.title.trim()) { $('vision-erro').hidden = false; $('vision-title').focus(); return; }
    b.disabled = true;
    try {
      const r = upsertDream(data, form, { editingId: editando, newId: crypto.randomUUID(), photo: f ? await reduzirFoto(f) : null });
      fecharFolha($('folha-sonho'));
      $('vision-person').value = r.dream.person;
      save(r.dreams, (r.created ? 'Sonho guardado: ' : 'Sonho salvo: ') + r.dream.title);
    } catch { aviso('Não foi possível processar a imagem.'); }
    finally { b.disabled = false; }
  });
  $('vision-excluir').addEventListener('click', () => {
    const x = data.find(y => y.id === editando);
    fecharFolha($('folha-sonho'));
    if (!x) return;
    save(removeById(data, x.id), 'Sonho excluído: ' + x.title);
    $('h-sonhos').focus();
  });
  $('vision-people').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('vision-new-person').value.trim().slice(0, 40);
    if (!n) return;
    const ex = extras();
    if (!peopleList(ex, []).includes(n)) {
      try { localStorage.setItem(PKEY, JSON.stringify([...ex, n])); } catch { aviso('Espaço insuficiente. Faça um backup em Dados.'); return; }
    }
    $('vision-new-person').value = '';
    preencher($('vision-person'), n);
    draw();
    aviso('Pessoa adicionada: ' + n);
  });

  draw();
  return { abrirNovo: () => abrir(null) };
}
