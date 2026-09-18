import { icon } from './icons.js';

export const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const units = ['g', 'kg', 'ml', 'l', 'Stück', 'EL', 'TL', 'Dose', 'Packung', 'Bund'];

export function ingredientRow(item = { amount:'', unit:'', name:'' }, index = 0) {
  return `<div class="repeater-row ingredient-item" data-index="${index}"><div class="ingredient-fields">
    <input class="input ingredient-amount" inputmode="decimal" aria-label="Menge" placeholder="Menge" value="${esc(item.amount ?? '')}">
    <input class="input ingredient-unit" list="unit-options" aria-label="Einheit" placeholder="Einheit" value="${esc(item.unit)}">
    <input class="input ingredient-name name" aria-label="Zutat" placeholder="Zutat" value="${esc(item.name)}">
  </div><div class="row-actions"><button type="button" class="btn ghost tiny remove-row" aria-label="Zutat löschen">${icon('trash')}</button></div></div>`;
}

export function instructionRow(text = '', index = 0, total = 1) {
  return `<div class="repeater-row instruction-item" data-index="${index}"><textarea class="textarea instruction-text" rows="2" aria-label="Schritt ${index + 1}" placeholder="Zubereitungsschritt">${esc(text)}</textarea><div class="row-actions">
    <button type="button" class="btn ghost tiny move-up" aria-label="Nach oben" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn ghost tiny move-down" aria-label="Nach unten" ${index === total - 1 ? 'disabled' : ''}>↓</button><button type="button" class="btn ghost tiny remove-row" aria-label="Schritt löschen">${icon('trash')}</button>
  </div></div>`;
}

export function recipeEditor(recipe, { title = 'Rezept bearbeiten', notice = '' } = {}) {
  const ingredients = recipe.ingredients.length ? recipe.ingredients : [{ amount:'',unit:'',name:'' }];
  const steps = recipe.instructions.length ? recipe.instructions : [''];
  return `<form id="recipe-form" class="form-grid" data-id="${esc(recipe.id)}">
    ${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
    <div class="panel"><div class="panel-head"><h2>${esc(title)}</h2></div>
      <div class="form-grid">
        <div class="field"><label for="recipe-title">Titel *</label><input class="input" id="recipe-title" name="title" required maxlength="140" value="${esc(recipe.title)}" placeholder="z. B. Auberginen-Curry"></div>
        <div class="form-row two"><div class="field"><label for="image-url">Bild-URL</label><input class="input" id="image-url" name="image" type="url" value="${esc(recipe.image)}" placeholder="https://…"></div><div class="field"><label for="image-file">Eigenes Bild</label><input class="input" id="image-file" type="file" accept="image/*"><span class="hint">Wird automatisch verkleinert und lokal gespeichert.</span></div></div>
        <div class="form-row three"><div class="field"><label for="servings">Portionen</label><input class="input" id="servings" name="servings" type="number" min="1" value="${esc(recipe.servings)}"></div><div class="field"><label for="prep-time">Vorbereitung (Min.)</label><input class="input" id="prep-time" name="prepTime" type="number" min="0" value="${esc(recipe.prepTime)}"></div><div class="field"><label for="cook-time">Kochzeit (Min.)</label><input class="input" id="cook-time" name="cookTime" type="number" min="0" value="${esc(recipe.cookTime)}"></div></div>
        <div class="field"><label for="tags">Tags</label><input class="input" id="tags" name="tags" value="${esc(recipe.tags.join(', '))}" placeholder="vegan, schnell, Abendessen"></div>
      </div>
    </div>
    <div class="panel"><div class="panel-head"><h2>Zutaten</h2><button type="button" class="btn" id="add-ingredient">${icon('plus')} Zutat</button></div><datalist id="unit-options">${units.map(u=>`<option value="${esc(u)}">`).join('')}</datalist><div id="ingredients-editor">${ingredients.map(ingredientRow).join('')}</div></div>
    <div class="panel"><div class="panel-head"><h2>Zubereitung</h2><button type="button" class="btn" id="add-instruction">${icon('plus')} Schritt</button></div><div id="instructions-editor">${steps.map((x,i) => instructionRow(x,i,steps.length)).join('')}</div></div>
    <div class="panel"><div class="form-grid"><div class="field"><label for="notes">Notizen</label><textarea class="textarea" id="notes" name="notes" rows="4" placeholder="Varianten, Tipps, Erinnerungen…">${esc(recipe.notes)}</textarea></div><div class="form-row two"><div class="field"><label for="source-type">Quelle</label><select class="select" id="source-type" name="sourceType">${['own','website','youtube','instagram'].map(x=>`<option value="${x}" ${recipe.source.type===x?'selected':''}>${{own:'Eigenes Rezept',website:'Webseite',youtube:'YouTube',instagram:'Instagram'}[x]}</option>`).join('')}</select></div><div class="field"><label for="source-url">Quell-Link</label><input class="input" id="source-url" name="sourceUrl" type="url" value="${esc(recipe.source.url)}" placeholder="https://…"></div></div></div></div>
    <div class="form-actions"><a class="btn" href="#recipes">Abbrechen</a><button class="btn primary" type="submit">Rezept speichern</button></div>
  </form>`;
}

export function readRecipeForm(form, original) {
  const data = new FormData(form);
  return { ...original, title:data.get('title'), image:data.get('image'), servings:data.get('servings'), prepTime:data.get('prepTime'), cookTime:data.get('cookTime'), tags:String(data.get('tags')||'').split(','), notes:data.get('notes'),
    source:{ type:data.get('sourceType'), url:data.get('sourceUrl') },
    ingredients:[...form.querySelectorAll('.ingredient-item')].map((row)=>({ amount:row.querySelector('.ingredient-amount').value, unit:row.querySelector('.ingredient-unit').value, name:row.querySelector('.ingredient-name').value })),
    instructions:[...form.querySelectorAll('.instruction-text')].map((x)=>x.value)
  };
}
