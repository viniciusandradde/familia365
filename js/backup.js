// Backup completo do Família365 (formato familia365.backup, version 2). Módulo puro: sem DOM, testável no Node.
// Lê também os backups antigos: a lista ({version:1, items}) e o painel de visão ({version:1, vision}).
export const MAX_BYTES = 25000000; // fotos em base64 cabem com folga; o LocalStorage guarda cerca de 5 MB
export const TABS = ['Hoje', 'Plano de vida', 'Família', 'Sonhos', 'Pendências', 'Revisão semanal'];
export const BASE_PEOPLE = ['Minha visão', 'Casal', 'Família'];
const PHOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ALL = ['items', 'dreams', 'people'];

export class BackupError extends Error {}
const fail = msg => { throw new BackupError(msg); };

// Mesmas regras de valid() do app.js.
export function validItem(x) {
  return !!x && typeof x.id === 'string' && typeof x.title === 'string' && x.title.length <= 200 && TABS.includes(x.tab) &&
    typeof x.done === 'boolean' && ['area', 'horizon', 'due', 'notes'].every(k => typeof x[k] === 'string');
}
// Mesmas regras da restauração do painel em vision.js.
export function validDream(x) {
  return !!x && ['id', 'person', 'title', 'area', 'horizon', 'notes', 'photo'].every(k => typeof x[k] === 'string') &&
    (!x.photo || PHOTO.test(x.photo)) &&
    ['target_cents', 'reserved_cents'].every(k => x[k] === undefined || (Number.isSafeInteger(x[k]) && x[k] >= 0)) &&
    (x.due === undefined || x.due === '' || DAY.test(x.due));
}
const validPerson = n => typeof n === 'string' && n.trim().length > 0 && n.length <= 40;

const cleanItem = x => ({ id: x.id, tab: x.tab, done: x.done, title: x.title, area: x.area, horizon: x.horizon, due: x.due, notes: x.notes });
const cents = v => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
export function cleanDream(x) {
  const s = k => (typeof x[k] === 'string' ? x[k] : '');
  return { id: String(x.id), person: s('person'), title: s('title'), area: s('area'), horizon: s('horizon'), notes: s('notes'),
    photo: PHOTO.test(s('photo')) ? x.photo : '', target_cents: cents(x.target_cents), reserved_cents: cents(x.reserved_cents),
    due: DAY.test(s('due')) ? x.due : '' };
}
const personKey = n => n.trim().toLocaleLowerCase('pt-BR');
function uniquePeople(list) {
  const seen = new Set(), out = [];
  for (const n of list) { const k = personKey(n); if (!seen.has(k)) { seen.add(k); out.push(n.trim()); } }
  return out;
}

export function buildBackup({ items = [], dreams = [], people = [], exportedAt = new Date().toISOString() } = {}) {
  return { format: 'familia365.backup', version: 2, exported_at: exportedAt, items: items.map(cleanItem),
    dreams: dreams.map(cleanDream), people: uniquePeople(people.filter(validPerson)) };
}

function checkItems(list) {
  if (!Array.isArray(list) || !list.every(validItem)) fail('Backup inválido: há tarefas com campos que o app não reconhece.');
  if (new Set(list.map(x => x.id)).size !== list.length) fail('Backup inválido: há tarefas com identificador repetido.');
  return list.map(cleanItem);
}
function checkDreams(list) {
  if (!Array.isArray(list) || !list.every(validDream)) fail('Backup inválido: há sonhos com campos ou fotos que o app não reconhece.');
  if (new Set(list.map(x => x.id)).size !== list.length) fail('Backup inválido: há sonhos com identificador repetido.');
  return list.map(cleanDream);
}
function checkPeople(list) {
  if (!Array.isArray(list) || !list.every(validPerson)) fail('Backup inválido: a lista de pessoas não está no formato esperado.');
  return uniquePeople(list);
}

