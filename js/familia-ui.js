// Tela Família (etapa 5): revisão da semana guiada (5 passos, todos puláveis, "Modo conversa"), Conversa de domingo (guarda
// só os combinados), pessoas com cor e o histórico. Lógica pura em js/familia.js; aqui, só a interface.
import { $, el, icon, aviso, abrirFolha, fecharFolha } from './ui.js';
import { isoDay, diaCurto } from './telas.js';
import { personKey } from './backup.js';
import { reais } from './painel.js';
import { scopeOf, SCOPE_LABEL, SCOPE_ICON } from './hoje.js';
import * as F from './familia.js';

const PKEY = 'familia365-people-v1', VKEY = 'familia365-vision-v1', META = 'familia365-meta-v1';
const SUB = ['Do grande ao pequeno, tudo conta.', 'Sem culpa: escolham o destino de cada um.', 'Escolham até 3 para a semana. É sugestão, não regra.',
  'Se der, um valor pequeno já conta.', 'Uma frase basta. Depois é só concluir.'];
const inicial = n => n.trim().charAt(0).toLocaleUpperCase('pt-BR');
const foto = keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
function voltar(snap) {
  try { for (const [k, v] of Object.entries(snap)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } return true; } catch { return false; }
}

// itens(): lista atual; gravar(next, texto?): grava a lista (com aviso e Desfazer quando há texto); sonhos: módulo da tela Sonhos.
export function iniciarFamilia({ itens, gravar, sonhos }) {
  let aberta = false, conversa = false, focoDepois = null, editandoPessoa = null;
  const ler = () => { try { return F.lerFamilia(JSON.parse(localStorage.getItem(F.FKEY) || 'null')); } catch { return F.lerFamilia(null); } };
  const pessoas = () => { try { const v = JSON.parse(localStorage.getItem(PKEY) || '[]'); return Array.isArray(v) ? v.filter(n => typeof n === 'string') : []; } catch { return []; } };
  function salvar(patch) {
    try { localStorage.setItem(F.FKEY, JSON.stringify({ ...ler(), ...patch })); return true; }
    catch { aviso('Não foi possível salvar. Verifique o espaço disponível e faça um backup.'); return false; }
  }
  const rascunho = () => ler().rascunho;
  function mudarRascunho(patch, redesenhar = true) { const r = rascunho(); if (r && salvar({ rascunho: { ...r, ...patch } }) && redesenhar) render(); }
  const sel = id => '#' + CSS.escape(id);

  // ---------- Revisão da semana ----------
  function abrirRevisao() {
    if (!rascunho() && !salvar({ rascunho: F.rascunhoNovo(isoDay()) })) return;
    aberta = true;
    focoDepois = '#rev-titulo';
    if (location.hash !== '#/familia') location.hash = '#/familia'; else render();
  }
  function ir(acao) { if (salvar({ rascunho: F.navegar(rascunho(), acao) })) { focoDepois = '#rev-titulo'; render(); } }
  function fechar() { aberta = false; conversa = false; focoDepois = '#rev-abrir'; render(); }
  function concluir(pularUltimo) {
    const antes = rascunho(), r = pularUltimo ? { ...antes, pulados: [...antes.pulados, 5] } : antes;
    const today = isoDay(), items = itens();
    const texto = F.resumoRevisao(r, { items, dreams: sonhos.lista(), today }) || 'Revisão feita, sem anotações.';
    const item = F.itemDaRevisao(texto, today, new Date().toISOString(), crypto.randomUUID());
    if (!gravar([...items, item])) return;
    const meta = foto([META]);
    try { localStorage.setItem(META, JSON.stringify({ ...JSON.parse(meta[META] || 'null'), revisao_agora_nao: today })); } catch { /* o cartão de domingo continua */ }
    salvar({ rascunho: null });
    aberta = false; conversa = false; focoDepois = '#s-historico';
    render();
    aviso('Revisão guardada. Boa semana!', () => {
      if (!gravar(items)) return;
      voltar(meta); salvar({ rascunho: antes }); aberta = true; render(); aviso('Desfeito.');
    });
  }
  function decidir(x, v) {
    const r = rascunho();
    if (!r || !salvar({ rascunho: { ...r, decisoes: { ...r.decisoes, [x.id]: v } } })) return;
    focoDepois = sel('dec-' + x.id + '-' + v);
    if (!gravar(F.aplicarDecisao(itens(), x.id, v, isoDay(), new Date().toISOString()))) render();
  }
  const btn = (texto, className, onclick, extra = {}) => el('button', { type: 'button', className, onclick, ...extra }, texto);
  function campo(rotulo, chave, valor, area) {
    const c = el(area ? 'textarea' : 'input', { className: 'campo', id: 'rev-' + chave, maxlength: area ? '1000' : '200', rows: area ? '3' : null, autocomplete: 'off' });
    c.value = valor;
    c.addEventListener('input', () => mudarRascunho({ [chave]: c.value }, false));
    return [el('label', { className: 'grupo editavel' }, el('span', { className: 'rotulo', text: rotulo }), c),
      valor.trim() ? el('p', { className: 'so-conversa', text: valor }) : null];
  }
  const vazio = texto => el('p', { className: 'rev-vazio', text: texto });
  function corpoPasso(r, today, items) {
    if (r.passo === 1) {
      const certo = F.deuCerto(items, today);
      return [certo.length ? el('ul', { className: 'rev-certo' }, ...certo.map(x => el('li', {}, icon('check', 'i--20'), el('span', { text: x.title }))))
        : vazio('Nada concluído nos últimos 7 dias, e tudo bem. Semanas assim também contam.'), ...campo('Quer anotar algo? (opcional)', 'nota_certo', r.nota_certo, true)];
    }
    if (r.passo === 2) {
      const lista = F.ficouPeloCaminho(items, today, r.decisoes);
      if (!lista.length) return [vazio('Nada ficou pelo caminho.')];
      return lista.map(x => {
        const sc = scopeOf(x), d = r.decisoes[x.id];
        return el('div', { className: 'pendente' }, el('h3', { className: 'pendente-titulo', text: x.title }),
          el('p', { className: 'item-meta' }, el('span', { className: 'quem' }, icon(SCOPE_ICON[sc]), SCOPE_LABEL[sc]),
            x.due && !d ? el('span', { text: ' · prazo ' + diaCurto(x.due, today) }) : null),
          el('fieldset', { className: 'segmentos editavel' }, el('legend', { className: 'sr', text: 'O que fazer com: ' + x.title }),
            ...Object.entries(F.ESCOLHAS).map(([v, rot]) => {
              const inp = el('input', { type: 'radio', name: 'dec-' + x.id, value: v, id: 'dec-' + x.id + '-' + v });
              inp.checked = d === v;
              inp.addEventListener('change', () => decidir(x, v));
              return el('label', {}, inp, el('span', { className: 'seg-marca', 'aria-hidden': 'true' }), rot);
            })),
          d ? el('p', { className: 'so-conversa', text: F.ESCOLHAS[d] }) : null);
      });
    }
    if (r.passo === 3) {
      const cand = F.candidatosPendencias(items).slice(0, 20), n = r.pendencias.length;
      if (!cand.length) return [vazio('Nenhuma pendência aberta. Semana livre.')];
      return [el('ul', { className: 'rev-pend' }, ...cand.map(x => {
        const sim = r.pendencias.includes(x.id), c = el('input', { type: 'checkbox', className: 'caixa', id: 'pend-' + x.id });
        c.checked = sim;
        c.addEventListener('change', () => {
          const resto = rascunho().pendencias.filter(id => id !== x.id);
          focoDepois = sel('pend-' + x.id);
          mudarRascunho({ pendencias: c.checked ? [...resto, x.id] : resto });
        });
        return el('li', { className: sim ? 'escolhida' : null }, el('label', {}, c, el('span', { className: 'rev-pend-texto' }, el('span', { text: x.title }),
          x.due ? el('span', { className: 'item-meta', text: diaCurto(x.due, today) }) : null)));
      })), el('p', { className: 'dica editavel', 'aria-live': 'polite', text: n === 0 ? 'Sugestão: até 3.' : n <= 3 ? n + ' de até 3.' : n + ' escolhidas. Mais de 3 também vale; confiram se cabe na semana.' })];
    }
    if (r.passo === 4) {
      const ds = F.sonhosComMeta(sonhos.lista());
      if (!ds.length) return [vazio('Nenhum sonho com meta em andamento. Dá para criar um em Sonhos.')];
      return ds.map(d => el('div', { className: 'rev-sonho' }, el('div', {}, el('h3', { className: 'pendente-titulo', text: d.title }),
        el('p', { className: 'item-meta', text: reais(d.reserved_cents || 0) + ' de ' + reais(d.target_cents) + (r.guardados[d.id] ? ' · agora + ' + reais(r.guardados[d.id]) : '') })),
      btn('+ R$', 'btn btn-tonal editavel', () => sonhos.guardar(d.id), { id: 'rev-g-' + d.id, 'aria-label': 'Guardar valor em ' + d.title })));
    }
    return [...campo('Foco da semana', 'foco', r.foco, false), ...campo('Anotação (opcional)', 'nota', r.nota, true)];
  }
  function cartaoRevisao(r, today, items) {
    const n = r.passo;
    return el('section', { className: 'revisao' + (conversa ? ' revisao--conversa' : ''), 'aria-labelledby': 'rev-titulo' },
      el('div', { className: 'revisao-topo' }, el('p', { className: 'sobretitulo', text: 'Revisão da semana' }),
        el('button', { className: 'btn-icone', type: 'button', 'aria-label': 'Sair da revisão (continua de onde parou)', onclick: fechar }, icon('fechar'))),
      el('ol', { className: 'passos', 'aria-label': 'Passo ' + n + ' de 5' }, ...F.PASSOS.map((t, i) => el('li', { className: i + 1 < n ? 'feito' : null, 'aria-current': i + 1 === n ? 'step' : null },
        el('span', { className: 'sr', text: 'Passo ' + (i + 1) + (i + 1 === n ? ', atual' : i + 1 < n ? (r.pulados.includes(i + 1) ? ', pulado' : ', feito') : '') })))),
      el('p', { className: 'passo-info', text: 'Passo ' + n + ' de 5' }),
      el('h2', { id: 'rev-titulo', tabindex: '-1', text: F.PASSOS[n - 1] }), el('p', { text: SUB[n - 1] }),
      el('div', { className: 'rev-corpo' }, ...corpoPasso(r, today, items)),
      el('div', { className: 'revisao-rodape' }, n > 1 ? btn('Voltar', 'btn btn-texto btn-texto--neutro', () => ir('voltar')) : el('span'),
        el('div', { className: 'direita' }, btn('Pular', 'btn btn-texto', () => (n === 5 ? concluir(true) : ir('pular'))),
          btn(n === 5 ? 'Concluir' : 'Continuar', 'btn btn-principal', () => (n === 5 ? concluir(false) : ir('continuar'))))),
      el('div', { className: 'modo-conversa' }, el('button', { className: 'btn btn-texto btn-texto--neutro', type: 'button', id: 'rev-conversa', 'aria-pressed': String(conversa),
        onclick: () => { conversa = !conversa; focoDepois = '#rev-conversa'; render(); } }, el('span', { className: 'aa', 'aria-hidden': 'true', text: 'Aa' }),
      conversa ? 'Sair do modo conversa' : 'Modo conversa, com letras grandes')));
  }
  function chamadaRevisao(r) {
    return el('section', { className: 'cartao rev-chamada', 'aria-labelledby': 's-rev-chamada' },
      el('span', { className: 'icone-redondo', 'aria-hidden': 'true' }, icon('revisao', 'i--20')),
      el('div', {}, el('h2', { id: 's-rev-chamada', text: 'Revisão da semana' }),
        el('p', { text: r ? 'Vocês pararam no passo ' + r.passo + ' de 5. O que já fizeram está guardado.' : 'Uns 10 minutos, em 5 passos. Dá para pular qualquer um.' })),
      btn(r ? 'Continuar' : 'Começar', 'btn btn-tonal', abrirRevisao, { id: 'rev-abrir' }));
  }

  // ---------- Pessoas ----------
  function secaoPessoas(ps, salvas) {
    const cores = F.coresDasPessoas(ps, salvas);
    const nova = (className, texto) => el('button', { type: 'button', className, id: 'pessoa-nova', onclick: () => abrirPessoa(null) }, icon('mais', 'i--20'), texto);
    return el('section', { className: 'secao', 'aria-labelledby': 's-pessoas' },
      el('h2', { className: 'secao-titulo secao-titulo--grande', id: 's-pessoas', text: 'Pessoas' }),
      ps.length ? el('ul', { className: 'lista' }, ...ps.map(n => {
        const c = cores[personKey(n)], cor = F.NOME_COR[c].toLocaleLowerCase('pt-BR');
        return el('li', {}, el('button', { type: 'button', className: 'pessoa', 'data-pessoa': personKey(n), 'aria-label': 'Editar ' + n + ', cor ' + cor, onclick: () => abrirPessoa(n) },
          el('span', { className: 'av av--40 p-' + c, 'aria-hidden': 'true', text: inicial(n) }),
          el('span', {}, el('span', { className: 'pessoa-nome', text: n }), el('br'), el('span', { className: 'pessoa-sub', text: 'cor ' + cor })), icon('opcoes')));
      }), el('li', {}, nova('btn btn-texto linha-acao', 'Adicionar pessoa')))
        : el('div', { className: 'vazio' }, el('h3', { text: 'Quem faz parte da família?' }),
          el('p', { text: 'Cadastre as pessoas: cada uma ganha uma cor, sempre com o nome ao lado.' }), nova('btn btn-tonal', 'Adicionar pessoa')),
      el('p', { className: 'nota' }, icon('cadeado', 'i--18'), 'Nomes e cores ficam só neste aparelho.'));
  }
  function abrirPessoa(nome) {
    editandoPessoa = nome;
    $('pessoa-form').reset();
    $('pessoa-erro').hidden = true;
    $('folha-pessoa-titulo').textContent = nome ? 'Editar pessoa' : 'Nova pessoa';
    $('pessoa-nome').value = nome || '';
    $('pessoa-remover').hidden = !nome;
    const ps = pessoas(), cor = F.coresDasPessoas(nome ? ps : [...ps, '\u0000nova'], ler().cores)[personKey(nome || '\u0000nova')];
    const r = document.querySelector(`input[name="pessoa-cor"][value="${cor}"]`);
    if (r) r.checked = true;
    abrirFolha($('folha-pessoa'));
    $('pessoa-nome').focus();
  }
  function aplicarPessoas(fn, texto, focar) {
    const snap = foto([PKEY, F.FKEY, VKEY]);
    try { fn(); }
    catch (err) {
      voltar(snap);
      if (err instanceof DOMException || err.message === 'leitura') { aviso('Não foi possível salvar. Verifique o espaço disponível e faça um backup.'); return false; }
      $('pessoa-erro').textContent = err.message; $('pessoa-erro').hidden = false; $('pessoa-nome').focus(); return false;
    }
    fecharFolha($('folha-pessoa'));
    sonhos.recarregar();
    focoDepois = focar;
    render();
    aviso(texto, () => { voltar(snap); sonhos.recarregar(); render(); aviso('Desfeito.'); });
    return true;
  }
  const gravarJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  $('pessoa-form').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('pessoa-nome').value.trim(), cor = document.querySelector('input[name="pessoa-cor"]:checked')?.value, de = editandoPessoa;
    aplicarPessoas(() => {
      const f = ler(), ps = pessoas();
      if (de === null) {
        const r = F.adicionarPessoa({ people: ps, cores: f.cores }, nome, cor);
        gravarJSON(PKEY, r.people); gravarJSON(F.FKEY, { ...f, cores: r.cores });
        return;
      }
      let dreams;
      try { dreams = JSON.parse(localStorage.getItem(VKEY) || '[]'); } catch { throw Error('leitura'); }
      if (!Array.isArray(dreams)) throw Error('leitura');
      const r = F.renomearPessoa({ people: ps, cores: f.cores, dreams }, de, nome, cor);
      if (r.dreams.some((d, i) => d !== dreams[i])) gravarJSON(VKEY, r.dreams);
      gravarJSON(PKEY, r.people); gravarJSON(F.FKEY, { ...f, cores: r.cores });
    }, de === null ? 'Pessoa adicionada: ' + nome : 'Pessoa atualizada: ' + nome, `[data-pessoa="${CSS.escape(personKey(nome))}"]`);
  });
  $('pessoa-remover').addEventListener('click', () => {
    const n = editandoPessoa;
    aplicarPessoas(() => {
      const f = ler(), r = F.removerPessoa({ people: pessoas(), cores: f.cores }, n);
      gravarJSON(PKEY, r.people); gravarJSON(F.FKEY, { ...f, cores: r.cores });
    }, 'Pessoa removida: ' + n + '. Os sonhos continuam guardados.', '#pessoa-nova');
  });

  // ---------- Conversa de domingo ----------
  function mudarCombinados(lista, texto, focar) {
    const snap = foto([F.FKEY]);
    if (!salvar({ combinados: lista })) return;
    focoDepois = focar;
    render();
    aviso(texto, () => { voltar(snap); render(); aviso('Desfeito.'); });
  }
  function secaoConversa(combinados, today) {
    const input = el('input', { className: 'campo', id: 'combinado-texto', maxlength: '200', autocomplete: 'off', placeholder: 'Ex.: jantar sem celular às quartas' });
    const form = el('form', { className: 'combinado-form', novalidate: true, onsubmit: e => {
      e.preventDefault();
      const l = F.adicionarCombinado(ler().combinados, input.value, isoDay(), crypto.randomUUID());
      if (!l) { input.focus(); return; }
      mudarCombinados(l, 'Combinado guardado.', '#combinado-texto');
    } }, el('label', { className: 'rotulo', for: 'combinado-texto', text: 'O que vocês combinaram?' }),
    el('div', { className: 'combinado-linha' }, input, el('button', { className: 'btn btn-principal', type: 'submit' }, 'Guardar')));
    return el('section', { className: 'secao conversa', 'aria-labelledby': 's-conversa' },
      el('div', { className: 'conversa-topo' }, el('span', { className: 'icone-redondo', 'aria-hidden': 'true' }, icon('xicara', 'i--20')),
        el('div', {}, el('h2', { id: 's-conversa', text: 'Conversa de domingo' }), el('p', { text: 'Três perguntas, sem pressa. Só os combinados ficam guardados.' }))),
      el('ol', { className: 'perguntas' }, ...F.PERGUNTAS.map(q => el('li', { text: q }))), form,
      combinados.length ? el('ul', { className: 'combinados', 'aria-label': 'Combinados, mais recentes primeiro' }, ...combinados.map(c => el('li', {},
        el('div', {}, el('p', { text: c.text }), el('time', { className: 'item-meta', datetime: c.date, text: 'combinado ' + diaCurto(c.date, today) })),
        btn('Tirar', 'btn btn-texto btn-texto--neutro', () => mudarCombinados(F.removerCombinado(ler().combinados, c.id), 'Combinado tirado: ' + c.text, '#combinado-texto'),
          { 'aria-label': 'Tirar o combinado: ' + c.text }))))
        : el('div', { className: 'vazio' }, el('h3', { text: 'Ainda não há combinados' }),
          el('p', { text: 'O que vocês combinarem aparece aqui, para lembrar durante a semana.' })));
  }

  // ---------- Histórico e deixados de lado ----------
  function historicoSecoes(items) {
    const out = [], revs = F.historico(items), soltos = F.deixadosDeLado(items);
    if (revs.length) out.push(el('section', { className: 'secao', 'aria-labelledby': 's-historico' },
      el('h2', { className: 'secao-titulo', id: 's-historico', tabindex: '-1', text: 'Revisões anteriores' }),
      el('ul', { className: 'lista historico' }, ...revs.map(x => el('li', {}, el('details', {}, el('summary', { text: x.title }),
        el('p', { className: 'historico-texto', text: x.notes || 'Sem anotações.' })))))));
    if (soltos.length) out.push(el('section', { className: 'secao', 'aria-labelledby': 's-soltos' },
      el('h2', { className: 'secao-titulo', id: 's-soltos', text: 'Deixados de lado' }),
      el('p', { className: 'dica', text: 'Soltos na revisão. Dá para trazer de volta quando quiser.' }),
      el('ul', { className: 'lista soltos' }, ...soltos.map(x => el('li', {}, el('span', { text: x.title }),
        btn('Recuperar', 'btn btn-texto', () => gravar(F.recuperar(itens(), x.id), 'Recuperado: ' + x.title), { 'aria-label': 'Recuperar: ' + x.title }))))));
    return out;
  }

  function render() {
    const today = isoDay(), items = itens(), f = ler();
    if (!f.rascunho) aberta = false;
    $('familia-revisao').replaceChildren(aberta ? cartaoRevisao(f.rascunho, today, items) : chamadaRevisao(f.rascunho));
    $('familia-conteudo').replaceChildren(secaoPessoas(pessoas(), f.cores), secaoConversa(f.combinados, today), ...historicoSecoes(items));
    if (focoDepois && !$('tela-familia').hidden) { document.querySelector(focoDepois)?.focus(); focoDepois = null; }
  }
  document.addEventListener('familia365:guardado', e => {
    const r = rascunho();
    if (!r || !aberta) return;
    const { id, cents } = e.detail;
    focoDepois = sel('rev-g-' + id);
    mudarRascunho({ guardados: { ...r.guardados, [id]: (r.guardados[id] || 0) + cents } });
  });
  return { render, abrirRevisao };
}
