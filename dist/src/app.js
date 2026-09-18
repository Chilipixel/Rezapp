import { db } from './storage/indexedDb.js';
import { blankRecipe, normalizeRecipe, samples, uid } from './models/recipe.js';
import { icon } from './components/icons.js';
import { esc, recipeEditor, readRecipeForm, ingredientRow, instructionRow } from './components/editor.js';
import { scaledIngredients, formatAmount, mergeItems, parseIngredient } from './utils/ingredients.js';
import { compressImage } from './utils/image.js';
import { importFromUrl, parseManualText } from './services/recipeImportService.js?v=1.1.0';
import { bringService } from './services/bringService.js?v=1.2.1';

const APP_VERSION = '1.2.1';
const state = { recipes:[], shopping:[], settings:{ id:'app', theme:'auto', defaultServings:4, bringEmail:'', bringPassword:'', bringList:'' }, search:'', tag:'all', favorites:false, sort:'updated', draft:null };
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const nav = [{id:'recipes',label:'Rezepte',icon:'recipes'},{id:'import',label:'Import',icon:'import'},{id:'shopping',label:'Einkauf',icon:'shopping'},{id:'settings',label:'Einstellungen',icon:'settings'}];

function route() {
  const raw = location.hash.slice(1) || 'recipes';
  const [page, id] = raw.split('/');
  return { page, id };
}
function navHtml() { const current=route().page; return nav.map(n=>`<a class="nav-link ${current===n.id?'active':''}" href="#${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join(''); }
function setChrome(title, eyebrow, action='') { $('#page-title').textContent=title; $('#eyebrow').textContent=eyebrow; $('#top-actions').innerHTML=action; $('.desktop-nav').innerHTML=navHtml(); $('.bottom-nav').innerHTML=navHtml(); }
function toast(message, type='') { const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; $('#toast-region').append(el); setTimeout(()=>el.remove(),3500); }
function showModal(html) { $('#modal-content').innerHTML=`<div class="modal-inner">${html}</div>`; $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function applyTheme() { const dark=state.settings.theme==='dark'||(state.settings.theme==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme=dark?'dark':'light'; $('meta[name="theme-color"]').content=dark?'#101714':'#f5f1e8'; }
const totalTime = r => Number(r.prepTime||0)+Number(r.cookTime||0);

async function init() {
  [state.recipes,state.shopping] = await Promise.all([db.all('recipes'),db.all('shopping')]);
  state.settings = await db.get('settings','app') || state.settings;
  if (!state.recipes.length && !localStorage.getItem('mise-initialized')) { for (const recipe of samples) await db.put('recipes',recipe); state.recipes=[...samples]; localStorage.setItem('mise-initialized','1'); }
  applyTheme(); render();
  addEventListener('hashchange',render);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state.settings.theme==='auto')applyTheme()});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function recipeCard(recipe) {
  return `<article class="recipe-card"><img class="card-image" src="${esc(recipe.image || './assets/placeholder.svg')}" alt="" loading="lazy"><button class="card-hit" data-open="${esc(recipe.id)}">${esc(recipe.title)} öffnen</button><button class="favorite ${recipe.favorite?'on':''}" data-favorite="${esc(recipe.id)}" aria-label="${recipe.favorite?'Favorit entfernen':'Als Favorit markieren'}">${recipe.favorite?'♥':'♡'}</button><div class="card-body"><h2 class="card-title">${esc(recipe.title)}</h2><div class="card-meta">${totalTime(recipe)?`<span>${icon('clock')} ${totalTime(recipe)} Min.</span>`:''}<span>${icon('people')} ${recipe.servings}</span></div><div class="tags">${recipe.tags.slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div></article>`;
}

function renderRecipes() {
  setChrome('Rezepte','Deine Sammlung',`<a class="btn primary" href="#new">${icon('plus')} <span>Neu</span></a>`);
  const tags=[...new Set(state.recipes.flatMap(r=>r.tags))].sort((a,b)=>a.localeCompare(b,'de'));
  const term=state.search.toLocaleLowerCase('de');
  let filtered=state.recipes.filter(r=>(!term||[r.title,...r.tags,...r.ingredients.map(x=>x.name)].join(' ').toLocaleLowerCase('de').includes(term))&&(state.tag==='all'||r.tags.includes(state.tag))&&(!state.favorites||r.favorite));
  filtered.sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title,'de'):state.sort==='time'?totalTime(a)-totalTime(b):new Date(b.updatedAt)-new Date(a.updatedAt));
  $('#view').innerHTML=`<div class="toolbar"><div class="search-wrap">${icon('search')}<input id="search" class="input" type="search" placeholder="Rezepte, Tags oder Zutaten suchen" value="${esc(state.search)}"></div><select id="sort" class="select" aria-label="Sortierung"><option value="updated" ${state.sort==='updated'?'selected':''}>Zuletzt geändert</option><option value="title" ${state.sort==='title'?'selected':''}>Titel A–Z</option><option value="time" ${state.sort==='time'?'selected':''}>Kürzeste Zeit</option></select></div><div class="filters"><button class="chip ${state.tag==='all'?'active':''}" data-tag="all">Alle ${state.recipes.length}</button><button class="chip ${state.favorites?'active':''}" id="favorites-filter">♥ Favoriten</button>${tags.map(t=>`<button class="chip ${state.tag===t?'active':''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div><div class="recipe-grid">${filtered.length?filtered.map(recipeCard).join(''):`<div class="empty"><h2>Nichts gefunden</h2><p>Probiere einen anderen Suchbegriff oder lege ein neues Rezept an.</p><a class="btn primary" href="#new">${icon('plus')} Neues Rezept</a></div>`}</div>`;
  $('#search').addEventListener('input',e=>{state.search=e.target.value;renderRecipes()}); $('#sort').onchange=e=>{state.sort=e.target.value;renderRecipes()};
  $$('#view [data-tag]').forEach(b=>b.onclick=()=>{state.tag=b.dataset.tag;renderRecipes()}); $('#favorites-filter').onclick=()=>{state.favorites=!state.favorites;renderRecipes()};
  $$('#view [data-open]').forEach(b=>b.onclick=()=>location.hash=`#recipe/${b.dataset.open}`);
  $$('#view [data-favorite]').forEach(b=>b.onclick=async()=>{const r=state.recipes.find(x=>x.id===b.dataset.favorite);r.favorite=!r.favorite;r.updatedAt=new Date().toISOString();await db.put('recipes',r);renderRecipes()});
}

function renderDetail(id) {
  const recipe=state.recipes.find(r=>r.id===id); if(!recipe){location.hash='#recipes';return}
  setChrome(recipe.title,'Rezept',`<button class="btn icon" id="detail-more" aria-label="Weitere Aktionen">${icon('more')}</button>`);
  const servings=Number(sessionStorage.getItem(`servings-${id}`))||recipe.servings; const ingredients=scaledIngredients(recipe,servings);
  const bringUrl=bringService.recipeImportUrl(recipe.source.url,recipe.servings,servings);
  $('#view').innerHTML=`<a class="btn ghost" href="#recipes">${icon('back')} Zurück</a><article class="panel" style="margin-top:16px">${recipe.image?`<img class="detail-cover" src="${esc(recipe.image)}" alt="${esc(recipe.title)}">`:''}<div class="tags">${recipe.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><h2 class="detail-title">${esc(recipe.title)}</h2><div class="detail-facts">${recipe.prepTime?`<span class="fact">${recipe.prepTime} Min. Vorbereitung</span>`:''}${recipe.cookTime?`<span class="fact">${recipe.cookTime} Min. Kochen</span>`:''}<label class="fact">Portionen <select id="servings-detail" aria-label="Portionen">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option ${n===servings?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="detail-layout"><section><div class="panel-head"><h2>Zutaten</h2></div><ul class="ingredient-list">${ingredients.map(x=>`<li class="ingredient-row"><strong class="amount">${formatAmount(x.amount)} ${esc(x.unit)}</strong><span>${esc(x.name)}</span></li>`).join('')}</ul><div class="form-actions" style="margin-top:20px"><button class="btn primary" id="add-to-shopping">${icon('shopping')} Zu Einkauf hinzufügen</button>${bringUrl?`<a class="btn" href="${esc(bringUrl)}" target="_blank" rel="noopener">Rezept in Bring! importieren ↗</a>`:''}</div></section><section><h2>Zubereitung</h2><ol class="step-list">${recipe.instructions.map((x,i)=>`<li class="step"><span class="step-num">${i+1}</span><span>${esc(x)}</span></li>`).join('')}</ol>${recipe.notes?`<div class="notice" style="margin-top:20px"><strong>Notiz</strong><br>${esc(recipe.notes)}</div>`:''}${recipe.source.url?`<p style="margin-top:22px"><a href="${esc(recipe.source.url)}" target="_blank" rel="noopener">Originalquelle öffnen ↗</a></p>`:''}</section></div></article>`;
  $('#servings-detail').onchange=e=>{sessionStorage.setItem(`servings-${id}`,e.target.value);renderDetail(id)}; $('#add-to-shopping').onclick=()=>showIngredientPicker(recipe,ingredients);
  $('#detail-more').onclick=()=>showModal(`<div class="modal-head"><h2>Rezeptaktionen</h2><button class="btn icon" data-close>${icon('close')}</button></div><div class="form-grid"><a class="btn" href="#edit/${id}">${icon('edit')} Bearbeiten</a><button class="btn" id="duplicate">${icon('copy')} Duplizieren</button><button class="btn danger" id="delete-recipe">${icon('trash')} Rezept löschen</button></div>`);
  $('#modal-content [data-close]')?.addEventListener('click',closeModal); $('#duplicate')?.addEventListener('click',async()=>{const copy=normalizeRecipe({...recipe,id:uid(),title:`${recipe.title} (Kopie)`,createdAt:new Date().toISOString()});await db.put('recipes',copy);state.recipes.push(copy);closeModal();location.hash=`#edit/${copy.id}`}); $('#delete-recipe')?.addEventListener('click',async()=>{if(confirm(`„${recipe.title}“ wirklich löschen?`)){await db.delete('recipes',id);state.recipes=state.recipes.filter(x=>x.id!==id);closeModal();location.hash='#recipes';toast('Rezept gelöscht.')}});
}

function showIngredientPicker(recipe, ingredients) {
  showModal(`<div class="modal-head"><div><p class="eyebrow">${esc(recipe.title)}</p><h2>Zutaten auswählen</h2></div><button class="btn icon" data-close>${icon('close')}</button></div><div class="shopping-list">${ingredients.map((x,i)=>`<label class="shopping-row"><input class="checkbox pick-ingredient" type="checkbox" value="${i}" checked><span><strong>${formatAmount(x.amount)} ${esc(x.unit)}</strong> ${esc(x.name)}</span></label>`).join('')}</div><div class="modal-actions"><button class="btn" id="pick-bring">Für Bring! kopieren</button><button class="btn primary" id="pick-internal">Zur Einkaufsliste</button></div>`);
  $('[data-close]',$('#modal')).onclick=closeModal; const chosen=()=>$$('.pick-ingredient:checked',$('#modal')).map(x=>ingredients[Number(x.value)]);
  $('#pick-internal').onclick=async()=>{await addShopping(chosen(),recipe.title);closeModal();toast('Zur Einkaufsliste hinzugefügt.')};
  $('#pick-bring').onclick=async()=>{try{const msg=await bringService.copyItems(chosen());closeModal();toast(msg)}catch(e){toast(e.message,'error')}};
}

async function addShopping(items, recipeTitle='Manuell') {
  const incoming=items.map(x=>({...x,id:uid(),checked:false,source:recipeTitle,createdAt:new Date().toISOString()}));
  const merged=mergeItems([...state.shopping,...incoming]); await db.clear('shopping'); for(const x of merged)await db.put('shopping',x); state.shopping=merged;
}

function bindEditor(recipe) {
  $('#add-ingredient').onclick=()=>$('#ingredients-editor').insertAdjacentHTML('beforeend',ingredientRow());
  $('#add-instruction').onclick=()=>{const n=$$('.instruction-item').length;$('#instructions-editor').insertAdjacentHTML('beforeend',instructionRow('',n,n+1));refreshStepButtons()};
  $('#view').onclick=e=>{const remove=e.target.closest('.remove-row');if(remove){remove.closest('.repeater-row').remove();refreshStepButtons()}const move=e.target.closest('.move-up,.move-down');if(move){const row=move.closest('.instruction-item');const sibling=move.classList.contains('move-up')?row.previousElementSibling:row.nextElementSibling;if(sibling)row.parentNode.insertBefore(move.classList.contains('move-up')?row:sibling,move.classList.contains('move-up')?sibling:row);refreshStepButtons()}};
  $('#image-file').onchange=async e=>{try{$('#image-url').value=await compressImage(e.target.files[0]);toast('Bild lokal optimiert.')}catch(err){toast(err.message,'error')}};
  $('#recipe-form').onsubmit=async e=>{e.preventDefault();const saved=normalizeRecipe(readRecipeForm(e.currentTarget,recipe));if(!saved.title)return;await db.put('recipes',saved);const i=state.recipes.findIndex(x=>x.id===saved.id);if(i>=0)state.recipes[i]=saved;else state.recipes.push(saved);state.draft=null;toast('Rezept gespeichert.');location.hash=`#recipe/${saved.id}`};
}
function refreshStepButtons(){const rows=$$('.instruction-item');rows.forEach((r,i)=>{r.dataset.index=i;$('.move-up',r).disabled=i===0;$('.move-down',r).disabled=i===rows.length-1})}
function renderEditor(id, draft=null) { const original=draft||state.recipes.find(r=>r.id===id)||blankRecipe(); setChrome(original.title||'Neues Rezept',draft?'Import prüfen':id?'Bearbeiten':'Eigenes Rezept'); $('#view').innerHTML=recipeEditor(original,{title:draft?'Import-Vorschau':id?'Rezept bearbeiten':'Neues Rezept',notice:draft?draft._warning:''}); bindEditor(original); }

function renderImport() {
  setChrome('Importieren','Aus Link oder Text'); $('#view').innerHTML=`<div class="detail-layout"><section class="panel"><div class="source-card"><div class="source-icon">${icon('import')}</div><div><h2>Rezept-Link</h2><p class="hint">Funktioniert mit beliebigen öffentlichen Rezeptseiten: zuerst direkt per Schema.org, bei CORS über Jina Reader und bei fehlenden Rezeptdaten über die erkannten Zutaten- und Zubereitungsabschnitte.</p></div></div><form id="url-import" class="form-grid"><input class="input" name="url" type="url" required placeholder="https://…"><button class="btn primary" type="submit">Link analysieren</button></form><p class="hint">Beim Fallback wird nur der öffentliche Link an Jina Reader übertragen. Deine gespeicherten Daten bleiben lokal.</p><div id="import-status"></div></section><section class="panel"><h2>Text manuell übernehmen</h2><p class="hint">Füge Titel, Caption, Zutaten und nummerierte Schritte ein. Du kannst alles vor dem Speichern korrigieren.</p><form id="text-import" class="form-grid"><input class="input" name="url" type="url" placeholder="Quell-Link (optional)"><textarea class="textarea" name="text" rows="12" required placeholder="Gerichtstitel&#10;&#10;250 g Tofu&#10;1 Stück Zwiebel&#10;&#10;1. Zwiebel schneiden&#10;2. Tofu anbraten"></textarea><button class="btn" type="submit">Text übernehmen</button></form></section></div>`;
  $('#url-import').onsubmit=async e=>{e.preventDefault();const url=new FormData(e.currentTarget).get('url');$('#import-status').innerHTML='<p class="notice">Link wird geprüft…</p>';try{const result=await importFromUrl(url);result.recipe._warning=result.warning||'';state.draft=result.recipe;renderEditor(null,state.draft)}catch(error){$('#import-status').innerHTML=`<p class="notice error">${esc(error.message)}</p>`}};
  $('#text-import').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget);state.draft=parseManualText(d.get('text'),d.get('url'));renderEditor(null,state.draft)};
}

function renderShopping() {
  setChrome('Einkauf',`${state.shopping.filter(x=>!x.checked).length} offen`,`<button class="btn primary" id="add-shopping">${icon('plus')} Hinzufügen</button>`);
  const open=state.shopping.filter(x=>!x.checked),done=state.shopping.filter(x=>x.checked); const row=x=>`<li class="shopping-row ${x.checked?'checked':''}" data-id="${x.id}"><input class="checkbox shopping-check" type="checkbox" ${x.checked?'checked':''} aria-label="${esc(x.name)} abhaken"><span><strong>${formatAmount(x.amount)} ${esc(x.unit)}</strong> ${esc(x.name)}<br><small>${esc(x.source||'Manuell')}</small></span><div class="row-actions"><button class="btn ghost tiny edit-shopping" aria-label="Bearbeiten">${icon('edit')}</button><button class="btn ghost tiny delete-shopping" aria-label="Löschen">${icon('trash')}</button></div></li>`;
  $('#view').innerHTML=`<div class="panel"><div class="panel-head"><h2>Auf der Liste</h2><span>${open.length} Zutaten</span></div>${open.length?`<ul class="shopping-list">${open.map(row).join('')}</ul>`:`<div class="empty"><h2>Liste ist leer</h2><p>Füge Zutaten aus einem Rezept oder direkt hier hinzu.</p></div>`}<div class="form-actions"><button class="btn" id="clear-checked" ${done.length?'':'disabled'}>Erledigte entfernen</button><button class="btn primary" id="send-bring" ${open.length?'':'disabled'}>Für Bring! kopieren</button></div></div>${done.length?`<div class="panel"><div class="panel-head"><h2>Erledigt</h2><span>${done.length}</span></div><ul class="shopping-list">${done.map(row).join('')}</ul></div>`:''}`;
  $('#add-shopping').onclick=()=>shoppingModal(); $$('.shopping-check').forEach(c=>c.onchange=async()=>{const item=state.shopping.find(x=>x.id===c.closest('[data-id]').dataset.id);item.checked=c.checked;await db.put('shopping',item);renderShopping()});
  $$('.delete-shopping').forEach(b=>b.onclick=async()=>{const id=b.closest('[data-id]').dataset.id;await db.delete('shopping',id);state.shopping=state.shopping.filter(x=>x.id!==id);renderShopping()});
  $$('.edit-shopping').forEach(b=>b.onclick=()=>shoppingModal(state.shopping.find(x=>x.id===b.closest('[data-id]').dataset.id)));
  $('#clear-checked').onclick=async()=>{for(const x of done)await db.delete('shopping',x.id);state.shopping=open;renderShopping()};
  $('#send-bring').onclick=async()=>{try{toast(await bringService.copyItems(open))}catch(e){toast(e.message,'error')}};
}
function shoppingModal(item={id:uid(),amount:'',unit:'',name:'',checked:false,source:'Manuell'}){showModal(`<div class="modal-head"><h2>Zutat ${item.name?'bearbeiten':'hinzufügen'}</h2><button class="btn icon" data-close>${icon('close')}</button></div><form id="shopping-form" class="form-grid"><div class="form-row three"><input class="input" name="amount" inputmode="decimal" placeholder="Menge" value="${esc(item.amount??'')}"><input class="input" name="unit" placeholder="Einheit" value="${esc(item.unit)}"><input class="input" name="name" required placeholder="Zutat" value="${esc(item.name)}"></div><div class="modal-actions"><button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary">Speichern</button></div></form>`);$$('[data-close]',$('#modal')).forEach(b=>b.onclick=closeModal);$('#shopping-form').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);const saved={...item,amount:d.get('amount')===''?null:Number(String(d.get('amount')).replace(',','.')),unit:d.get('unit'),name:d.get('name')};await db.put('shopping',saved);const i=state.shopping.findIndex(x=>x.id===saved.id);i>=0?state.shopping[i]=saved:state.shopping.push(saved);closeModal();renderShopping()}}

