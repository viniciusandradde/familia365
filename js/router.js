// Rotas por hash da nova interface (lógica pura, sem DOM). "#import=" continua sendo o link de importação.
export const ROUTES = ['hoje', 'planos', 'sonhos', 'familia', 'dados'];
const LEGACY = { dados: 'dados', vision: 'sonhos' }; // âncoras da página antiga
const IMPORT = '#import=';

export function parseRoute(hash) {
  const h = typeof hash === 'string' ? hash : '';
  if (h.startsWith(IMPORT)) return { route: 'hoje', importPayload: h.slice(IMPORT.length), canonical: false };
  if (h.startsWith('#/')) {
    const raw = h.slice(2);
    let name = raw;
    try { name = decodeURIComponent(raw); } catch { /* fica como veio */ }
    name = name.replace(/\/+$/, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (ROUTES.includes(name)) return { route: name, importPayload: null, canonical: raw === name };
  } else if (LEGACY[h.slice(1)]) {
    return { route: LEGACY[h.slice(1)], importPayload: null, canonical: false };
  }
  return { route: 'hoje', importPayload: null, canonical: false };
}

export function hashFor(route) {
  return '#/' + (ROUTES.includes(route) ? route : 'hoje');
}
