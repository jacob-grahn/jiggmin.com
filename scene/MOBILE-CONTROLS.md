# Controller and mobile-input plan

Status: physical controller modeled. Mobile animation, DOM touch targets, and Ruffle integration are proposed, not implemented or game-tested.

## Physical model

One J/01 controller replaces the earlier placeholder gamepad. It has a left thumbstick, labeled jade A and amber B buttons, and a small recessed QUIT button. The assembly is parented under `CONTROLLER • J01 mobile dock`. The stick has its own pivot, and the buttons have semantic role tags. The cable is separate so it can disappear as the controller rises into the mobile interface.

Latest scene: `midnight-den-controller.blend`.

## Proposed behavior

- Desktop: controller rests on the table. Real keyboard/mouse continue to operate the selected game.
- Touch device, keyboard game: controller lifts from the table and docks below the game. HTML touch targets aligned with the visual controls provide reliable multi-touch; decorative 3D geometry is not responsible for touch hit detection.
- Touch device, mouse game: direct tapping/dragging on the game is the default. Keep the controller parked when it is not needed, and retain a separate accessible Quit control.
- Mixed-input game: use a game-specific combination of touch on the screen and only the controller buttons required.
- Quit: release held keys/pointer buttons, stop the game session, and return to the room. Do not assume sending Escape quits an arbitrary SWF.

The visible Quit button can remain small, but its invisible touch target should be generous and separated from A/B. Respect safe areas and avoid covering the game. Portrait can reserve a bottom control area; landscape can place directions and action buttons near opposite thumbs.

## Ruffle input route

Ruffle's current web implementation listens for `keydown`/`keyup` on the window and handles them only while the player has focus. It receives pointer events on its canvas. That supports a browser-event adapter as the starting approach; this is an inference from source inspection, not an end-to-end compatibility result.

Source inspected: https://github.com/ruffle-rs/ruffle/blob/master/web/src/lib.rs (keyboard handlers and focus management; pointer handlers).

Give each cartridge an explicit profile, for example: joystick -> arrows, A -> Space, B -> X, or controller disabled. Those are examples only, not assumed mappings for Jiggmin's games. Use both key and code values, keydown on press and keyup on release; preserve focus and support holding a direction while pressing A/B. Release every held input on pointer cancellation, focus loss, game changes, and Quit. Include joystick dead zone and diagonals, suppress page scrolling on control surfaces, and keep ordinary mouse/keyboard input usable.

Prefer a real Ruffle DOM player aligned with the CRT face, especially in the playing camera position. Treating the game only as a WebGL texture complicates pointer coordinates and focus. If a virtual cursor is needed, map it into the actual displayed game rectangle and validate against the pinned Ruffle build.

Before claiming mobile support, test an actual keyboard SWF, mouse SWF, and mixed-input SWF on iOS Safari and Android Chrome. Some games rely on hovering, extra keys, typing, or simultaneous aiming and movement; joystick plus two buttons will not automatically cover every game. No SWFs have been supplied for those checks yet.
