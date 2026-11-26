import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, parseRoute, hashFor } from '../js/router.js';

test('as cinco rotas, nesta ordem', () => {
  assert.deepEqual(ROUTES, ['hoje', 'planos', 'sonhos', 'familia', 'dados']);
});

test('sem hash ou hash desconhecido vai para Hoje (não canônico)', () => {
  for (const h of ['', '#', '#/', '#/nada', '#qualquer', undefined]) {
    assert.deepEqual(parseRoute(h), { route: 'hoje', importPayload: null, canonical: false }, String(h));
  }
});

test('rotas canônicas #/rota', () => {
  for (const r of ROUTES) assert.deepEqual(parseRoute('#/' + r), { route: r, importPayload: null, canonical: true });
});

test('tolera barra no fim, maiúsculas e "família" com acento', () => {
  assert.equal(parseRoute('#/planos/').route, 'planos');
  assert.equal(parseRoute('#/Sonhos').route, 'sonhos');
  assert.equal(parseRoute('#/fam%C3%ADlia').route, 'familia');
  assert.equal(parseRoute('#/família').route, 'familia');
  assert.equal(parseRoute('#/planos/').canonical, false);
});

test('links antigos: #dados e #vision', () => {
  assert.deepEqual(parseRoute('#dados'), { route: 'dados', importPayload: null, canonical: false });
  assert.deepEqual(parseRoute('#vision'), { route: 'sonhos', importPayload: null, canonical: false });
});

test('#import= continua valendo e abre em Hoje com o conteúdo cru', () => {
  const raw = encodeURIComponent(JSON.stringify({ version: 1, items: [] }));
  assert.deepEqual(parseRoute('#import=' + raw), { route: 'hoje', importPayload: raw, canonical: false });
  assert.equal(parseRoute('#import=').importPayload, '');
});

test('hashFor monta o hash e recusa rota inválida', () => {
  assert.equal(hashFor('planos'), '#/planos');
  assert.equal(hashFor('xyz'), '#/hoje');
});
