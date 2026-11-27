// Reconhecimento local de datas no texto (sem rede): "amanhã", "depois de amanhã" e dias da semana ("sábado", "na segunda").
// Lógica pura. Devolve {due, termo, clear, title} ou null. "clear" diz se o termo pode sair do título sem mudar o sentido:
// só no fim ou no começo da frase, sem "de" antes ("presente de sábado" fica como está) e sem deixar o título vazio.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const L = '[\\p{L}\\p{N}]';
const TERMO = new RegExp(
  `(?<!${L})(?:(na|no|nesta|neste|nessa|nesse|para|pra|até|ate|de)\\s+)?(?:(?:pr[óo]xim[ao])\\s+)?` +
  `(depois\\s+de\\s+amanh[ãa]|amanh[ãa]|domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:-feira|\\s+feira)?(?!${L})`, 'giu');
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d + n));
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
}
function diaDaSemana(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function dataDo(palavra, today) {
  const p = semAcento(palavra);
  if (p === 'amanha') return addDays(today, 1);
  if (p.startsWith('depois')) return addDays(today, 2);
  const alvo = SEMANA[p], hoje = diaDaSemana(today);
  return addDays(today, ((alvo - hoje + 7) % 7) || 7); // o mesmo dia da semana é o da semana que vem
}

export function reconhecerData(texto, today) {
  if (typeof texto !== 'string' || !DAY.test(today || '')) return null;
  const achados = [...texto.matchAll(TERMO)].map(m => {
    const palavra = m[2], prep = m[1] ? semAcento(m[1]) : '', ini = m.index, fim = m.index + m[0].length;
    const termo = m[1] ? m[0].slice(m[1].length).trimStart() : m[0];
    const noFim = /^[\s.!?,;:]*$/.test(texto.slice(fim)), noComeco = /^\s*$/.test(texto.slice(0, ini));
    const semana = !/amanh/i.test(palavra);
    return { termo, prep, ini, fim, noFim, noComeco, due: dataDo(palavra, today),
      // dia da semana solto no meio da frase não é data ("a segunda via", "pela segunda vez")
      valido: !semana || !!prep || noFim || noComeco };
  });
  if (new Set(achados.map(a => a.due)).size > 1) return null; // dois dias diferentes: ambíguo
  const a = achados.find(x => x.valido);
  if (!a) return null;
  let title = (texto.slice(0, a.ini) + ' ' + texto.slice(a.fim)).replace(/^[\s,;:.-]+|[\s,;:-]+$/g, '').replace(/\s+/g, ' ');
  if (a.noComeco && /^\p{Lu}/u.test(texto.trim())) title = title.charAt(0).toLocaleUpperCase('pt-BR') + title.slice(1);
  const clear = (a.noFim || a.noComeco) && a.prep !== 'de' && title.length > 0 && achados.length === 1;
  return { due: a.due, termo: a.termo, clear, title: clear ? title : texto };
}
