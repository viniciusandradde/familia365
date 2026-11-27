// Operações sobre a lista (familia365-v1) e os sonhos do painel (familia365-vision-v1). Lógica pura: devolvem
// cópias novas e mantêm o formato gravado de antes; os campos da etapa 3 (done_at, scope, time, night) são opcionais
// e só aparecem quando têm valor.
import { TABS, BASE_PEOPLE, validItem, itemExtras } from './backup.js';
import { addDays } from './datas.js';

// Concluir grava done_at (ISO); reabrir tira done_at.
export const toggleDone = (items, id, nowIso = new Date().toISOString()) => items.map(x => {
  if (x.id !== id) return x;
  if (x.done) { const { done_at, ...resto } = x; return { ...resto, done: false }; }
  return { ...x, done: true, done_at: nowIso };
});
const comPrazo = (items, id, due) => items.map(x => (x.id === id ? { ...x, due } : x));
export const trazerParaHoje = (items, id, today) => comPrazo(items, id, today);
export const ficaParaAmanha = (items, id, today) => comPrazo(items, id, addDays(today, 1));
export const removeById = (list, id) => list.filter(x => x.id !== id);
const str = v => (typeof v === 'string' ? v : '');
const isoOrEmpty = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');

// form: { title, tab, area, horizon, due, notes, scope?, time?, night? }. Lança erro se o item ficar inválido (nada é gravado).
// atStart: o item novo entra no topo da lista (captura em Hoje).
export function upsertItem(items, form, { editingId = null, newId = '', atStart = false } = {}) {
  const old = items.find(x => x.id === editingId);
  const tab = TABS.includes(form.tab) ? form.tab : old?.tab || 'Hoje';
  const done = old?.done || false;
  const item = { id: old?.id || newId, tab, done, title: str(form.title).trim(),
    area: str(form.area), horizon: str(form.horizon), due: isoOrEmpty(form.due), notes: str(form.notes),
    ...itemExtras({ done, done_at: old?.done_at, scope: form.scope, time: form.time, night: form.night }) };
  if (!item.title || !validItem(item) || item.notes.length > 4000) throw Error('item inválido');
  const lista = old ? items.map(x => (x.id === old.id ? item : x)) : atStart ? [item, ...items] : [...items, item];
  return { items: lista, item, created: !old };
}

export function toCents(v) {
  const n = Math.round(Number(String(v ?? '').trim().replace(',', '.')) * 100);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

// form: { title, person, area, horizon, notes, target, reserved, due }; photo: data URL nova, '' (sem foto) ou null (manter).
export function upsertDream(dreams, form, { editingId = null, newId = '', photo = null } = {}) {
  const old = dreams.find(x => x.id === editingId);
  const dream = { ...(old || {}), id: old?.id || newId, person: str(form.person) || old?.person || BASE_PEOPLE[0],
    photo: photo === null ? old?.photo || '' : photo, title: str(form.title).trim().slice(0, 200), area: str(form.area),
    horizon: str(form.horizon), notes: str(form.notes), target_cents: toCents(form.target), reserved_cents: toCents(form.reserved),
    due: isoOrEmpty(form.due) };
  if (!dream.title || !dream.id) throw Error('sonho inválido');
  return { dreams: old ? dreams.map(x => (x.id === old.id ? dream : x)) : [...dreams, dream], dream, created: !old };
}

const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function goalText(x, today = new Date()) {
  if (!x.target_cents) return '';
  const res = x.reserved_cents || 0, left = Math.max(0, x.target_cents - res), pct = Math.min(100, Math.floor(res * 100 / x.target_cents));
  let t = brl(res) + ' de ' + brl(x.target_cents) + ' (' + pct + '%)';
  if (!left) return t + ' · meta atingida';
  t += ' · faltam ' + brl(left);
  if (x.due) {
    const d = new Date(x.due + 'T00:00:00'), m = (d.getFullYear() - today.getFullYear()) * 12 + d.getMonth() - today.getMonth();
    t += m > 0 ? ' · ~' + brl(Math.ceil(left / m)) + '/mês até ' + x.due.split('-').reverse().join('/') : ' · vale rever o prazo';
  }
  return t;
}

export function peopleList(extras, dreams) {
  const all = [...BASE_PEOPLE];
  for (const n of [...(extras || []), ...(dreams || []).map(x => x?.person)]) {
    if (typeof n === 'string' && n.trim() && !all.includes(n)) all.push(n);
  }
  return all;
}
