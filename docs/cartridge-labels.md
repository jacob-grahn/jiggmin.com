# Screen-print cartridge labels

Approved direction: Effing Meteors style study 2. All 24 games now use full-front illustrated labels, generated with the built-in OpenAI image tool from original thumbnails and captured title/menu screens where available. The original thumbnails remain on the spines. Existing wear and broken tape are applied over the front artwork.

Optimized runtime images: `web/assets/labels/*-screenprint.webp`. Full-resolution art and exact prompts: `scene/mockups/screenprint-labels/` (ignored source art). Effing Meteors original prompt and approved master: `scene/mockups/effing-meteors-styles/`. Captured references: `scene/renders/label-references/` (ignored). Some unavailable games only supplied a blank/loading screen, so their thumbnails were used as the visual reference. These are interpretive illustrations, not screenshots of gameplay.

A label file is optional in `data/games.json` under `cartridgeLabel.file`; unavailable art falls back to the original thumbnail layout.
