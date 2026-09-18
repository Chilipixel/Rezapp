import { blankRecipe, normalizeRecipe } from '../models/recipe.js';
import { parseIngredient } from '../utils/ingredients.js';

const durationMinutes = (value) => {
  if (!value) return 0;
  const match = String(value).match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  return match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) : Number.parseInt(value, 10) || 0;
};

const instructions = (value) => (Array.isArray(value) ? value : [value]).flatMap((item) => {
  if (typeof item === 'string') return item.split(/\n\s*\n/);
  if (item?.itemListElement) return instructions(item.itemListElement);
  return item?.text || item?.name || [];
}).map((x) => String(x).replace(/<[^>]+>/g, '').trim()).filter(Boolean);

function findRecipeJson(value) {
  const list = Array.isArray(value) ? value : [value];
  for (const item of list) {
    if (!item) continue;
    if (Array.isArray(item['@graph'])) { const found = findRecipeJson(item['@graph']); if (found) return found; }
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    if (types.some((x) => String(x).toLowerCase() === 'recipe')) return item;
  }
  return null;
}

function fromJsonLd(data, url) {
  const imageValue = Array.isArray(data.image) ? data.image[0] : data.image;
  const image = typeof imageValue === 'object' ? imageValue?.url || imageValue?.contentUrl : imageValue;
  const prepTime = durationMinutes(data.prepTime);
  const totalTime = durationMinutes(data.totalTime);
  const cookTime = durationMinutes(data.cookTime) || Math.max(0, totalTime - prepTime);
  const tagText = [data.keywords, data.recipeCategory].flat().filter(Boolean).join(',');
  return normalizeRecipe({
    ...blankRecipe(), title: data.name || '', image: image || '', servings: Number.parseInt(data.recipeYield, 10) || 4,
    prepTime, cookTime,
    ingredients: (data.recipeIngredient || []).map(parseIngredient), instructions: instructions(data.recipeInstructions),
    tags: tagText.split(',').map((x) => x.trim()).filter(Boolean),
    source: { type: 'website', url }
  });
}

