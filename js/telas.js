// O que cada tela mostra (lógica pura, sem DOM). Os itens continuam com a mesma "tab" gravada desde a primeira versão.
import { describeLastBackup } from './backup.js';

export const PLANOS_TABS = ['Plano de vida', 'Família', 'Pendências'];
const TAB_DA_TELA = { hoje: 'Hoje', planos: 'Plano de vida', sonhos: 'Sonhos', familia: 'Revisão semanal' };
const TITULOS = { hoje: 'Hoje', planos: 'Planos', sonhos: 'Sonhos', familia: 'Família', dados: 'Dados e backup' };
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "Hoje" mantém a regra da aba antiga: itens da aba Hoje e os abertos com prazo para hoje.
export function itemsForScreen(items, screen, today) {
  const list = Array.isArray(items) ? items : [];
  if (screen === 'hoje') return list.filter(x => x.tab === 'Hoje' || (!x.done && x.due === today));
  if (screen === 'planos') return list.filter(x => PLANOS_TABS.includes(x.tab));
  if (screen === 'sonhos') return list.filter(x => x.tab === 'Sonhos');
  if (screen === 'familia') return list.filter(x => x.tab === 'Revisão semanal');
  return [];
}

export function groupPlanos(items) {
  const list = Array.isArray(items) ? items : [];
  return PLANOS_TABS.map(tab => ({ tab, items: list.filter(x => x.tab === tab) }));
}

export const defaultTab = screen => TAB_DA_TELA[screen] || 'Hoje';
export const fabAction = screen => (screen === 'dados' ? null : screen === 'sonhos' ? 'sonho' : 'item');
export const screenTitle = screen => TITULOS[screen] || TITULOS.hoje;

export function summary(items) {
  const open = items.filter(x => !x.done).length, done = items.length - open;
  const parts = [];
  if (open) parts.push(open + ' em aberto');
  if (done) parts.push(done + (done === 1 ? ' concluído' : ' concluídos'));
  return parts.join(' · ') || 'Nada anotado ainda';
}

export function needsBackupReminder(iso, now = new Date()) {
  const d = describeLastBackup(iso, now);
  return !d || d.days > 7;
}

export function headerDate(d = new Date()) {
  return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}

// Data local do aparelho em AAAA-MM-DD.
export function isoDay(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function dueLabel(due, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '')) return '';
  if (due === today) return 'hoje';
  const [y, m, d] = due.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  if (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td) === 86400000) return 'amanhã';
  return y === ty ? d + '/' + String(m).padStart(2, '0') : String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
}

// Itens da aba Hoje com prazo futuro (ex.: "sábado"): aparecem em Planos, em "Próximos dias", pela data.
export function proximosDias(items, today) {
  const list = Array.isArray(items) ? items : [];
  return list.map((x, i) => ({ x, i })).filter(({ x }) => x.tab === 'Hoje' && !x.done && /^\d{4}-\d{2}-\d{2}$/.test(x.due || '') && x.due > today)
    .sort((a, b) => (a.x.due < b.x.due ? -1 : a.x.due > b.x.due ? 1 : a.i - b.i)).map(({ x }) => x);
}
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// "sáb, 28/11" (com o ano quando não é o ano de hoje).
export function diaCurto(due, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '')) return '';
  const [y, m, d] = due.split('-').map(Number), w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DIAS_CURTOS[w] + ', ' + String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + (today && today.slice(0, 4) !== String(y) ? '/' + y : '');
}

export function openFirst(items) {
  return items.filter(x => !x.done).concat(items.filter(x => x.done));
}
