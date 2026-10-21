// Settings live in chrome.storage.sync so they follow the user across machines.
// Shape:
// {
//   editor: 'vscode' | 'cursor' | 'windsurf',
//   alwaysAddPreviewParam: boolean,
//   repos: { [shop: string]: string },                     // local theme repo per myshopify domain
//   linkedStores: [{ label, url, previewThemeId? }]        // separate stores per region / market
// }

export const DEFAULT_SETTINGS = {
  editor: 'vscode',
  alwaysAddPreviewParam: false,
  repos: {},
  linkedStores: []
};

export const EDITORS = {
  vscode: { label: 'VS Code', scheme: 'vscode' },
  cursor: { label: 'Cursor', scheme: 'cursor' },
  windsurf: { label: 'Windsurf', scheme: 'windsurf' }
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch) {
  await chrome.storage.sync.set(patch);
  return getSettings();
}
