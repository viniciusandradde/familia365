import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsForScreen, groupPlanos, defaultTab, fabAction, summary, needsBackupReminder, headerDate, dueLabel, openFirst, screenTitle } from '../js/telas.js';

const it = (id, tab, extra = {}) => ({ id, tab, title: 'Item ' + id, area: '', horizon: '', due: '', notes: '', done: false, ...extra });
const today = '2026-11-26';
const items = [
  it('a', 'Hoje'), it('b', 'Plano de vida', { due: today }), it('c', 'Plano de vida', { due: today, done: true }),
  it('d', 'Família'), it('e', 'Pendências'), it('f', 'Sonhos'), it('g', 'Revisão semanal'), it('h', 'Hoje', { done: true }),
];
const ids = list => list.map(x => x.id);

test('Hoje: itens da aba Hoje e os abertos com prazo hoje (regra atual)', () => {
  assert.deepEqual(ids(itemsForScreen(items, 'hoje', today)), ['a', 'b', 'h']);
});

test('Planos: Plano de vida, Família e Pendências; Sonhos e Família da tela', () => {
  assert.deepEqual(ids(itemsForScreen(items, 'planos', today)), ['b', 'c', 'd', 'e']);
  assert.deepEqual(ids(itemsForScreen(items, 'sonhos', today)), ['f']);
  assert.deepEqual(ids(itemsForScreen(items, 'familia', today)), ['g']);
  assert.deepEqual(itemsForScreen(items, 'dados', today), []);
  assert.deepEqual(itemsForScreen(null, 'hoje', today), []);
});

test('Planos agrupados por aba, sempre os três grupos na ordem das abas', () => {
  const g = groupPlanos(items);
  assert.deepEqual(g.map(x => x.tab), ['Plano de vida', 'Família', 'Pendências']);
  assert.deepEqual(g.map(x => ids(x.items)), [['b', 'c'], ['d'], ['e']]);
  assert.deepEqual(groupPlanos([]).map(x => x.items.length), [0, 0, 0]);
});

test('aba padrão do item novo e ação do botão + por tela', () => {
  assert.equal(defaultTab('hoje'), 'Hoje');
  assert.equal(defaultTab('planos'), 'Plano de vida');
  assert.equal(defaultTab('sonhos'), 'Sonhos');
  assert.equal(defaultTab('familia'), 'Revisão semanal');
  assert.equal(defaultTab('dados'), 'Hoje');
  assert.deepEqual(['hoje', 'planos', 'sonhos', 'familia', 'dados'].map(fabAction), ['item', 'item', 'sonho', 'item', null]);
});

test('títulos das telas', () => {
  assert.deepEqual(['hoje', 'planos', 'sonhos', 'familia', 'dados'].map(screenTitle), ['Hoje', 'Planos', 'Sonhos', 'Família', 'Dados e backup']);
});

test('resumo com singular e plural', () => {
  assert.equal(summary([]), 'Nada anotado ainda');
  assert.equal(summary([it('a', 'Hoje')]), '1 em aberto');
  assert.equal(summary([it('a', 'Hoje'), it('b', 'Hoje', { done: true })]), '1 em aberto · 1 concluído');
  assert.equal(summary([it('a', 'Hoje', { done: true }), it('b', 'Hoje', { done: true })]), '2 concluídos');
});

test('ponto ocre do backup: sem backup ou mais de 7 dias', () => {
  const now = new Date(2026, 10, 26, 10);
  assert.equal(needsBackupReminder(undefined, now), true);
  assert.equal(needsBackupReminder('lixo', now), true);
  assert.equal(needsBackupReminder(new Date(2026, 10, 19, 22).toISOString(), now), false); // 7 dias
  assert.equal(needsBackupReminder(new Date(2026, 10, 18, 9).toISOString(), now), true); // 8 dias
  assert.equal(needsBackupReminder(new Date(2026, 10, 26, 8).toISOString(), now), false);
});

test('data do cabeçalho sem depender do idioma do sistema', () => {
  assert.equal(headerDate(new Date(2026, 10, 26)), 'Quinta, 26 de novembro');
  assert.equal(headerDate(new Date(2027, 0, 3)), 'Domingo, 3 de janeiro');
});

test('prazo: hoje, amanhã, dia/mês e ano quando outro', () => {
  assert.equal(dueLabel('', today), '');
  assert.equal(dueLabel('lixo', today), '');
  assert.equal(dueLabel(today, today), 'hoje');
  assert.equal(dueLabel('2026-11-27', today), 'amanhã');
  assert.equal(dueLabel('2026-12-05', today), '5/12');
  assert.equal(dueLabel('2027-01-10', today), '10/01/2027');
});

test('abertos primeiro, concluídos depois, mantendo a ordem', () => {
  assert.deepEqual(ids(openFirst(items.slice(0, 3).concat(items[7]))), ['a', 'b', 'c', 'h']);
  assert.deepEqual(ids(openFirst([it('x', 'Hoje', { done: true }), it('y', 'Hoje')])), ['y', 'x']);
});
