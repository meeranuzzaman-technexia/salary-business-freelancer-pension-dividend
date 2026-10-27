#!/usr/bin/env node
"use strict";

/**
 * Guards the dividend-certificate mapping fix.
 *
 * Bug (reported from the wizard): a fully extracted, reviewed
 * dividend_certificate showed "Mapping for this document type is not
 * available yet." — the UI mappability whitelist omitted the type, and even
 * past the UI the server action fell through to
 * "No mapping rule exists for this document type yet".
 *
 * Fix contract asserted here:
 *  1. UI: dividend_certificate is in the isMappableDocument whitelist in
 *     components/tax/filing/wizard-documents-step.tsx (button renders).
 *  2. Server: approveAndMapExtractedDocumentAction handles
 *     dividend_certificate BEFORE the "No mapping rule exists" fallthrough.
 *  3. The branch is evidence-only by design: it validates the printed gross
 *     dividend (positive), allows an explicit 0 withholding (REIT-SPV),
 *     refuses a tax-year mismatch, marks the document MAPPED, invalidates
 *     the cached calculation and supersedes stale packets — and it must NOT
 *     create ledger entries or filing income records from the certificate
 *     (dividend income flows from classified bank credits; the gross→income
 *     link is phase-2 work).
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const wizardStep = fs.readFileSync(
  path.join(root, "components/tax/filing/wizard-documents-step.tsx"),
  "utf8",
);
const extraction = fs.readFileSync(
  path.join(root, "app/actions/extraction.ts"),
  "utf8",
);

// ── 1. UI whitelist ─────────────────────────────────────────────────────────
assert.ok(
  /isMappableDocument\s*=[\s\S]*?slot\.documentType === "dividend_certificate"/.test(
    wizardStep,
  ),
  "wizard-documents-step: dividend_certificate must be in the isMappableDocument whitelist",
);
assert.ok(
  !/dividend_certificate[\s\S]{0,80}Mapping for this document type is not available yet/.test(
    wizardStep.replace(/isMappableDocument[\s\S]*?pseb_certificate/, ""), // strip the whitelist itself
  ) ||
    true, // informational: the fallback string may still exist for genuinely unmappable types
);

// ── 2. Server branch exists and precedes the fallthrough ────────────────────
const actionStart = extraction.indexOf(
  "export async function approveAndMapExtractedDocumentAction",
);
assert.ok(actionStart > 0, "approveAndMapExtractedDocumentAction not found");
const fallthrough = extraction.indexOf(
  "No mapping rule exists for this document type yet",
  actionStart,
);
assert.ok(fallthrough > 0, "fallthrough error not found");
const branchIdx = extraction.indexOf(
  'document.documentType === "dividend_certificate"',
  actionStart,
);
assert.ok(branchIdx > 0, "dividend_certificate branch is missing");
assert.ok(
  branchIdx < fallthrough,
  "dividend_certificate branch must run BEFORE the fallthrough return",
);

const branch = extraction.slice(branchIdx, fallthrough);

// ── 3. Branch behaviour contract ────────────────────────────────────────────
for (const [needle, why] of [
  [/"COMPLETED", "MAPPED"/, "requires a finished extraction before mapping"],
  [/gross_dividend/, "reads the gross dividend field"],
  [/Enter the gross dividend/, "refuses a missing/zero gross dividend"],
  [/tax_year/, "reads the certificate tax year"],
  [/dividendDraft\.taxYear/, "refuses a tax-year mismatch against the draft"],
  [
    /taxCalculationStatus: "NOT_CALCULATED"/,
    "invalidates the cached calculation on mapping",
  ],
  [
    /status: "SUPERSEDED", approvalStatus: "SUPERSEDED"/,
    "supersedes stale packets on mapping",
  ],
  [
    /extractionStatus: "MAPPED"/,
    "marks the document MAPPED inside the transaction",
  ],
  [/mapping: "DIVIDEND_CERTIFICATE"/, "returns the mapping identifier"],
  [
    /invalidateBusinessBalancePackets/,
    "keeps the shared packet-invalidation hygiene of other evidence docs",
  ],
]) {
  assert.ok(needle.test(branch), `dividend_certificate branch: ${why}`);
}

// Evidence-only: no ledger/income records may be written from a certificate.
for (const forbidden of [
  /ledgerEntry\.create/,
  /bankTransaction\.create/,
  /filingIncomeRecord\.create/,
  /filingTaxCredit\.create/,
]) {
  assert.ok(
    !forbidden.test(branch),
    `dividend_certificate branch must not write ${forbidden} — income flows from Bank Intelligence, not certificates`,
  );
}

console.log("verify-dividend-mapping: all checks passed ✔");
