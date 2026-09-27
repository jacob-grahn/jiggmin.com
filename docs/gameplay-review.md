# Gameplay review — updated 27 September 2026

All 23 games were inspected using their embedded instructions and local Ruffle launch screens. This is a control/launch review, not a complete playthrough or a physical-phone compatibility certification. Your four supplied classifications take precedence. Profiles live in `data/gameplay.json` and can be changed independently of the game archive.

**Touch** means no required keyboard input in the selected play mode; optional pause keys do not disqualify it. **Controller** keeps direct screen input available alongside the pad. **Broken** means unavailable or reported broken in this archive today, not proof of a permanent Ruffle incompatibility. Broken games still attempt to load behind the CRT distortion.

| Game | Mode | Stick | A / B | Evidence and remaining uncertainty |
| --- | --- | --- | --- | --- |
| Effing Meteors | touch | — | — | Cursor attracts meteors. Pointer-only instructions; menu/tutorial opened in Ruffle. |
| Platform Racing 3 | broken (provisional) | — | — | Remains at checking your login. Intended arrows/Space controls; requires online services. |
| the Great Red Herring Chase | touch (provisional) | — | — | Repaired URL check. Title/options and driving round work. Choose click mode in options for touch; default typing mode needs a keyboard. See SWF repair notes. |
| Effing Hail | touch | — | — | Hold left mouse to control wind. Menu, instructions and level opened in Ruffle. |
| Neverending Light | controller/twin-sticks (provisional) | arrows | Left click / — | Arrow movement, mouse aim, left-click attack. Direct touch aiming plus joystick suggested on mobile. Title screen opens in Ruffle. Twin sticks: left moves, right aims and holds left mouse while deflected; releasing throws/stops firing. A also clicks at the retained cursor. |
| Platform Racing 2 | touch | — | — | Live HTML5 port at https://pr2hub.com/client/. Author-selected touch framing; keyboard input still needed until the port adds touch controls. |
| Musical Evenizer | controller (provisional) | arrows | Z / X | Repaired site check and archived the list plus 24 songs. First track drives spectrum platforms and increases score. Online upload/high scores unverified. |
| Uber Space Shooter | controller | arrows | Space / P | Instructions: arrows move, Space shoots; Pause button labelled P. Reaches click-to-play loader. |
| Platform Racing | broken (provisional) | — | — | Instructions: arrows/WASD move, up jumps, down charges, Space uses item. Online availability pending. Local menu works, but attempting to connect reports Could not connect to the server. |
| Kongregate Racing | broken (provisional) | — | — | Online racing; controller assignment provisional until server availability is checked. Local menu works, but attempting to connect reports Could not connect to the server. |
| Orbit | controller | mouse | Left / Right | User-confirmed. Instructions: mouse moves the core; arrows/WASD spin. |
| Beat Master 3000 | controller/arrows | arrows | — / — | User-selected four discrete arrow keys. Choose Arrows in the game menu. |
| Click Upon Dots | broken (provisional) | — | — | Pointer-only intended controls, but Connect reports Could not connect to the server in the local archive. |
| Rolley-Ball | touch | — | — | Menu offers mouse or arrow play. Touch assumes mouse mode; P is optional pause. Mouse-mode first level starts. |
| the Game of Disorientation | controller/arrows | four arrow buttons | — | User-confirmed working; four discrete arrow buttons for movement. |
| Uber Pool | controller | mouse | Left click / P | Move pointer to strike; hold left mouse to keep cue steady. Joystick avoids touch-drag acting as a brake. |
| Mines | touch | — | — | User-confirmed. Click mines and powerups. P is optional pause. |
| Cooties | controller/twin-sticks (provisional) | arrows | Left click / — | Arrows/A/D move; mouse aims hand; hold click to grab, release to throw. Direct screen aiming remains available. Animated Play menu opens in Ruffle. Twin sticks: left moves, right aims and holds left mouse while deflected; releasing throws/stops firing. A also clicks at the retained cursor. User confirms P does not pause. |
| Uber Breakout II | controller (provisional) | arrows | P / — | Previously reported broken. Unchanged SWF now verified through one-player gameplay, increasing score and life loss. Starts paused: press P or virtual A. |
| Uber Breakout | controller | arrows | P / — | User-confirmed joystick arrows, A P, B disabled. |
| Kimblis the Blue | controller/twin-sticks (provisional) | wasd | Left click / — | Live instructions confirm WASD movement, E health potion and Q magic potion. Mouse aims/attacks; potions and attack selection have clickable UI. Hybrid touch ergonomics need review. Twin sticks: left moves, right aims and holds left mouse while deflected; releasing throws/stops firing. A also clicks at the retained cursor. |
| Red Earth II | controller/twin-sticks (provisional) | arrows | Left click / — | Live instructions confirm arrows or ASDW movement and clickable weapon selection (also 1–4). First level starts. Mouse attack confirmed by user and repeated A presses verified locally. Twin sticks: left moves, right aims and holds left mouse while deflected; releasing throws/stops firing. A also clicks at the retained cursor. User confirms click attacks. |
| Red Earth | controller | wasd | Space / Shift | WASD moves, Space fires, Shift interacts, X/Z zoom. Zoom keys omitted from two-button pad. Menu opens in Ruffle. |

## Confirmed control variants

Controller layouts are subsets of `mode: "controller"`: `standard`, `arrows`, and `twin-sticks`. Beat Master uses four discrete arrow buttons (choose Arrows in its own menu). Neverending Light, Kimblis, Cooties, and Red Earth II use twin sticks: left for movement, right for virtual cursor aiming plus held left click while deflected. Release the right stick to stop firing or throw the grabbed object in Cooties. A also clicks the retained cursor position. Direct mouse/touch input is still available.

The user confirmed Cooties has no P pause binding, Red Earth II attacks with clicks, and unavailable titles should remain broken. Broken cartridges have handwritten “broken” tape on the front and spine. Pointer position is restored before each simulated click and continuously maintained during virtual control, so leaving the CRT to press A does not lose the aim point.

Physical-phone multitouch and each game's aiming feel still benefit from playtesting. Kimblis potions remain accessible through the game's clickable interface.

## Verification

- All 40 automated checks pass: profile coverage, your explicit mappings, touch framing across aspect ratios, virtual pointer letterboxing/bounds and release behavior, plus the existing room/physics/routing suite.
- An original diagnostic SWF confirmed synthetic pointer motion, left-click down/up, and arrow/Space/P events inside Flash itself with a transformed CRT-style player.
- Orbit's integrated virtual joystick moved its game cursor. Mines ran with close touch framing and Eject. Uber Breakout II displayed a cracked cartridge and CRT distortion.
- Local menu/level observations are recorded above. Server errors are distinguished from blank players; the latter need investigation before claiming a cause.
- The review fixture uses a fresh document for each game to avoid accumulated Ruffle player resources influencing later results. These diagnostic pages are not included in the production build.

The updated twin-stick layout and repeated A attacks were verified in Red Earth II: successive presses fired projectiles while the physical cursor stayed on the controller.

- **Bubble Racing:** touch mode (user confirmed). Live HTML5/Godot iframe at `https://bubbleracing.com/`; no keyboard overlay. Online only. Response headers checked for framing restrictions.

## SWF repair follow-up

The September 27 sweep repaired Red Herring and Musical Evenizer and verified Uber Breakout II in the current player. The four online titles remain broken here. See [SWF compatibility fixes](swf-compatibility-fixes.md#broken-game-sweep--september-27-2026) for reproduction, original preservation, soundtrack provenance, and verification limits. The older broken-cartridge observations above describe the September 26 review.
