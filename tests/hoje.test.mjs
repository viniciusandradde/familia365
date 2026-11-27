import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secoesHoje, scopeOf, SCOPE_LABEL, isNight, timeLabel, localDay, mostrarRevisao, whenOf, tabForWhen, horizonForWhen, SUGESTOES } from '../js/hoje.js';

const today = '2026-11-26';
const em = (d, h = 10) => new Date(2026, 10, d, h, 0).toISOString(); // hora local do aparelho
const it = (id, tab, extra = {}) => ({ id, tab, title: 'Item ' + id, area: '', horizon: '', due: '', notes: '', done: false, ...extra });
const items = [
  it('a', 'Hoje'), it('b', 'Pendências', { due: today }), it('c', 'Hoje', { time: '20:30' }), it('d', 'Hoje', { night: true }),
  it('e', 'Hoje', { time: '17:00' }), it('f', 'Pendências', { due: '2026-11-20' }), it('g', 'Hoje', { due: '2026-11-24' }),
  it('h', 'Plano de vida', { due: today, done: true, done_at: em(26) }), it('i', 'Hoje', { done: true, done_at: em(26, 7) }),
  it('j', 'Hoje', { done: true, done_at: em(25) }), it('k', 'Hoje', { done: true }), it('l', 'Plano de vida'),
  it('m', 'Hoje', { due: '2026-11-27' }), it('n', 'Pendências', { done: true, done_at: em(26) }),
  it('o', 'Sonhos', { due: '2026-11-01' }), it('p', 'Família', { due: '2026-11-25', done: true, done_at: em(25) }),
  it('q', 'Hoje', { time: '08:00' }),
];
const ids = l => l.map(x => x.id);

test('seções de Hoje: para hoje, à noite, quer trazer, concluídos hoje e concluídos antes', () => {
  const s = secoesHoje(items, today);
  assert.deepEqual(ids(s.paraHoje), ['a', 'b', 'q', 'e'], 'sem horário na ordem da lista; com horário, pela hora');
  assert.deepEqual(ids(s.noite), ['d', 'c']);
  assert.deepEqual(ids(s.trazer), ['f', 'g'], 'vencidos e abertos; Sonhos não entram');
  assert.deepEqual(ids(s.concluidos), ['h', 'i'], 'concluído hoje, inclusive de outra aba com prazo hoje');
  assert.deepEqual(ids(s.antes), ['j', 'k'], 'da aba Hoje, concluídos antes (ou sem data, de versões antigas)');
});

test('item da aba Hoje com prazo futuro sai de Hoje até o dia (Fica para amanhã)', () => {
  const s = secoesHoje(items, today), todos = Object.values(s).flat().map(x => x.id);
  assert.ok(!todos.includes('m'));
  assert.ok(ids(secoesHoje(items, '2026-11-27').paraHoje).includes('m'));
});

test('lista vazia ou inválida não quebra', () => {
  assert.deepEqual(secoesHoje(null, today), { paraHoje: [], noite: [], trazer: [], concluidos: [], antes: [] });
});

test('à noite: horário a partir de 18h ou marcado como noite', () => {
  assert.equal(isNight({ time: '18:00' }), true);
  assert.equal(isNight({ time: '17:59' }), false);
  assert.equal(isNight({ night: true }), true);
  assert.equal(isNight({}), false);
});

test('de quem é: Para mim (padrão), Casal, Família', () => {
  assert.equal(scopeOf({}), 'eu');
  assert.equal(scopeOf({ scope: 'casal' }), 'casal');
  assert.equal(scopeOf({ scope: 'outro' }), 'eu');
  assert.deepEqual(SCOPE_LABEL, { eu: 'Para mim', casal: 'Casal', familia: 'Família' });
});

test('horário curto e data local', () => {
  assert.equal(timeLabel('17:00'), '17h');
  assert.equal(timeLabel('20:30'), '20h30');
  assert.equal(timeLabel('08:05'), '8h05');
  assert.equal(timeLabel(''), '');
  assert.equal(localDay(em(26, 23)), '2026-11-26');
  assert.equal(localDay('não é data'), '');
});

test('revisão da semana: aos domingos, até alguém dizer "Agora não"', () => {
  assert.equal(mostrarRevisao('2026-11-29', ''), true);
  assert.equal(mostrarRevisao('2026-11-29', '2026-11-29'), false);
  assert.equal(mostrarRevisao('2026-11-26', ''), false);
  assert.equal(mostrarRevisao('2026-12-06', '2026-11-29'), true);
  assert.equal(mostrarRevisao('2026-11-26', '', 4), true, 'dia configurável');
});

test('Quando? (Hoje / Semana / Algum dia) ↔ aba e horizonte', () => {
  assert.equal(whenOf(it('x', 'Hoje')), 'hoje');
  assert.equal(whenOf(it('x', 'Pendências', { horizon: '7 dias' })), 'semana');
  assert.equal(whenOf(it('x', 'Plano de vida', { horizon: '5 anos' })), 'algum');
  assert.equal(tabForWhen('hoje', 'planos'), 'Hoje');
  assert.equal(tabForWhen('semana', 'hoje'), 'Pendências');
  assert.equal(tabForWhen('algum', 'hoje'), 'Plano de vida');
  assert.equal(tabForWhen('semana', 'familia'), 'Revisão semanal');
  assert.deepEqual(['hoje', 'semana', 'algum'].map(horizonForWhen), ['Hoje', '7 dias', '']);
});

test('três sugestões genéricas para o estado vazio', () => {
  assert.equal(SUGESTOES.length, 3);
  for (const s of SUGESTOES) assert.ok(s.title && ['eu', 'casal', 'familia'].includes(s.scope));
});
