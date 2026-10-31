"use strict";
/**
 * Unit coverage for the Bank Account modal's injected page operation. These
 * tests deliberately run with JSDOM rather than Playwright so the strict
 * field resolver can be verified even where a Chromium binary is unavailable.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const driver = require("../electron-connect/iris-balance-sheet-driver.js");

const IBAN = "PK35HABB0018067900476803";

const checkboxes = ({
  foreign = false,
  foreignLabel = "Foreign Currency/Others",
  foreignChecked = false,
} = {}) => `
  <mat-checkbox><input type="checkbox"><label>Joint Account</label></mat-checkbox>
  ${foreign ? `<mat-checkbox><input type="checkbox"${foreignChecked ? " checked" : ""}><label>${foreignLabel}</label></mat-checkbox>` : ""}
`;

function dialog(body, options = {}) {
  return `<!doctype html><html><body>
    <mat-dialog-container role="dialog">
      <h6 class="mat-mdc-dialog-title"><span class="left">Bank Account</span></h6>
      <mat-dialog-content>${checkboxes(options)}${body}</mat-dialog-content>
      <mat-dialog-actions><button type="button">CLOSE</button><button type="button" disabled>ADD</button></mat-dialog-actions>
    </mat-dialog-container>
  </body></html>`;
}

function form(label, attrs = "") {
  return `<mat-form-field><mat-label>${label}</mat-label><input type="text" ${attrs}></mat-form-field>`;
}

function page(html) {
  return new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
}

function run(dom, step) {
  return dom.window.eval(driver.buildPageScript(step));
}

const ibanSet = () => ({ op: "dialog_set", kind: "bank", field: "iban", value: IBAN });

test("Bank modal resolves exactly one visible IBAN field by its Material label when placeholder is blank", () => {
  const dom = page(
    dialog(
      form("IBAN *", 'data-field="iban" placeholder=""') +
        form("Account Title", 'placeholder="Account Title" disabled') +
        form("Bank Name", 'placeholder="Bank Name" disabled'),
    ),
  );

  const before = run(dom, { op: "dialog_state", kind: "bank" });
  assert.deepEqual(
    { iban: before.iban, joint: before.joint, foreignCurrency: before.foreignCurrency },
    { iban: "", joint: "unchecked", foreignCurrency: "absent" },
  );
  const set = run(dom, ibanSet());
  assert.equal(set.status, "set");
  assert.equal(set.readback, IBAN);
  assert.equal(dom.window.document.querySelector('[data-field="iban"]').value, IBAN);
  assert.equal(run(dom, { op: "dialog_state", kind: "bank" }).iban, IBAN);
});

test("Bank modal normalizes an IBAN required-marker in the placeholder", () => {
  const dom = page(dialog('<input data-field="iban" type="text" placeholder="  IBAN *  ">'));
  const set = run(dom, ibanSet());
  assert.equal(set.status, "set");
  assert.equal(set.readback, IBAN);
  assert.equal(dom.window.document.querySelector('[data-field="iban"]').value, IBAN);
});

test("The supplied live aliases resolve the unique IBAN/Mobile Wallet No. field and read the actual Foreign Currency Account state", () => {
  const dom = page(
    dialog(
      form("IBAN/Mobile Wallet No. *", 'data-field="iban" placeholder="IBAN/Mobile Wallet No. *"') +
        form("Account Title", 'placeholder="Account Title" disabled') +
        form("Bank Name", 'placeholder="Bank Name" disabled'),
      { foreign: true, foreignLabel: "Foreign Currency Account" },
    ),
  );
  const state = run(dom, { op: "dialog_state", kind: "bank" });
  assert.equal(state.foreignCurrency, "unchecked");
  const set = run(dom, ibanSet());
  assert.equal(set.status, "set");
  assert.equal(set.readback, IBAN);
  assert.equal(dom.window.document.querySelector('[data-field="iban"]').value, IBAN);
});

test("The supplied Foreign Currency Account alias remains unsafe when it is checked", () => {
  const dom = page(dialog(form("IBAN/Mobile Wallet No. *", 'data-field="iban" placeholder="IBAN/Mobile Wallet No. *"'), {
    foreign: true,
    foreignLabel: "Foreign Currency Account",
    foreignChecked: true,
  }));
  assert.equal(run(dom, { op: "dialog_state", kind: "bank" }).foreignCurrency, "checked");
});

test("Two semantic IBAN fields are ambiguous and neither is changed", () => {
  const dom = page(
    dialog(
      form("IBAN *", 'data-field="first" placeholder=""') +
        form("IBAN", 'data-field="second" placeholder=""'),
    ),
  );
  const result = run(dom, ibanSet());
  assert.equal(result.status, "ambiguous_field");
  assert.equal(result.diagnostic.matchedBy, "label");
  assert.equal(result.diagnostic.inputs.length, 2);
  assert.equal(dom.window.document.querySelector('[data-field="first"]').value, "");
  assert.equal(dom.window.document.querySelector('[data-field="second"]').value, "");
});

test("Unknown fields remain not-found and diagnostics contain structure but no field values", () => {
  const dom = page(dialog(form("Reference Number", 'placeholder="Reference" value="must-not-leak"')));
  const result = run(dom, ibanSet());
  assert.equal(result.status, "field_not_found");
  assert.equal(result.diagnostic.matchedBy, "none");
  assert.deepEqual(JSON.parse(JSON.stringify(result.diagnostic.inputs)), [
    {
      label: "reference number",
      placeholder: "Reference",
      formControlName: "",
      type: "text",
      disabled: false,
      readOnly: false,
    },
  ]);
  assert.equal(JSON.stringify(result.diagnostic).includes("must-not-leak"), false);
  assert.equal(dom.window.document.querySelector('input[placeholder="Reference"]').value, "must-not-leak");
});

test("A uniquely labelled but disabled IBAN field is never typed", () => {
  const dom = page(dialog(form("IBAN", 'data-field="iban" placeholder="" disabled')));
  const result = run(dom, ibanSet());
  assert.equal(result.status, "field_disabled");
  assert.equal(dom.window.document.querySelector('[data-field="iban"]').value, "");
});
