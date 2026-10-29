// Which Chrome tab group a URL belongs in: a custom rule ("GA" → tagmanager.google.com, ga4.com),
// else its Shopify store. Pure functions so they can be tested without Chrome.
import { slotFor } from './slots.js';

export const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

/** "redwolf*" → /^redwolf.*$/i. Every other character is literal. */
const globRe = pattern => new RegExp(`^${pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');

/** Strings a pattern is tried against: store handle, host and its parent domains, host + path. */
function candidates(u, store) {
  const parts = u.hostname.split('.');
  const hosts = parts.slice(0, -1).map((_, i) => parts.slice(i).join('.'));
  return [store, ...hosts, u.hostname + u.pathname.replace(/\/$/, '')].filter(Boolean);
}

export function ruleMatches(rule, u, store) {
  const values = candidates(u, store);
  return (rule.patterns || []).some(p => {
    const re = globRe(p.trim().replace(/^https?:\/\//, ''));
    return values.some(v => re.test(v));
  });
}

/** Stable colour per name, so a store keeps its colour across sessions. */
export function colorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/**
 * Group for `url` as { key, title, color }, or null when it should stay ungrouped.
 *   groups: [{ name, color, patterns: string[] }]  custom rules, first match wins
 *   groupStores: put every Shopify store's tabs in a group named after the store
 *   storeGroups: { [store]: { title, color } }      store groups you renamed / recoloured in Chrome
 */
export function groupFor(url, settings = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const slot = slotFor(url, { hosts: settings.hosts });
  const store = slot && slot.kind !== 'url' ? slot.store : null;

  const rule = (settings.groups || []).find(r => r.name?.trim() && ruleMatches(r, u, store));
  if (rule) {
    const name = rule.name.trim();
    return { key: `rule:${name}`, title: name, color: rule.color || colorFor(name) };
  }
  if (store && settings.groupStores) {
    const saved = settings.storeGroups?.[store] || {};
    return { key: `store:${store}`, title: saved.title || store, color: saved.color || colorFor(store) };
  }
  return null;
}

/** Comma / whitespace separated patterns → list. */
export const parsePatterns = text => text.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
