// Peças de interface compartilhadas: criação de elementos, ícones, aviso global com "Desfazer" e folhas (<dialog>).
export const $ = id => document.getElementById(id);

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter(c => c !== null && c !== undefined && c !== false));
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';
export function icon(name, extra = '') {
  const svg = document.createElementNS(SVG, 'svg'), use = document.createElementNS(SVG, 'use');
  svg.setAttribute('class', ('i ' + extra).trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

// ---------- Aviso global ----------
// Uma mensagem por vez, logo acima da barra inferior; some em ~5 s (o tempo para enquanto o foco ou o ponteiro estiver nele).
const DURACAO = 5000;
let timer = null;
function agendar() { clearTimeout(timer); timer = setTimeout(fecharAviso, DURACAO); }
export function fecharAviso() {
  clearTimeout(timer);
  $('aviso').replaceChildren();
  document.body.classList.remove('com-aviso');
}
export function aviso(texto, desfazer) {
  const caixa = el('div', { className: 'aviso' },
    el('p', { className: 'aviso-texto' }, icon('check', 'i--20'), el('span', { text: texto })));
  if (desfazer) {
    caixa.append(el('button', { className: 'aviso-acao', type: 'button', onclick: () => { fecharAviso(); desfazer(); } },
      icon('desfazer', 'i--20'), 'Desfazer'));
  }
  caixa.addEventListener('pointerenter', () => clearTimeout(timer));
  caixa.addEventListener('pointerleave', agendar);
  caixa.addEventListener('focusin', () => clearTimeout(timer));
  caixa.addEventListener('focusout', agendar);
  $('aviso').replaceChildren(caixa);
  document.body.classList.add('com-aviso');
  agendar();
}

// ---------- Folhas ----------
// Abrir empilha um passo no histórico: "voltar" (botão do aparelho ou do navegador) fecha a folha em vez de sair da tela.
export function abrirFolha(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  history.pushState({ folha: dialog.id }, '', location.href);
  dialog.dataset.historico = '1';
}
export function fecharFolha(dialog) { if (dialog.open) dialog.close(); }

export function prepararFolhas() {
  for (const dialog of document.querySelectorAll('dialog.folha')) {
    dialog.addEventListener('close', () => {
      if (!dialog.dataset.historico) return;
      delete dialog.dataset.historico;
      if (history.state && history.state.folha === dialog.id) history.back();
    });
    // Toque no véu (fora da folha) fecha.
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dialog.close();
    });
    for (const b of dialog.querySelectorAll('[data-fechar]')) b.addEventListener('click', () => dialog.close());
  }
  window.addEventListener('popstate', () => {
    for (const dialog of document.querySelectorAll('dialog.folha[open]')) { delete dialog.dataset.historico; dialog.close(); }
  });
}