function renderSettings() {
  setChrome('Einstellungen','App & Daten'); $('#view').innerHTML=`<div class="settings-grid"><section class="panel"><h2>Darstellung</h2><div class="setting-row"><div><h3>Farbschema</h3><p>Folgt auf Wunsch deinem Gerät.</p></div><select class="select" id="theme"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></div><div class="setting-row"><div><h3>Standard-Portionen</h3><p>Für neue eigene Rezepte.</p></div><input class="input" id="default-servings" type="number" min="1" max="24" value="${state.settings.defaultServings}" style="max-width:110px"></div></section><section class="panel"><h2>Bring!</h2><div class="notice"><strong>Zwei zuverlässige Wege</strong><br>Bei importierten Rezepten mit öffentlicher Quellseite öffnet Rezapp den offiziellen Bring!-Rezeptimport. Eigene und ausgewählte Zutaten kopiert Rezapp in die Zwischenablage, damit du sie anschließend in Bring! einfügen kannst. Das Teilen-Menü wird nicht mehr verwendet, weil Bring! dort nur Rezeptlinks und keinen freien Zutatentext akzeptiert.</div><div class="form-actions" style="margin-top:16px"><button class="btn" id="test-bring">Kopieren prüfen</button><a class="btn" href="${bringService.webUrl}" target="_blank" rel="noopener">Bring! Web öffnen ↗</a></div><p class="hint" style="margin-top:12px">Rezapp speichert keine Bring!-Zugangsdaten und sendet sie auch an keinen Drittanbieter.</p></section><section class="panel"><h2>Datensicherung</h2><p class="hint">Die JSON-Sicherung enthält alle lokalen Rezepte, Bilder, Einstellungen und die Einkaufsliste. Bewahre sie sicher auf.</p><div class="form-grid"><button class="btn" id="export">${icon('download')} Backup exportieren</button><button class="btn" id="import-backup">${icon('upload')} Backup importieren</button><button class="btn danger" id="clear-data">${icon('trash')} Lokale Daten löschen</button></div></section><section class="panel"><h2>Über Rezapp</h2><div class="setting-row"><div><h3>Installierbare Offline-App</h3><p>Deine Daten verlassen dieses Gerät nicht.</p></div><strong>Version ${APP_VERSION}</strong></div></section></div>`;
  $('#theme').value=state.settings.theme; const save=async()=>{await db.put('settings',state.settings)}; $('#theme').onchange=async e=>{state.settings.theme=e.target.value;applyTheme();await save()}; $('#default-servings').onchange=async e=>{state.settings.defaultServings=Math.max(1,Number(e.target.value)||4);await save()};
  $('#test-bring').onclick=async()=>{try{toast(await bringService.testConnection())}catch(e){toast(e.message,'error')}};
  $('#export').onclick=exportBackup; $('#import-backup').onclick=()=>$('#backup-file').click(); $('#clear-data').onclick=async()=>{if(confirm('Alle Rezepte, Bilder, Einstellungen und Einkaufsdaten auf diesem Gerät löschen?')){await db.clearAll();localStorage.removeItem('mise-initialized');location.reload()}};
}

async function exportBackup(){const data=await db.exportAll();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`rezapp-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('Backup exportiert.')}
$('#backup-file').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());await db.importAll(data);toast('Backup importiert.');setTimeout(()=>location.reload(),700)}catch(err){toast(err.message||'Backup konnte nicht gelesen werden.','error')}e.target.value=''};

function render(){window.scrollTo({top:0});const {page,id}=route();if(page==='recipes')renderRecipes();else if(page==='recipe')renderDetail(id);else if(page==='new'){const r=blankRecipe();r.servings=state.settings.defaultServings;renderEditor(null,r)}else if(page==='edit')renderEditor(id);else if(page==='import')renderImport();else if(page==='shopping')renderShopping();else if(page==='settings')renderSettings();else{location.hash='#recipes'}}
init().catch(err=>{$('#view').innerHTML=`<div class="notice error">Die lokalen Daten konnten nicht geöffnet werden: ${esc(err.message)}</div>`});
