// Sonhos num lugar só (etapa 4): lógica pura do painel (familia365-vision-v1). Sem DOM, testável no Node.
// Campos opcionais novos nos sonhos, gravados só quando têm valor: paused, achieved, next_step, photo_ref, origin_id.
import { BASE_PEOPLE } from './backup.js';
import { moneyCents } from './goals.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PESSOA_DO_ESCOPO = { eu: 'Minha visão', casal: 'Casal', familia: 'Família' };
const str = v => (typeof v === 'string' ? v : '');

// Itens antigos da aba "Sonhos" da lista viram sonhos do painel com o mesmo id (origin_id guarda o id do item).
// Idempotente: se o sonho já existe (mesmo id ou origin_id), o item só sai da lista; o que o item tinha e o sonho não
// (valor-alvo, prazo, descrição) é copiado antes. Devolve listas novas e quantos itens saíram da lista.
export function migrarSonhosDaLista(items, dreams) {
  const lista = Array.isArray(items) ? items : [], painel = Array.isArray(dreams) ? dreams.slice() : [];
  const fica = [];
  let migrados = 0;
  for (const x of lista) {
    if (!x || x.tab !== 'Sonhos') { fica.push(x); continue; }
    const alvo = moneyCents(x.title) || moneyCents(x.notes);
    const i = painel.findIndex(d => d && (d.id === x.id || d.origin_id === x.id));
    if (i >= 0) {
      const d = painel[i];
      painel[i] = { ...d, target_cents: d.target_cents || alvo, due: d.due || (DAY.test(x.due) ? x.due : ''), notes: d.notes || str(x.notes) };
    } else {
      const titulo = str(x.title).replace(/R\$\s*[\d.,]+/i, '').replace(/\s{2,}/g, ' ').trim();
      const d = { id: x.id, person: PESSOA_DO_ESCOPO[x.scope] || BASE_PEOPLE[0], title: (alvo && titulo ? titulo : str(x.title).trim()).slice(0, 200),
        area: str(x.area), horizon: str(x.horizon), notes: str(x.notes), photo: '', target_cents: alvo, reserved_cents: 0,
        due: DAY.test(x.due) ? x.due : '', origin_id: x.id };
      if (x.done === true) d.achieved = true;
      painel.push(d);
    }
    migrados++;
  }
  return { items: migrados ? fica : lista, dreams: painel, migrados };
}

// Selo de escopo: Meu / Casal / Família ou o nome da pessoa.
export function seloDoSonho(d) {
  const p = str(d?.person);
  return p === 'Minha visão' || !p ? 'Meu' : p;
}
export const ESCOPO_ICONE = { Meu: 'pessoa', Casal: 'casal', 'Família': 'casa' };

// Filtros: Todos, Meu, Casal, Família e cada pessoa cadastrada (ou que já tenha sonho gravado).
export function filtrosSonhos(pessoas) {
  return [{ id: '', rotulo: 'Todos' }, ...pessoas.map(p => ({ id: p, rotulo: p === 'Minha visão' ? 'Meu' : p }))];
}
export const filtrarSonhos = (dreams, filtro) => (filtro ? dreams.filter(d => d.person === filtro) : dreams.slice());

export function jaGuardado(dreams) {
  const com = dreams.filter(d => Number.isSafeInteger(d.reserved_cents) && d.reserved_cents > 0);
  return { cents: com.reduce((s, d) => s + d.reserved_cents, 0), sonhos: com.length };
}

// "R$ 1.500" (sem centavos quando o valor é redondo).
export function reais(c) {
  const v = (c || 0) / 100, inteiro = Number.isInteger(v);
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 2 });
}
export const mesAno = due => (DAY.test(due || '') ? MESES[Number(due.slice(5, 7)) - 1] + '/' + due.slice(0, 4) : '');

// O que o cartão mostra. tipo: 'pausado' | 'alcancado' | 'meta' | 'passo'. Aporte simples, sem juros: falta ÷ meses até o prazo.
export function estadoSonho(d, today) {
  const alvo = d.target_cents || 0, guardado = d.reserved_cents || 0, falta = Math.max(0, alvo - guardado);
  const prazoPassado = DAY.test(d.due || '') && d.due < today;
  const e = { tipo: 'passo', alvo, guardado, falta, pct: 0, mensal: 0, prazo: mesAno(d.due), prazoPassado: false };
  if (d.achieved === true || (alvo > 0 && falta === 0)) return { ...e, tipo: 'alcancado', pct: alvo ? 100 : 0 };
  if (alvo > 0) { e.tipo = 'meta'; e.pct = Math.min(100, Math.floor(guardado * 100 / alvo)); }
  if (d.paused === true) return { ...e, tipo: 'pausado' };
  e.prazoPassado = prazoPassado;
  if (e.tipo === 'meta' && DAY.test(d.due || '') && !prazoPassado) {
    const meses = (Number(d.due.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(d.due.slice(5, 7)) - Number(today.slice(5, 7));
    e.mensal = Math.round(falta / Math.max(1, meses) / 100) * 100 || falta;
  }
  return e;
}

const comSonho = (dreams, id, f) => dreams.map(d => (d.id === id ? f(d) : d));
export function guardarValor(dreams, id, cents) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw Error('valor inválido');
  return comSonho(dreams, id, d => ({ ...d, reserved_cents: (d.reserved_cents || 0) + cents }));
}
export const pausarSonho = (dreams, id, pausar) => comSonho(dreams, id, d => {
  const { paused, ...resto } = d;
  return pausar ? { ...resto, paused: true } : resto;
});
export function mudarPrazo(dreams, id, due) {
  if (due !== '' && !DAY.test(due)) throw Error('prazo inválido');
  return comSonho(dreams, id, d => ({ ...d, due }));
}
