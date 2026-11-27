// Tela Família (etapa 5), lógica pura: revisão da semana em 5 passos, Conversa de domingo (só os combinados) e pessoas com
// cor. Sem DOM, testável no Node. O que é da tela fica em familia365-familia-v1 ({cores, combinados, rascunho}); a revisão
// concluída vira um item da aba "Revisão semanal" (formato de sempre) e as decisões mexem nos próprios itens.
import { BASE_PEOPLE, PALETA, personKey, cleanFamilia } from './backup.js';
import { addDays } from './datas.js';
import { isoDay } from './telas.js';
import { reais } from './painel.js';

export { PALETA };
export const FKEY = 'familia365-familia-v1';
export const NOME_COR = { azul: 'Azul', terracota: 'Terracota', verde: 'Verde', lavanda: 'Lavanda', ameixa: 'Ameixa', caramelo: 'Caramelo' };
export const PASSOS = ['O que deu certo', 'O que ficou pelo caminho?', 'Pendências da semana', 'Sonhos: guardamos algo?', 'Foco da semana'];
export const PERGUNTAS = ['O que funcionou na nossa família esta semana?', 'O que não funcionou?', 'O que vamos combinar?'];
export const ESCOLHAS = { semana: 'Esta semana', depois: 'Mais tarde', soltar: 'Soltar' };
const ESCOLHA_RESUMO = { semana: 'esta semana', depois: 'mais tarde', soltar: 'deixado de lado' };
const FORA = ['Sonhos', 'Revisão semanal'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = v => (typeof v === 'string' ? v : '');

// ---------- Rascunho e passos ----------
export function rascunhoNovo(today) {
  return { passo: 1, inicio: today, pulados: [], nota_certo: '', decisoes: {}, pendencias: [], guardados: {}, foco: '', nota: '' };
}
function validRascunho(r) {
  if (!r || typeof r !== 'object' || !Number.isInteger(r.passo) || r.passo < 1 || r.passo > 5 || !DAY.test(str(r.inicio))) return null;
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const decisoes = {}, guardados = {};
  for (const [k, v] of Object.entries(obj(r.decisoes))) if (ESCOLHAS[v]) decisoes[k] = v;
  for (const [k, v] of Object.entries(obj(r.guardados))) if (Number.isSafeInteger(v) && v > 0) guardados[k] = v;
  return { passo: r.passo, inicio: r.inicio, pulados: (Array.isArray(r.pulados) ? r.pulados : []).filter(n => Number.isInteger(n) && n >= 1 && n <= 5),
    nota_certo: str(r.nota_certo).slice(0, 1000), decisoes, pendencias: (Array.isArray(r.pendencias) ? r.pendencias : []).filter(x => typeof x === 'string'),
    guardados, foco: str(r.foco).slice(0, 200), nota: str(r.nota).slice(0, 1000) };
}
export function lerFamilia(raw) {
  return { ...cleanFamilia(raw), rascunho: validRascunho(raw && raw.rascunho) };
}
// Continuar e Pular avançam (Pular marca o passo, que não entra no resumo); Voltar recua. O passo 5 é o último.
export function navegar(r, acao) {
  const pulados = r.pulados.filter(n => n !== r.passo);
  if (acao === 'voltar') return { ...r, passo: Math.max(1, r.passo - 1) };
  if (acao === 'pular') pulados.push(r.passo);
  return { ...r, pulados, passo: Math.min(5, r.passo + 1) };
}

// ---------- O que entra em cada passo ----------
const aberto = x => !x.done && !FORA.includes(x.tab);
const diaDe = iso => { const t = new Date(iso); return Number.isNaN(t.getTime()) ? '' : isoDay(t); };
// Passo 1: concluídos nos últimos 7 dias (done_at), sem os deixados de lado e sem as próprias revisões. Sem contar por pessoa.
export function deuCerto(items, today) {
  const desde = addDays(today, -6);
  return items.filter(x => x.done && !x.dropped && x.tab !== 'Revisão semanal' && x.done_at && diaDe(x.done_at) >= desde && diaDe(x.done_at) <= today);
}
// Passo 2: abertos com prazo passado ou nos próximos 7 dias, e os já decididos nesta revisão (para a lista não pular).
export function ficouPeloCaminho(items, today, decisoes = {}) {
  const ate = addDays(today, 6);
  return items.filter(x => Object.hasOwn(decisoes, x.id) || (aberto(x) && x.due && x.due <= ate));
}
// "Esta semana" vai até o próximo domingo (no domingo da revisão, o da semana que vem).
export function fimDaSemana(today) {
  const dow = new Date(today + 'T12:00:00').getDay();
  return addDays(today, dow === 0 ? 7 : 7 - dow);
}
export function aplicarDecisao(items, id, escolha, today, agora) {
  return items.map(x => {
    if (x.id !== id) return x;
    const { done_at, dropped, ...base } = x;
    if (escolha === 'semana') return { ...base, done: false, due: fimDaSemana(today) };
    if (escolha === 'depois') return { ...base, done: false, due: '', tab: base.tab === 'Hoje' ? 'Pendências' : base.tab };
    if (escolha === 'soltar') return { ...base, done: true, done_at: agora, dropped: true };
    return x;
  });
}
export const deixadosDeLado = items => items.filter(x => x.done && x.dropped);
export function recuperar(items, id) {
  return items.map(x => { if (x.id !== id) return x; const { done_at, dropped, ...base } = x; return { ...base, done: false }; });
}
// Passo 3: abertos (sem Sonhos e revisões), os com prazo primeiro, pela data.
export function candidatosPendencias(items) {
  const abertos = items.filter(aberto);
  return [...abertos.filter(x => x.due).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)), ...abertos.filter(x => !x.due)];
}
// Passo 4: sonhos com meta em andamento.
export const sonhosComMeta = dreams => dreams.filter(d => d.target_cents > 0 && !d.paused && !d.achieved && (d.reserved_cents || 0) < d.target_cents);

