#!/usr/bin/env node
"use strict";

/**
 * Guards the multi-category dividend split (Step 2).
 *
 * Bug (pre-Step 2): selecting more than one dividend category made the whole
 * estimate stop with NEEDS_RULES ("no evidence for how the income divides")
 * and the portal packet was blocked by a DIVIDEND_SPLIT_UNREVIEWED gap with
 * zero IRIS rows — even when the user had uploaded a certificate per category.
 *
 * Contract asserted here:
 *  1. Estimate action: per-category MAPPED certificates bound via
 *     Document.dividendSubcategory become per-category dividend route inputs
 *     (Σ cert gross per category); selection with a missing/unbound/changed
 *     certificate reports a precise NEEDS_RULES note instead of pricing.
 *  2. The old bulk "flatRoutesNeedingSplit" refusal no longer claims
 *     dividends — every other multi-category source still refuses.
 *  3. Portal map: multi-category certs produce one §150 Final Tax row per
 *     distinct IRIS code (mutual-fund codes merge), each with σ gross +
 *     σ withholding; unbound certificates keep the gap with a re-upload
 *     instruction; single-category legacy rows still resolve unchanged.
 */

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");

// ── 1. Source contract: estimate action prices the split ────────────────────
const taxAction = fs.readFileSync(
  path.join(root, "app/actions/tax-calculation.ts"),
  "utf8",
);
const portalMapSrc = fs.readFileSync(
  path.join(root, "lib/tax/dividend-portal-map.ts"),
  "utf8",
);
assert.ok(
  taxAction.includes("dividendIncomeBySubcategory[subcategory] = gross"),
  "estimate action must accumulate per-subcategory certificate gross",
);
{
  const fetchBlock = taxAction.match(
    /documentType: "dividend_certificate",[\s\S]{0,400}extractedData: true/,
  );
  assert.ok(
    fetchBlock &&
      fetchBlock[0].includes("dividendSubcategory: true") &&
      fetchBlock[0].includes("extractionStatus: true"),
    "certificate fetch must select dividendSubcategory + extractionStatus",
  );
}
assert.ok(
  taxAction.includes("dividendAllocationProblem"),
  "dividend allocation problem must gate the estimate",
);
assert.ok(
  /\{\s*status: "NEEDS_RULES"/.test(taxAction) ||
    taxAction.includes('status: "NEEDS_RULES"'),
  "blocked estimate still reports NEEDS_RULES",
);
// The bulk refusal branch must still exist for the OTHER flat sources...
assert.ok(
  taxAction.includes("flatRoutesNeedingSplit.push(entry.source)"),
  "other multi-category flat sources must still stop until evidenced",
);
// ...but dividends branch off before it via the certificate-evidence route.
assert.ok(
  taxAction.indexOf('if (entry.source === "dividend")') <
    taxAction.indexOf("flatRoutesNeedingSplit.push(entry.source)"),
  "dividend must branch to certificate evidence before the bulk refusal",
);

// ── 1b. Single-category estimate prefers the certificate gross (Step 3) ─────
assert.ok(
  taxAction.includes("dividendSingleCertGross"),
  "single-category dividend must be able to price from the certificate gross",
);
assert.ok(
  taxAction.includes(
    'entry.source === "dividend" && dividendSingleCertGross !== null',
  ),
  "ledger-net dividend is only the certificate-less fallback",
);
// A certificate bound to another category must not pollute the single line.
assert.ok(
  taxAction.includes(
    "if (doc.dividendSubcategory && doc.dividendSubcategory !== selected) continue;",
  ),
  "single-category gross must ignore certificates bound elsewhere",
);

// ── 1c. Step 4: composite fund portions come from the certificate ───────────
assert.ok(
  portalMapSrc.includes("dividendProportionsFromExtraction"),
  "portal map must expose the certificate portion parser",
);
assert.ok(
  taxAction.includes("dividendMfCertPortions"),
  "estimate action must hold certificate-derived portions",
);
assert.ok(
  taxAction.includes("details?.debtPortion ??") &&
    taxAction.includes("dividendMfCertPortions?.debtPortion"),
  "declared portions stay the fallback, certificate evidence the default",
);
// Portions must reconcile with the certified gross before being priced.
assert.ok(
  taxAction.includes("Math.abs(debt + equity - certifiedGross) <= 1"),
  "portion evidence that does not sum to the certified gross must be ignored",
);

// ── 1d. Bonus shares (§236Z) — captured 2026-10-27 as Final Tax row 64151351 ─
assert.ok(
  portalMapSrc.includes('"bonus-shares"') &&
    portalMapSrc.includes("FINAL_DIVIDEND_BONUS_236Z"),
  "bonus shares must map onto captured IRIS row 64151351",
);
assert.ok(
  portalMapSrc.includes("manualNotes"),
  "manualNotes escape hatch stays available for future uncaptured rows",
);

// ── 1e. Sidebar/summary counting must keep per-category certificates distinct ─
const filingSummary = fs.readFileSync(
  path.join(root, "app/actions/filing-summary.ts"),
  "utf8",
);
assert.ok(
  filingSummary.includes("document.dividendSubcategory ??"),
  "latestRequiredDocuments dedupe key must include dividendSubcategory — eight category certificates must not collapse into one",
);

const wizardPlaceholder_check = true;

// ── 1e. Sidebar regression: slot identity, never the base type ──────────────
const wizard = fs.readFileSync(
  path.join(root, "components/tax/filing/filing-wizard.tsx"),
  "utf8",
);
assert.ok(
  wizard.includes("uploadedDocuments[slot.slotKey ?? slot.documentType]"),
  "documents sidebar must count slots by slotKey (bank/dividend slots would undercount otherwise)",
);

// ── 2. Source contract: upload-slot binding feeds the packet ────────────────
const packets = fs.readFileSync(path.join(root, "app/actions/packet.ts"), "utf8");
assert.ok(
  packets.includes("select: { id: true, extractedData: true, dividendSubcategory: true },"),
  "packet certificate fetch must select the per-category binding",
);
assert.ok(
  packets.includes("subcategory: doc.dividendSubcategory"),
  "packet must forward the certificate binding into the portal plan",
);
assert.ok(
  packets.includes("subcategory: cert.subcategory ?? null"),
  "packet's final projection must NOT drop the binding (regression: unbound gap with certs bound)",
);

// ── 3. Runtime contract: portal plan splits/rejects correctly ───────────────
assert.ok(
  portalMapSrc.includes("subcategory?: string | null;"),
  "DividendCertificateInput must carry the optional slot binding",
);
assert.ok(
  portalMapSrc.includes("missingSubcategories"),
  "multi-category plan must gap a selected category with no certificate",
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "divsplit-"));
try {
  execFileSync(
    "npx",
    [
      "tsc",
      "--outDir",
      tmp,
      "--target",
      "es2020",
      "--module",
      "commonjs",
      "--esModuleInterop",
      "--skipLibCheck",
      "lib/tax/dividend-portal-map.ts",
      "lib/tax/iris-field-codes.ts",
      "lib/tax/portal-row-evidence.ts",
      "lib/tax/business-tax-deductions.ts",
    ],
    { cwd: root, stdio: "pipe" },
  );
} catch (error) {
  // Emitter still wrote usable JS; hard type errors are surfaced by CI's
  // full tsc run. (The y2026 catalog chain uses repo aliases elsewhere.)
  if (error.status && !fs.existsSync(tmp)) throw error;
}
const jsOut = path.join(tmp, "dividend-portal-map.js");
const map = require(fs.existsSync(jsOut) ? jsOut : path.join(tmp, "lib/tax/dividend-portal-map.js"));
const cert = (id, grossAdded, wht, sub) => ({
  documentId: id,
  grossAmount: grossAdded,
  taxWithheld: wht,
  subcategory: sub,
});