// Devolve {items, dreams, people, kind, covers, exportedAt}. covers diz quais partes o arquivo traz de fato.
export function parseBackup(text) {
  if (typeof text !== 'string') fail('Arquivo vazio ou ilegível.');
  if (text.length > MAX_BYTES) fail('Arquivo grande demais para ser um backup do Família365 (limite de 25 MB).');
  let d;
  try { d = JSON.parse(text); } catch { fail('Este arquivo não é um backup do Família365 (não é um JSON válido).'); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) fail('Arquivo não reconhecido como backup do Família365.');
  if (d.format === 'familia365.goal') fail('Este é um arquivo de metas do FiscalFlow. Use "Importar metas" em Outras importações.');
  if (d.format === 'familia365.backup') {
    if (d.version !== 2) fail(d.version > 2 ? 'Backup feito numa versão mais nova do app. Atualize o Família365 e tente de novo.' : 'Versão de backup não reconhecida.');
    const exportedAt = typeof d.exported_at === 'string' && !Number.isNaN(Date.parse(d.exported_at)) ? d.exported_at : '';
    return { items: checkItems(d.items), dreams: checkDreams(d.dreams), people: checkPeople(d.people ?? []), kind: 'v2', covers: ALL.slice(), exportedAt };
  }
  if (d.version === 1 && Array.isArray(d.items)) return { items: checkItems(d.items), dreams: [], people: [], kind: 'lista', covers: ['items'], exportedAt: '' };
  if (d.version === 1 && Array.isArray(d.vision)) return { items: [], dreams: checkDreams(d.vision), people: [], kind: 'painel', covers: ['dreams'], exportedAt: '' };
  fail('Arquivo não reconhecido como backup do Família365.');
}

const hasPhoto = x => !!x.photo;
const extraPeople = list => list.filter(n => !BASE_PEOPLE.some(b => personKey(b) === personKey(n)));

export function summarize(device, file) {
  const itemIds = new Set(device.items.map(x => x.id)), dreamIds = new Set(device.dreams.map(x => x.id));
  const known = new Set(device.people.map(personKey));
  const newDreams = file.dreams.filter(x => !dreamIds.has(x.id));
  const filePeople = extraPeople(uniquePeople(file.people)), devicePeople = extraPeople(uniquePeople(device.people));
  const s = {
    items: { file: file.items.length, device: device.items.length, new: file.items.filter(x => !itemIds.has(x.id)).length },
    dreams: { file: file.dreams.length, device: device.dreams.length, new: newDreams.length },
    photos: { file: file.dreams.filter(hasPhoto).length, device: device.dreams.filter(hasPhoto).length, new: newDreams.filter(hasPhoto).length },
    people: { file: filePeople.length, device: devicePeople.length, new: filePeople.filter(n => !known.has(personKey(n))).length },
  };
  s.totalNew = s.items.new + s.dreams.new + s.people.new;
  return s;
}

// "Juntar": fica tudo o que está no aparelho; entra só o que falta (por id; pessoas por nome). Nunca apaga nem sobrescreve.
export function merge(device, file) {
  const items = device.items.slice(), dreams = device.dreams.slice(), people = uniquePeople(device.people);
  const itemIds = new Set(items.map(x => x.id)), dreamIds = new Set(dreams.map(x => x.id)), known = new Set(people.map(personKey));
  const added = { items: 0, dreams: 0, photos: 0, people: 0 };
  for (const x of file.items) if (!itemIds.has(x.id)) { itemIds.add(x.id); items.push(x); added.items++; }
  for (const x of file.dreams) if (!dreamIds.has(x.id)) { dreamIds.add(x.id); dreams.push(x); added.dreams++; if (x.photo) added.photos++; }
  for (const n of extraPeople(file.people)) if (!known.has(personKey(n))) { known.add(personKey(n)); people.push(n.trim()); added.people++; }
  return { items, dreams, people, added };
}

// "Substituir tudo": o aparelho fica igual ao arquivo nas partes que ele traz (um backup antigo da lista não apaga os sonhos).
export function replace(device, file) {
  const covers = file.covers || ALL;
  return { items: covers.includes('items') ? file.items.slice() : device.items.slice(),
    dreams: covers.includes('dreams') ? file.dreams.slice() : device.dreams.slice(),
    people: covers.includes('people') ? file.people.slice() : device.people.slice() };
}

// "há 12 dias · 14 de novembro" (dias de calendário, no fuso do aparelho).
export function describeLastBackup(iso, now = new Date()) {
  if (typeof iso !== 'string') return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const day = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.max(0, Math.round((day(now) - day(t)) / 86400000));
  const when = days === 0 ? 'hoje' : days === 1 ? 'ontem' : 'há ' + days + ' dias';
  return { when, date: t.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }), days };
}
