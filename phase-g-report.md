# Phase G Report — E2E proof for the Bank Profit stack

Date: 2026-10-28 · Deliverable: `bank-profit-phase-g.zip`

## What was proven offline (sandbox)

A new test in `scripts/verify-iris-navigation.cjs` —
**"Phase G offline E2E: a mixed Bank Profit + Sukuk packet drives the real row driver once per code, dividend row untouched"** —
runs the extracted, shipping `runRealIrisAutofill` against a JSDOM replica of the live Other Sources → Final Tax grid, with:

- the **real** `iris-bank-profit-row-driver.js` (chooser cards, Investment/Contents dialog, guarded Calculate),
- the **real** `iris-row-filler.js` (typing + readback + overwrite guard + prefill snapshot),
- the **real** `planSectionFills` / group splitter in `main.js`,
- only `navigateToSection` and the web-job liveness probe stubbed (both covered elsewhere).

### Packet (3 sources on one Final Tax grid)

| Source | Code | Columns | Flow |
|---|---|---|---|
| Bank Profit §151(1)(b) | 64040052 | 1250000 / 187500 / 187500 | "+ Section" chooser → parent row → Investment/Contents dialog → detail row |
| Sukuk §151(1A) @10% | 64330054 | 10000 / 1000 / 1000 | direct writable row; Tax Chargeable locked → exactly one guarded **Calculate** press, readback-verified |
| Dividend §150 @15% | 64030052 | 1000 / 150 pre-filled | packet matches IRIS → treated as `already_correct`, never typed over |

### Assertions (all green)

1. `ensureBankProfitFinalTaxRow` invoked **once per code, in packet order** — `[64040052, 64330054]`.
2. All 8 packet fields end terminal: `filled` ×5, `already_correct` ×3 (incl. locked sukuk chargeable after verified Calculate).
3. `bankProfitCalculated === true`; Calculate pressed **exactly once**; Save/Submit clicked **zero** times.
4. DOM readback: `[1250000,187500,187500]`, `[10000,1000,1000]`, `[1000,150,""]`.
5. Dividend §150 row byte-identical afterwards (§150 regression guard).
6. No overwrite conflicts; chooser dialogs closed; no safety stop.
7. Final pause is only the designed `portal_autofill_review` prefill notice — nothing typed silently.

## Bug found & fixed (main.js)

The Sukuk G12 path: after `calculateBankProfitFinalTax` succeeded (driver verified the locked cell holds the packet figure), the code retried `fillIrisRows` — which can only refuse a locked cell (`column_disabled`). That forced a false "could not be placed" pause on every sukuk packet. Fix: on `calculated.ok`, the verified readback is carried as `ALREADY_CORRECT`. Scope-gated to bank-profit sukuk chargeable only. This is exactly the bug class this E2E exists to catch.

## Fake upgrade (BC-safe)

`scripts/lib/fake-iris-bank-profit.cjs` now models multi-target Final Tax pages (targets map ctor, `"code":"…"` op-slot auto-activation that filler scripts cannot spoof, chooser card cloning, ADD routing for sukuk-direct vs parent). The pre-existing 22/22 row-driver suite stays green unchanged.

## Gates

- iris-navigation: **179/179 → 180/180** (new E2E added)
- row-driver 22/22 · business-agent-phase2 14/14 · portal-agent ✓ · fbr-contracts 30/30 · job-report 14/14
- 106-gate sweep: **zero regressions** — byte-identical pre-existing failure set (fixture/credential-dependent; listed in plan doc §4), `tsc --noEmit` clean.

## What remains user-side (documented, cannot be sandboxed)

1. Live certificate upload → extraction review → approve (real PDF/images + credentials).
2. Live IRIS agent run + census (`verify-bank-profit-suite` tests 14–17 + `verify-bank-profit-iris-captures` need the live capture dir at `/home/user/Downloads/Bank Profit HTML`).
3. `verify-dividend-autofill-dom` needs `IRIS_DUMP=<decoded Other Sources capture html>`.
4. Live dividend §150 + §236Z 15/15 regression run.
