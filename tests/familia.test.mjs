import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSOS, PALETA, PERGUNTAS, rascunhoNovo, navegar, deuCerto, ficouPeloCaminho, aplicarDecisao, recuperar, deixadosDeLado,
  candidatosPendencias, sonhosComMeta, resumoRevisao, itemDaRevisao, historico, adicionarCombinado, removerCombinado,
  coresDasPessoas, adicionarPessoa, renomearPessoa, removerPessoa, lerFamilia, fimDaSemana } from '../js/familia.js';
import { validItem } from '../js/backup.js';

const it = (id, o = {}) => ({ id, title: 'Item ' + id, tab: 'Pendências', done: false, area: '', horizon: '', due: '', notes: '', ...o });
const HOJE = '2026-11-29'; // domingo

test('cinco passos com os títulos do desenho e três perguntas', () => {
  assert.equal(PASSOS.length, 5);
  assert.equal(PASSOS[1], 'O que ficou pelo caminho?');
  assert.equal(PERGUNTAS[2], 'O que vamos combinar?');
});

test('navegar: continuar, pular (marca o passo), voltar e limites', () => {
  let r = rascunhoNovo(HOJE);
  assert.equal(r.passo, 1);
  r = navegar(r, 'pular');
  assert.deepEqual([r.passo, r.pulados], [2, [1]]);
  r = navegar(r, 'voltar');
  assert.equal(r.passo, 1);
  r = navegar(r, 'continuar');
  assert.deepEqual([r.passo, r.pulados], [2, []]);
  r = navegar(navegar(navegar(navegar(r, 'continuar'), 'continuar'), 'continuar'), 'continuar');
  assert.equal(r.passo, 5);
  assert.equal(navegar(rascunhoNovo(HOJE), 'voltar').passo, 1);
});

test('o que deu certo: concluídos nos últimos 7 dias, sem os deixados de lado nem as revisões', () => {
  const items = [it('a', { done: true, done_at: '2026-11-27T10:00:00' }), it('b', { done: true, done_at: '2026-11-20T10:00:00' }),
    it('c', { done: true, done_at: '2026-11-28T09:00:00', dropped: true }), it('d', { done: true }),
    it('e', { done: true, done_at: '2026-11-23T08:00:00', tab: 'Revisão semanal' }), it('f', { done: true, done_at: '2026-11-23T08:00:00' })];
  assert.deepEqual(deuCerto(items, HOJE).map(x => x.id), ['a', 'f']);
});

test('ficou pelo caminho: abertos com prazo passado ou da semana, mais os já decididos', () => {
  const items = [it('a', { due: '2026-11-20' }), it('b', { due: '2026-12-04' }), it('c', { due: '2026-12-10' }), it('d'),
    it('e', { due: '2026-11-20', done: true }), it('f', { due: '2026-11-20', tab: 'Revisão semanal' }), it('g', { due: '' , done: true, dropped: true })];
  assert.deepEqual(ficouPeloCaminho(items, HOJE).map(x => x.id), ['a', 'b']);
  assert.deepEqual(ficouPeloCaminho(items, HOJE, { g: 'soltar', d: 'depois' }).map(x => x.id), ['a', 'b', 'd', 'g']);
});

test('decisões: esta semana (prazo no domingo), mais tarde (sem prazo) e soltar (concluído como deixado de lado)', () => {
  assert.equal(fimDaSemana('2026-11-29'), '2026-12-06');
  assert.equal(fimDaSemana('2026-12-02'), '2026-12-06');
  const items = [it('a', { due: '2026-11-20', tab: 'Hoje' })];
  const semana = aplicarDecisao(items, 'a', 'semana', HOJE, '2026-11-29T20:00:00.000Z')[0];
  assert.equal(semana.due, '2026-12-06');
  const depois = aplicarDecisao(items, 'a', 'depois', HOJE, '2026-11-29T20:00:00.000Z')[0];
  assert.deepEqual([depois.due, depois.tab, depois.done], ['', 'Pendências', false]);
  const solto = aplicarDecisao(items, 'a', 'soltar', HOJE, '2026-11-29T20:00:00.000Z');
  assert.deepEqual([solto[0].done, solto[0].dropped, solto[0].done_at], [true, true, '2026-11-29T20:00:00.000Z']);
  assert.ok(validItem(solto[0]));
  assert.deepEqual(deixadosDeLado(solto).map(x => x.id), ['a']);
  const devolta = aplicarDecisao(solto, 'a', 'semana', HOJE, 'x')[0];
  assert.deepEqual([devolta.done, 'dropped' in devolta, 'done_at' in devolta], [false, false, false]);
  assert.equal(items[0].due, '2026-11-20', 'não muda a lista original');
});

test('recuperar um deixado de lado reabre sem done_at nem dropped', () => {
  const r = recuperar([it('a', { done: true, dropped: true, done_at: '2026-11-29T10:00:00Z' }), it('b')], 'a');
  assert.deepEqual(r[0], it('a'));
  assert.equal(deixadosDeLado(r).length, 0);
});

test('pendências da semana: abertos, com prazo primeiro, sem Sonhos nem revisões', () => {
  const items = [it('a'), it('b', { due: '2026-12-03' }), it('c', { due: '2026-12-01' }), it('d', { done: true }),
    it('e', { tab: 'Revisão semanal' }), it('f', { tab: 'Sonhos' })];
  assert.deepEqual(candidatosPendencias(items, HOJE).map(x => x.id), ['c', 'b', 'a']);
});

test('sonhos com meta: com valor-alvo, sem pausados, alcançados ou completos', () => {
  const d = (id, o) => ({ id, person: 'Família', title: id, area: '', horizon: '', notes: '', photo: '', target_cents: 1000, reserved_cents: 0, ...o });
  const dreams = [d('a'), d('b', { target_cents: 0 }), d('c', { paused: true }), d('d', { achieved: true }), d('e', { reserved_cents: 1000 })];
  assert.deepEqual(sonhosComMeta(dreams).map(x => x.id), ['a']);
});

