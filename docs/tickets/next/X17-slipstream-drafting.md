# X17: Aerodynamic Slipstream Drafting and Slingshot Overtake

- **ID**: `X17`
- **Priority**: Creative Proposal
- **Component**: Aerodynamics Physics / Race Tactics / Visual FX
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
Implement aerodynamic slipstream drafting behind leading rivals to encourage tactical pack racing and dramatic overtakes. When trailing directly behind an opponent ($|z_{\text{target}} - z_{\text{player}}| < 40\text{ units}$ and $50 < x_{\text{target}} - x_{\text{player}} < 220\text{ units}$) for more than 0.8 seconds, the player's marble enters the low-pressure draft cone. Visual wind tunnel speed streaks wrap around the cockpit, forward aerodynamic drag drops by 45%, and pulling out to an adjacent lane triggers a momentary "Slingshot Surge" speed boost ($+45\text{ km/h}$ for 1.2 s) allowing high-speed passes.

---

## Acceptance Criteria
- [ ] Trailing within an opponent's wake cone triggers visual slipstream vapor trails.
- [ ] Sustained drafting reduces air drag and accelerates the trailing marble past the lead car's top speed.
- [ ] Swerving into an adjacent lane grants a clean Slingshot Surge overtake boost with wind burst audio.
