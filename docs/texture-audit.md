# Texture audit — 2026-09-28

Audit of the Balanced build and runtime texture usage before label optimization.
Follow-up: standalone labels are now compressed by the build at quality 80 and
capped at 640×512, preserving aspect ratio; source files remain unchanged. The
other recommendations below have not been applied. MB/KB below are decimal file bytes before
HTTP compression. Resize estimates are measured encodes from source exports at
WebP quality 80, not guesses from pixel counts. Visual approval of resized
candidates is still needed.

## Priority findings

| Asset | Current dimensions / size | Runtime use | Recommendation |
| --- | --- | --- | --- |
| 24 cartridge labels | 768×615 each; 2.762 MB total | Each image is drawn into a 512×512 canvas in `web/cartridge-model.js` | Cap at 640×512, preserving aspect ratio and at least 512 pixels per axis; include these images in the compression pipeline. Measured total: 1.416 MB (1.346 MB saved). |
| Old cartridge artwork embedded in cartridges.glb | 23 fronts at 600×520 and 23 spines at 180×760; 330,324 image bytes | `web/app.js` calls `remodelCartridge` for every cartridge, which replaces the original meshes/materials before rendering | Remove these embedded images from the runtime export after detaching their material references. Keep the source geometry/metadata intact unless separately audited. |
| Old garden images in all four room GLBs | One 1536×1024 image per room; 855,952 image bytes total | `createMoonlitWindows` replaces these materials with the shared sky texture before rendering | Remove replaced image/material references in runtime exports. This saves download and decode work; do not remove window geometry. |
| Workshop keyboard | 2172×724; 111,056 bytes in Balanced | Printed top of a movable keyboard | Test 1024×341: 34,122 bytes, saving about 77 KB. Check close dragging and high-DPI views. |
| Hallway plate photo | 1200×1200; 65,842 bytes | Photo on a small plate that can move | Test 512×512: 21,468 bytes. Keep enough detail for close inspection. |
| Basement moon-garden painting | 1448×1086; 173,884 bytes | Movable framed painting | Test 1024×768: 96,904 bytes. Art detail is more sensitive than generic props. |

The first three items offer approximately **2.53 MB** of savings with the
conservative 640×512 label target, plus minor GLB metadata/padding changes.
Adding the keyboard candidate brings that estimate to **2.61 MB**.

## Cartridge label alternatives

At audit time, labels were copied unchanged. They are now discovered separately
by the build pipeline. These original measurements separate re-encoding from resizing:

| Encoding | Total bytes | Savings vs current |
| --- | ---: | ---: |
| Current 768×615 exports | 2,762,056 | — |
| Same dimensions, quality 80 | 2,222,970 | 539,086 |
| 640×512, quality 80 | 1,415,822 | 1,346,234 |
| 512×410, quality 80 | 1,046,168 | 1,715,888 |
| 384×308, quality 80 | 705,488 | 2,056,568 |

640×512 is a conservative first choice: neither source axis is smaller than the
512×512 canvas. Smaller aspect-preserving images require vertical upscaling into
that canvas. Reducing the generated canvas itself is a separate GPU-memory
optimization and should be judged while holding/throwing a cartridge, not only
while it is on a shelf. Label artwork is also embedded separately into room
posters and a T-shirt; those uses should have their own resolution policy.

## Small objects and atlases

The four house GLBs contain 184 small surface images at 256×256 (wood, metal,
paper, rubber, normal/roughness maps, etc.), totaling about 677 KB of encoded
images. These are mostly shared by multiple objects within a room. They are not
an obvious high-resolution problem. The ordinary game thumbnails are generally
200×100; all 25 thumbnails under games/ total only 195 KB.

Some small framed pictures use 640×640 textures. Estimated projected extents at
the settled room camera in a 1600×1000 viewport are about 102×107 CSS pixels for
the workshop shelf picture and 58×65 for the basement shelf picture. House
rendering uses up to 1.5 device pixels per CSS pixel. A 256–384-pixel texture is
worth testing for these props, but their movable/close-up state may need more.
These are geometry projection estimates, not screenshot measurements; they
exclude occlusion and do not represent maximum sizes during dragging.

Every extra room has a 4096×4096 lighting atlas and a 2048×2048 ceiling atlas.
These cover many surfaces, so object-by-object reasoning does not apply. Their
file sizes are modest in most rooms, though they use significant decoded/GPU
memory. Test atlas resolution separately, focusing on shadow edges and room-wide
lighting. Do not apply a blanket 512-pixel cap to all images.

The den's 5120×1600 lighting plate is 121 KB and intentionally covers ultrawide
views. Its 1766×452 prop-lighting strip is 32 KB, the 1600×1000 loading backdrop
is 58 KB, and the shared 1774×887 panoramic sky is 15 KB. These are lower-priority
download targets than cartridge labels, although resolution still affects memory.
Bubble Racing's separate 180×180 thumbnail is also appropriately small.

The controller's generated underside label is 512×256. It has no network payload
and can become visible when the controller is flipped; lowering it would only
save runtime texture memory, not site download size.
