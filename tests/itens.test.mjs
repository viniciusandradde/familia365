import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleDone, removeById, upsertItem, upsertDream, toCents, goalText, peopleList } from '../js/itens.js';
import { validItem } from '../js/backup.js';

const base = [
  { id: 'a', tab: 'Hoje', title: 'Feira', area: 'Família', horizon: 'Hoje', due: '', notes: '', done: false },
  { id: 'b', tab: 'Sonhos', title: 'Viagem', area: '', horizon: '', due: '', notes: 'praia', done: true },
];

test('concluir e reabrir não muda o resto nem a lista original', () => {
  const next = toggleDone(base, 'a');
  assert.equal(next[0].done, true);
  assert.equal(base[0].done, false);
  assert.deepEqual(next[1], base[1]);
  assert.equal(toggleDone(next, 'a')[0].done, false);
});

test('excluir remove só o item pedido', () => {
  assert.deepEqual(removeById(base, 'a').map(x => x.id), ['b']);
  assert.equal(removeById(base, 'zz').length, 2);
});

test('criar item: mesmo formato gravado de antes, válido, título aparado', () => {
  const r = upsertItem(base, { title: '  Ligar para a escola ', tab: 'Pendências', area: 'Filhos', horizon: '7 dias', due: '2026-12-01', notes: 'x' }, { newId: 'n1' });
  assert.equal(r.created, true);
  assert.deepEqual(Object.keys(r.item), ['id', 'tab', 'done', 'title', 'area', 'horizon', 'due', 'notes']);
  assert.deepEqual(r.item, { id: 'n1', tab: 'Pendências', done: false, title: 'Ligar para a escola', area: 'Filhos', horizon: '7 dias', due: '2026-12-01', notes: 'x' });
  assert.ok(validItem(r.item));
  assert.equal(r.items.length, 3);
});

test('editar item: mantém id, posição e concluído; troca de aba vale', () => {
  const r = upsertItem(base, { title: 'Viagem à serra', tab: 'Plano de vida', area: '', horizon: '1 ano', due: '', notes: '' }, { editingId: 'b', newId: 'nao-usar' });
  assert.equal(r.created, false);
  assert.equal(r.items[1].id, 'b');
  assert.equal(r.items[1].done, true);
  assert.equal(r.items[1].tab, 'Plano de vida');
  assert.equal(r.items.length, 2);
});

test('item inválido não é criado (título vazio, longo ou aba desconhecida vira a anterior/Hoje)', () => {
  assert.throws(() => upsertItem(base, { title: '   ' }, { newId: 'x' }));
  assert.throws(() => upsertItem(base, { title: 'x'.repeat(201) }, { newId: 'x' }));
  assert.equal(upsertItem(base, { title: 'Ok', tab: 'Outra' }, { newId: 'x' }).item.tab, 'Hoje');
  assert.equal(upsertItem(base, { title: 'Ok', tab: 'Outra' }, { editingId: 'b' }).item.tab, 'Sonhos');
});

test('valores em centavos', () => {
  assert.equal(toCents('6000.50'), 600050);
  assert.equal(toCents('6000,5'), 600050);
  assert.equal(toCents(''), 0);
  assert.equal(toCents('-3'), 0);
  assert.equal(toCents('abc'), 0);
});

test('sonho novo e editado: mesmos campos do painel; edição preserva foto e campos extras', () => {
  const r = upsertDream([], { title: ' Casa no campo ', person: 'Casal', area: 'Família', horizon: '5 anos', notes: '', target: '6000.50', reserved: '500', due: '2027-06-30' }, { newId: 's1', photo: '' });
  assert.deepEqual(r.dream, { id: 's1', person: 'Casal', photo: '', title: 'Casa no campo', area: 'Família', horizon: '5 anos', notes: '', target_cents: 600050, reserved_cents: 50000, due: '2027-06-30' });
  const old = [{ ...r.dream, photo: 'data:image/jpeg;base64,AAA', extra: 1 }];
  const e = upsertDream(old, { title: 'Casa', person: 'Casal', area: '', horizon: '', notes: '', target: '', reserved: '', due: 'lixo' }, { editingId: 's1', photo: null });
  assert.equal(e.dream.photo, 'data:image/jpeg;base64,AAA');
  assert.equal(e.dream.extra, 1);
  assert.equal(e.dream.target_cents, 0);
  assert.equal(e.dream.due, '');
  assert.throws(() => upsertDream([], { title: ' ' }, { newId: 'x' }));
});