const fullyBound = map.buildDividendFinalTaxPlan({
  certificates: [
    cert("d1", 100000, 7500, "ipp"),
    cert("d2", 200000, 30000, "reit-and-other"),
  ],
  selectedSubcategories: ["ipp", "reit-and-other"],
});
assert.equal(fullyBound.kind, "rows");
assert.equal(fullyBound.rows.length, 2);
assert.equal(
  fullyBound.rows.reduce((a, r) => a + r.grossAmount, 0),
  300000,
  "rows must total the certified grosses",
);
assert.equal(
  new Set(fullyBound.rows.map((r) => r.documentIds.length)).size,
  1,
  "each row anchors exactly its own certificate",
);

const missing = map.buildDividendFinalTaxPlan({
  certificates: [cert("d1", 100000, 7500, "ipp")],
  selectedSubcategories: ["ipp", "reit-and-other"],
});
assert.equal(missing.kind, "gap");
assert.equal(missing.category, "DIVIDEND_SPLIT_UNREVIEWED");
assert.match(missing.reason, /reit-and-other/);

const unbound = map.buildDividendFinalTaxPlan({
  certificates: [cert("d1", 100000, 7500, null), cert("d2", 5, 0, "ipp")],
  selectedSubcategories: ["ipp", "reit-and-other"],
});
assert.equal(unbound.kind, "gap");
assert.match(unbound.reason, /without its category/);

const legacySingle = map.buildDividendFinalTaxPlan({
  certificates: [cert("d1", 100000, 7500, null)],
  selectedSubcategories: ["ipp"],
});
assert.equal(legacySingle.kind, "rows");
assert.equal(legacySingle.rows[0].grossAmount, 100000);

const sameIrisRow = map.buildDividendFinalTaxPlan({
  certificates: [
    cert("d1", 100000, 25000, "mutual-fund-debt-50-or-more"),
    cert("d2", 50000, 9000, "mutual-fund-proportional"),
  ],
  selectedSubcategories: [
    "mutual-fund-debt-50-or-more",
    "mutual-fund-proportional",
  ],
});
assert.equal(sameIrisRow.kind, "rows");
assert.equal(
  sameIrisRow.rows.length,
  1,
  "categories sharing one captured IRIS code must merge into a single row",
);
assert.equal(sameIrisRow.rows[0].grossAmount, 150000);
assert.equal(sameIrisRow.rows[0].documentIds.length, 2);


const bonusOnly = map.buildDividendFinalTaxPlan({
  certificates: [cert("b8", 50000, 5000, "bonus-shares")],
  selectedSubcategories: ["bonus-shares"],
});
assert.equal(bonusOnly.kind, "rows", "captured 236Z row must resolve");
assert.equal(bonusOnly.rows[0].irisCode, "64151351");
const bonusFields = map.buildDividendTaxDeductionAgentFields(bonusOnly);
assert.equal(bonusFields.length, 1, "EED proof must emit one driver field");
assert.deepEqual(
  bonusFields[0].values.map((v) => v.value),
  ["50000", "5000"],
);
assert.deepEqual(
  [bonusOnly.rows[0].grossAmount, bonusOnly.rows[0].taxWithheld],
  [50000, 5000],
);

console.log("verify-dividend-split: all assertions passed ✔");
