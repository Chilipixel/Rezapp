const BRING_RECIPE_ENDPOINT = 'https://api.getbring.com/rest/bringrecipes/deeplink';
const BRING_WEB_URL = 'https://web.getbring.com/';

function itemText(item) {
  return `${item.amount ?? ''} ${item.unit || ''} ${item.name || ''}`.replace(/\s+/g, ' ').trim();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Die Einkaufsliste konnte auf diesem Gerät nicht kopiert werden.');
}

export const bringService = {
  webUrl: BRING_WEB_URL,

  recipeImportUrl(url, baseQuantity = 4, requestedQuantity = baseQuantity) {
    if (!/^https?:\/\//i.test(url || '')) return '';
    const target = new URL(BRING_RECIPE_ENDPOINT);
    target.searchParams.set('url', url);
    target.searchParams.set('source', 'web');
    target.searchParams.set('baseQuantity', String(baseQuantity || 4));
    target.searchParams.set('requestedQuantity', String(requestedQuantity || baseQuantity || 4));
    return target.href;
  },

  async testConnection() {
    if ((navigator.clipboard?.writeText && window.isSecureContext) || document.queryCommandSupported?.('copy')) {
      return 'Kopieren ist verfügbar. Öffentliche Rezeptlinks können außerdem direkt in Bring! geöffnet werden.';
    }
    throw new Error('Dieses Gerät unterstützt das Kopieren nicht. Öffne Bring! Web und übertrage die Liste manuell.');
  },

  async copyItems(items) {
    const available = (items || []).filter((item) => item?.name?.trim());
    if (!available.length) throw new Error('Wähle mindestens eine Zutat aus.');
    const text = available.map(itemText).join('\n');
    await copyText(text);
    return 'Die Einkaufsliste wurde kopiert. Öffne Bring! und füge sie dort ein.';
  }
};
