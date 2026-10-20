# Plan — The Sealed Vault

**Status:** Proposed, awaiting approval. Nothing in this plan is built yet.
**Date:** 2026-09-18

## 1. The problem this solves

The levels are already unlimited: `levelAt(n)` answers for any `n`, dealing the
levels 6-20 corridors one lap at a time past the authored twenty
(`src/game/level.ts`, `src/game/__tests__/endless.test.ts`). What the endless
road has no answer for is *why a player starts the next one*.

Today a cleared level ends on a card that reports the run — score, best, the
gems banked — and offers NEXT LEVEL (`FinishOverlay`, `src/ui/Overlays.tsx`).
Nothing is handed over that the player did not already have thirty seconds
earlier, and the gems have exactly one thing to spend on: a revive at five
apiece (`REVIVE_COST`, `src/ui/GameScreen.tsx`). A player who closes the app
after a clear leaves nothing behind, so there is nothing pulling them back.

## 2. The idea in one line

**Clearing a level seals a vault, and the vault opens on the level after it.**

The reward is always one level ahead of where the player stops, so quitting
always leaves something on the table — and the thing left on the table is named
and visible on the card they are quitting from.

## 3. Rules

| # | Rule |
| --- | --- |
| R1 | Clearing a level for the first time seals a vault. The vault is stamped with the next level number: `opensAt = level + 1`. |
| R2 | Clearing *that* level opens the vault, pays it out, and seals a fresh one stamped with the level after. |
| R3 | The tier walks a four-step cycle — **bronze → silver → gold → prism → bronze** — one step per vault opened. Every fourth clear is a prism. |
| R4 | A vault only opens on the level it names. Replaying a level that is already cleared pays its stars as it does today and touches the vault not at all. |
| R5 | The tier never falls. There is no streak to break and no punishment for dying: a level takes as many retries as it takes, and the vault is still there at the end of it. |
| R6 | A prism vault also carries a **free revive** — one revive that costs no gems, spent before gems are. |
| R7 | The card a run *dies* on names the waiting vault: "A gold vault opens on Level 21." That is the card players quit from, so it is the card the hook belongs on. |
| R8 | An opened vault offers **DOUBLE IT** — a rewarded video for twice the gems. **Blocked: AdMob was removed on 2026-09-24, so there is no rewarded video to offer.** Optional, skippable, never blocking. |

### Why R4 matters

Without it, a player farms level 1 forever: clear, open, reseal, clear. Stamping
the vault with a level number makes farming impossible without a single extra
check — the vault sealed on level 20 names level 21, and only level 21 opens it.

### Payouts (first pass, all tunable in one table)

| Tier | Gems | Extra |
| --- | --- | --- |
| Bronze | 10 | — |
| Silver | 20 | — |
| Gold | 30 | — |
| Prism | 50 | 1 free revive |

For scale: a coin in the corridor is 1 gem, a star is 5, a rewarded video is 10,
a revive costs 5. A prism is therefore roughly a level's worth of pickups on top
of the level's own pickups — enough to feel like an event, not enough to make
the corridor's coins pointless.

**Open question for approval:** the gem economy has one sink (revive). Vaults
pour gems in faster than revives take them out, so the numbers above will drift
toward meaningless unless something else is added to spend on. Flagging it here
rather than solving it in this plan.

## 4. What the player sees

**On the victory card** (`FinishOverlay`), in the order it happens:

1. The sealed vault that was already waiting slides in, shut, in its tier colour.
2. It opens — lid up, a burst, gems counting up into the readout's gem number.
3. `+30 GEMS` under it, and on a prism a second line: `+1 FREE REVIVE`.
4. `DOUBLE IT` appears beside it for a few seconds (R8), then the next vault
   drops in sealed, with four tier pips and the line **OPENS ON LEVEL 22**.

On the very first clear of a player's life there is nothing to open, so steps
1-4 are skipped and the card goes straight to the sealed vault dropping in.

**On the death card** (`GameOverOverlay`): one line, no control —
`GOLD VAULT · LEVEL 21`, locked, sitting small under the readout.

**On the road** (`LevelMap`): the bead the vault names carries a small vault
glyph instead of its number ring, so the road shows where the prize is.
*Phase 2 — the cards are what matter.*

No new art is needed: MaterialCommunityIcons already carries `treasure-chest`
and `treasure-chest-outline`, which is what `Icon` draws from, and the tier is
carried by colour (`COLORS`) rather than by four drawings.

## 5. What gets built

### State — `src/state/progress.ts`

