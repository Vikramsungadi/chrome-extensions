Help me submit a new Chrome extension, "Theme Dev Toolkit for Shopify", on the Chrome Web Store developer dashboard: https://chrome.google.com/webstore/devconsole

How to work:
- I'm signed in. If the dashboard asks for the one-time $5 registration, stop and tell me.
- You can't pick files from my computer. When a step needs an upload, stop and tell me which file to choose, then wait for me to say "done". All files are in /Users/apple/Desktop/WORK/Tools/chrome-extensions/.
- Paste the text below exactly as written. Don't rewrite it.
- Don't press "Submit for review". When everything is filled in, show me a summary of each tab and wait for my go-ahead.

STEP 1: Click "New item" and ask me to upload:
  dist/shopify-dev-toolkit-2.3.1.zip

STEP 2: STORE LISTING tab
Name: Theme Dev Toolkit for Shopify (comes from the zip)
Summary: Shortcuts for Shopify theme developers: preview links with QR, theme editor, admin, markets, section inspector and QA tools.
Category: Developer Tools
Language: English
Description (paste between the lines):
----------
A toolkit for developers building Shopify themes, especially stores that sell in several markets.

PREVIEW
• Copy the preview link for the page you're on, with the theme and variant kept
• Scan a QR code to open the same preview on your phone
• Jump to the theme editor on the same template, the admin page for the product or collection you're viewing, or the code editor
• View the live theme or exit preview in one click

MARKETS
• See every market URL for the current page (en-us, en-ae, …) with the preview theme kept, and copy them all at once
• Switch country and language the same way the storefront's own selector does
• Link separate regional stores and open the same page on each one

ADMIN
• Search orders, products, customers, collections and drafts
• Quick links to admin sections, with one-click "new" buttons
• Keyboard jump menu: press Ctrl+A, then a letter — P products, O orders, C collections, D discounts, F content, M metafields, T themes, S settings and more
• Add Shift to create new (Shift+P = new product), or press Ctrl+A twice to edit the product or collection you're viewing

SECTION INSPECTOR
• Hover any section to see the real section file behind it, even if the section was renamed in the theme editor or is a market-specific template
• Open the file in the admin code editor or in VS Code / Cursor / Windsurf, at the right line

QA TOOLS
• Scan the page for Liquid errors, missing translations, broken images, missing alt text and duplicate IDs
• Hide the preview bar, reload without cache, copy debug info for bug reports
• Open product / collection / cart JSON, copy or clear the cart

Keyboard shortcuts for the common actions; change them at chrome://extensions/shortcuts.

Not affiliated with or endorsed by Shopify Inc. "Shopify" is a trademark of Shopify Inc.
----------
Homepage URL: https://github.com/Vikramsungadi/chrome-extensions
Support URL: https://github.com/Vikramsungadi/chrome-extensions/issues

Graphics: ask me to upload each one, in this order (all in extensions/shopify-dev-toolkit/store/):
  Store icon (128×128): extensions/shopify-dev-toolkit/icons/icon128.png
  Screenshot 1: screenshot-1-preview.png
  Screenshot 2: screenshot-5-admin-keys.png
  Screenshot 3: screenshot-2-admin.png
  Screenshot 4: screenshot-3-markets.png
  Screenshot 5: screenshot-4-tools.png
  Small promo tile (440×280): promo-small.png
  Marquee promo tile (1400×560): promo-marquee.png

STEP 3: PRIVACY PRACTICES tab
Single purpose:
Speeds up Shopify theme development by turning the store page you're viewing into quick links and inspection tools: preview links and QR codes, theme editor/admin/code links, market URLs, and a section inspector.

Permission justifications:
- activeTab: Reads store details (shop, theme ID, market) from the tab only when the user opens the popup or presses a shortcut, to build preview, editor and admin links.
- scripting: Runs the code that reads window.Shopify on the active tab, and shows the section inspector, the admin jump menu, preview-bar hiding and the QA scan when the user starts them.
- storage: Saves the user's settings (editor choice, linked stores, local repo paths), optional Admin API tokens, and a temporary cache of theme files.
- offscreen: Copies links to the clipboard when the user presses a keyboard shortcut. Chrome only allows a web page to write to the clipboard right after the user interacts with it, so the copy runs in a hidden extension page instead.
- declarativeContent: Shows the coloured toolbar icon only on pages that contain Shopify sections, without reading page content.
- Host permissions (optional: https://*.myshopify.com/*, https://admin.shopify.com/*): Requested only when the user turns on "Theme access" in Settings. Lets the section inspector read the theme's JSON templates from the Shopify admin to show which section file renders each part of the page. No other hosts are accessed.

Remote code: "No, I am not using remote code."

Data usage. Tick only these two:
- Authentication information
- Website content
Leave every other data type unticked.

Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

Privacy policy URL: https://github.com/Vikramsungadi/chrome-extensions/blob/main/extensions/shopify-dev-toolkit/PRIVACY.md
(Open this link first. If it shows a 404, tell me: the file hasn't been pushed to GitHub yet.)

STEP 4: DISTRIBUTION tab
Payment: free. Regions: all regions.
Visibility: ask me whether I want Public, Unlisted or Private.

STEP 5: Show me the summary and wait. Don't submit.
