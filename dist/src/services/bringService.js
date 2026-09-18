const BRING_RECIPE_ENDPOINT = 'https://api.getbring.com/rest/bringrecipes/deeplink';
const BRING_WEB_URL = 'https://web.getbring.com/';

function itemText(item) {
  return `${item.amount ?? ''} ${item.unit || ''} ${item.name || ''}`.replace(/\s+/g, ' ').trim();
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
    if (navigator.share) return 'Die Übergabe an die Bring!-App ist auf diesem Gerät verfügbar.';
    if (navigator.clipboard?.writeText) return 'Die Einkaufsliste kann kopiert und anschließend in Bring! eingefügt werden.';
    throw new Error('Dieses Gerät unterstützt weder Teilen noch Kopieren. Öffne Bring! Web und übertrage die Liste manuell.');
  },

  async send(items) {
    const available = (items || []).filter((item) => item?.name?.trim());
    if (!available.length) throw new Error('Wähle mindestens eine Zutat aus.');
    const text = available.map(itemText).join('\n');
    const shareData = { title: 'Rezapp – Einkaufsliste', text };
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      return 'Die Einkaufsliste wurde an das Teilen-Menü übergeben. Wähle dort Bring! aus.';
    }
    if (!navigator.clipboard?.writeText) throw new Error('Die Einkaufsliste konnte auf diesem Gerät nicht übergeben werden.');
    await navigator.clipboard.writeText(text);
    return 'Die Einkaufsliste wurde kopiert. Öffne Bring! und füge sie dort ein.';
  }
};
