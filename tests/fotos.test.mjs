import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotosParaBackup, moverFotos, fotosOrfas } from '../js/fotos.js';
import { buildBackup, parseBackup, merge } from '../js/backup.js';

// Armazenamento falso no lugar do IndexedDB.
function falso(inicial = {}, { falhar = false } = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, get: async k => m.get(k), keys: async () => [...m.keys()], delete: async k => { m.delete(k); },
    put: async (k, v) => { if (falhar) throw Error('cheio'); m.set(k, v); } };
}
const FOTO = 'data:image/jpeg;base64,QUJD';
const sonho = (id, extra = {}) => ({ id, person: 'Casal', title: 'Sonho ' + id, area: '', horizon: '', notes: '', photo: '', target_cents: 0, reserved_cents: 0, due: '', ...extra });

test('backup completo leva as fotos do IndexedDB em base64, sem a referência', async () => {
  const store = falso({ r1: FOTO });
  const { dreams, faltando } = await fotosParaBackup([sonho('a', { photo_ref: 'r1' }), sonho('b', { photo: FOTO }), sonho('c')], store);
  assert.equal(faltando, 0);
  assert.deepEqual(dreams.map(d => d.photo), [FOTO, FOTO, '']);
  assert.ok(dreams.every(d => !('photo_ref' in d)));
  const lido = parseBackup(JSON.stringify(buildBackup({ dreams })));
  assert.equal(lido.dreams[0].photo, FOTO);
});

test('foto que sumiu do IndexedDB não impede o backup e é contada', async () => {
  const { dreams, faltando } = await fotosParaBackup([sonho('a', { photo_ref: 'nao-existe' })], falso());
  assert.equal(faltando, 1);
  assert.equal(dreams[0].photo, '');
});

test('restaurar grava as fotos no IndexedDB e o sonho fica só com a referência', async () => {
  const arquivo = parseBackup(JSON.stringify(buildBackup({ dreams: [sonho('a', { photo: FOTO }), sonho('b')] })));
  const juntado = merge({ items: [], dreams: [], people: [] }, arquivo);
  const store = falso();
  let n = 0;
  const r = await moverFotos(juntado.dreams, store, { novaRef: () => 'ref-' + ++n });
  assert.equal(r.movidas, 1);
  assert.equal(r.dreams[0].photo, '');
  assert.equal(r.dreams[0].photo_ref, 'ref-1');
  assert.equal(store.m.get('ref-1'), FOTO);
  // ida e volta: limpar tudo e restaurar devolve a mesma foto
  const deNovo = await fotosParaBackup(r.dreams, store);
  assert.equal(deNovo.dreams[0].photo, FOTO);
});

test('fotos antigas em base64 vão aos poucos e ficam como estão se o IndexedDB falhar', async () => {
  const ds = [sonho('a', { photo: FOTO }), sonho('b', { photo: FOTO }), sonho('c', { photo: FOTO })];
  const aos = await moverFotos(ds, falso(), { limite: 2 });
  assert.equal(aos.movidas, 2);
  assert.equal(aos.dreams[2].photo, FOTO);
  const falhou = await moverFotos(ds, falso({}, { falhar: true }));
  assert.equal(falhou.movidas, 0);
  assert.deepEqual(falhou.dreams, ds);
  assert.equal((await moverFotos(ds, null)).movidas, 0);
});

test('fotos órfãs: só as que nenhum sonho (nem a cópia de desfazer) usa', () => {
  assert.deepEqual(fotosOrfas(['r1', 'r2', 'r3'], [sonho('a', { photo_ref: 'r1' })], [sonho('b', { photo_ref: 'r3' })], null), ['r2']);
});
