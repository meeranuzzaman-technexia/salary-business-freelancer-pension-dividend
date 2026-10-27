#!/usr/bin/env node
/**
 * Probe: is the DIVIDEND auto-approve fix actually LIVE in this checkout?
 *
 * Run from the repo root:   node scripts/probe-dividend-classify.cjs
 *
 * It checks the four pieces the fix depends on and prints [OK]/[STALE]
 * for each — no server, no database, no network needed.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
let failures = 0;

const root = path.join(__dirname, "..");

// 1) Source-level checks: does each file actually contain the fix?
const checks = [
  {
    file: "lib/tax/bank-classification-rules.ts",
    needles: ['"dividend"', 'category: "DIVIDEND"'],
    label: "DIVIDEND keyword rule in classification rules",
  },
  {
    file: "lib/tax/business-bank-categories.ts",
    needles: ["isDividendIncomeSelected"],
    label: "isDividendIncomeSelected() gate helper",
  },
  {
    file: "app/actions/bank-classification.ts",
    needles: ["dividendEnabled", 'suggestedCategory === "DIVIDEND"'],
    label: "auto-approve DIVIDEND branch",
  },
  {
    file: "app/actions/extraction.ts",
    needles: ['mapping: "DIVIDEND_CERTIFICATE"'],
    label: "dividend certificate mapping branch (Task 5)",
  },
  {
    file: "components/tax/filing/wizard-documents-step.tsx",
    needles: ['slot.documentType === "dividend_certificate"'],
    label: "mapping button whitelist (Task 5)",
  },
  {
    file: "package.json",
    needles: ["verify:dividend-mapping"],
    label: "verify scripts wired",
  },
];
for (const check of checks) {
  const text = fs.readFileSync(path.join(root, check.file), "utf8");
  const missing = check.needles.filter((needle) => !text.includes(needle));
  if (missing.length === 0) {
    console.log(`[OK]    ${check.label}  (${check.file})`);
  } else {
    failures += 1;
    console.log(`[STALE] ${check.label}  (${check.file}) — missing: ${missing.join(", ")}`);
  }
}

// 2) Behaviour check: what does the real rule engine say about the
//    exact narration from the fixture statement?
let ts;
try {
  ts = require("typescript");
} catch {
  console.log("[SKIP]  typescript module not available — run this from the repo root after npm install.");
  process.exit(failures ? 1 : 0);
}
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(root, request.slice(2));
  return originalResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (module, filename) {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
};

const rules = require(path.join(root, "lib/tax/bank-classification-rules.ts"));
const narration = "HUB POWER HUBCO FINAL DIVIDEND FY2025 CNIC 4220106970933";
const out = rules.classifyTransaction(
  {
    id: "probe",
    bankAccountId: "a1",
    transactionDate: new Date("2025-09-25"),
    description: narration,
    debit: null,
    credit: "185000",
  },
  [],
);
console.log(`\nclassifyTransaction("${narration}")`);
console.log(`  -> status=${out.status}  entryType=${out.entryType}  category=${out.category}`);
if (out.status === "SUGGESTED" && out.category === "DIVIDEND") {
  console.log("[OK]    Rule engine suggests DIVIDEND income — button will appear after Classify.");
} else {
  failures += 1;
  console.log("[STALE] Rule engine does NOT know dividend — auto-approve button can never appear.");
}

console.log(failures ? `\n${failures} stale piece(s) found.` : "\nAll pieces live — if the app still shows 'Potential income', restart Next dev (rm -rf .next) and click Classify again.");
process.exit(failures ? 1 : 0);
