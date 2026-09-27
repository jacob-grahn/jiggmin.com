# SWF compatibility fixes

The recovered **Inkclipse** and **A Murder in Crowland** games needed two small compatibility fixes to run in the site's vendored Ruffle player. We patched the compiled SWFs directly; we did not rebuild them from their Flash source projects or replace their gameplay code.

## Preserve the originals

The supplied archives contained `Inkclipse/Inkclipse.swf` and `A Murder in Crowland/Crows.swf`. Each compiled original is preserved byte-for-byte as `games/bonus/<game>/original.swf`. Patched playback copies are stored alongside them as `game.swf`.

[data/bonus-games.json](../data/bonus-games.json) records archive provenance, original and playback file sizes, SHA-256 hashes, stage dimensions, and compatibility notes. The source ZIPs and Flash authoring files remain outside the repository.

## Fix 1: legacy URL checks in both games

Both games have a `Data.allowedURL` method whose legacy checks reject local HTTP servers and HTTPS, including HTTPS on jiggmin.com. That prevented playback in the intended environment.

[scripts/prepare_bonus_games.py](../scripts/prepare_bonus_games.py) decompresses the SWF body when necessary, reads its `DoABC` tag, and parses the ActionScript bytecode structures to locate the method through its `allowedURL` trait. It replaces that method's instructions with:

```text
pushtrue      // 0x26
returnvalue   // 0x48
nop …         // 0x02, padding to the original method-body length
```

The method consequently returns `true`. Keeping the instruction buffer the same length avoids shifting the surrounding bytecode structures. The script requires exactly one matching method body in the processed ABC block, then recompresses the playback copy.

This is the only compatibility patch applied to **A Murder in Crowland**.

## Fix 2: Inkclipse's invisible menu buttons

After the URL fix, Inkclipse displayed its menu, but its buttons did not dispatch clicks in the tested Ruffle player. The two original buttons defined only a **HitTest** state—the clickable region—with no **Up** state for their normal appearance.

[scripts/swf_button_compat.py](../scripts/swf_button_compat.py) adds a separate transparent Up-state record to each button:

- It finds `DefineButton2` IDs **42** and **43**, including inside nested sprites.
- Both use the shared hit-area character **41**.
- It copies the hit record's character, depth, and transformation into a new Up record.
- A `CXFORMWITHALPHA` color transform preserves RGB and sets alpha to zero: multipliers `[256, 256, 256, 0]`, with no additive offsets.
- It preserves the original HitTest record byte-for-byte.

The transparency matters: making the shared cyan hit-area shape visible would cover the menu artwork. A separate invisible Up state restores clicking while preserving the original appearance and hit geometry.

The patch updates affected tag lengths, including enclosing sprites, and the SWF header's uncompressed file length before recompression. It rejects unexpected button layouts rather than guessing. Both buttons must be present and match the expected original structure.

## Reproduce the playback copies

From the repository root, using Python 3's standard library:

```sh
python3 scripts/prepare_bonus_games.py
```

This reads the preserved originals and overwrites only the generated `game.swf` copies. It always starts from the originals, so repeated runs do not accumulate button records. If the patch is intentionally changed, update the playback sizes and hashes in `data/bonus-games.json` as well.

Run the focused checks with:

```sh
node --test tests/bonus-games.test.mjs tests/house-content.test.mjs
```

The tests check packaged asset hashes, Inkclipse's original hash, valid uncompressed length, both transparent Up records, and preservation of the original hit records. They also rebuild Inkclipse twice in a temporary directory, compare the results with each other and the checked-in playback copy, and verify that its original remains unchanged. The deterministic rebuild test specifically covers Inkclipse.

## What was verified

Browser smoke checks with the vendored Ruffle player on September 26, 2026 established:

| Game | Observed working | Not established |
| --- | --- | --- |
| A Murder in Crowland | Title/start menu, crow animation, shooting, ammunition decrement | Full completion, reload, shield, sound quality |
| Inkclipse | Original menu appearance; starting rounds through both mouse and keyboard menu options; rotating globe and ink targets | Full completion and successful scoring inputs |