test('texto da meta do sonho (sem culpa quando o prazo passou)', () => {
  const now = new Date(2026, 10, 26);
  assert.equal(goalText({ target_cents: 0 }, now), '');
  const t = goalText({ target_cents: 1200000, reserved_cents: 200000, due: '2027-05-26' }, now);
  assert.match(t, /16%/);
  assert.match(t, /\/mês até 26\/05\/2027/);
  assert.match(goalText({ target_cents: 1000, reserved_cents: 1000 }, now), /meta atingida/);
  const passou = goalText({ target_cents: 1000, reserved_cents: 0, due: '2026-01-01' }, now);
  assert.doesNotMatch(passou, /vencid|atrasad/i);
  assert.match(passou, /rever o prazo/);
});

test('pessoas: base, extras do aparelho e as que aparecem nos sonhos, sem repetir', () => {
  assert.deepEqual(peopleList(['Avó', 'Casal', 7, ' '], [{ person: 'Tia' }, { person: 'Avó' }, {}]), ['Minha visão', 'Casal', 'Família', 'Avó', 'Tia']);
});

// ---------- Etapa 3: done_at, de quem é, horário ----------
import { trazerParaHoje, ficaParaAmanha } from '../js/itens.js';
const novo = { id: 'z', tab: 'Hoje', title: 'Regar', area: '', horizon: '', due: '', notes: '', done: false };

test('concluir grava done_at (ISO); reabrir apaga done_at; original intacto', () => {
  const agora = '2026-11-26T13:00:00.000Z';
  const feito = toggleDone([novo], 'z', agora)[0];
  assert.equal(feito.done, true);
  assert.equal(feito.done_at, agora);
  assert.ok(validItem(feito));
  const aberto = toggleDone([feito], 'z', agora)[0];
  assert.equal(aberto.done, false);
  assert.ok(!('done_at' in aberto));
  assert.ok(!('done_at' in novo));
  assert.ok(!Number.isNaN(Date.parse(toggleDone([novo], 'z')[0].done_at)), 'sem data informada usa a hora atual');
});

test('trazer para hoje e fica para amanhã mudam só o prazo', () => {
  assert.deepEqual(trazerParaHoje([{ ...novo, due: '2026-11-20' }], 'z', '2026-11-26')[0], { ...novo, due: '2026-11-26' });
  assert.equal(ficaParaAmanha([novo], 'z', '2026-11-30')[0].due, '2026-12-01');
  assert.equal(ficaParaAmanha([novo], 'outro', '2026-11-30')[0].due, '');
});

test('criar com de quem é, horário e noite; campos inválidos ficam de fora', () => {
  const r = upsertItem([], { title: 'Ler juntos', tab: 'Hoje', area: '', horizon: 'Hoje', due: '', notes: '', scope: 'familia', time: '20:30', night: true }, { newId: 'n' });
  assert.deepEqual(r.item, { id: 'n', tab: 'Hoje', done: false, title: 'Ler juntos', area: '', horizon: 'Hoje', due: '', notes: '', scope: 'familia', time: '20:30', night: true });
  assert.ok(validItem(r.item));
  const s = upsertItem([], { title: 'X', tab: 'Hoje', scope: 'chefe', time: '25:00', night: false }, { newId: 'm' }).item;
  assert.deepEqual(Object.keys(s), ['id', 'tab', 'done', 'title', 'area', 'horizon', 'due', 'notes']);
});

test('editar mantém done_at do concluído; atStart põe o novo no topo', () => {
  const feito = { ...novo, done: true, done_at: '2026-11-26T10:00:00.000Z' };
  const r = upsertItem([feito], { title: 'Regar as plantas', tab: 'Hoje', scope: 'eu' }, { editingId: 'z' });
  assert.equal(r.item.done_at, feito.done_at);
  assert.equal(r.item.scope, 'eu');
  assert.deepEqual(upsertItem([novo], { title: 'Primeiro', tab: 'Hoje' }, { newId: 'p', atStart: true }).items.map(x => x.id), ['p', 'z']);
});

import { upsertDream as upsertDream4 } from '../js/itens.js';
test('sonho com foto nova no IndexedDB guarda só a referência; próximo passo opcional; campos novos preservados', () => {
  const form = { title: 'Horta', person: 'Casal', area: '', horizon: '', notes: '', target: '', reserved: '', due: '', next_step: ' Escolher as mudas ' };
  const r = upsertDream4([], form, { newId: 'd1', photoRef: 'ref-1' });
  assert.equal(r.dream.photo, '');
  assert.equal(r.dream.photo_ref, 'ref-1');
  assert.equal(r.dream.next_step, 'Escolher as mudas');
  const pausado = [{ ...r.dream, paused: true }];
  const e = upsertDream4(pausado, { ...form, next_step: '' }, { editingId: 'd1' });
  assert.equal(e.dream.photo_ref, 'ref-1');
  assert.equal(e.dream.paused, true);
  assert.equal('next_step' in e.dream, false);
  assert.equal('photo_ref' in upsertDream4(pausado, form, { editingId: 'd1', photo: '' }).dream, false);
});
