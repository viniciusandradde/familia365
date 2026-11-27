// Tela Hoje (etapa 3): seções, "de quem é", horário, "Quando?" e revisão da semana. Lógica pura, sem DOM.
import { defaultTab } from './telas.js';
import { SCOPES } from './backup.js';

export { SCOPES };
export const SCOPE_LABEL = { eu: 'Para mim', casal: 'Casal', familia: 'Família' };
export const SCOPE_ICON = { eu: 'pessoa', casal: 'casal', familia: 'casa' };
// Itens antigos não têm "scope": contam como pessoais (o padrão da captura).
export const scopeOf = x => (SCOPES.includes(x?.scope) ? x.scope : 'eu');
export const isNight = x => x?.night === true || (/^\d{2}:\d{2}$/.test(x?.time || '') && x.time >= '18:00');

export function timeLabel(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  return m ? Number(m[1]) + 'h' + (m[2] === '00' ? '' : m[2]) : '';
}

// Data local (AAAA-MM-DD) de um instante ISO; '' se inválido.
export function localDay(iso) {
  const d = new Date(typeof iso === 'string' ? iso : NaN);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Sem horário primeiro, na ordem da lista (o recém-anotado fica no topo); depois os com horário, pela hora.
const ordenar = l => l.filter(x => !x.time).concat(l.filter(x => x.time).sort((a, b) => a.time.localeCompare(b.time)));

// paraHoje/noite: abertos da aba Hoje (sem prazo ou com prazo hoje) e de qualquer aba com prazo hoje.
// trazer: abertos com prazo vencido (menos Sonhos). concluidos: concluídos hoje entre os de Hoje.
// antes: da aba Hoje concluídos em outro dia ou sem done_at (versões antigas), para não sumirem da tela.
export function secoesHoje(items, today) {
  const list = Array.isArray(items) ? items : [];
  const abertos = [], trazer = [], concluidos = [], antes = [];
  for (const x of list) {
    const due = x.due || '';
    if (!x.done) {
      if (due && due < today) { if (x.tab !== 'Sonhos') trazer.push(x); }
      else if (due === today || (x.tab === 'Hoje' && !due)) abertos.push(x);
    } else if (localDay(x.done_at) === today) {
      if (x.tab === 'Hoje' || due === today) concluidos.push(x);
    } else if (x.tab === 'Hoje') antes.push(x);
  }
  return { paraHoje: ordenar(abertos.filter(x => !isNight(x))), noite: ordenar(abertos.filter(isNight)), trazer, concluidos, antes };
}

// Cartão da revisão da semana: no dia escolhido (domingo por padrão), até "Agora não" naquele dia.
export function mostrarRevisao(today, adiadaEm, dia = 0) {
  const [y, m, d] = String(today).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === dia && adiadaEm !== today;
}

// "Quando?" da folha Anotar ↔ aba e horizonte gravados desde a primeira versão.
export function whenOf(x) {
  if (x.tab === 'Hoje' || x.horizon === 'Hoje') return 'hoje';
  return x.horizon === '7 dias' ? 'semana' : 'algum';
}
export function tabForWhen(when, screen) {
  if (when === 'hoje') return 'Hoje';
  const tab = defaultTab(screen);
  if (tab !== 'Hoje') return tab;
  return when === 'semana' ? 'Pendências' : 'Plano de vida';
}
export const horizonForWhen = when => ({ hoje: 'Hoje', semana: '7 dias' })[when] || '';

export const SUGESTOES = [
  { title: 'Caminhar 20 min', scope: 'eu', area: 'Saúde' },
  { title: 'Ler 15 min juntos', scope: 'familia', area: 'Família' },
  { title: 'Ligar para alguém querido', scope: 'eu', area: 'Pessoal' },
];