// ---------- Conclusão ----------
export function resumoRevisao(r, { items, dreams, today }) {
  const tit = id => items.find(x => x.id === id)?.title, linhas = [], feito = n => !r.pulados.includes(n);
  if (feito(1)) {
    const certo = deuCerto(items, today).map(x => x.title);
    if (certo.length) linhas.push('O que deu certo: ' + certo.join('; ') + '.');
    if (r.nota_certo.trim()) linhas.push('Sobre a semana: ' + r.nota_certo.trim());
  }
  if (feito(2)) {
    const d = Object.entries(r.decisoes).filter(([id]) => tit(id)).map(([id, e]) => tit(id) + ' (' + ESCOLHA_RESUMO[e] + ')');
    if (d.length) linhas.push('Ficou pelo caminho: ' + d.join('; ') + '.');
  }
  if (feito(3)) {
    const p = r.pendencias.map(tit).filter(Boolean);
    if (p.length) linhas.push('Pendências da semana: ' + p.join('; ') + '.');
  }
  if (feito(4)) {
    const g = Object.entries(r.guardados).map(([id, c]) => { const d = dreams.find(y => y.id === id); return d ? reais(c) + ' para ' + d.title : ''; }).filter(Boolean);
    if (g.length) linhas.push('Sonhos: ' + g.join('; ') + '.');
  }
  if (feito(5)) {
    if (r.foco.trim()) linhas.push('Foco da semana: ' + r.foco.trim() + '.');
    if (r.nota.trim()) linhas.push('Anotação: ' + r.nota.trim());
  }
  return linhas.join('\n');
}
export function itemDaRevisao(texto, today, agora, id) {
  const [a, m, d] = today.split('-');
  return { id, tab: 'Revisão semanal', done: true, done_at: agora, title: 'Revisão da semana · ' + d + '/' + m + '/' + a,
    area: '', horizon: '7 dias', due: today, notes: str(texto).slice(0, 4000) };
}
const quando = x => x.done_at || x.due || '';
export const historico = items => items.filter(x => x.tab === 'Revisão semanal' && x.done)
  .sort((a, b) => (quando(a) < quando(b) ? 1 : quando(a) > quando(b) ? -1 : 0));

// ---------- Conversa de domingo: só os combinados ----------
export function adicionarCombinado(lista, texto, date, id) {
  const text = str(texto).trim().slice(0, 200);
  if (!text) return null;
  return cleanFamilia({ combinados: [{ id, text, date }, ...lista] }).combinados;
}
export const removerCombinado = (lista, id) => lista.filter(c => c.id !== id);

// ---------- Pessoas e cores ----------
// Cada pessoa tem uma cor da paleta (segura para daltonismo e sempre com o nome escrito). A escolhida fica; quem não tem
// recebe a cor menos usada, na ordem da paleta.
export function coresDasPessoas(pessoas, cores = {}) {
  const out = {}, uso = Object.fromEntries(PALETA.map(c => [c, 0]));
  for (const n of pessoas) { const k = personKey(n), c = cores[k]; if (PALETA.includes(c)) { out[k] = c; uso[c]++; } }
  for (const n of pessoas) {
    const k = personKey(n);
    if (out[k]) continue;
    const c = PALETA.reduce((m, p) => (uso[p] < uso[m] ? p : m), PALETA[0]);
    out[k] = c; uso[c]++;
  }
  return out;
}
function nomeValido(nome, people, menos = '') {
  const n = str(nome).trim();
  if (!n || n.length > 40) throw Error('Escreva um nome com até 40 letras.');
  const k = personKey(n);
  if (k !== personKey(menos || ' ') && [...BASE_PEOPLE, ...people].some(p => personKey(p) === k)) throw Error('Esse nome já está na lista.');
  return n;
}
export function adicionarPessoa({ people, cores }, nome, cor) {
  const n = nomeValido(nome, people), k = personKey(n), novas = [...people, n];
  return { people: novas, cores: { ...cores, [k]: PALETA.includes(cor) ? cor : coresDasPessoas(novas, cores)[k] } };
}
export function renomearPessoa({ people, cores, dreams }, de, para, cor) {
  const n = nomeValido(para, people, de), kDe = personKey(de), k = personKey(n), c = PALETA.includes(cor) ? cor : cores[kDe];
  const novasCores = { ...cores };
  delete novasCores[kDe];
  if (c) novasCores[k] = c;
  return { people: people.map(p => (personKey(p) === kDe ? n : p)), cores: novasCores,
    dreams: dreams.map(d => (typeof d.person === 'string' && personKey(d.person) === kDe ? { ...d, person: n } : d)) };
}
export function removerPessoa({ people, cores }, nome) {
  const k = personKey(nome), novasCores = { ...cores };
  delete novasCores[k];
  return { people: people.filter(p => personKey(p) !== k), cores: novasCores };
}
