export const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function blankRecipe() {
  const now = new Date().toISOString();
  return { id: uid(), title: '', image: '', servings: 4, prepTime: 0, cookTime: 0, ingredients: [], instructions: [], tags: [], notes: '', favorite: false, source: { type: 'own', url: '' }, createdAt: now, updatedAt: now };
}

export function normalizeRecipe(input = {}) {
  const base = blankRecipe();
  return {
    ...base, ...input,
    id: input.id || base.id,
    title: String(input.title || '').trim(),
    servings: Math.max(1, Number(input.servings) || 1),
    prepTime: Math.max(0, Number(input.prepTime) || 0),
    cookTime: Math.max(0, Number(input.cookTime) || 0),
    ingredients: (input.ingredients || []).filter((x) => x?.name).map((x) => ({ amount: x.amount === '' || x.amount == null ? null : Number(x.amount), unit: String(x.unit || '').trim(), name: String(x.name).trim() })),
    instructions: (input.instructions || []).map(String).map((x) => x.trim()).filter(Boolean),
    tags: [...new Set((input.tags || []).map(String).map((x) => x.trim()).filter(Boolean))],
    source: { type: input.source?.type || 'own', url: input.source?.url || '' },
    updatedAt: new Date().toISOString()
  };
}

export const samples = [
  normalizeRecipe({
    id: 'sample-tomato-orzo', title: 'Geröstetes Tomaten-Orzo', servings: 4, prepTime: 10, cookTime: 25,
    image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=82',
    ingredients: [{ amount: 300, unit: 'g', name: 'Orzo' }, { amount: 500, unit: 'g', name: 'Cherrytomaten' }, { amount: 2, unit: 'Stück', name: 'Knoblauchzehen' }, { amount: 120, unit: 'g', name: 'Feta' }, { amount: 1, unit: 'Bund', name: 'Basilikum' }],
    instructions: ['Backofen auf 210 °C vorheizen und Tomaten mit Knoblauch rösten.', 'Orzo bissfest kochen und etwas Kochwasser aufheben.', 'Alles cremig vermengen, Feta darüberbröseln und mit Basilikum servieren.'],
    tags: ['vegetarisch', 'schnell', 'Abendessen'], notes: 'Ein unkompliziertes Feierabendgericht.', favorite: true, source: { type: 'own', url: '' }
  }),
  normalizeRecipe({
    id: 'sample-chickpea-curry', title: 'Kichererbsen-Curry', servings: 4, prepTime: 12, cookTime: 28,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=82',
    ingredients: [{ amount: 2, unit: 'Dose', name: 'Kichererbsen' }, { amount: 400, unit: 'ml', name: 'Kokosmilch' }, { amount: 1, unit: 'Stück', name: 'Zwiebel' }, { amount: 2, unit: 'EL', name: 'Currypaste' }, { amount: 150, unit: 'g', name: 'Spinat' }],
    instructions: ['Zwiebel fein schneiden und glasig braten.', 'Currypaste kurz mitrösten, Kichererbsen und Kokosmilch zugeben.', '20 Minuten köcheln lassen und zum Schluss den Spinat unterheben.'],
    tags: ['vegan', 'Curry', 'Meal Prep'], source: { type: 'own', url: '' }
  })
];