const cleanMarkdown = (value) => String(value || '')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export function parseReaderText(text, url) {
  const lines = String(text || '').split(/\r?\n/);
  const headingText = (line) => cleanMarkdown(line.replace(/^#{1,6}\s+/, '')).replace(/:\s*$/, '');
  const headingLevel = (line) => line.match(/^(#{1,6})\s+/)?.[1].length || 0;
  const isIngredientHeading = (line) => /^(Zutaten|Ingredients?|Ingrédients?|Ingredientes|Ingredienti|Ingrediënten)\b/i.test(headingText(line));
  const isInstructionHeading = (line) => /^(Zubereitung(?:sschritte)?|Anleitung|Instructions?|Directions?|Method|Preparation|Preparación|Preparazione|Bereiding)$/i.test(headingText(line));
  const isHeading = (line) => /^#{1,6}\s+/.test(line);
  const documentTitle = cleanMarkdown(lines.find((line) => /^Title:\s*/i.test(line))?.replace(/^Title:\s*/i, '') || '');
  const h1Titles = lines.filter((line) => /^#\s+\S/.test(line)).map((line) => cleanMarkdown(line.replace(/^#\s+/, '')));
  const title = h1Titles.find((candidate) => documentTitle.toLocaleLowerCase().includes(candidate.toLocaleLowerCase())) || documentTitle || h1Titles[0] || '';
  const mainHeading = lines.findIndex((line) => /^#\s+/.test(line) && cleanMarkdown(line.replace(/^#\s+/, '')) === title);
  const imageWindow = lines.slice(Math.max(0, mainHeading - 24), mainHeading + 60).join('\n');
  const imageMatches = [...imageWindow.matchAll(/!\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/gi)]
    .filter((match) => !/(?:icon|logo|heart|avatar|sprite|placeholder)[./_-]/i.test(match[2]));
  const imageUrl = imageMatches.find((match) => cleanMarkdown(match[1]).toLocaleLowerCase().includes(title.toLocaleLowerCase()))?.[2]
    || imageMatches.find((match) => /\.(?:jpe?g|png|webp|avif)(?:\?|$)/i.test(match[2]))?.[2]
    || imageMatches[0]?.[2] || '';
  const ingredientHeading = lines.findIndex(isIngredientHeading);
  const instructionHeading = lines.findIndex((line, index) => index > ingredientHeading && isInstructionHeading(line));
  const ingredientLevel = headingLevel(lines[ingredientHeading] || '');
  const nextHeadingAfterIngredients = lines.findIndex((line, index) => index > ingredientHeading && isHeading(line) && headingLevel(line) <= ingredientLevel);
  const ingredientEnd = Math.min(
    instructionHeading >= 0 ? instructionHeading : lines.length,
    nextHeadingAfterIngredients >= 0 ? nextHeadingAfterIngredients : lines.length
  );
  const ingredientLines = [];
  let lastIngredientLine = -1;
  if (ingredientHeading >= 0) {
    const section = lines.slice(ingredientHeading + 1, ingredientEnd);
    const tableRows = section.map((line, offset) => ({ line, offset })).filter(({ line }) => /^\s*\|.*\|\s*$/.test(line) && !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line));
    const hasList = section.some((line) => /^\s*(?:[*+-]|\d+[.)])\s+/.test(line));
    if (tableRows.length) {
      for (const { line, offset } of tableRows) {
        const cells = line.split('|').slice(1, -1).map(cleanMarkdown);
        if (!cells.some(Boolean) || cells.some((cell) => /^(Menge|Zutaten|Amount|Ingredients?)$/i.test(cell))) continue;
        const item = cells.length > 1 ? `${cells[0]} ${cells.slice(1).join(' ')}`.trim() : cells[0];
        if (item) { ingredientLines.push(item); lastIngredientLine = ingredientHeading + 1 + offset; }
      }
    } else {
    for (let offset = 0; offset < section.length; offset += 1) {
      const raw = section[offset];
      if (!raw.trim() || /^!\[/.test(raw.trim())) continue;
      if (hasList && !/^\s*(?:[*+-]|\d+[.)])\s+/.test(raw)) continue;
      const item = cleanMarkdown(raw.replace(/^\s*(?:[*+-]|\d+[.)])\s+/, ''));
      if (item && !/^\d+\s+(?:Stück(?:e)?|Person(?:en)?|Portion(?:en)?|servings?)$/i.test(item) && !/(?:Zutaten\s+online\s+bestellen|zurücksetzen|umrechnen|calculator)$/i.test(item)) {
        ingredientLines.push(item); lastIngredientLine = ingredientHeading + 1 + offset;
      }
    }
    }
  }
  const steps = [];
  const instructionLevel = headingLevel(lines[instructionHeading] || '');
  const instructionEnd = instructionHeading >= 0
    ? lines.findIndex((line, index) => index > instructionHeading && isHeading(line) && headingLevel(line) <= instructionLevel)
    : nextHeadingAfterIngredients;
  const stepsStart = instructionHeading >= 0 ? instructionHeading + 1 : lastIngredientLine >= 0 ? lastIngredientLine + 1 : ingredientEnd;
  if (stepsStart >= 0) {
    const sectionEnd = instructionEnd >= 0 ? instructionEnd : lines.length;
    const section = lines.slice(stepsStart, sectionEnd);
    const numbered = section.filter((line) => /^\s*\d+[.)]\s+/.test(line));
    const bullets = section.filter((line) => /^\s*[*+-]\s+/.test(line) && !/^\s*[*+-]\s+\[/.test(line));
    const prose = section.filter((line) => {
      const clean = cleanMarkdown(line);
      return line.trim() && !isHeading(line) && !/^\s*(?:[*+-]|\d+[.)])\s+/.test(line) && !/^\s*\|/.test(line) && !/^!\[/.test(line.trim())
        && clean.split(/\s+/).length >= 5 && /[.!?]$/.test(clean)
        && !/(?:hat es dir geschmeckt|bewerte das rezept|zur bewertung|feedback)/i.test(clean);
    });
    const sentenceBullets = bullets.filter((line) => cleanMarkdown(line).split(/\s+/).length >= 5 && /[.!?]$/.test(cleanMarkdown(line)));
    const candidates = numbered.length ? numbered : prose.length ? prose : sentenceBullets.length ? sentenceBullets : bullets.length ? bullets : section.filter((line) => line.trim() && !isHeading(line) && !/^\s*\|/.test(line) && !/^!\[/.test(line.trim()));
    for (const raw of candidates) {
      const step = cleanMarkdown(raw.replace(/^\s*(?:[*+-]|\d+[.)])\s+/, ''));
      if (step) steps.push(step);
    }
  }
  const beforeIngredients = lines.slice(0, ingredientHeading >= 0 ? ingredientHeading : lines.length).join('\n');
  const timeMatch = beforeIngredients.match(/(?:Zubereitungszeit|Gesamtzeit|Total Time)\s*:\s*(\d+)\s*(Min|minutes?|Std|Stunden?|hours?)/i);
  const reverseTotalMatch = beforeIngredients.match(/(?:(\d+)\s*h\s*)?(\d+)?\s*min\s*(?:Gesamtzeit|Total Time)/i);
  const reversePrepMatch = beforeIngredients.match(/(?:(\d+)\s*h\s*)?(\d+)?\s*min\s*(?:Zubereitung(?:szeit)?|Vorbereitung|Prep(?:aration)?)/i);
  const servingsMatch = beforeIngredients.match(/(\d+)\s*(?:Person(?:en)?|Portion(?:en)?|servings?)|(?:Serves|Yield|Ergibt)\s*:?[ ]*(\d+)/i);
  const ingredientIntro = lines.slice(ingredientHeading + 1, Math.min(ingredientEnd, ingredientHeading + 30)).join('\n');
  const piecesMatch = `${headingText(lines[ingredientHeading] || '')}\n${ingredientIntro}`.match(/(?:für\s+)?(\d+)\s+(?:Stück(?:e)?|pieces?)\b/i);
  const preparationMatch = String(text).match(/(?:Zubereiten|Zubereitung(?:szeit)?|Vorbereitung|Prep(?:aration)?)\s*:?[ ]*(\d+)\s*(?:min|minutes?)\b/i);
  const cookingMatch = String(text).match(/(?:Kochen(?:\/Backen)?|Backen|Cooking?|Baking?)\s*:?[ ]*(\d+)\s*(?:min|minutes?)\b/i);
  const prepMinutes = (Number(reversePrepMatch?.[1] || 0) * 60 + Number(reversePrepMatch?.[2] || 0)) || Number(preparationMatch?.[1]) || 0;
  const totalMinutes = timeMatch ? Number(timeMatch[1]) * (/^(Std|Stunden?|hours?)$/i.test(timeMatch[2]) ? 60 : 1) : (Number(reverseTotalMatch?.[1] || 0) * 60 + Number(reverseTotalMatch?.[2] || 0));
  const cookMinutes = Number(cookingMatch?.[1]) || Math.max(0, totalMinutes - prepMinutes);
  if (!title || !ingredientLines.length) throw new Error('Reader lieferte kein erkennbares Rezept.');
  return normalizeRecipe({
    ...blankRecipe(), title, image: imageUrl, servings: Number(servingsMatch?.[1] || servingsMatch?.[2] || piecesMatch?.[1]) || 4,
    prepTime: prepMinutes,
    cookTime: cookMinutes,
    ingredients: ingredientLines.map(parseIngredient), instructions: steps,
    source: { type: 'website', url }
  });
}

export function parseHtmlRecipe(html, url) {
  const scripts = String(html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try { const found = findRecipeJson(JSON.parse(match[1])); if (found) return fromJsonLd(found, url); } catch {}
  }
  return null;
}

export function parseHtmlMetadata(html) {
  const values = {};
  for (const match of String(html || '').matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]
      ?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (key && content && !values[key]) values[key] = content;
  }
  return { title: values['og:title'] || values.title || '', image: values['og:image'] || values['twitter:image'] || '', keywords: values.keywords || '' };
}

function hasCompleteRecipe(recipe) {
  return Boolean(recipe?.title && recipe.ingredients?.length && recipe.instructions?.length);
}

function mergeReaderRecipe(schemaRecipe, readerRecipe, metadata) {
  if (!schemaRecipe) return normalizeRecipe({
    ...readerRecipe,
    image: metadata.image || readerRecipe.image,
    tags: readerRecipe.tags.length ? readerRecipe.tags : metadata.keywords.split(',').map((tag) => tag.trim()).filter(Boolean)
  });
  const schemaHasIngredients = schemaRecipe.ingredients.length > 0;
  return normalizeRecipe({
    ...readerRecipe,
    title: schemaRecipe.title || readerRecipe.title,
    image: schemaRecipe.image || metadata.image || readerRecipe.image,
    servings: schemaHasIngredients ? schemaRecipe.servings : readerRecipe.servings,
    prepTime: schemaRecipe.prepTime || readerRecipe.prepTime,
    cookTime: schemaRecipe.cookTime || readerRecipe.cookTime,
    ingredients: schemaRecipe.ingredients.length >= readerRecipe.ingredients.length ? schemaRecipe.ingredients : readerRecipe.ingredients,
    instructions: schemaRecipe.instructions.length >= readerRecipe.instructions.length ? schemaRecipe.instructions : readerRecipe.instructions,
    tags: schemaRecipe.tags.length ? schemaRecipe.tags : readerRecipe.tags.length ? readerRecipe.tags : metadata.keywords.split(',').map((tag) => tag.trim()).filter(Boolean)
  });
}

async function importThroughReader(url) {
  const readerUrl = `https://r.jina.ai/${url}`;
  const htmlResponse = await fetch(readerUrl, { headers: { 'X-Return-Format': 'html' } });
  if (!htmlResponse.ok) throw new Error(`Reader HTTP ${htmlResponse.status}`);
  const html = await htmlResponse.text();
  const recipe = parseHtmlRecipe(html, url);
  if (hasCompleteRecipe(recipe)) return recipe;
  const metadata = parseHtmlMetadata(html);
  const textResponse = await fetch(readerUrl, { headers: { 'X-Return-Format': 'markdown' } });
  if (!textResponse.ok) throw new Error(`Reader HTTP ${textResponse.status}`);
  const parsed = parseReaderText(await textResponse.text(), url);
  return mergeReaderRecipe(recipe, parsed, metadata);
}

export function sourceType(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('instagram.com')) return 'instagram';
  } catch {}
  return 'website';
}

