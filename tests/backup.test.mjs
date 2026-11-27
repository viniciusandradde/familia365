import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, summarize, merge, replace, describeLastBackup, MAX_BYTES } from '../js/backup.js';

const FOTO = 'data:image/jpeg;base64,QUJD';
const item = (id, extra = {}) => ({ id, tab: 'Hoje', done: false, title: 'Tarefa ' + id, area: 'Pessoal', horizon: 'Hoje', due: '', notes: '', ...extra });
const sonho = (id, extra = {}) => ({ id, person: 'Casal', title: 'Sonho ' + id, area: 'Lazer', horizon: '5 anos', notes: '', photo: '', target_cents: 0, reserved_cents: 0, due: '', ...extra });
const device = () => ({ items: [item('a'), item('b')], dreams: [sonho('s1', { photo: FOTO })], people: ['Lia Teste'] });

test('ida e volta do backup v2', () => {
  const d = device();
  const b = buildBackup({ ...d, exportedAt: '2026-11-14T10:00:00.000Z' });
  assert.equal(b.format, 'familia365.backup');
  assert.equal(b.version, 2);
  assert.equal(b.exported_at, '2026-11-14T10:00:00.000Z');
  const r = parseBackup(JSON.stringify(b));
  assert.equal(r.kind, 'v2');
  assert.deepEqual(r.items, d.items);
  assert.deepEqual(r.dreams, d.dreams);
  assert.deepEqual(r.people, d.people);
  assert.equal(r.dreams[0].photo, FOTO);
  assert.equal(r.exportedAt, '2026-11-14T10:00:00.000Z');
  assert.deepEqual(r.covers, ['items', 'dreams', 'people']);
});

test('lê o backup antigo da lista (version 1, items)', () => {
  const r = parseBackup(JSON.stringify({ version: 1, items: [item('x'), item('y', { tab: 'Sonhos', done: true })] }));
  assert.equal(r.kind, 'lista');
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.dreams, []);
  assert.deepEqual(r.people, []);
  assert.deepEqual(r.covers, ['items']);
});

test('lê o backup antigo do painel (version 1, vision), com e sem campos de meta', () => {
  const antigo = { id: 'v0', person: 'Minha visão', title: 'Viagem', area: 'Lazer', horizon: '1 ano', notes: '', photo: FOTO };
  const r = parseBackup(JSON.stringify({ version: 1, vision: [antigo, sonho('v1', { target_cents: 600000, reserved_cents: 150000, due: '2027-12-01' })] }));
  assert.equal(r.kind, 'painel');
  assert.deepEqual(r.items, []);
  assert.equal(r.dreams.length, 2);
  assert.equal(r.dreams[0].target_cents, 0);
  assert.equal(r.dreams[0].due, '');
  assert.equal(r.dreams[1].target_cents, 600000);
  assert.deepEqual(r.covers, ['dreams']);
});

test('recusa arquivos inválidos com mensagem clara', () => {
  assert.throws(() => parseBackup('isto não é json'), /não é um backup/i);
  assert.throws(() => parseBackup(JSON.stringify({ ola: 1 })), /não reconhecido/i);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'familia365.goal', version: 1, goals: [] })), /metas/i);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'familia365.backup', version: 3, items: [] })), /mais nova/i);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, items: [{ id: 'a', title: 'x' }] })), /inválid/i);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, items: [item('a', { tab: 'Outra' })] })), /inválid/i);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, items: [item('a'), item('a')] })), /repetid/i);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, vision: [sonho('s', { photo: 'javascript:alert(1)' })] })), /inválid/i);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'familia365.backup', version: 2, items: [], dreams: [], people: [42] })), /inválid/i);
  assert.throws(() => parseBackup('x'.repeat(MAX_BYTES + 1)), /grande/i);
});

test('prévia: contagens no arquivo, no aparelho e quantos são novos', () => {
  const file = { items: [item('a'), item('c'), item('d')], dreams: [sonho('s1', { photo: FOTO }), sonho('s2', { photo: FOTO }), sonho('s3')], people: ['lia teste', 'Tio Exemplo'] };
  const s = summarize(device(), file);
  assert.deepEqual(s.items, { file: 3, device: 2, new: 2 });
  assert.deepEqual(s.dreams, { file: 3, device: 1, new: 2 });
  assert.deepEqual(s.photos, { file: 2, device: 1, new: 1 });
  assert.deepEqual(s.people, { file: 2, device: 1, new: 1 });
  assert.equal(s.totalNew, 5, 'fotos fazem parte dos sonhos: não contam duas vezes');
});

