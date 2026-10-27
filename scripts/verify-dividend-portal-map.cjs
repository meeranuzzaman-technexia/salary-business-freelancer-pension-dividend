#!/usr/bin/env node
/**
 * Dividend (§150) → Other Sources > Tax Deductions > Final Tax — mapping
 * contract. Pins three things, against the REAL captured IRIS page where
 * possible:
 *
 *  1. Every resident dividend subcategory routes to a captured IRIS row code
 *     and that code is PROVEN enterable by the portal row evidence
 *     (writeable index pattern, never assumed).
 *  2. Certified gross/WHT become exactly one driver agent field per row:
 *     regime "final", header row 999919 (the Final Tax header id from the
 *     2026-10-26 Other Sources captures — 999915 is Business-only),
 *     cells "EED", values = gross (col 0) + withholding (col 1).
 *  3. The field rows stay OUT of adjustableTaxFields: the generic section
 *     tour sees the Other Sources tax grids EMPTY by default, so queued rows
 *     could only ever be reported "code_not_seen_in_section_tour".
 *
 * Runs against the repository sources directly (no fixtures to rebuild).
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.join(__dirname, "..");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) {
    request = path.join(projectRoot, request.slice(2));
  }
  return originalResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(compiled, filename);
};

const {
  buildDividendFinalTaxPlan,
  buildDividendTaxDeductionAgentFields,
  DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW,
} = require("../lib/tax/dividend-portal-map");
const { buildPortalFieldMap } = require("../lib/tax/portal-field-map");
const { PORTAL_ROW_EVIDENCE, PORTAL_WRITEABLE_CODES } = require("../lib/tax/portal-row-evidence");
const { IRIS_TAX_DEDUCTION_REGIMES } = require("../lib/tax/business-tax-deductions");

const CERTS = [
  { documentId: "doc-1", grossAmount: 100000, taxWithheld: 15000 },
  { documentId: "doc-2", grossAmount: 85000, taxWithheld: 0 },
];

test("every routed subcategory targets a proven-enterable IRIS row", () => {
  for (const [subcategory, target] of Object.entries(DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW)) {
    const evidence = PORTAL_ROW_EVIDENCE[target.code];
    assert.ok(
      evidence,
      `${subcategory} → ${target.code} has no captured row evidence; mapping is unproven`,
    );
    assert.ok(
      PORTAL_WRITEABLE_CODES.has(target.code),
      `${subcategory} → ${target.code} captured but no writeable cell recorded`,
    );
    assert.deepEqual(
      evidence.writeableInputIndexes,
      [0, 1],
      `${subcategory} → ${target.code} writeable cells differ from the Final Tax shape (Taxable Amount, Tax Deducted)`,
    );
  }
});

test("certificates become exactly one agent field per proven row", () => {
  const plan = buildDividendFinalTaxPlan({
    certificates: CERTS,
    selectedSubcategories: ["reit-and-other"],
  });
  assert.equal(plan.kind, "rows");
  assert.equal(plan.rows.length, 1);
  const row = plan.rows[0];
  assert.equal(row.irisCode, DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW["reit-and-other"].code);
  assert.equal(row.grossAmount, 185000); // certificate gross, never net bank credit
  assert.equal(row.taxWithheld, 15000); // certificate WHT; 0 stays visible (REIT-SPV case)

  const fields = buildDividendTaxDeductionAgentFields(plan);
  assert.equal(fields.length, 1);
  const field = fields[0];
  const spec = IRIS_TAX_DEDUCTION_REGIMES.final;
  assert.equal(field.regime, "final");
  assert.equal(field.key, `${row.irisCode}:dividendFinalTax`);
  assert.deepEqual(
    { panelTitle: field.panelTitle, pickerTitle: field.pickerTitle, headerRowId: field.headerRowId, headers: field.headers },
    {
      panelTitle: "Final Tax",
      pickerTitle: "Add Final Tax",
      // 2026-10-26 Other Sources capture — 999915 stays Business-only.
      headerRowId: "999919",
      headers: ["Taxable Amount", "Tax Deducted", "Tax Chargeable"],
    },
  );
  assert.equal(field.cells, "EED", "cells come from evidence, not an assumed pattern");
  assert.deepEqual(
    field.values.map((v) => [v.columnIndex, v.column, v.value]),
    [
      [0, "Taxable Amount", "185000"],
      [1, "Tax Deducted", "15000"],
    ],
  );
});

test("the Electron driver accepts the dividend entry for the Other Sources spec", () => {
  const driver = require("../electron-connect/iris-tax-deduction-driver.js");
  const plan = buildDividendFinalTaxPlan({
    certificates: CERTS,
    selectedSubcategories: ["ipp"],
  });
  const fields = buildDividendTaxDeductionAgentFields(plan);
  assert.equal(fields.length, 1);
  const field = fields[0];
  // Business default must still refuse: final regime never typed there.
  const business = driver.prepareTaxDeductionField(field, {
    regimes: driver.REGIMES,
    typedRegimes: new Set(["adjustable", "minimum"]),
    typedCells: { adjustable: ["EE"], minimum: ["EEDDDD", "EEDEDD"] },
  });
  assert.equal(business.valid, false);
  assert.ok(business.problems.includes("regime_not_typed_in_this_build"));
  // Other Sources spec + typed sets must accept it cleanly.
  const otherSources = driver.prepareTaxDeductionField(field, {
    regimes: driver.OTHER_SOURCES_REGIMES,
    typedRegimes: driver.OTHER_SOURCES_TYPED_REGIMES,
    typedCells: driver.OTHER_SOURCES_TYPED_CELLS,
  });
  assert.deepEqual(otherSources.problems, [], `driver refused dividend entry: ${otherSources.problems.join(", ")}`);
  assert.equal(otherSources.valid, true);
  assert.equal(otherSources.headerRowId, "999919");
});

test("gaps surface as mapping gaps, agent fields stay empty", () => {
  const noSubcategory = buildDividendFinalTaxPlan({ certificates: CERTS, selectedSubcategories: [] });
  assert.equal(noSubcategory.kind, "gap");
  assert.equal(noSubcategory.category, "DIVIDEND_SUBCATEGORY_UNSELECTED");
  assert.equal(buildDividendTaxDeductionAgentFields(noSubcategory).length, 0);

  const split = buildDividendFinalTaxPlan({ certificates: CERTS, selectedSubcategories: ["ipp", "reit-and-other"] });
  assert.equal(split.kind, "gap");
  assert.equal(split.category, "DIVIDEND_SPLIT_UNREVIEWED");

  const nothing = buildDividendFinalTaxPlan({ certificates: [], selectedSubcategories: ["ipp"] });
  assert.equal(nothing.kind, "none");
});

test("field map: dividend rows never enter the generic fill surface", () => {
  const map = buildPortalFieldMap({
    taxYear: 2026,
    filerType: "myself",
    taxpayerListStatus: "ATL",
    ledgerEntries: [
      { id: "d1", entryType: "INCOME", category: "DIVIDEND", description: "Dividend", amount: 185000 },
    ],
    dividendCertificates: CERTS,
    dividendSubcategories: ["reit-and-other"],
  });
  const dividendCodes = new Set(
    Object.values(DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW).map((t) => t.code),
  );
  const leaked = (map.adjustableTaxFields || []).filter((entry) => dividendCodes.has(String(entry.irisCode)));
  assert.deepEqual(
    leaked,
    [],
    "dividend Final Tax rows must not be queued on the tour-driven row-fill surface (section tour renders these grids empty)",
  );
  assert.equal(
    map.mappingGaps.unmappedCategories.some((g) => g.category === "DIVIDEND_SUBCATEGORY_UNSELECTED"),
    false,
    "a selected subcategory with mapped certificates must not show up as a gap",
  );
});

test("field map: certificates without a selected subcategory stay a named gap", () => {
  const map = buildPortalFieldMap({
    taxYear: 2026,
    filerType: "myself",
    taxpayerListStatus: "ATL",
    ledgerEntries: [
      { id: "d1", entryType: "INCOME", category: "DIVIDEND", description: "Dividend", amount: 185000 },
    ],
    dividendCertificates: CERTS,
    dividendSubcategories: [],
  });
  const gap = map.mappingGaps.unmappedCategories.find((g) => g.category === "DIVIDEND_SUBCATEGORY_UNSELECTED");
  assert.ok(gap, "gap must be surfaced");
  assert.equal(gap.totalAmount, 185000);
  assert.match(gap.reason, /Dividend income card/i);
});
