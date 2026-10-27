# Privacy Policy — Theme Dev Toolkit for Shopify

_Last updated: 21 October 2026_

Theme Dev Toolkit for Shopify ("the extension") is a developer tool for working on Shopify themes. It does not collect, sell or share personal data, and it has no servers of its own.

## What the extension reads

- **The current tab, when you use it.** When you open the popup or use a keyboard shortcut, the extension reads store details that the page already exposes (`window.Shopify`: shop domain, theme ID and name, country, language, currency) and the page's alternate-language links. This is used only to build links (preview, theme editor, admin, market URLs) and to show the details in the popup.
- **Your theme's JSON files, if you turn on "Theme access".** The section inspector reads `templates/*.json` and `sections/*.json` from the Shopify admin of the store you are viewing. This is used only to show which section file renders each part of the page. It requests these files directly from Shopify (`*.myshopify.com` and `admin.shopify.com`), using your existing admin sign-in or an Admin API token you provide.

## What the extension stores

| Data | Where | Purpose |
|---|---|---|
| Preferences (editor choice, linked store URLs, local repo paths) | `chrome.storage.sync`, your Google account's Chrome sync | Keeps your settings across your own devices |
| Admin API tokens you enter | `chrome.storage.local`, this device only | Reading theme files when the admin sign-in isn't used |
| Theme file contents | `chrome.storage.session`, in memory, cleared when the browser closes | Avoids re-downloading the same files |

## What the extension does not do

- It does not send any data to the developer or to any third party. Network requests go only to Shopify, for the store you are working on.
- It does not use analytics, tracking or advertising.
- It does not read pages unless you invoke it on that tab.
- It does not sell or transfer data, or use it for any purpose unrelated to the features above.

## Removing your data

Uninstalling the extension deletes everything it stored. You can also delete tokens and settings at any time on its Settings page, and turn off Theme access there.

## Contact

Questions: sungadivikram1@gmail.com, or open an issue at https://github.com/Vikramsungadi/chrome-extensions/issues
