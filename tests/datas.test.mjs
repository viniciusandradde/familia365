import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconhecerData, addDays } from '../js/datas.js';

const hoje = '2026-11-26'; // quinta-feira
const r = t => reconhecerData(t, hoje);

test('somar dias atravessa mês e ano', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 2), '2027-01-02');
});

test('"amanhã" no fim vira prazo e sai do título', () => {
  assert.deepEqual(r('Ligar para a escola amanhã'), { due: '2026-11-27', termo: 'amanhã', clear: true, title: 'Ligar para a escola' });
  assert.equal(r('Ligar para a escola amanha').due, '2026-11-27');
});

test('"depois de amanhã" ganha de "amanhã"', () => {
  const x = r('Buscar o bolo depois de amanhã');
  assert.equal(x.due, '2026-11-28');
  assert.equal(x.title, 'Buscar o bolo');
  assert.equal(x.termo, 'depois de amanhã');
});

test('no começo da frase também é claro, e a primeira letra continua maiúscula', () => {
  assert.deepEqual(r('Amanhã, ligar para o dentista'), { due: '2026-11-27', termo: 'Amanhã', clear: true, title: 'Ligar para o dentista' });
  assert.equal(r('Sexta-feira: pagar a luz').title, 'Pagar a luz');
  assert.equal(r('Sexta-feira: pagar a luz').due, '2026-11-27');
});

test('dias da semana com ou sem preposição: a próxima ocorrência', () => {
  assert.equal(r('Consertar a bicicleta na segunda').due, '2026-11-30');
  assert.equal(r('Consertar a bicicleta na segunda').title, 'Consertar a bicicleta');
  assert.equal(r('Feira no domingo').due, '2026-11-29');
  assert.equal(r('Comprar o presente da vó até sábado').title, 'Comprar o presente da vó');
  assert.equal(r('Comprar o presente da vó até sabado').due, '2026-11-28');
  assert.equal(r('Treino terça').due, '2026-12-01');
  assert.equal(r('Reunião na quinta').due, '2026-12-03', 'o mesmo dia da semana é a semana que vem');
  assert.equal(r('Cinema na próxima sexta').due, '2026-11-27');
});

test('no meio da frase vira prazo, mas o título fica como está', () => {
  assert.deepEqual(r('Levar o bolo amanhã cedo'), { due: '2026-11-27', termo: 'amanhã', clear: false, title: 'Levar o bolo amanhã cedo' });
  assert.equal(r('Dentista na segunda-feira às 9h').due, '2026-11-30');
  assert.equal(r('Dentista na segunda-feira às 9h').clear, false);
});

test('"de sábado" é prazo, mas não sai do título (faz parte do sentido)', () => {
  const x = r('Comprar o presente de sábado');
  assert.equal(x.due, '2026-11-28');
  assert.equal(x.clear, false);
  assert.equal(x.title, 'Comprar o presente de sábado');
});

test('só a data, sem mais nada: prazo sim, título não fica vazio', () => {
  assert.deepEqual(r('amanhã'), { due: '2026-11-27', termo: 'amanhã', clear: false, title: 'amanhã' });
});

test('sem reconhecimento: "segunda via", nomes, palavras parecidas e dois dias diferentes', () => {
  for (const t of ['Pedir a segunda via do boleto', 'Ligar para o Domingos', 'Sextante novo', 'Pagar a luz', '', 'Ligar na terça ou na quarta', 'Pela segunda vez'])
    assert.equal(r(t), null, t);
  assert.equal(reconhecerData(null, hoje), null);
  assert.equal(reconhecerData('amanhã', 'ontem'), null);
});