These are compatibility fixes and limited playback checks, not a full gameplay certification. Gameplay logic, sounds, and shared artwork were left unchanged; the edits are confined to URL permission checks and Inkclipse's button-state definitions.

For manual testing, run `npm start` and open `/web/bonus.html` on the local server. The games are also available through workshop discoveries and the journal. They load only when selected.

## Broken-game sweep — September 27, 2026

All seven games previously marked broken were reviewed with the existing vendored Ruffle build. No Adobe license or Flash re-export was needed. JPEXS 26.3.0 was used temporarily to inspect the compiled scripts ([official project](https://github.com/jindrapetrik/jpexs-decompiler)); it is not a build dependency. The repair scripts use Python's standard library.

| Game | Result | Evidence / remaining work |
| --- | --- | --- |
| The Great Red Herring Chase | Repaired | Original showed only a black screen and sound icon. URL-check patch restores title/options menus and a driving round. For touch, select **click mode** in options. Full completion untested. |
| Musical Evenizer | Repaired; soundtrack archived | URL-check patch restores loader, animated intro and instructions. Local song list and MP3s restore selection and music-driven platforms; first track produced increasing score. Other tracks are integrity-checked, not individually gameplay-tested. Online upload/high scores remain external and unverified. |
| Uber Breakout II | Working in this build; no SWF patch | Loader → Play → one-player Start → P reaches active gameplay, increasing score and life loss. The game starts paused. Virtual A now sends P; stick uses arrows. Two-player mode and completion untested. Prior user report of failure is retained in the profile history. |
| Platform Racing | Still broken here | Menu and customization work; selecting a server produces “Could not connect to the server.” Uses XMLSocket. |
| Kongregate Racing | Still broken here | Character selection works; Connect produces a connection error. Uses XMLSocket. |
| Click Upon Dots | Still broken here | Name/color selection works; Connect produces a connection error. Uses XMLSocket. |
| Platform Racing 3 | Still broken here | Main payload remains at “Checking your login.” MenuPage waits for `Sparkworkz.IsLoggedIn` and retries failures every 3333 ms. Further play also depends on server-list and socket services. |

### Red Herring

`BaseClass.init` calls `Data.allowedURL(stage.loaderInfo.url, ["jiggmin2.com"], true)` before creating `MenuPage`. Its archived check recognizes HTTPS for the listed domain and local **file** URLs, but rejects HTTP localhost and the intended jiggmin.com domain. Only that Boolean method's instructions are replaced with `pushtrue; returnvalue; nop…`.

The original `games/the-great-red-herring-chase/the-great-red-herring-chase.swf` stays unchanged. The playback copy is `game.swf`. A possible missing-Up-state button fix was tested and found unnecessary: URL-only playback starts the game, so **no button patch is included**.

Typing remains the game's default. To play with clicks/touch, choose the bottom title-menu option (“First things first; a lady needs her face”), click the right option (“Adjust the difficulty”) twice to go from medium → hard → click mode, then return to the title and start.

### Musical Evenizer

The obfuscated class `_i_--__--` exposes `_i_----_(Sprite):Boolean`, a URL permission check called during timeline construction. Returning true from that single method restores startup; the obfuscated gameplay methods are untouched.

The remote song-list response had no `Access-Control-Allow-Origin` header. The restored menu initially had only **None**. The repair replaces exactly one ABC string constant, the song-list URL, with `/games/musical-evenizer/song-list.txt`, updating its variable-length string size, the DoABC tag size, and the SWF uncompressed size. The local list references the 24 locally archived MP3s (59,979,655 bytes total). It preserves song titles/credits and the existing external upload/score URLs.

- `song-list.original.txt`: original public endpoint response.
- `song-list.txt`: same list with only song URLs redirected locally.
- `songs.json`: source URLs, byte counts and SHA-256 for every downloaded track.
- `songs/`: the 24 MP3s. No server-side PHP is required for playback.

The original `musical-evenizer.swf` is preserved; `game.swf` is the repaired copy. Music spectrum movement and increasing score were observed with **Orbital Trance – Space Planet**. This is a limited play check, not a full playthrough or audio-quality certification.

### Rebuild and verify

`data/games.json` retains each original's provenance/hash and records repaired copies under `playback`. `playbackFile()` prefers that copy, then the existing main-payload/original fallback. Gameplay profiles remove broken presentation from the three verified titles; the four online titles retain it.

```sh
python3 scripts/prepare_archive_games.py
npm test
```

The patcher rejects originals whose SHA-256 does not match the reviewed files and rejects missing/ambiguous target methods. It rebuilds only the two playback SWFs, without network access or modification of the originals. `--output-root /some/temp/directory` supports isolated reproduction. The song files are checked-in archive assets; rebuilds do not fetch them.

The added tests rebuild twice, compare byte-for-byte with packaged playback files, verify original and playback hashes and SWF lengths, reject changed inputs, and check every song/list reference. All **58 tests** passed after the changes. The local review fixture normally uses repaired playback; add `&original` to compare the preserved original.

### Why the online games remain marked broken

The three older multiplayer SWFs contain XMLSocket connection code and the server address `149.56.15.128`. Browser playback currently configures no socket bridge. Ruffle supports explicit host/port → WebSocket proxy mappings ([SocketProxy documentation](https://ruffle.rs/js-docs/master/interfaces/Config.SocketProxy.html)); restoring these games requires identifying working game services and hosting/configuring such a bridge. The connection errors do **not** establish that the underlying servers are dead.

PR3 uses `api.pr3hub.com`. An unauthenticated HTTPS POST to its `isloggedin/?id=IsLoggedIn` endpoint returned HTTP 200 and `IsLoggedIn=0`, but no cross-origin access header for localhost. Its client also chooses HTTP on local HTTP pages unless HTTPS is requested. A same-origin API integration or server CORS support, plus a socket bridge and further compatibility testing, is needed; bypassing its wait screen would not establish a working game. No authentication checks or online game state were altered.

For the next pass, original unobfuscated sources for the multiplayer clients and any surviving server/protocol sources would be most useful. They can be inspected without exporting through Adobe.

### Author-supplied Musical Evenizer source archive

The author supplied `Musical Evenizer.zip` on September 27, 2026. It remains outside the repository. Archive SHA-256: `7fdbe62d95d87bbd4213580d0dc45732246aa176fa7476002cc536375ed1a970`.

It contains the binary Flash authoring document `Evenizer.fla`, readable gameplay/support ActionScript (including `Player.as`, `Weight.as`, `Sounds.as`, `Key.as`, and `Preloader.as`), and an unobfuscated `Evenizer.swf` (211,743 bytes; SHA-256 `7b2973b8aa229c40f57be4d45c27ee5462d4af519add4841fdd7f5eeedd8cd18`). The FLA is a legacy compound binary document, not an XML-based ZIP; its timeline code was inspected through the included compiled SWF, without opening or exporting in Adobe.

This is a different build from the archived jiggmin2.com SWF. Its readable timeline loads `http://jiggmin.com/games/Evenizer/songList.txt`, and its score/upload integration also uses older jiggmin.com endpoints. It therefore was not substituted for the already tested repaired archive build.

The supplied `Player.as` confirms left/right movement, Up jumping (up to two jumps), Down accelerating downward, Z adding downward weight, and X adding upward weight. The readable timeline uses `SoundMixer.computeSpectrum` to drive the bars and loads music separately from the SWF, consistent with the soundtrack repair. Source inspection did not identify a further compatibility patch needed for the behavior already tested. These files provide a clearer reference for future gameplay or end-of-song debugging; no source files or supplied binaries were modified.
