// Fotos dos sonhos no IndexedDB (API nativa). O sonho guarda só a referência (photo_ref); fotos antigas em base64
// (campo photo) continuam valendo e vão para o IndexedDB aos poucos. As funções de cima recebem um armazenamento
// { get(ref), put(ref, dataUrl), keys(), delete(ref) } e são testáveis no Node com um armazenamento falso.

// Backup: cada sonho sai com a foto em base64 no campo photo (o formato v2 de sempre) e sem photo_ref.
// Foto que não puder ser lida sai vazia e entra na contagem "faltando".
export async function fotosParaBackup(dreams, store) {
  let faltando = 0;
  const out = [];
  for (const d of dreams) {
    const { photo_ref, ...resto } = d;
    if (photo_ref && !resto.photo) {
      let foto = '';
      try { foto = (store && await store.get(photo_ref)) || ''; } catch { foto = ''; }
      if (!foto) faltando++;
      out.push({ ...resto, photo: foto });
    } else out.push(resto);
  }
  return { dreams: out, faltando };
}

// Leva para o IndexedDB as fotos em base64 (de um backup restaurado ou gravadas por versões antigas), no máximo
// "limite" por vez. Se gravar falhar, a foto continua em base64 no sonho: nada se perde.
export async function moverFotos(dreams, store, { limite = Infinity, novaRef = () => crypto.randomUUID() } = {}) {
  let movidas = 0;
  const out = [];
  for (const d of dreams) {
    if (d.photo && movidas < limite && store) {
      const ref = novaRef();
      try {
        await store.put(ref, d.photo);
        const { photo, ...resto } = d;
        out.push({ ...resto, photo: '', photo_ref: ref });
        movidas++;
        continue;
      } catch { /* fica em base64 */ }
    }
    out.push(d);
  }
  return { dreams: out, movidas };
}

// Referências guardadas no IndexedDB que nenhum sonho usa mais (nem a cópia de "Desfazer a última restauração").
export function fotosOrfas(keys, ...listas) {
  const usadas = new Set();
  for (const l of listas) for (const d of Array.isArray(l) ? l : []) if (d && typeof d.photo_ref === 'string') usadas.add(d.photo_ref);
  return keys.filter(k => !usadas.has(k));
}

// ---------- IndexedDB do navegador ----------
const DB = 'familia365-fotos', STORE = 'fotos';
const req = r => new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
export async function abrirFotos(idb = globalThis.indexedDB) {
  if (!idb) return null;
  const abrir = idb.open(DB, 1);
  abrir.onupgradeneeded = () => abrir.result.createObjectStore(STORE);
  const db = await req(abrir);
  const tx = modo => db.transaction(STORE, modo).objectStore(STORE);
  const escrever = op => new Promise((ok, falha) => {
    const t = db.transaction(STORE, 'readwrite');
    op(t.objectStore(STORE));
    t.oncomplete = () => ok();
    t.onerror = t.onabort = () => falha(t.error || Error('IndexedDB'));
  });
  return {
    get: ref => req(tx('readonly').get(ref)),
    keys: () => req(tx('readonly').getAllKeys()),
    put: (ref, dataUrl) => escrever(s => s.put(dataUrl, ref)),
    delete: ref => escrever(s => s.delete(ref)),
  };
}
