# Captured cartridge labels

Updated October 13, 2026. All 24 main-library games were run in the browser to replace the illustrated, generated cartridge fronts with actual game captures. The two bonus cartridges already use original artwork and are outside this replacement set.

Runtime captures: `web/assets/labels/*-title-screen.webp` (lossless WebP). Original browser screenshots: `scene/renders/title-screens/*.jpg` (ignored local source captures). Rebuild runtime images and catalog metadata with `node scripts/prepare-title-labels.mjs` after collecting the captures. The source screenshots must be present to run that command.

Use `tests/fixtures/title-screen-capture.html?game=GAME_ID` with the local source server to run each game at its authored dimensions. Skip intros and advance loading screens as needed, then capture only the game stage. HTML5 games use their live embed URLs. Review the rendered labels at `tests/fixtures/label-gallery.html`.

`web/cartridge-label.js` enlarges each title without stretching or clipping letters. `data/cartridge-title-framing.json` records tight title bounds; the renderer expands those bounds to the physical label proportions using as much surrounding screenshot as fits at the same title scale. It does not discard the real background in favor of narrow title strips. `captureSize` preserves the authored coordinate system when production compression resizes an image. Existing wear and broken tape still appear over the front. Original thumbnails remain on the spines. `cartridgeLabel.style` is `title-screen` or `opening-screen`; the latter adds a plain game-name caption beneath the screenshot.

## Results and exceptions

- **21 title screens captured**, including Platform Racing 2 and Bubble Racing from their live HTML5 games.
- **Musical Evenizer:** no separate title screen reached; captured its initial song-selection/game screen after dismissing instructions.
- **Kongregate Racing:** opens directly to its color/name connection menu; used that opening screen with a caption.
- **Click Upon Dots:** opens directly to its name/color connection menu; used that opening screen with a caption.
- **Platform Racing 3:** title logo renders, but the game remains at “Checking your login.” The status box was removed for the label. This does not establish that online play works.
- **the Game of Disorientation:** two local attempts remained white. Captured its working animated title on `https://jiggmin2.com/games/the-game-of-disorientation/` instead. The local game files were not changed.

All other title/menu captures loaded from the existing local archive, including its existing compatibility patches. Capturing a title is not a full gameplay or online-service verification.

## Limited cleanup provenance

Platform Racing 3 and Uber Breakout II use small, local patches from the built-in imagegen tool. No original title lettering is replaced. Platform Racing 3: The generated result is saved locally as `scene/renders/title-screens/platform-racing-3-cleanup.png`. The preparation script resizes that result to the original dimensions and copies only the 277 × 84 px status-box region at (196, 251) onto the original screenshot. All logo and surrounding artwork pixels come from the original capture.

Exact prompt:

> Use case: precise-object-edit. Edit target: the supplied actual game title screenshot, to be used as a cartridge label. Remove ONLY the pale blue rectangular status box reading CHECKING YOUR LOGIN... in the center-lower area, filling that region with the same continuous blue background. Keep every other part unchanged: exact Platform Racing 3 logo lettering and placement, REBORN text, orange squares upper left, blue squares lower right, speaker lower left, colors, composition, aspect ratio. Do not redraw, reinterpret, stylize, add detail, crop, or add text. Minimal inpainting only.

Uber Breakout II's cleaned source is `scene/renders/title-screens/uber-breakout-2-cleanup.png`. Only the four menu-text rectangles are composited from it: (215, 98, 111, 23), (178, 142, 184, 22), (198, 235, 141, 23), and (230, 275, 78, 24), in x/y/width/height pixels. The original title and giant II remain outside those patches.

Exact Uber Breakout II prompt:

> Use case: precise-object-edit. Edit target: original Uber Breakout II game title screenshot. Remove ONLY the four black menu button texts CREDITS, INSTRUCTIONS, MINIGAME, and PLAY. Inpaint their small regions with the exact underlying pale lavender giant Roman numeral II and its subtle existing gradients. Keep every other pixel's content unchanged: red and black UBER BREAKOUT lettering across center, giant pale II with red glow, circular pale background, purple outer field, black streaks, bottom-right volume corner. Do not retype, re-render, change font, rearrange, crop, stylize, or add anything. This is minimal clutter removal for a screenshot-based cartridge label. Preserve original 550:400 aspect ratio.
