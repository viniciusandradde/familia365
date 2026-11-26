// Metas para o FiscalFlow (contrato familia365.goal/v1). Módulo puro.
// Vale o sonho do painel com valor-alvo (target_cents); continuam valendo os itens da aba "Sonhos" com valor escrito
// no título ou nas notas ("R$ 6.000" ou "R$ 6.000,00"). Sem valor, não vai.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i;
const positive = v => Number.isSafeInteger(v) && v > 0;

export function moneyCents(s) {
  const m = String(s || '').match(MONEY);
  return m ? Math.round(parseFloat(m[1].replace(/\./g, '').replace(',', '.')) * 100) : 0;
}

export function goalsFile(items = [], dreams = []) {
  const goals = [], seen = new Set();
  for (const d of dreams || []) {
    if (!d || typeof d.id !== 'string' || seen.has(d.id) || !positive(d.target_cents)) continue;
    seen.add(d.id);
    const title = String(d.title || '').trim();
    goals.push({ id: d.id, name: title.slice(0, 80) || 'Sonho', target_cents: d.target_cents,
      saved_cents: Number.isSafeInteger(d.reserved_cents) && d.reserved_cents >= 0 ? d.reserved_cents : 0,
      due_date: DAY.test(d.due || '') ? d.due : '' });
  }
  for (const x of items || []) {
    if (!x || x.tab !== 'Sonhos' || typeof x.id !== 'string' || seen.has(x.id)) continue;
    const target = moneyCents(x.title) || moneyCents(x.notes);
    if (!positive(target)) continue;
    seen.add(x.id);
    goals.push({ id: x.id, name: String(x.title).replace(/R\$\s*[\d.,]+/i, '').trim().slice(0, 80) || x.title, target_cents: target,
      saved_cents: 0, due_date: DAY.test(x.due || '') ? x.due : '' });
  }
  return { format: 'familia365.goal', version: 1, goals };
}
