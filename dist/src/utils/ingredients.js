export function formatAmount(value) {
  if (value == null || value === '') return '';
  const rounded = Math.round(Number(value) * 100) / 100;
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(rounded);
}

export function scaledIngredients(recipe, servings) {
  const factor = (Number(servings) || recipe.servings) / recipe.servings;
  return recipe.ingredients.map((x) => ({ ...x, amount: x.amount == null ? null : x.amount * factor }));
}

export function parseIngredient(line) {
  const clean = String(line || '').replace(/^[-•☐☑]\s*/, '').replace(/^(?:ca\.|etwa|approx\.?)\s+/i, '').trim();
  const match = clean.match(/^(\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*(.*)$/u);
  if (!match) return { amount: null, unit: '', name: clean };
  let amount = match[1].replace(/\s/g, '');
  const vulgar = { '¼':.25, '½':.5, '¾':.75, '⅓':1/3, '⅔':2/3, '⅛':.125, '⅜':.375, '⅝':.625, '⅞':.875 };
  const vulgarChar = [...amount].find((char) => vulgar[char]);
  if (vulgarChar) amount = Number(amount.replace(vulgarChar, '') || 0) + vulgar[vulgarChar];
  if (typeof amount === 'string' && amount.includes('/')) { const [a,b] = amount.split('/').map(Number); amount = b ? a / b : null; }
  else if (typeof amount === 'string' && amount) amount = Number(amount.replace(',', '.'));
  const rest = match[2].trim();
  const unitMatch = rest.match(/^(mg|g|kg|ml|cl|dl|l|Stück|Stk\.?|EL|TL|Dose[n]?|Packung(?:en)?|Päckchen|Pck\.?|Bund|Prise[n]?|Tasse[n]?|Zehe[n]?|Scheibe(?:\(n\)|n)?)\b\.?\s*(.*)$/iu);
  return { amount, unit: unitMatch?.[1] || '', name: (unitMatch?.[2] || rest).trim() };
}

const singular = (name) => name.toLocaleLowerCase('de').trim().replace(/(en|n|e)$/i, '');
export function mergeItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${singular(item.name)}|${item.unit.toLocaleLowerCase('de').trim()}`;
    const existing = map.get(key);
    if (existing && existing.amount != null && item.amount != null) existing.amount += Number(item.amount);
    else if (!existing) map.set(key, { ...item });
    else map.set(`${key}|${item.id}`, { ...item });
  }
  return [...map.values()];
}
