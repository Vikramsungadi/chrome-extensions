// Adds an "Image Size" pane next to Styles / Computed in the Elements panel.
chrome.devtools.panels.elements.createSidebarPane('Image Size', pane => pane.setPage('src/devtools/pane.html'));
