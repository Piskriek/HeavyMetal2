# Builder tickets: what's on the road should be editable

Found while debugging on 2026-09-25. In build mode you cannot select or move the race's ramps, boost
pads, gaps and spinners, or its pickups; the Powerups tab shows random icons; and what you place from
the Powerups and Barriers tabs does nothing in a race.

| Ticket | Title | Priority | Depends on | Conflicts with |
|---|---|---|---|---|
| [BLD-01](BLD-01-powerups-are-race-pickups.md) | The Powerups tab places the race's real pickups | High | — | BLD-03a (engine pickups) |
| [BLD-02](BLD-02-barriers-block-in-race.md) | Barriers placed in the builder block balls in the race | High | — | BLD-03b (engine obstacle list) |
| [BLD-03a](BLD-03a-obstacle-document-select.md) | The race's obstacles become a document you can see and select in build mode | High | — | BLD-01 |
| [BLD-03b](BLD-03b-obstacle-move-edit-save.md) | Move, resize, delete and save race obstacles | High | BLD-03a | BLD-02 |
| [BLD-03c](BLD-03c-obstacle-palette.md) | Add obstacles from a palette | Medium | BLD-03b, ART-B3 art (optional) | — |
| [BLD-04](BLD-04-ramp-move-feedback.md) | A placed ramp shows why it will not move | Medium | — | — |

BLD-03 is "big move 1" (obstacles become builder props), previously on hold; the owner asked for it
on 2026-09-25. Run it as separate PRs, a → b → c, into `fix/flash-followups`.

**Protect the owner's track.** `backups/props/track-props-latest.json` (522 props) contains
`powerup_shield`, `powerup_missile`, `powerup_speed_boost` and a `timber_ramp`. Any type change must
migrate them in place (never drop a prop), and the C2 safety copies in
`backups/props/user_safety_backup/` must never be touched.