Two fields on `Progress`, both new, both defaulting to a value an old save reads
correctly as (the store merges saved values over the defaults, so there is
nothing to migrate):

```ts
/** The sealed vault, and the level that opens it. Null before the first clear. */
vault: { tier: number; opensAt: number } | null;
/** Revives that cost no gems, paid out by prism vaults. */
freeRevives: number;
```

And one function, which is where every rule above lives:

```ts
/**
 * Bank a first-time clear's vault. Returns what the card should show:
 * `opened` is the vault that was paid out (null on the first clear of all),
 * `sealed` is the one now waiting.
 */
export function settleVault(level: number): { opened: Vault | null; sealed: Vault };
```

`recordClear` already answers whether the clear was a first, so `GameScreen`
calls `settleVault` only when it was — that is R4, in one line.

### Payout table — `src/game/config.ts`

`VAULT_TIERS`: four rows of `{ name, gems, freeRevives, tint }`, beside
`REVIVE_COST`. The only place a number from §3 appears.

### Wiring — `src/ui/GameScreen.tsx`

- At the `w.status === 'finished'` branch (around line 367), where `recordClear`
  already runs: call `settleVault` when the clear was a first, add the gems, and
  put the result on `summary` so the card can draw it.
- `onCarryOn` (the revive): spend a free revive before reaching for gems, so R6
  needs no second button.
- `canRevive` on the death card becomes `freeRevives > 0 || coins >= REVIVE_COST`.

### Card — `src/ui/Overlays.tsx`

- A new `VaultRow`, used by `FinishOverlay` (opening, then resealing) and by
  `GameOverOverlay` (the one locked line).
- Animated with `Animated`, the way the cards already are. **One trap worth
  naming up front:** this repo has been bitten three times by handing over only
  when an `Animated` timing reports finishing — an interrupted timing never
  does, and the screen hangs. The vault animation must be decorative only: no
  button and no state change may wait on its completion callback.

### Services

- `Analytics`: two names added to `EventName` — `vault_open` (tier, level,
  doubled) and `vault_double`.
- `Sound`: a new `vault` clip. There is no asset for it yet; `SOURCES` is a
  partial map and a missing name is simply silent, so it ships quiet and gains
  the sound when the clip lands. `checkpoint` is the stand-in until then.

## 6. Tests

New `src/state/__tests__/vault.test.ts`:

- A first clear seals bronze stamped with the next level and opens nothing.
- The next clear opens it, pays the bronze row, and seals silver.
- Four clears walk bronze → silver → gold → prism; the fifth is bronze again.
- A prism adds exactly one free revive.
- Replaying a cleared level leaves the vault untouched — the farming test (R4).
- The vault behaves the same a long way down the endless road (level 137).
- An old save with no `vault` key loads as "nothing sealed" and seals on the
  next clear rather than throwing.

Extended: `src/state/__tests__/progress.test.ts` for the free revive being spent
before gems, and a render test that the death card names the waiting vault.

## 7. Order of work

| Phase | What | Shippable on its own |
| --- | --- | --- |
| 1 | State, payout table, tests (§5 state, §6) | Yes — no UI, nothing visible |
| 2 | Victory card: open, pay out, reseal | Yes — the feature, playable |
| 3 | Death card line (R7) | Yes |
| 4 | DOUBLE IT rewarded video (R8) | Yes |
| 5 | Road bead glyph | Optional |

Phases 1-3 are the feature. 4 and 5 can be dropped without leaving a hole.

## 8. Documents to update when this is built

Per `PROJECT.md` §4:

- `docs/ER.md` — `Progress.vault` and `Progress.freeRevives` are new stored
  fields under the existing `bladeloop.progress.v1` key.
- `docs/FUNCTIONAL-REQUIREMENTS.md` — a new FR for the vault, and FR-8's revive
  amended for the free one.
- `docs/CHECKLIST.md` — the missing `vault` sound clip, and the real-money
  question in §3 if the economy gets a second sink.
- `PROJECT.md` — a dated change-log row.

## 9. What this plan deliberately leaves out

- **Daily rewards, login streaks, energy, spin wheels.** The road already
  refused a daily bonus and a streak once (`PROJECT.md`, 2026-09-17) on the
  grounds that nothing behind the page keeps them. The vault is kept by
  `Progress`, which is why it is proposed and they are not.
- **A punishing streak.** Deaths are the texture of this game — a reward a death
  can take away would make retrying feel like a loss, and retrying is the loop.
- **Cosmetic unlocks (ball trails) and the ghost of your best run.** Both were on
  the table and both still stand as follow-ups; neither is needed for the vault
  to work, and each is a system of its own.
