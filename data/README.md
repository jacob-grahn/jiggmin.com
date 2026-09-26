# Downloaded Ruffle games

Fetched from [jiggmin2.com](https://jiggmin2.com/) on 2026-09-26T02:01:47.212354+00:00.

23 Ruffle-embedded game entries, each with the original SWF entry point and thumbnail. The two loader-based entries also include the main payloads advertised by their public update descriptors. Files have not been modified.

File verification: all 23 entry-point SWFs have valid SWF signatures and matching decompressed lengths. PR3's additional main SWF also validates. SHA-256 hashes, byte counts, source URLs, original embed dimensions, native stage dimensions, frame rates, and thumbnail paths are in [games.json](games.json). Total downloaded game/thumbnail bytes: 116,811,717 (111.40 MiB).

## Scope and caveats

- Bubble Racing and Volly-Bounce were excluded. The site's decorative Flash header was excluded.
- Eight game pages include an ActionScript 3 compatibility warning. This is recorded as a statement from the mirror, not a current Ruffle compatibility assessment.
- PR2 and PR3 are online games. Their services and additional runtime assets have not been mirrored.
- PR2's advertised main payload does not have a standard SWF signature. Its original bytes and source filename are retained, with a validation note in the manifest. Use the loader entry point until this is investigated.
- Other games may also use external resources or services; embedded URL strings are recorded only as static hints.
- Playback and offline completeness are not yet tested. No Ruffle runtime or web-player integration was added in this fetch.

## Inventory

| Game | Mirror compatibility warning | Entry point |
| --- | --- | --- |
| [Effing Meteors](https://jiggmin2.com/games/effing-meteors) | Yes | [game](effing-meteors/effing-meteors.swf) |
| [Platform Racing 3](https://jiggmin2.com/games/platform-racing-3) | Yes | [loader](platform-racing-3/pr3-loader.swf) |
| [the Great Red Herring Chase](https://jiggmin2.com/games/the-great-red-herring-chase) | Yes | [game](the-great-red-herring-chase/the-great-red-herring-chase.swf) |
| [Effing Hail](https://jiggmin2.com/games/effing-hail) | Yes | [game](effing-hail/effing-hail.swf) |
| [Neverending Light](https://jiggmin2.com/games/neverending-light) | Yes | [game](neverending-light/neverending-light.swf) |
| [Platform Racing 2](https://jiggmin2.com/games/platform-racing-2) | Yes | [loader](platform-racing-2/platform-racing-2-loader-v15.swf) |
| [Musical Evenizer](https://jiggmin2.com/games/musical-evenizer) | Yes | [game](musical-evenizer/musical-evenizer.swf) |
| [Uber Space Shooter](https://jiggmin2.com/games/uber-space-shooter) | Yes | [game](uber-space-shooter/uber-space-shooter.swf) |
| [Platform Racing](https://jiggmin2.com/games/platform-racing) | No | [game](platform-racing/platform-racing.swf) |
| [Kongregate Racing](https://jiggmin2.com/games/kongregate-racing) | No | [game](kongregate-racing/kongregate-racing.swf) |
| [Orbit](https://jiggmin2.com/games/orbit) | No | [game](orbit/orbit.swf) |
| [Beat Master 3000](https://jiggmin2.com/games/beat-master-3000) | No | [game](beat-master-3000/beat-master-3000.swf) |
| [Click Upon Dots](https://jiggmin2.com/games/click-upon-dots) | No | [game](click-upon-dots/click-upon-dots.swf) |
| [Rolley-Ball](https://jiggmin2.com/games/rolley-ball) | No | [game](rolley-ball/rolley-ball.swf) |
| [the Game of Disorientation](https://jiggmin2.com/games/the-game-of-disorientation) | No | [game](the-game-of-disorientation/the-game-of-disorientation.swf) |
| [Uber Pool](https://jiggmin2.com/games/uber-pool) | No | [game](uber-pool/uber-pool.swf) |
| [Mines](https://jiggmin2.com/games/mines) | No | [game](mines/mines.swf) |
| [Cooties](https://jiggmin2.com/games/cooties) | No | [game](cooties/cooties.swf) |
| [Uber Breakout II](https://jiggmin2.com/games/uber-breakout-2) | No | [game](uber-breakout-2/uber-breakout-2.swf) |
| [Uber Breakout](https://jiggmin2.com/games/uber-breakout) | No | [game](uber-breakout/uber-breakout.swf) |
| [Kimblis the Blue](https://jiggmin2.com/games/kimblis-the-blue) | No | [game](kimblis-the-blue/kimblis-the-blue.swf) |
| [Red Earth II](https://jiggmin2.com/games/red-earth-2) | No | [game](red-earth-2/red-earth-2.swf) |
| [Red Earth](https://jiggmin2.com/games/red-earth) | No | [game](red-earth/red-earth.swf) |

## Repeat the fetch

Run `python3 scripts/fetch_ruffle_games.py` from the project root, followed by `python3 scripts/fetch_loader_payloads.py`. These scripts use curl for HTTPS and replace the fetched inventory with current server versions.