export async function importFromUrl(url) {
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Bitte einen öffentlichen http- oder https-Link verwenden.');
  const type = sourceType(url);
  const draft = normalizeRecipe({ ...blankRecipe(), source: { type, url } });
  if (type !== 'website') {
    return { recipe: draft, warning: `${type === 'youtube' ? 'YouTube' : 'Instagram'} blockiert das direkte Auslesen häufig. Der Link ist gespeichert; ergänze unten Titel und Inhalt.` };
  }
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const recipe = parseHtmlRecipe(html, url);
    if (hasCompleteRecipe(recipe)) return { recipe };
    throw new Error('Kein strukturiertes Rezept gefunden.');
  } catch {
    try {
      return { recipe: await importThroughReader(url), warning: 'Automatisch über Jina Reader gelesen. Bitte prüfe besonders die Portionszahl und die Zubereitungsschritte.' };
    } catch {
      return { recipe: draft, warning: 'Die Seite konnte weder direkt noch über den externen Lesedienst ausgewertet werden. Der Link ist gespeichert; nutze den manuellen Import.' };
    }
  }
}

export function parseManualText(text, sourceUrl = '') {
  const lines = String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const ingredientLines = [], steps = [];
  for (const line of lines) {
    if (/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s+/u.test(line) && !/^\d+[.)]\s/.test(line)) ingredientLines.push(line);
    else if (/^(\d+[.)]|[-•])\s+/.test(line)) steps.push(line.replace(/^(\d+[.)]|[-•])\s+/, ''));
  }
  return normalizeRecipe({ ...blankRecipe(), title: lines[0]?.slice(0, 100) || '', ingredients: ingredientLines.map(parseIngredient), instructions: steps, source: { type: sourceType(sourceUrl), url: sourceUrl } });
}
