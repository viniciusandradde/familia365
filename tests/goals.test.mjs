import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalsFile } from '../js/goals.js';

const sonho = (id, extra = {}) => ({ id, person: 'Casal', title: 'Sonho ' + id, area: 'Lazer', horizon: '5 anos', notes: '', photo: '', target_cents: 0, reserved_cents: 0, due: '', ...extra });
const item = (id, extra = {}) => ({ id, tab: 'Sonhos', done: false, title: 'Item ' + id, area: '', horizon: '', due: '', notes: '', ...extra });

test('metas a partir dos sonhos do painel (target_cents, reserved_cents, due)', () => {
  const f = goalsFile([], [sonho('p1', { title: 'Viagem à praia', target_cents: 600000, reserved_cents: 150000, due: '2027-12-01' }), sonho('p2'), sonho('p3', { target_cents: 50000 })]);
  assert.equal(f.format, 'familia365.goal');
  assert.equal(f.version, 1);
  assert.deepEqual(f.goals, [
    { id: 'p1', name: 'Viagem à praia', target_cents: 600000, saved_cents: 150000, due_date: '2027-12-01' },
    { id: 'p3', name: 'Sonho p3', target_cents: 50000, saved_cents: 0, due_date: '' },
  ]);
});

test('continua aceitando os itens da aba Sonhos com valor no título ou nas notas', () => {
  const f = goalsFile([
    item('l1', { title: 'Carro novo R$ 6.000', due: '2027-06-30' }),
    item('l2', { title: 'Curso', notes: 'custa R$ 1.250,50' }),
    item('l3', { title: 'Sem valor' }),
    item('l4', { tab: 'Hoje', title: 'Pagar R$ 100' }),
  ], []);
  assert.deepEqual(f.goals, [
    { id: 'l1', name: 'Carro novo', target_cents: 600000, saved_cents: 0, due_date: '2027-06-30' },
    { id: 'l2', name: 'Curso', target_cents: 125050, saved_cents: 0, due_date: '' },
  ]);
});

test('junta painel e lista sem repetir id (o painel vale)', () => {
  const f = goalsFile([item('x', { title: 'Reforma R$ 9.000' })], [sonho('x', { title: 'Reforma', target_cents: 1000000, reserved_cents: 10 })]);
  assert.equal(f.goals.length, 1);
  assert.equal(f.goals[0].target_cents, 1000000);
  assert.equal(f.goals[0].saved_cents, 10);
});

test('ignora valores inválidos e prazos fora do formato', () => {
  const f = goalsFile(undefined, [sonho('a', { target_cents: -5 }), sonho('b', { target_cents: 1.5 }), sonho('c', { target_cents: 100, reserved_cents: 'x', due: '01/12/2027' })]);
  assert.deepEqual(f.goals, [{ id: 'c', name: 'Sonho c', target_cents: 100, saved_cents: 0, due_date: '' }]);
});

test('metas do FiscalFlow entram em Sonhos: atualiza pelo id, cria as novas, nunca apaga', async () => {
  const { mergeGoals } = await import('../js/goals.js');
  const list = [{ id: 'g1', tab: 'Sonhos', title: 'Velho', area: 'x', horizon: '', due: '', notes: 'n', done: false }, { id: 'k', tab: 'Hoje', title: 'K', area: '', horizon: '', due: '', notes: '', done: false }];
  const file = { format: 'familia365.goal', version: 1, goals: [{ id: 'g1', name: 'Reserva', target_cents: 600050, due_date: '2027-01-31' }, { id: 'g2', name: 'Carro', target_cents: 100 }, { id: 'g3', name: '', target_cents: 5 }] };
  const r = mergeGoals(list, file);
  assert.equal(r.count, 2);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].title, 'Reserva R$ 6.000,50');
  assert.equal(r.items[0].due, '2027-01-31');
  assert.equal(r.items[0].notes, 'n');
  assert.deepEqual(r.items[2], { id: 'g2', tab: 'Sonhos', title: 'Carro R$ 1,00', area: '', horizon: '', due: '', notes: 'Meta do FiscalFlow', done: false });
  assert.throws(() => mergeGoals(list, { format: 'outro' }));
});
