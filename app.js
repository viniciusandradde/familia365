'use strict';
const $=id=>document.getElementById(id), KEY='familia365-v1', tabs=['Hoje','Plano de vida','Família','Sonhos','Pendências','Revisão semanal'];let tab=tabs[0],editing=null,items=[];
function valid(x){return x&&typeof x.id==='string'&&typeof x.title==='string'&&x.title.length<=200&&tabs.includes(x.tab)&&typeof x.done==='boolean'&&['area','horizon','due','notes'].every(k=>typeof x[k]==='string');}
try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(!Array.isArray(data)||!data.every(valid))throw Error();items=data;}}catch{ $('status').textContent='Não foi possível ler os dados locais. Exporte ou preserve o armazenamento antes de continuar.'; $('form').hidden=true;}
function persist(next){try{localStorage.setItem(KEY,JSON.stringify(next));items=next;render();return true;}catch{$('status').textContent='Não foi possível salvar. Verifique o espaço disponível.';return false;}}
function reset(){editing=null;$('form').reset();$('save').textContent='Adicionar';$('cancel').hidden=true;}
function render(){ $('heading').textContent=tab;const list=$('list');list.replaceChildren();const shown=items.filter(x=>tab==='Hoje'?x.tab==='Hoje'||(!x.done&&x.due===new Date().toLocaleDateString('sv-SE')):x.tab===tab);$('summary').textContent=shown.filter(x=>!x.done).length+' em aberto · '+shown.filter(x=>x.done).length+' concluídos';for(const x of shown){const a=document.createElement('article'),h=document.createElement('strong'),meta=document.createElement('small'),p=document.createElement('p');h.textContent=x.title;h.className=x.done?'done':'';meta.textContent=[x.area,x.horizon,x.due].filter(Boolean).join(' · ');p.textContent=x.notes;a.append(h,meta,p);for(const [label,fn] of [[x.done?'Reabrir':'Concluir',()=>persist(items.map(y=>y.id===x.id?{...y,done:!y.done}:y))],['Editar',()=>{editing=x.id;for(const k of ['title','area','horizon','due','notes'])$(k).value=x[k];$('save').textContent='Salvar edição';$('cancel').hidden=false;$('title').focus();}],['Excluir',()=>{if(confirm('Excluir este registro?'))persist(items.filter(y=>y.id!==x.id));}]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;a.append(b);}list.append(a);}for(const b of $('nav').children)b.setAttribute('aria-pressed',String(b.textContent===tab));}
for(const t of tabs){const b=document.createElement('button');b.textContent=t;b.onclick=()=>{tab=t;reset();render();};$('nav').append(b);}
$('date').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
$('form').onsubmit=e=>{e.preventDefault();const title=$('title').value.trim();if(!title)return;const old=items.find(x=>x.id===editing),x={id:old?.id||crypto.randomUUID(),tab:old?.tab||tab,done:old?.done||false,title};for(const k of ['area','horizon','due','notes'])x[k]=$(k).value;if(persist(old?items.map(y=>y.id===old.id?x:y):[...items,x]))reset();};$('cancel').onclick=reset;
$('export').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({version:1,items},null,2)],{type:'application/json'}));a.href=u;a.download='familia365-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw Error();const d=JSON.parse(await f.text());if(d.version!==1||!Array.isArray(d.items)||!d.items.every(valid)||new Set(d.items.map(x=>x.id)).size!==d.items.length)throw Error();if(confirm('Substituir todos os registros locais pelo backup?')){if(persist(d.items)){$('form').hidden=false;reset();$('status').textContent='Backup restaurado.';}}}catch{$('status').textContent='Backup inválido.';}finally{e.target.value='';}};
render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{$('status').textContent='Modo offline não disponível neste navegador.';});

function importLink(){
 const prefix='#import=';if(!location.hash.startsWith(prefix))return;
 try{
 if($('form').hidden)throw Error('Armazenamento indisponível');
 const raw=location.hash.slice(prefix.length);if(raw.length>30000)throw Error('Link muito grande');
 const d=JSON.parse(decodeURIComponent(raw));if(d.version!==1||!Array.isArray(d.items)||d.items.length>100||!d.items.every(x=>valid(x)&&x.id.length<=100&&x.notes.length<=4000&&x.title.trim())||new Set(d.items.map(x=>x.id)).size!==d.items.length)throw Error('Dados inválidos');
 const known=new Set(items.map(x=>x.id));const fresh=d.items.filter(x=>!known.has(x.id)).map(x=>({id:x.id,title:x.title,tab:x.tab,area:x.area,horizon:x.horizon,due:x.due,notes:x.notes,done:x.done}));
 if(!fresh.length){$('status').textContent='Registros já importados.';history.replaceState(null,'',location.pathname+location.search);return;}
 if(!confirm('Adicionar '+fresh.length+' registros ao Família365, preservando os atuais?\n\n'+fresh.map(x=>x.title).join('\n')))return;
 if(persist([...items,...fresh])){$('status').textContent=fresh.length+' registros adicionados.';history.replaceState(null,'',location.pathname+location.search);}
 }catch{$('status').textContent='Não foi possível importar este link. Nenhum registro foi alterado.';}
}
window.addEventListener('hashchange',importLink);importLink();
