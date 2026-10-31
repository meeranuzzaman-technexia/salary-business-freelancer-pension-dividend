# Bank Profit — TR-BankProfit → salary-business-freelancer-pension Port Plan

**Date:** 2026-10-27 · **Source repo:** github.com/meeranuzzaman-technexia/TR-BankProfit @ `9876a50 "Bank_profit Fixed!"` (2026-10-23, old-fork single commit) · **Target:** `/home/user/salary-business-freelancer-pension` (worktree w/ dividend round complete) · **Discipline:** evidence-backed PORT, never file-replacement; additive only; no git merge.

---

## 0. What our repo ALREADY has (no port needed)

- Engine pricing: `bankProfitIncome` (§151 @15/30%, sukuk bands, MF-≥50% PoD) — `lib/tax/tax-calculation.ts` ≈ identical to TR's (offset-shifted)
- Classification category `BANK_PROFIT` — `lib/tax/bank-classification-rules.ts:119`
- Doc-type wiring: `bank_certificate` allowed — `app/actions/documents.ts:207`, `extraction.ts:179`, `lib/tax/document-requirements.ts:63`
- DB models: `FilingIncomeSelection`, `FilingIncomeRecord` (source+subcategory generic) — **no prisma migration**
- Rates: `lib/tax/rules/ty2026/catalog.ts` §151 entries
- IRIS codes (income/adjustable): `lib/tax/iris-field-codes.ts` 500312, 64040001, 64040002
- Portal evidence: all 6 TR final-tax codes present in `portal-row-evidence.ts` (64330054/55/56 writable [0,1]; 64040052/53/54 captured but idx-empty)
- `lib/tax/fbr-agent-config.ts` — **diff 0, identical**
- `lib/tax/wealth-rows.ts` — diff = line reorder only, **identical behavior**

## 1. TR functional slices to port (8 slices)

### SLICE 1 — Multi-category selection (6 subcategories)
`FilingIncomeSelection { source:"bank_profit", subcategory }` multi-select; per-subcategory upload slot `bank_certificate:<subcat>`.
- Files: `lib/tax/iris-bank-profit-capture.ts` (contract: 6 subcats → IRIS codes 64040052/53/54 + 64330054/55/56), `lib/tax/bank-profit-document-slot.ts`, hunks of `lib/tax/filing-completeness.ts`

### SLICE 2 — Certificate extraction + review + auto-subcat-detect
- Files: `app/actions/extraction.ts` hunks (BANK_PROFIT_CERTIFICATE prompt, `ensureBankProfitCertificateReviewFields`, `getBankProfitCertificateReviewErrors`, `readApprovedBankProfitCertificate`, auto-slot via `bankProfitSubcategoryFromCertificate`), new `lib/tax/bank-profit-certificate-fields.ts` (IBAN/CNIC/date/amount validation)

