# The Studio's `ui:` editor tab: research

For Plan 57 §15: the next step after the play HUD became `ui:` panels is an editor tab in the Studio, where a player (or their agent) edits a screen's panels with live previews. This doc is the research-first step (CLAUDE.md drift guard 4): how comparable games let players lay out their HUD, and what players praise and complain about. Read the sentiment as recurring themes from forums and help pages, not statistics.

## Findings

**F1. Named, shareable layouts.** World of Warcraft's Edit Mode (Dragonflight) lets players name, save, edit, copy and share a layout [1]. Layouts import and export through the layout menu, and community sites such as wago.io host shared layouts [2]. A player who uses no addons praised Edit Mode as a strong customisation feature while asking for improvements [3].

**F2. Snapping, and the complaints about it.** Final Fantasy XIV's HUD layout snaps a dragged element to a grid while Shift is held, and once snapped elements to each other with Ctrl [4][5]. Players reported that element-to-element snapping stopped working [4]. They also called adjustment slow on console, and some PC players could not find the grid at all [6].

**F3. Overlap is the default HUD's recurring fault.** Depending on screen size the default FFXIV HUD has many overlapping elements, and players criticise its party frames [7]. FIDELITY already has a nine-zone HUD and an overlap gate for this (`scripts/e2e-hud-and-luminance-gate.mjs`).

**F4. A layout per mode.** Fortnite's mobile HUD Layout Tool lets players drag buttons and icons where they want them. Combat and build modes each keep their own layout [8][9]. On PC and console the HUD is a set of toggles in the Game UI settings instead [8].

**F5. Moving the HUD is an accessibility need.** The Accessible Player Experiences pattern "Personal Interface" lists moving HUD elements to a preferred position as an access pattern, using Fortnite's tool as its example [9].

**F6. In this repo.**
- The racing game's HUD editor (`apps/web/src/maker/hud-editor.tsx`) draws a small preview of the screen with a row of controls per element (anchor, scale, visibility), and writes the preset's layout.
- `@hm/hudlayout` validates `ui:` screens (the lens rule) and writes them as `uic:` share codes.
- The owner's standing rule (previews drive play): every slider, material, operator or preset choice shows a live preview and a hover try-on.

## Proposals for the tab

- **P1. The real screen, live.** The preview draws the play HUD's screen (`PLAY_HUD_SCREEN`) with the same `UiPanelView` the game uses, at sample values. Every change shows at once (the owner's rule). Hovering a choice (a tone, a frame, a size) tries it on in the preview before it is picked.
- **P2. Panels and parts as rows.**
  - Each panel has its anchor (the nine zones), offset and visibility.
  - Each part has its widget look (kind, tone, frame, size) and what it reads (its source), chosen only from the sources the screen really has.
  - This follows the racing editor's shape (F6).
- **P3. The lens rule, live.** `validateScreen`'s issues show beside the rows as they happen. A part with nothing real to read cannot be placed, and an action with no command cannot be added.
- **P4. Snapping that is easy to find.** Offsets step on an 8 px grid by default, and the step is shown on the slider, not hidden behind a modifier key (F2).
- **P5. Overlap shown while editing.** The preview marks any two panels whose boxes overlap, the overlap gate's check run live (F3).
- **P6. Share as a code.** The screen copies out and pastes in as `uic:` (F1). A damaged code is refused with the reason, and nothing changes.
- **P7. Agent-friendly** (the owner's rule for the Studio, Plan 40). The Studio bridge can read the screen, validate it and propose a staged edit, as it does for kits. The AI never applies its own edit.
- **Later:** a layout per mode (F4), and an accessibility preset that moves the HUD for a player's needs (F5).

## Sources

1. Blizzard, "World of Warcraft: Dragonflight HUD and UI Revamp": https://worldofwarcraft.blizzard.com/en-us/news/23841481
2. Warcraft Wiki, "HUD Edit Mode": https://warcraft.wiki.gg/wiki/HUD_Edit_Mode
3. Blizzard forums, "Suggestions/complaints about UI and Edit Mode": https://eu.forums.blizzard.com/en/wow/t/suggestionscomplaints-about-ui-and-edit-mode/582710
4. FFXIV forums, "Snapping HUD elements to each other": https://forum.square-enix.com/ffxiv/threads/196315-Snapping-HUD-elements-to-each-other
5. FFXIV forums (a 2013 post on Shift snapping): https://forum.square-enix.com/ffxiv/showthread.php?p=1040986
6. FFXIV forums, "A Few Suggestions to Improve the UI": https://forum.square-enix.com/ffxiv/threads/309701-A-Few-Suggestions-to-Improve-the-UI
7. FFXIV forums, "Customizable or not, I think the Default HUD/UI needs some improvement": https://forum.square-enix.com/ffxiv/threads/464296-Customizable-or-not-I-think-the-Default-HUD-UI-needs-some-improvement
8. Epic Games help, "How do I customize my HUD in Fortnite?": https://www.epicgames.com/help/fortnite-battle-royale-c-202300000001636/gameplay-c-202300000001721/hud-a202300000011110
9. Accessible Player Experiences, "Personal Interface": https://accessible.games/accessible-player-experiences/access-patterns/personal-interface/
