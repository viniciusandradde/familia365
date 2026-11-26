// Operações sobre a lista (familia365-v1) e os sonhos do painel (familia365-vision-v1). Lógica pura: devolvem
// cópias novas e mantêm o formato gravado de antes (os mesmos campos, nenhum campo novo).
import { TABS, BASE_PEOPLE, validItem } from './backup.js';

export const toggleDone = (items, id) => items.map(x => (x.id === id ? { ...x, done: !x.done } : x));
export const removeById = (list, id) => list.filter(x => x.id !== id);
const str = v => (typeof v === 'string' ? v : '');
const isoOrEmpty = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');

// form: { title, tab, area, horizon, due, notes }. Lança erro se o item ficar inválido (nada é gravado).
export function upsertItem(items, form, { editingId = null, newId = '' } = {}) {
  const old = items.find(x => x.id === editingId);
  const tab = TABS.includes(form.tab) ? form.tab : old?.tab || 'Hoje';
  const item = { id: old?.id || newId, tab, done: old?.done || false, title: str(form.title).trim(),
    area: str(form.area), horizon: str(form.horizon), due: isoOrEmpty(form.due), notes: str(form.notes) };
  if (!item.title || !validItem(item) || item.notes.length > 4000) throw Error('item inválido');
  return { items: old ? items.map(x => (x.id === old.id ? item : x)) : [...items, item], item, created: !old };
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
