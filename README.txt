TaxRocket — Phase 1 final live-Bank-Account modal alias fix + Phase 2 overlay
===============================================================================

THIS REPLACES THE EARLIER PHASE 1/2 ZIP
----------------------------------------
Apply this source overlay to the TaxRocket repository root. It retains the
validated Phase 2 protections and fixes the exact current live IRIS Bank
Account popup supplied with job cmvvzgjfp000vp3zityrq6k9x.

EXACT LIVE ROOT CAUSE
---------------------
The previous Phase 1 resolver safely refused the popup, but the new diagnostic
and the supplied HTML proved why:

  expected earlier field name:  IBAN
  actual IRIS field label:     IBAN/Mobile Wallet No. *
  actual IRIS placeholder:     IBAN/Mobile Wallet No. *
  actual optional checkbox:    Foreign Currency Account

The old resolver did not use a substring or first-input fallback, so it gave:
  bank_iban_field_not_found
rather than risking data entry in the wrong control.

FIX INCLUDED
------------
1. The Bank Account modal now permits exactly one visible text input carrying
   one of these explicit, required-marker-normalised field names:
     - IBAN
     - IBAN/Mobile Wallet No.

   This is an explicit allowlist, not fuzzy/substring matching. A different
   label, two candidate fields, disabled field or read-only field is still held
   and nothing is typed.

2. The optional foreign-currency checkbox now recognises BOTH explicit live
   labels:
     - Foreign Currency/Others
     - Foreign Currency Account

   The account can proceed only if the one recognised Foreign Currency control
   is unchecked, or if neither form of that optional control exists. If either
   recognised control is checked or two controls are found, the popup closes
   without typing, searching or adding.

3. All existing Bank Account safeguards remain mandatory:
     - 3320 summary row only; purple Add Bank Account icon only;
     - Joint Account must be explicitly unchecked;
     - exact IBAN readback after typing;
     - Search button only inside the Bank Account dialog;
     - Account Title and Bank Name must resolve;
     - ADD must be enabled;
     - IBAN and checkbox states are rechecked immediately before ADD;
     - exact new child row must exist before PKR amount filling;
     - no orange Edit/red Delete icons, Save, Calculate or Submit are used.

4. On any future discovery mismatch, the log records structural metadata only
   (label, placeholder, formControlName, type, disabled/readOnly) and closes
   the dialog. It does not log field values or type blindly.

CURRENT PAUSED JOB: IMPORTANT
-----------------------------
The supplied current job cmvvzgjfp000vp3zityrq6k9x must NOT be continued to
force this test. In its first run, the user confirmation classified the missing
bank as a taxpayer-taken-over item. The second and third runs correctly use
read-only verification and return:

  child_row_missing_verify_only
  takeover_unconfirmed

That is a Phase 2 safety rule: the agent must not silently create a replacement
for something the user has said they entered manually. It is correct behaviour
for that acknowledged job.

After applying this overlay, launch a NEW agent/autofill job from the same
approved packet. Do not press Continue again on the current manual-takeover
prompt and do not tick a manual-entry confirmation. A fresh job has no stale
manual-takeover acknowledgement; it will leave the already-correct 69 values
untouched and attempt the missing 3320 bank row itself.

DO NOT delete existing correct IRIS rows merely to test this repair.

EXPECTED FRESH-RUN PATH
-----------------------
  Business > Balance Sheet
  -> summary row 3320 / #add-balance-sheet-bank-account purple + icon
  -> Bank Account popup
  -> unique IBAN/Mobile Wallet No. field receives the planned IBAN
  -> Search
  -> exact Account Title + Bank Name are populated and ADD becomes enabled
  -> ADD once
  -> exact 3320 Bank Account child row appears
  -> only then PKR 3,350,000 is typed/read back in its amount cell

Expected success event: balance_bank_added
Expected failure that should no longer occur for the captured modal:
  bank_iban_field_not_found

FILES IN THIS OVERLAY
---------------------
electron-connect/iris-balance-sheet-driver.js
  Runtime Phase 1 exact modal-alias resolver and all Balance Sheet safeguards.
electron-connect/main.js
  Retained Phase 2 planned-child prefill/takeover wiring.
scripts/verify-data-push-2-agent.cjs
  Browser fixture with captured live aliases and required safety cases.
scripts/verify-balance-sheet-bank-modal.cjs
  Runtime JSDOM tests of the exact aliases, ambiguity and no-write failures.
scripts/verify-job-report.cjs
  Retained Phase 2 report coverage.

APPLY / RESTART
---------------
1. Close every TR Filing Agent / Electron window. End any remaining agent
   process before copying files.

2. From the TaxRocket REPOSITORY ROOT (the folder containing electron-connect),
   extract this ZIP and allow replacement, preserving paths. Example PowerShell:

     Expand-Archive -LiteralPath .\phase-1-2-live-bank-modal-alias-fix.zip `
       -DestinationPath .\TaxRocket -Force

3. For a source/developer run:

     cd .\TaxRocket\electron-connect
     npm start

   Or use the established live-developer launcher:

     npm run dev:live

4. If the normal workflow uses an installed Windows EXE, source overlay is not
   enough because Electron bundles these sources in app.asar. Rebuild/install
   the normal package after overlaying:

     cd .\TaxRocket\electron-connect
     npm run dist:win

VALIDATION COMPLETED IN THIS WORKSPACE
--------------------------------------
PASS  node --test scripts/verify-data-push-2-agent.cjs              21/21
      Includes full browser flow for captured aliases:
      IBAN/Mobile Wallet No. + Foreign Currency Account (unchecked)
      -> search -> resolution -> ADD -> exact child row -> amount.
      Also proves a checked Foreign Currency Account closes untouched before
      IBAN typing.
PASS  node --test scripts/verify-balance-sheet-bank-modal.cjs       7/7
PASS  node --test scripts/verify-job-report.cjs                     15/15
PASS  npm run verify:bank-iban                                      16/16
PASS  node --check electron-connect/iris-balance-sheet-driver.js
PASS  node --check electron-connect/main.js
PASS  node --check scripts/verify-data-push-2-agent.cjs
PASS  node --check scripts/verify-balance-sheet-bank-modal.cjs
PASS  git diff --check

LIMIT
-----
This workspace has no authenticated IRIS session. The fresh job on the actual
portal is the final live acceptance check. No Phase 3 work is included.
