import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrarSonhosDaLista, estadoSonho, guardarValor, pausarSonho, mudarPrazo, filtrosSonhos, filtrarSonhos, jaGuardado, seloDoSonho, reais, mesAno } from '../js/painel.js';
import { merge, parseBackup, buildBackup } from '../js/backup.js';

const item = (id, title, extra = {}) => ({ id, tab: 'Sonhos', done: false, title, area: 'Lazer', horizon: '5 anos', due: '', notes: '', ...extra });
const hoje = { id: 'h1', tab: 'Hoje', done: false, title: 'Pagar a conta', area: '', horizon: '', due: '', notes: '' };

test('itens da aba Sonhos viram sonhos do painel com o id original e saem da lista', () => {
  const r = migrarSonhosDaLista([hoje, item('s1', 'Viagem à praia R$ 6.000', { due: '2027-12-01', scope: 'casal', notes: 'Com as crianças' })], []);
  assert.equal(r.migrados, 1);
  assert.deepEqual(r.items, [hoje]);
  assert.deepEqual(r.dreams, [{ id: 's1', person: 'Casal', title: 'Viagem à praia', area: 'Lazer', horizon: '5 anos', notes: 'Com as crianças',
    photo: '', target_cents: 600000, reserved_cents: 0, due: '2027-12-01', origin_id: 's1' }]);
});

test('migração é idempotente e não toca em nada quando não há itens de Sonhos', () => {
  const r1 = migrarSonhosDaLista([hoje, item('s1', 'Horta em casa')], []);
  const r2 = migrarSonhosDaLista(r1.items, r1.dreams);
  assert.equal(r2.migrados, 0);
  assert.deepEqual(r2.dreams, r1.dreams);
  const lista = [hoje];
  assert.equal(migrarSonhosDaLista(lista, []).items, lista);
});

test('backup antigo restaurado depois da migração não duplica o sonho', () => {
  const antigo = parseBackup(JSON.stringify({ version: 1, items: [hoje, item('s1', 'Horta em casa', { done: true })] }));
  const migrado = migrarSonhosDaLista(antigo.items, []);
  const device = { items: migrado.items, dreams: migrado.dreams, people: [] };
  const juntado = merge(device, antigo); // o item s1 volta para a lista…
  assert.equal(juntado.items.filter(x => x.id === 's1').length, 1);
  const de_novo = migrarSonhosDaLista(juntado.items, juntado.dreams); // …e sai de novo sem virar outro sonho
  assert.equal(de_novo.dreams.length, 1);
  assert.equal(de_novo.dreams[0].achieved, true);
  assert.deepEqual(de_novo.items, [hoje]);
});

test('item com o mesmo id de um sonho (meta duplicada) só completa o que falta no sonho', () => {
  const sonho = { id: 'g1', person: 'Família', title: 'Carro', area: '', horizon: '', notes: '', photo: '', target_cents: 0, reserved_cents: 5000, due: '' };
  const r = migrarSonhosDaLista([item('g1', 'Carro R$ 30.000', { due: '2028-01-01' })], [sonho]);
  assert.equal(r.dreams.length, 1);
  assert.equal(r.dreams[0].target_cents, 3000000);
  assert.equal(r.dreams[0].due, '2028-01-01');
  assert.equal(r.dreams[0].reserved_cents, 5000);
  assert.deepEqual(r.items, []);
});

test('sonhos migrados passam pela validação do backup (campos novos opcionais)', () => {
  const r = migrarSonhosDaLista([item('s1', 'Horta', { done: true })], []);
  const d = { ...r.dreams[0], paused: true, next_step: 'Escolher as mudas', photo_ref: 'ref-1' };
  const lido = parseBackup(JSON.stringify(buildBackup({ dreams: [d] })));
  assert.deepEqual(lido.dreams[0], d);
});

test('estado do cartão: aporte simples até o prazo, pausado, alcançado e prazo passado', () => {
  const base = { target_cents: 600000, reserved_cents: 150000, due: '2027-12-15' };
  const e = estadoSonho(base, '2026-11-26');
  assert.equal(e.tipo, 'meta');
  assert.equal(e.pct, 25);
  assert.equal(reais(e.mensal), 'R$ 346');
  assert.equal(e.prazo, 'dez/2027');
  assert.equal(estadoSonho({ ...base, paused: true }, '2026-11-26').tipo, 'pausado');
  assert.equal(estadoSonho({ ...base, paused: true }, '2026-11-26').mensal, 0);
  assert.equal(estadoSonho({ ...base, reserved_cents: 600000 }, '2026-11-26').tipo, 'alcancado');
  assert.equal(estadoSonho({ achieved: true }, '2026-11-26').tipo, 'alcancado');
  const passado = estadoSonho({ ...base, due: '2026-10-01' }, '2026-11-26');
  assert.equal(passado.prazoPassado, true);
  assert.equal(passado.mensal, 0);
  assert.equal(estadoSonho({ due: '' }, '2026-11-26').tipo, 'passo');
  assert.equal(estadoSonho({ ...base, due: '2026-11-30' }, '2026-11-26').mensal, 450000);
});

test('guardar valor soma ao já guardado; pausar, retomar e mudar prazo', () => {
  const ds = [{ id: 'a', reserved_cents: 150000 }, { id: 'b' }];
  assert.equal(guardarValor(ds, 'a', 5000)[0].reserved_cents, 155000);
  assert.equal(guardarValor(ds, 'b', 100)[1].reserved_cents, 100);
  assert.throws(() => guardarValor(ds, 'a', 0));
  const p = pausarSonho(ds, 'a', true);
  assert.equal(p[0].paused, true);
  assert.equal('paused' in pausarSonho(p, 'a', false)[0], false);
  assert.equal(mudarPrazo(ds, 'b', '2028-03-01')[1].due, '2028-03-01');
  assert.throws(() => mudarPrazo(ds, 'b', '03/2028'));
});

test('filtros, selo de escopo e "Já guardado"', () => {
  const ds = [{ id: 'a', person: 'Minha visão', reserved_cents: 150000 }, { id: 'b', person: 'Casal', reserved_cents: 45000 }, { id: 'c', person: 'Ana', reserved_cents: 0 }];
  assert.deepEqual(filtrosSonhos(['Minha visão', 'Casal', 'Família', 'Ana']).map(f => f.rotulo), ['Todos', 'Meu', 'Casal', 'Família', 'Ana']);
  assert.deepEqual(filtrarSonhos(ds, 'Casal').map(d => d.id), ['b']);
  assert.equal(filtrarSonhos(ds, '').length, 3);
  assert.deepEqual(ds.map(seloDoSonho), ['Meu', 'Casal', 'Ana']);
  assert.deepEqual(jaGuardado(ds), { cents: 195000, sonhos: 2 });
  assert.equal(reais(195050), 'R$ 1.950,50');
  assert.equal(mesAno('2027-05-01'), 'mai/2027');
});
