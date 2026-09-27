# Recovered workshop cartridges

Discover both cartridges in the workshop or replay them from the journal. A standalone diagnostic preview is available at `/web/bonus.html`. They remain separate from the regular den shelf/catalog.

- **A Murder in Crowland**: start menu, active crow animation, shooting, and ammunition decrement verified with the vendored Ruffle player on September 26, 2026. Credits on the title screen: programming by Jiggmin, art by Greg Wohlwend. Full completion, shield, reload, and sound quality remain unverified.
- **Inkclipse**: rounds start in both mouse and keyboard modes after a transparent-button compatibility patch. Full completion and successful scoring inputs have not been verified.

Both user-supplied ZIPs contain source and compiled SWFs. Originals and supplied thumbnails are stored under `games/bonus/`; the ZIPs and FLA/source material remain in the user's Downloads archives. `data/bonus-games.json` records provenance and hashes.

The original `Data.allowedURL` methods reject local HTTP servers and HTTPS, including HTTPS on jiggmin.com. `scripts/prepare_bonus_games.py` parses the SWF/ABC structures, identifies the `allowedURL` trait, and replaces only its method body with `pushtrue; returnvalue` and padding. `original.swf` remains byte-for-byte unchanged; `game.swf` is the generated playback copy. Inkclipse also receives two transparent Up-state button records through `scripts/swf_button_compat.py`, allowing Ruffle to activate its menu while preserving the original HitTest records and visible artwork. Gameplay logic and sounds are unchanged.

The preview uses the existing vendored Ruffle and fetches it and the selected game only after a click. Nothing imports the preview or bonus manifest from the initial den page. The standard build copies these files, but initial page network payload is unchanged. Original compiled files plus playback copies add about 4.3 MB to the deployment archive, not initial loading.

Automated tests verify preserved originals, asset hashes, and deterministic rebuilding. The browser observations above are limited smoke checks, not full compatibility certification.