test('resumo da revisão e item gravado na aba Revisão semanal (formato atual)', () => {
  const items = [it('a', { done: true, done_at: '2026-11-28T10:00:00', title: 'Levar o carro' }), it('b', { title: 'Pagar a conta' }),
    it('c', { title: 'Ligar para a escola' })];
  const r = { ...rascunhoNovo(HOJE), passo: 5, pulados: [4], nota_certo: 'Semana leve', decisoes: { b: 'semana', c: 'soltar' },
    pendencias: ['b'], guardados: { s1: 5000 }, foco: 'Descansar', nota: 'Jantar juntos' };
  const texto = resumoRevisao(r, { items, dreams: [{ id: 's1', title: 'Viagem' }], today: HOJE });
  assert.match(texto, /O que deu certo: Levar o carro\./);
  assert.match(texto, /Semana leve/);
  assert.match(texto, /Pagar a conta \(esta semana\)/);
  assert.match(texto, /Ligar para a escola \(deixado de lado\)/);
  assert.match(texto, /Pendências da semana: Pagar a conta\./);
  assert.doesNotMatch(texto, /Sonhos/, 'passo pulado não entra');
  assert.match(texto, /Foco da semana: Descansar\./);
  const x = itemDaRevisao(texto, HOJE, '2026-11-29T21:00:00.000Z', 'rev1');
  assert.ok(validItem(x));
  assert.deepEqual([x.tab, x.done, x.title, x.due], ['Revisão semanal', true, 'Revisão da semana · 29/11/2026', HOJE]);
  assert.ok(itemDaRevisao('x'.repeat(5000), HOJE, 'z', 'r').notes.length <= 4000);
});

test('histórico: revisões concluídas, mais recentes primeiro', () => {
  const items = [it('r1', { tab: 'Revisão semanal', done: true, done_at: '2026-11-15T10:00:00Z' }),
    it('r2', { tab: 'Revisão semanal', done: true, done_at: '2026-11-22T10:00:00Z' }), it('x', { tab: 'Revisão semanal' }), it('y', { done: true })];
  assert.deepEqual(historico(items).map(x => x.id), ['r2', 'r1']);
});

test('combinados: só o texto e a data, mais recentes primeiro; remover', () => {
  let l = adicionarCombinado([], '  Jantar sem celular às quartas ', '2026-11-22', 'c1');
  l = adicionarCombinado(l, 'Passeio no parque', '2026-11-29', 'c2');
  assert.deepEqual(l, [{ id: 'c2', text: 'Passeio no parque', date: '2026-11-29' }, { id: 'c1', text: 'Jantar sem celular às quartas', date: '2026-11-22' }]);
  assert.equal(adicionarCombinado(l, '   ', HOJE, 'c3'), null);
  assert.deepEqual(removerCombinado(l, 'c2').map(c => c.id), ['c1']);
});

test('cores das pessoas: da paleta, mantém a escolhida e distribui as que faltam', () => {
  assert.equal(PALETA.length, 6);
  const c = coresDasPessoas(['Ana', 'Léo', 'Bia'], { 'léo': 'azul' });
  assert.deepEqual(c, { ana: 'terracota', 'léo': 'azul', bia: 'verde' });
  assert.equal(coresDasPessoas(['Ana'], { ana: 'roxo' }).ana, 'azul', 'cor fora da paleta é trocada');
  const sete = coresDasPessoas(['a', 'b', 'c', 'd', 'e', 'f', 'g'], {});
  assert.equal(sete.g, 'azul', 'depois de usar todas, recomeça');
});

test('pessoas: adicionar, renomear (sonhos acompanham) e remover', () => {
  let s = adicionarPessoa({ people: ['Ana'], cores: {} }, ' Léo ', 'verde');
  assert.deepEqual(s, { people: ['Ana', 'Léo'], cores: { 'léo': 'verde' } });
  assert.throws(() => adicionarPessoa(s, 'ana'), /já está/);
  assert.throws(() => adicionarPessoa(s, 'Família'), /já está/);
  assert.throws(() => adicionarPessoa(s, '  '), /nome/);
  const dreams = [{ id: 'd1', person: 'Léo' }, { id: 'd2', person: 'Ana' }];
  const r = renomearPessoa({ ...s, dreams }, 'Léo', 'Leo', 'ameixa');
  assert.deepEqual(r.people, ['Ana', 'Leo']);
  assert.deepEqual(r.cores, { leo: 'ameixa' });
  assert.deepEqual(r.dreams.map(d => d.person), ['Leo', 'Ana']);
  assert.throws(() => renomearPessoa({ ...s, dreams }, 'Léo', 'Ana'), /já está/);
  const sem = removerPessoa(s, 'léo');
  assert.deepEqual(sem, { people: ['Ana'], cores: {} });
});

test('lerFamilia aceita vazio e lixo, e guarda o rascunho válido', () => {
  assert.deepEqual(lerFamilia(null), { cores: {}, combinados: [], rascunho: null });
  const f = lerFamilia({ cores: { ana: 'verde', bia: 'roxo', 3: 4 }, combinados: [{ id: 'c', text: 'Ok', date: '2026-11-29' }, { text: 1 }],
    rascunho: { ...rascunhoNovo(HOJE), passo: 3 } });
  assert.deepEqual(f.cores, { ana: 'verde' });
  assert.equal(f.combinados.length, 1);
  assert.equal(f.rascunho.passo, 3);
  assert.equal(lerFamilia({ rascunho: { passo: 9 } }).rascunho, null);
});
