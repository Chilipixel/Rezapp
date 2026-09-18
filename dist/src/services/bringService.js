// Einzige Integrationsgrenze für Bring!. Es werden bewusst keine inoffiziellen
// Endpunkte oder Zugangsdaten in den Quellcode eingebaut.
export const bringService = {
  async testConnection(credentials) {
    if (!credentials?.email || !credentials?.password) throw new Error('E-Mail und Passwort fehlen.');
    throw new Error('Direkte Bring!-Anmeldung ist im Browser derzeit nicht verlässlich verfügbar (CORS/API). Deine Daten bleiben lokal gespeichert.');
  },
  async send(items) {
    const text = items.map((x) => `${x.amount ?? ''} ${x.unit || ''} ${x.name}`.replace(/\s+/g, ' ').trim()).join('\n');
    if (navigator.share) {
      await navigator.share({ title: 'Einkaufsliste', text });
      return 'Die Zutaten wurden zum Teilen geöffnet. Wähle Bring!, falls es angeboten wird.';
    }
    await navigator.clipboard.writeText(text);
    return 'Die Zutaten wurden kopiert. Füge sie in Bring! ein.';
  }
};