test('juntar acrescenta o que falta e nunca apaga nem sobrescreve', () => {
  const d = device();
  const file = { items: [item('a', { title: 'Versão do arquivo', done: true }), item('c')], dreams: [sonho('s1', { title: 'Outro título', photo: '' }), sonho('s2', { photo: FOTO })], people: ['LIA TESTE', 'Tio Exemplo', 'Tio Exemplo'] };
  const r = merge(d, file);
  assert.deepEqual(r.items.map(x => x.id), ['a', 'b', 'c']);
  assert.equal(r.items[0].title, 'Tarefa a');
  assert.equal(r.items[0].done, false);
  assert.deepEqual(r.dreams.map(x => x.id), ['s1', 's2']);
  assert.equal(r.dreams[0].title, 'Sonho s1');
  assert.equal(r.dreams[0].photo, FOTO);
  assert.deepEqual(r.people, ['Lia Teste', 'Tio Exemplo']);
  assert.deepEqual(r.added, { items: 1, dreams: 1, photos: 1, people: 1 });
  assert.deepEqual(d, device(), 'não altera o estado recebido');
});

test('substituir troca só as partes que o arquivo traz', () => {
  const d = device();
  const lista = { items: [item('z')], dreams: [], people: [], covers: ['items'] };
  const r = replace(d, lista);
  assert.deepEqual(r.items.map(x => x.id), ['z']);
  assert.deepEqual(r.dreams, d.dreams);
  assert.deepEqual(r.people, d.people);
  const tudo = replace(d, { items: [], dreams: [], people: [], covers: ['items', 'dreams', 'people'] });
  assert.deepEqual(tudo, { items: [], dreams: [], people: [] });
});

test('último backup em palavras', () => {
  const now = new Date(2026, 10, 26, 15, 0);
  assert.equal(describeLastBackup(null, now), null);
  assert.deepEqual(describeLastBackup(new Date(2026, 10, 14, 9, 0).toISOString(), now), { when: 'há 12 dias', date: '14 de novembro', days: 12 });
  assert.equal(describeLastBackup(new Date(2026, 10, 26, 8, 0).toISOString(), now).when, 'hoje');
  assert.equal(describeLastBackup(new Date(2026, 10, 25, 23, 0).toISOString(), now).when, 'ontem');
  assert.equal(describeLastBackup('lixo', now), null);
});

// ---------- Etapa 3: campos novos opcionais nos itens ----------
import { validItem } from '../js/backup.js';
test('validItem: itens antigos continuam válidos; campos novos válidos passam e inválidos não', () => {
  const velho = { id: 'v', tab: 'Hoje', done: false, title: 'Antigo', area: '', horizon: '', due: '', notes: '' };
  assert.ok(validItem(velho));
  assert.ok(validItem({ ...velho, done: true, done_at: '2026-11-26T10:00:00.000Z', scope: 'casal', time: '07:30', night: false }));
  assert.ok(validItem({ ...velho, time: '', done_at: '' }));
  for (const extra of [{ time: '25:00' }, { time: '7h' }, { scope: 'chefe' }, { done_at: 'ontem' }, { done_at: 5 }, { night: 'sim' }])
    assert.equal(validItem({ ...velho, ...extra }), false, JSON.stringify(extra));
});

test('backup v2 guarda e devolve os campos novos; backup antigo da lista continua válido', () => {
  const x = { id: 'n1', tab: 'Pendências', done: true, title: 'Ler', area: 'Família', horizon: '7 dias', due: '2026-11-26', notes: '',
    done_at: '2026-11-26T21:00:00.000Z', scope: 'familia', time: '20:00', night: true };
  const b = buildBackup({ items: [x], exportedAt: '2026-11-26T22:00:00.000Z' });
  assert.deepEqual(b.items[0], x);
  assert.deepEqual(parseBackup(JSON.stringify(b)).items[0], x);
  const antigo = parseBackup(JSON.stringify({ version: 1, items: [{ id: 'a', tab: 'Hoje', done: false, title: 'Feira', area: '', horizon: '', due: '', notes: '' }] }));
  assert.deepEqual(Object.keys(antigo.items[0]), ['id', 'tab', 'done', 'title', 'area', 'horizon', 'due', 'notes']);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, items: [{ id: 'a', tab: 'Hoje', done: false, title: 'F', area: '', horizon: '', due: '', notes: '', scope: 'chefe' }] })));
});
