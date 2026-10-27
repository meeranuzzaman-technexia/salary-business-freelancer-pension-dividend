#!/usr/bin/env node
/**
 * Final proof step for the dividend §150 autofill: run the REAL Electron
 * driver (electron-connect/iris-tax-deduction-driver.js) against the REAL
 * captured IRIS Other Sources > Tax Deductions page inside jsdom. This is not
 * a re-implementation — the shipped `taxDeductionProbe` executes in the
 * captured DOM and types into the captured inputs.
 *
 * Needs the decoded capture HTML of the page with the Final Tax grid rows
 * rendered (e.g. "Other Sources — Tax Deductions Popup all fields selected"
 * decoded):
 *
 *   IRIS_DUMP=/path/to/capture.html node scripts/verify-dividend-autofill-dom.cjs
 *
 * jsdom cannot report CSS visibility, so the capture's geometry is stubbed
 * visible — every other check (labels, header row id 999919, editable cells,
 * readback) is the live driver's own logic.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const dump = process.env.IRIS_DUMP || "";
if (!dump || !fs.existsSync(dump)) {
  console.error(
    "IRIS_DUMP=<decoded capture html> required — point it at the Other Sources Tax Deductions capture (Final Tax grid rendered).",
  );
  process.exit(2);
}

const { JSDOM } = require("jsdom");
const driver = require("../electron-connect/iris-tax-deduction-driver.js");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function main() {
  const html = fs.readFileSync(dump, "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  window.Element.prototype.scrollIntoView = () => {};
  if (!window.document.getElementById("64030055")) {
    throw new Error("capture does not render the 64030055 Final Tax row — is this the right page?");
  }

  const frame = {
    url: "https://iris.fbr.gov.pk/nitr/workflow",
    executeJavaScript: async (Code) => window.eval(Code),
  };
  const windowInstance = {
    webContents: {
      mainFrame: { framesInSubtree: [frame] },
      getURL: () => frame.url,
    },
  };
  // findFrame walks framesInSubtree; keep webContents itself working too.
  windowInstance.webContents.url = frame.url;

  const field = {
    key: "64030055:dividendFinalTax",
    regime: "final",
    irisCode: "64030055",
    label: "Dividend u/s 150 @15%",
    panelTitle: "Final Tax",
    pickerTitle: "Add Final Tax",
    headerRowId: "999919",
    headers: ["Taxable Amount", "Tax Deducted", "Tax Chargeable"],
    cells: "EED",
    values: [
      { columnIndex: 0, column: "Taxable Amount", value: "185000" },
      { columnIndex: 1, column: "Tax Deducted", value: "27750" },
    ],
  };

  const outcome = await driver.fillTaxDeductions(windowInstance, [field], {
    mode: "live",
    verifyDocument: async () => ({ ok: true, status: "document_verified" }),
    spec: driver.OTHER_SOURCES_SPEC,
    sectionId: driver.OTHER_SOURCES_SECTION_ID,
    censusView: driver.OTHER_SOURCES_CENSUS_VIEW,
    typedRegimes: driver.OTHER_SOURCES_TYPED_REGIMES,
    typedCells: driver.OTHER_SOURCES_TYPED_CELLS,
    attempts: 3,
    intervalMs: 1,
    settleMs: 0,
    sleep: () => Promise.resolve(),
  });

  console.log("driver outcome:", outcome.ok, "| reason:", outcome.reason || "(none)");
  for (const r of outcome.results || []) {
    console.log(`  result: ${r.irisCode} [${r.columnIndex}] -> ${r.status}${r.setupStatus ? ` (${r.setupStatus})` : ""}`);
  }
  assert(outcome.ok === true, "driver completed the dividend Final Tax row");
  assert((outcome.results || []).length === 2, "one result per typed cell (Taxable Amount + Tax Deducted)");
  assert(
    (outcome.results || []).every((r) => r.status === "filled" && r.sectionId === "other_sources_tax_deductions"),
    "both cells FILLED and tagged to the Other Sources section id",
  );
  const row = window.document.getElementById("64030055");
  const inputs = [...row.querySelectorAll("input")];
  assert(inputs[0] && inputs[0].value.replace(/[\s,]/g, "") === "185000", "Taxable Amount input holds 185000");
  assert(inputs[1] && inputs[1].value.replace(/[\s,]/g, "") === "27750", "Tax Deducted input holds 27750");
  console.log(process.exitCode ? "\nDOM fill test FAILED" : "\nDOM fill test: dividend §150 row typed end-to-end by the real driver.");
}

main().catch((error) => {
  console.error(`FAIL: ${error && error.message}`);
  process.exitCode = 1;
});