### SLICE 3 — Auto-detect + approve ledger transactions
- Files: `app/actions/bank-classification.ts` hunks (BANK_PROFIT in allowed income categories, suggestedCategory flow), `components/tax/filing/wizard-bank-intelligence-step.tsx` hunks (suggestion display/approve)
- NOTE: classification RULES file needs nothing (ours already has BANK_PROFIT rules; TR's 144-line diff is old-fork noise)

### SLICE 4 — Portal mapping (multi-field)
- `lib/tax/portal-field-map.ts` hunks: `BankProfitPortalSource` type + `bankProfitInvestment/bankProfitContents` on income fields (~L98,233,441), skip-if-verified (~L885), final-tax push (~L1092), conditional GAP messages ("certificate required" text replaces free-text gap ONLY when evidence path exists)
- `lib/tax/iris-field-codes.ts`: +36 lines additions only

### SLICE 5 — Packet/coverage
- `app/actions/packet.ts` hunks (13 bp lines): read approved certs → sources, incomeSources bank_profit w/o certs → selection-needed path, gap suppression only with verified sources, coverage metadata
- `app/actions/tax-calculation.ts` (16 bp lines): cert→portal-source assembly + plan push

### SLICE 6 — UI surfaces (5 components)
`filing-wizard.tsx` (sidebar per-subcat slots), `use-filing-documents.ts` (BANK_PROFIT_CERTIFICATE mapping labels), `wizard-review-step.tsx` (per-subcat review labels), `wizard-documents-step.tsx` (slot rendering)

### SLICE 7 — Electron
- COPY: `electron-connect/iris-bank-profit-row-driver.js` (1087; Final-Tax-chooser-only driver; detail-creation modals for Investment/Contents)
- GRAFT: `main.js` (~30 bp lines: require, BUILD_TAG chain, bankProfitRequested gating, routing block, detailsByCode validation), `iris-navigation.js` (~15 bp lines: BANK_PROFIT_SECTION_IDS, census Final-Tax pair guards), `job-report.js` (2 lines)

### SLICE 8 — Gates (regression-proofing)
- COPY new: `scripts/verify-bank-profit-certificate.cjs` (335), `scripts/verify-bank-profit-iris-captures.cjs` (240), `scripts/verify-iris-bank-profit-row-driver.cjs` (535)
- GRAFT bp-only hunks: `verify-bank-classification.cjs` (+90), `verify-bank-iban.cjs` (+58), `verify-business-bank-classification.cjs` (+17), `verify-portal-field-map.cjs` (+137 careful: pre-existing 4-fail at HEAD must stay), `verify-iris-navigation.cjs` (bp-hunks only out of 1036 diff), `verify-flat-income-routes.cjs` (+20), `verify-tax-breakdown-surfacing.cjs` (+6), `verify-ty2026-tax-calculation.cjs` (+17), `verify-money-database.cjs` (δ 78 — inspect removals before graft), `portal-coverage-inventory.cjs` (+42)
- REJECT in all files: any hunk that deletes/cuts OUR dividend/pension/services work (TR base is older)

## 1.5. Round-2 census addenda (cheezein jo pehli census se chhoop gayi thin)

| Surface | Kya | File |
|---|---|---|
| **Test fixtures** | New gates `test-fixtures/iris/other-sources/` ke 4 HTML read karti hain; hamare repo me `test-fixtures/` **maujood hi nahi** (isi kami ki wajah se wealth/row-filler gates pre-existing fail hain). Port: sirf 4 files — `modal-add-final-tax.html`, `final-tax-row-after-add.html`, `final-tax-row-missing.html`, `investment-dialog-empty.html` | ت |
| **`lib/tax/document-invalidation.ts`** | 65-line NEW shared helper — extraction.ts import karti hai, hamare paas nahi | clean copy |
| **`scripts/verify-document-review-required.cjs`** | NEW gate (patch file se discover hui) | clean copy |
| **`package.json`** | +2 script entries (`verify:bank-profit-certificate`, `verify:iris-bank-profit-row-driver`) + verify:all chain — hamari dividend/sales-tax entries hifz | graft |
| **Tiny gate grafts** | verify-job-report.cjs (5 lines), verify-fbr-contracts.cjs (1), verify-ty2026-subcategories.cjs (1) | graft |
| **`tax-rocket-pension-bank-profit-certificate.patch`** (root) | 1365-line **ready-made graft map** certificate slice ka — Phase C ki precision script | reference |
| **README.md** | 647 diff lines mostly divergence; bp section optional | optional |
| Noise ruled out (dupha-census files jo actually identical/no-bp hain) | wizard-setup-step (d=0), filing-drafts/filing-draft-identity (identical), subcategories.ts (d=267 = hamara dividend expansion), filing-wizard-config (d=144 pure old-fork noise), wizard-packet-step (d=46 no bp), verify-business-profit/ui-02 (old noise) | **zero work** |

Revised TR-ONLY full-copy list (9): 3 lib files + 1 driver + document-invalidation.ts + 3 bp gates + verify-document-review-required.cjs. Plus 4 fixtures.

## 2. Execution order — UPDATED phases (post round-2 census)

Copy-set legend: **C** = clean verbatim copy · **G** = surgical graft (bp-hunks only) · **V** = verify-only (identical/noise)

### Phase A — Clean copies (zero conflict, sab pehle)
```
lib/tax/iris-bank-profit-capture.ts                    C (96)
lib/tax/bank-profit-certificate-fields.ts              C (429)
lib/tax/bank-profit-document-slot.ts                   C (26)
lib/tax/document-invalidation.ts                       C (65)
electron-connect/iris-bank-profit-row-driver.js        C (1087)
scripts/verify-bank-profit-certificate.cjs             C (335)
scripts/verify-bank-profit-iris-captures.cjs           C (240)
scripts/verify-iris-bank-profit-row-driver.cjs         C (535)
scripts/verify-document-review-required.cjs            C (new, from patch)
test-fixtures/iris/other-sources/modal-add-final-tax.html        C
test-fixtures/iris/other-sources/final-tax-row-after-add.html    C
test-fixtures/iris/other-sources/final-tax-row-missing.html      C
test-fixtures/iris/other-sources/investment-dialog-empty.html    C
package.json                                           G (+2 script entries + verify:all chain)
```
Proof: `node --check` all js; 4 new gates run (expect partial fail till slices land — baseline note).

### Phase B — Portal map + packet + codes (Slice 4+5) — ✅ DONE 2026-10-27
```
lib/tax/portal-field-map.ts      G grafted: imports, BankProfitPortalSource field types,
                                    params bankProfitSource?/bankProfitSources?, GAP text,
                                    skip-if-verified (placed BEFORE generic totalIncome add —
                                    TR order; double-count bug found+fixed), final-tax push
                                    (3 cells), §151-credit skip, "Tax Chargeable" column union,
                                    Other-Sources routing branch (before property branch),
                                    version stamps 1.3.0 / v1.3-2026-10-23
lib/tax/iris-field-codes.ts      NOT GRaFTED (decision): ours keeps dividend entries +
                                    "151" mappings (cert-less regression guard); TR removed
                                    them; ADJ_PROFIT_DEBT metadata kept — no external consumers
app/actions/packet.ts            G 5 edits: imports, destructure+query bank_certificate docs,
                                    sources assembly (certs×calculationLines parity), param pass
app/actions/tax-calculation.ts   G 3 edits: imports, multi-category cert parity block,
                                    flatRouteSources cert-sourced push
scripts/verify-portal-field-map.cjs  TR-paired updates: gap regex /final[\s-]*tax/i,
                                    +2 bp tests grafted, version stamps; "bare 151 fallback"
                                    test SKIPPED (contradicts kept 151 mappings, documented)
```
Proof DONE: tsc 0 ✓ · full 99-gate sweep exit-parity 100% (74/25 same set, same exits;
dividend-autofill-dom still 2) ✓ · verify-portal-field-map head-set = same 4 pre-existing
names, pass 28 (incl. 2 new bp tests green) ✓ · dividend-×3 + coverage + business-list 0 ✓

### Phase C — Selection + extraction + auto-detect/approve (Slices 1+2+3) — ✅ DONE 2026-10-28
```
lib/tax/filing-completeness.ts       G 2 edits (mapping set +bank_certificate, blockers block)
lib/tax/document-requirements.ts     G 1 edit (review-checklist reason text)
lib/tax/document-review-required.ts  G 4 edits (imports, REQUIREMENTS entry, required-field + errors branches)
app/actions/extraction.ts            G 15 edits: imports (+baseFilingDocumentType/isBankProfitCertificate/
                                       bankProfitCertificateSubcategory/bankProfitSubcategoryFromCertificate),
                                       5× base-normalize (ensureReviewFields/buildExtractionPrompt/
                                       validateExtractedDocument/listing/approve+update requiredErrors),
                                       bp ensureReview branch, extraction-prompt paragraph (verbatim),
                                       slot signals→5/min3, approvedBankProfitCertificate wipe on edit
                                       (isBankProfitCertificate guard), invalidate tx branch,
                                       approve list + full approve block verbatim (Serializable tx,
                                       canonical projection write, slot-subcat mismatch guard)
app/actions/bank-classification.ts   G 4 edits (SUGGESTED+POTENTIAL_INCOME query, select classificationStatus,
                                       admission filter, bulk-safe whitelist +BANK_PROFIT)
scripts/verify-bank-classification.cjs        paired: whitelist regex +BANK_PROFIT; grafted TR
                                       "Approve All Safe" test (UI button-gate asserts red until Phase D)
scripts/verify-balance-sheet-required.cjs     paired: requiredErrors call regex widened for baseFilingDocumentType()
scripts/verify-services-withholding-prefill.cjs paired: eval-stub baseFilingDocumentType in AST-extracted fn
scripts/verify-document-review-required.cjs   PATCH-LOOSENED regex already present in ours — no change needed
```
Proof DONE: tsc 0 ✓ · full 99-gate sweep: all 25 baseline non-zero identical, no flips ✓ ·
verify-portal-field-map still 28/4 same-set ✓ · verify-bank-iban, business-bank-classification 0 ✓ ·
verify-bank-classification 22 pass +1 intentional-red (UI marker, Phase D) ✓ ·
New bp gate suite: 12 pass / test-12 partial (UI+Electron asserts pend D/E) / 4 skip (captures)

### Phase D — UI (Slice 6) — ✅ DONE 2026-10-28
```
components/tax/filing/filing-wizard.tsx                  G 2 edits (bp imports + bankProfitSlots
                                    per-subcat slot list; dividend-style, deps unchanged)
components/tax/filing/hooks/use-filing-documents.ts      G 7 edits (edit-wipe approved projection,
                                    guard extension, Save/Map wipes + reset, approve note +
                                    certificate write-back, taxpayer_cnic formatting)
components/tax/filing/wizard-documents-step.tsx          G 9 edits (payload type, local
                                    isBankProfitCertificate flag, mappable/banner/buttons/
                                    readOnly/amber-note/CNIC-list)
lib/tax/document-upload-slot.ts                          G (TR guard: bank_certificate:<subcat> whitelist)
lib/tax/filing-completeness.ts                           FIXED (C2 blockers reapplied — Phase C silent-loss
                                    found by bp-gate test 12; script crashed before write)
components/tax/filing/wizard-review-step.tsx             NOT grafted: ours' generic subcategoryLabel
                                    chain (filing-summary→ty2026 options) already renders the 6
                                    §151 labels; TR's inline BANK_PROFIT_CATEGORY_LABELS redundant
components/tax/filing/wizard-bank-intelligence-step.tsx  G 5 edits (button-gate +POTENTIAL_INCOME/BP,
                                    badge tag surfacing, "Approve as X (AI suggestion)" title,
                                    one-click confirm onClick, imports)
scripts/verify-bank-iban.cjs                             paired: complete-cert fixture + new
                                    reconciliation test (16/16 PASS)
```
Proof DONE: tsc 0 ✓ · full 99-gate sweep: 25/25 baseline non-zero identical, zero flips ✓ ·
verify-bank-classification 23/23 (bp Approve-All-Safe green) ✓ · portal-field-map 28/4 same ✓ ·
bp-suite: 12 pass / test-12 now red ONLY on Electron markers (Phase E) / 4 skip

### Phase E — Electron (Slice 7) ✅ DONE (2026-10-28)
```
electron-connect/main.js            G'D (14 sites: require, BUILD_TAG chain, manifest entry,
                                       bankProfitRequested/portfolio-details validation +
                                       stale-packet pause (bankProfitCoverage=missing_detail_payload),
                                       deduped handoffSectionIds + bp arm, bankProfitCalculated flag,
                                       executionGroups flatMap per-code split (both fill loops),
                                       isBankProfitFinalTaxGroup, ensureBankProfitFinalTaxRow block
                                       (function-shaped early return), prefill bp-family filter,
                                       Sukuk Tax Chargeable Calculate-refresh + bank_profit_calculate_held,
                                       completion message suffix, result.bankProfitCalculated)
electron-connect/iris-navigation.js G'D (VERIFIED_ABSENT_CODE_ROUTES map; planSectionFills
                                       verified-absent bp routing + gridTitle on groups;
                                       validateRequiredGridTarget (TR-verbatim) + export)
                                       [TR's buildHandoffSectionIds NOT ported — our dividend-fork
                                       inline handoff + Other-Sources cursor-0 start already cover it;
                                       census Final-Tax pair guard lives in TR's census module and our
                                       row driver re-verifies the pair itself]
electron-connect/job-report.js      G'D (bankProfitCalculated detect, Calculate ternary in
                                       NEVER-DONE block, 8-branch bp setup what/todo)
electron-connect/package.json       G'D (build.files += iris-bank-profit-row-driver.js)
scripts/lib/fake-iris-bank-profit.cjs  copied from TR (fixture lib the Phase-A verify gate needs —
                                       was missing; gate had never run green here)
```
Proof: `node --check` ×3 ✓ · bp-suite test 12 green (13 pass/0 fail; 14-17 skip-guarded away
this session, fixture dir absent) · verify-iris-bank-profit-row-driver 22/22 · dividend ×3 0 ·
bank-classification 0 · bank-iban 0 · tsc 0 · 99-gate sweep = SAME 25 non-zero as baseline,
zero flips (exit codes identical: dom=2, portal-field-map=1 same 4-fail set)
Delivered: bank-profit-phase-e.zip

### Phase F — Gates grafts (Slice 8 remaining) ✅ DONE (2026-10-28)
```
scripts/verify-business-bank-classification.cjs  G'D (2 tests: Approve-all-safe accepts AI-tagged
                                          BANK_PROFIT potential income; leaves other tags) 48/48
scripts/verify-portal-field-map.cjs             G'D (bare §151 credit test — adapted: ours records
                                          it under mappingGaps.captureUnverified, not unmappedCategories;
                                          row 64040002 already never queued) 29 pass/4 fail — SAME head-set
scripts/verify-iris-navigation.cjs              G'D (harness ctx: pensionEntryHold + TAX_DEDUCTION_GRID_BY_CODE +
                                          irisBankProfitRowDriver — 63 pre-existing ReferenceError fails healed;
                                          fix43 stale predicate → salaryTourRequested; +fix53 handoff pins test;
                                          +prefill non-target/target bp test (drives OUR main.js end-to-end);
                                          +completion-card bp test; +fix53 bp-only navigation test +
                                          bankProfitFixture) 179/179 (baseline was 0/175 env-broken)
scripts/verify-tax-breakdown-surfacing.cjs      G'D (2 checks) + sources:
   app/actions/filing-summary.ts              subcategory: line.subcategory (additive next to subcategoryLabel)
   components/tax/filing/config/filing-wizard-config.ts  TaxBreakdownLine.subcategory? type field
   components/tax/filing/wizard-review-step.tsx  BANK_PROFIT_CATEGORY_LABELS + bankProfitCategoryLabel +
                                          bank_profit title branch (additive)
scripts/verify-job-report.cjs                   G'D (2 tests: guarded Calculate line; attention-message
                                          bp branch; Save-regex adapted to ours' line shape) 14/14
scripts/verify-fbr-contracts.cjs                G'D (build.files assert for iris-bank-profit-row-driver.js)
electron-connect/iris-navigation.js             G'D (bp pair verification: bankProfitCodes/parent/child/
                                          pairPresent + otherSourcesTaxDeductionsVerified; metadata export;
                                          captureSection mappingVerified branch; PUBLIC_CODE_SET +6 bp codes)
components/tax/fbr-connect-client.tsx            G'D (employer "none" → no employer block; covers Pension-era
                                          behavior identically, extends TR semantics to bank-profit-only)
scripts/verify-bank-classification.cjs          NO-OP (bp test already grafted in earlier phase; diff was position noise)
scripts/verify-bank-iban.cjs                    NO-OP (comment + regex-loosening only; ours pass stricter 16/16)
scripts/verify-flat-income-routes.cjs           NO-OP (diff = services-era ours-newer, zero bp)
scripts/verify-ty2026-tax-calculation.cjs       SKIP (diff = D4 10% clause-(1) surcharge deliberate)
scripts/verify-money-database.cjs               SKIP (δ78 inspected: all ours-newer completeness probes)
scripts/portal-coverage-inventory.cjs           SKIP (+42 = ours-only union-merge evidence guard)
```
Proof: tsc 0 · gate-level: bbc 48/48 · portal-field-map 29/4 same-set · iris-navigation 179/179 ·
job-report 14/14 · fbr-contracts 0 · tax-breakdown-surfacing 0 · full 98-gate sweep: ZERO flips in the
wrong direction; env-healed improvements: iris-navigation 0/175→179/179, economic-packet-sync 0/23→23/23,
data-push-{1,2,3,4}-agent + data-push-2-business-details + business-agent-phase2 → 0.
Remaining non-zero = pre-existing content drift only (row-filler 4/31, employer 6/27, wealth 8/56,
pension-statement 102/1, property-capture, pension-review-policy, sales ×5, bank-statement-isolation,
phase-3c-turnover, reco-other-outflow 14/2, portal-field-map 4, dividend-autofill-dom env=2 —
all byte-identical to baseline counts)
Delivered: bank-profit-phase-f.zip

### Phase G — E2E live proof
✅ **DONE (sandbox-offline portion)** — 2026-10-28.

1. **Offline multi-code E2E grafted into `scripts/verify-iris-navigation.cjs`** ("Phase G offline E2E: a mixed Bank Profit + Sukuk packet drives the real row driver once per code, dividend row untouched") — real `iris-bank-profit-row-driver` + real `iris-row-filler` + real `planSectionFills`/`runRealIrisAutofill` extraction under the JSDOM sandbox, `navigateToSection` stubbed.
   - Packet: bank 64040052 [1250000/187500/187500] (parent+detail via chooser+Investment/Contents), sukuk 64330054 [10000/1000/1000] (direct row, locked derived cell), dividend 64030052 pre-filled [1000/150] matching packet.
   - Proven: `ensureBankProfitFinalTaxRow` spy sequence exactly `[64040052, 64330054]`; all 8 fields terminal `filled`/`already_correct`; `bankProfitCalculated === true`; Save/Submit clicks **0**, Calculate clicks **exactly 1**; DOM readback exact; dividend row byte-identical (`already_correct` ×2, no overwrite); dialogs closed; final pause is only the by-design per-group prefill review (`portal_autofill_review`).
   - **Main.js G12 fix (E2E-found, verifier-justified)**: after a Sukuk `calculateBankProfitFinalTax` success (driver's own verified readback of the locked derived cell), the filler retry could only return `column_disabled` for that locked cell; the entry is now carried as `ALREADY_CORRECT` with the verified value. Scope-gated to `isBankProfitFinalTaxGroup && SUKUK && column "Tax Chargeable"` — no other flow touches this branch.
   - `scripts/lib/fake-iris-bank-profit.cjs` upgraded: `targets` map ctor, page-op `"code":"…"` auto-activation (filler scripts cannot re-point the fake), multi-target chooser card cloning, ADD routing to sukuk-direct vs parent path. Back-compat proven: existing row-driver suite stays 22/22.
   - Gates after graft: iris-navigation **180/180**, row-driver 22/22, business-agent-phase2 14/14, portal-agent/fbr-contracts 30/30, job-report 14/14.
   - 106-gate sweep: zero regressions vs Phase F baseline (byte-identical failure set: iris-row-filler 4/31, employer-moment 6/27, wealth-driver 8/56, pension-statement 102/1, portal-field-map 29/4, business-agent-phase1, phase-3c-turnover 14/1, reconciliation-other-outflow 14/2, document-review-required 29/8, dividend-autofill-dom exit 2 [IRIS_DUMP], property-capture [captures], sales-tax fixture-misses).
2. **Live-FBR steps stay user-side** (cannot be sandboxed): real certificate upload→review→approve; live agent run + census; live dividend §150/§236Z 15/15 regression; captures for bp-suite tests 14-17 & `verify-bank-profit-iris-captures` (need `/home/user/Downloads/Bank Profit HTML`); `IRIS_DUMP` capture for `verify-dividend-autofill-dom`.
3. Deliverable: `bank-profit-phase-g.zip`.

## 3. Invariants (never break)

1. GAP_ONLY BANK_PROFIT/PROFIT_ON_DEBT semantics: gap message stays until verified certificate exists; never silently converted
2. `prepareTaxDeductionField`/driver guards unchanged; duplicate-code census guard covers dividend+bank-profit shared grid 999919
3. `portal-row-evidence.ts` regenerated ONLY via captures script (standing user rule)
4. No prisma migration; no engine changes (already present)
5. `handoffSectionIds`/BUILD_TAG chains stay coherent after graft
6. Zip overlay = delivery; local `npx prisma migrate dev` N/A here

## 4. Pre-existing HEAD failures (untouched by this port)
verify-portal-field-map (4 pension/salary subtests + stale sync-list), verify-iris-wealth-driver (56: missing fixture HTMLs), verify-iris-row-filler (31: missing fixtures). These stay as-is; option to repair in a separate task.
