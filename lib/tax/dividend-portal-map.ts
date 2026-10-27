/**
 * Dividend (Section 150) → IRIS Other Sources > Tax Deductions > Final Tax.
 *
 * Verified against the live Other Sources captures (2026-10-26): dividend has
 * NO adjustable-tax route in IRIS — every §150 bucket renders as a Final Tax
 * row with two editable cells (Taxable Amount = GROSS dividend, Tax Deducted =
 * actual certificate withholding) plus an IRIS-computed Tax Chargeable. The
 * receipts row 500103 "Dividend Income" derives its Final-Tax and Total cells
 * from these rows, so nothing is ever written there by the agent.
 *
 * Every bucket the TY2026 rate card prices (lib/tax/rules/ty2026/catalog.ts)
 * maps 1:1 onto a captured IRIS row. Categories with no row stay gaps —
 * a guess is worse than a manual-entry notice.
 */
import { IRIS_CODES } from "./iris-field-codes";
import { PORTAL_ROW_EVIDENCE } from "./portal-row-evidence";
import type { TaxDeductionAgentField } from "./business-tax-deductions";

/**
 * The Other Sources > Tax Deductions > Final Tax grid labels as captured
 * 2026-10-26. NOT business-tax-deductions' final regime: that constants set
 * addresses the Business left tab whose Final Tax header row is 999915; the
 * same-named grid on Other Sources has header row 999919 (999918 is the
 * Adjustable grid there). The Electron driver enforces these strings against
 * the live page before typing, so they must match the capture exactly.
 */
const DIVIDEND_FINAL_TAX_GRID_SPEC = {
  panelTitle: "Final Tax",
  pickerTitle: "Add Final Tax",
  headerRowId: "999919",
  headers: ["Taxable Amount", "Tax Deducted", "Tax Chargeable"] as const,
};

export type DividendCertificateInput = {
  /** Mapped certificate document id (evidence anchor). */
  documentId: string;
  /** GROSS dividend printed on the certificate — the IRIS Taxable Amount. */
  grossAmount: number;
  /** Actual tax withheld u/s 150 printed on the certificate (0 is legal). */
  taxWithheld: number;
  /**
   * Per-category slot binding (Document.dividendSubcategory). Null on rows
   * uploaded before per-category slots existed — acceptable only when the
   * filing selects exactly one dividend category.
   */
  subcategory?: string | null;
};

export type DividendFinalTaxRow = {
  irisCode: string;
  irisDescription: string;
  subcategories: string[];
  grossAmount: number;
  taxWithheld: number;
  documentIds: string[];
};

/** Amount the packet must flag for manual IRIS entry even when rows exist. */
export type DividendManualNote = {
  category: string;
  amount: number;
  documentIds: string[];
  reason: string;
};

export type DividendPortalPlan =
  | { kind: "rows"; rows: DividendFinalTaxRow[]; manualNotes?: DividendManualNote[] }
  | {
      kind: "gap";
      category: string;
      totalAmount: number;
      reason: string;
      documentIds: string[];
    }
  | { kind: "none" };

/**
 * Rate-card subcategory → captured IRIS Final Tax row. Every TY2026 dividend
 * family member is covered, including §236Z bonus shares (captured 2026-10-27
 * as Final Tax row 64151351 in Other Sources > Tax Deductions).
 */
export const DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW: Readonly<
  Record<string, { code: string; description: string }>
> = {
  // Independent Power Producer dividend — ATL 7.5% (non-ATL 15%).
  ipp: {
    code: IRIS_CODES.FINAL_DIVIDEND_IPP.code,
    description: IRIS_CODES.FINAL_DIVIDEND_IPP.description,
  },
  // REIT and the general company dividend — ATL 15%.
  "reit-and-other": {
    code: IRIS_CODES.FINAL_DIVIDEND_15.code,
    description: IRIS_CODES.FINAL_DIVIDEND_15.description,
  },
  // Composite mutual fund (debt portion 25% / equity portion 15%): IRIS has a
  // single mutual-fund row; the composite split only affects the engine's
  // expectation, never the IRIS target.
  "mutual-fund-proportional": {
    code: IRIS_CODES.FINAL_DIVIDEND_MF_DEBT.code,
    description: IRIS_CODES.FINAL_DIVIDEND_MF_DEBT.description,
  },
  "mutual-fund-debt-50-or-more": {
    code: IRIS_CODES.FINAL_DIVIDEND_MF_DEBT.code,
    description: IRIS_CODES.FINAL_DIVIDEND_MF_DEBT.description,
  },
  // Dividend received by the REIT scheme itself from an SPV — 0% withholding.
  "reit-receives-from-spv": {
    code: IRIS_CODES.FINAL_DIVIDEND_SPV_ZERO.code,
    description: IRIS_CODES.FINAL_DIVIDEND_SPV_ZERO.description,
  },
  // Any other recipient from that SPV — ATL 35% (non-ATL 70%).
  "other-recipient-from-spv": {
    code: IRIS_CODES.FINAL_DIVIDEND_SPV_OTHER_35.code,
    description: IRIS_CODES.FINAL_DIVIDEND_SPV_OTHER_35.description,
  },
  // Company whose own income is exempt / nil — recipient rate 25%.
  "exempt-loss-or-credit-company": {
    code: IRIS_CODES.FINAL_DIVIDEND_EXEMPT_COMPANY_25.code,
    description: IRIS_CODES.FINAL_DIVIDEND_EXEMPT_COMPANY_25.description,
  },
  // §236Z bonus shares — captured 2026-10-27 (Other Sources > Tax Deductions
  // > Final Tax row 64151351, EED cells proven by the emit-evidence census).
  "bonus-shares": {
    code: IRIS_CODES.FINAL_DIVIDEND_BONUS_236Z.code,
    description: IRIS_CODES.FINAL_DIVIDEND_BONUS_236Z.description,
  },
};

/**
 * Turns mapped dividend certificates plus the filing's selected dividend
 * subcategory(ies) into Final Tax rows. The certificates are the ONLY source
 * of gross/WHT the engine may send to the portal — bank receipts are net and
 * a certificate-less dividend therefore stays a manual-entry gap.
 */
export function buildDividendFinalTaxPlan(params: {
  certificates: DividendCertificateInput[];
  selectedSubcategories: string[];
}): DividendPortalPlan {
  const { certificates, selectedSubcategories } = params;
  if (certificates.length === 0) return { kind: "none" };

  const grossTotal = certificates.reduce(function sum(a, c) {
    return a + c.grossAmount;
  }, 0);
  const documentIds = certificates.map((c) => c.documentId);

  // The income card carries the payer-type selection; without it the right
  // IRIS row cannot be proven from a certificate alone.
  const selected = [...selectedSubcategories];
  if (selected.length === 0) {
    return {
      kind: "gap",
      category: "DIVIDEND_SUBCATEGORY_UNSELECTED",
      totalAmount: grossTotal,
      documentIds,
      reason:
        "Mapped dividend certificate(s) exist but the Dividend income card has no category selected. Select the payer/fund type on the dividend step so the §150 rate (and its IRIS Final Tax row) is proven, then regenerate.",
    };
  }

  // Multi-category filings keep one §150 Final Tax row per selected
  // category, each proven from the certificates bound to that category's
  // upload slot (Document.dividendSubcategory). Certificates carrying no
  // binding — uploaded before per-category slots existed — cannot be
  // attributed, and a selected category with no certificate keeps its gap:
  // an unproven attribution would put the gross on the wrong IRIS row.
  if (selected.length > 1) {
    if (certificates.some((cert) => !cert.subcategory)) {
      return {
        kind: "gap",
        category: "DIVIDEND_SPLIT_UNREVIEWED",
        totalAmount: grossTotal,
        documentIds,
        reason:
          "A dividend certificate was uploaded without its category. Delete it and upload it against that category's slot on the Documents step, then regenerate.",
      };
    }
    const missingSubcategories = selected.filter(
      (subcategory) =>
        !certificates.some((cert) => cert.subcategory === subcategory),
    );
    if (missingSubcategories.length > 0) {
      return {
        kind: "gap",
        category: "DIVIDEND_SPLIT_UNREVIEWED",
        totalAmount: grossTotal,
        documentIds,
        reason:
          `No approved certificate is bound to ${missingSubcategories
            .map((subcategory) => `\"${subcategory}\"`)
            .join(", ")} — upload and review the certificate(s) for each selected category first.`,
      };
    }
    // Two categories can land on the same captured IRIS row (the mutual-fund
    // rows share 64330050): IRIS only offers one add-row per code, so those
    // amounts merge into a single row and keep both evidence anchors.
    const merged = new Map<string, DividendFinalTaxRow>();
    const pushRow = (row: DividendFinalTaxRow) => {
      const existing = merged.get(row.irisCode);
      if (!existing) {
        merged.set(row.irisCode, row);
        return;
      }
      existing.grossAmount += row.grossAmount;
      existing.taxWithheld += row.taxWithheld;
      existing.subcategories.push(...row.subcategories);
      existing.documentIds.push(...row.documentIds);
    };
    for (const subcategory of selected) {
      const target = DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW[subcategory];
      const group = certificates.filter(
        (cert) => cert.subcategory === subcategory,
      );
      if (!target) {
        return {
          kind: "gap",
          category: "DIVIDEND_SUBCATEGORY_UNMAPPED",
          totalAmount: group.reduce((a, c) => a + c.grossAmount, 0),
          documentIds: group.map((c) => c.documentId),
          reason:
            `Dividend category "${subcategory}" has no captured IRIS Final Tax row yet. Enter it by hand in Other Sources > Tax Deductions > Final Tax and capture that page so the code can be proven.`,
        };
      }
      pushRow({
        irisCode: target.code,
        irisDescription: target.description,
        subcategories: [subcategory],
        grossAmount: group.reduce((a, c) => a + c.grossAmount, 0),
        taxWithheld: group.reduce((a, c) => a + c.taxWithheld, 0),
        documentIds: group.map((c) => c.documentId),
      });
    }
    return { kind: "rows", rows: [...merged.values()] };
  }

  const target = DIVIDEND_SUBCATEGORY_TO_FINAL_TAX_ROW[selected[0]];
  if (!target) {
    return {
      kind: "gap",
      category: "DIVIDEND_SUBCATEGORY_UNMAPPED",
      totalAmount: grossTotal,
      documentIds,
      reason:
        `Dividend category "${selected[0]}" has no captured IRIS Final Tax row yet. Enter it by hand in Other Sources > Tax Deductions > Final Tax and capture that page so the code can be proven.`,
    };
  }

  const taxWithheldTotal = certificates.reduce(function sum(a, c) {
    return a + c.taxWithheld;
  }, 0);
  return {
    kind: "rows",
    rows: [
      {
        irisCode: target.code,
        irisDescription: target.description,
        subcategories: [selected[0]],
        grossAmount: grossTotal,
        taxWithheld: taxWithheldTotal,
        documentIds,
      },
    ],
  };
}


/**
 * Companion payload for the Electron driver: one agent entry per proven Final
 * Tax row, in the exact shape iris-tax-deduction-driver.js consumes. The cell
 * pattern is taken from the CAPTURED row evidence (never assumed) — a code
 * whose capture disagrees with the Final Tax grid shape is skipped rather
 * than fitted to a guess.
 */
export function buildDividendTaxDeductionAgentFields(
  plan: DividendPortalPlan,
): TaxDeductionAgentField[] {
  if (plan.kind !== "rows") return [];
  const spec = DIVIDEND_FINAL_TAX_GRID_SPEC;
  const fields: TaxDeductionAgentField[] = [];
  for (const row of plan.rows) {
    const evidence = PORTAL_ROW_EVIDENCE[row.irisCode];
    const writable = evidence?.writeableInputIndexes ?? [];
    const cells = spec.headers
      .map((_, index) => (writable.includes(index) ? "E" : "D"))
      .join("");
    if (cells !== "EED") continue; // never fit the dividend row to an assumed pattern
    fields.push({
      key: `${row.irisCode}:dividendFinalTax`,
      regime: "final",
      irisCode: row.irisCode,
      label: row.irisDescription,
      panelTitle: spec.panelTitle,
      pickerTitle: spec.pickerTitle,
      headerRowId: spec.headerRowId,
      headers: [...spec.headers],
      cells,
      values: [
        {
          columnIndex: 0,
          column: spec.headers[0],
          value: String(Math.round(row.grossAmount)),
        },
        {
          columnIndex: 1,
          column: spec.headers[1],
          value: String(Math.round(row.taxWithheld)),
        },
      ],
    });
  }
  return fields;
}

/**
 * Which certificates qualify: extraction approved ("MAPPED"), gross strictly
 * positive, withholding non-negative. Anything else returns reasons so the
 * packet can surface a precise gap instead of silently dropping evidence.
 */
/** Same normalisation the extraction action applies to certificate fields. */
function normalizedFieldLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function extractFieldValue(
  fields: Array<{ label: string; value: unknown }>,
  labels: string[],
) {
  const wanted = labels.map(normalizedFieldLabel);
  return fields.find((field) => {
    const actual = normalizedFieldLabel(field.label);
    return wanted.some((label) => actual === label || actual.includes(label));
  })?.value;
}

function parseMoneyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Kept byte-identical in intent with app/actions/extraction.ts mapping
 * branch — the certificate labels the review screen saves. */
export function dividendAmountsFromExtraction(
  fields: Array<{ label: string; value: unknown }>,
): { grossAmount: number | null; taxWithheld: number | null } {
  return {
    grossAmount: parseMoneyValue(
      extractFieldValue(fields, [
        "gross_dividend_pkr",
        "gross_dividend",
        "total_gross_dividend",
        "total_dividend",
      ]),
    ),
    taxWithheld: parseMoneyValue(
      extractFieldValue(fields, [
        "withholding_tax_u_s_150",
        "withholding_tax_u_s_236z",
        "withholding_tax",
        "tax_deducted_at_source",
        "tax_deducted",
        "tax_withheld",
      ]),
    ),
  };
}

/**
 * Composite mutual-fund certificates must print the debt/equity split. Parse
 * the same labelled fields so the engine prices the composite from EVIDENCE,
 * falling back to the taxpayer's declared portions only when the certificate
 * carries them. Either both print, or the certificate gives nothing usable.
 */
export function dividendProportionsFromExtraction(
  fields: Array<{ label: string; value: unknown }>,
): { debtPortion: number | null; equityPortion: number | null } {
  return {
    debtPortion: parseMoneyValue(
      extractFieldValue(fields, [
        "debt_derived_portion_of_dividend",
        "debt_derived_portion",
        "debt_portion",
        "debt_share",
      ]),
    ),
    equityPortion: parseMoneyValue(
      extractFieldValue(fields, [
        "equity_derived_portion_of_dividend",
        "equity_derived_portion",
        "equity_portion",
        "equity_share",
      ]),
    ),
  };
}

export function validateDividendCertificateAmounts(cert: {
  grossAmount: number | null;
  taxWithheld: number | null;
}): string | null {
  if (cert.grossAmount === null || cert.grossAmount === undefined) {
    return "Certificate has no gross dividend figure. Review the mapped certificate fields.";
  }
  if (!(cert.grossAmount > 0)) {
    return "Certificate gross dividend must be a positive amount.";
  }
  if (
    cert.taxWithheld !== null &&
    cert.taxWithheld !== undefined &&
    cert.taxWithheld < 0
  ) {
    return "Certificate withholding cannot be negative.";
  }
  if (cert.taxWithheld !== null && cert.taxWithheld !== undefined) {
    if (cert.taxWithheld > cert.grossAmount) {
      return "Certificate withholding exceeds its gross dividend — review the mapped fields.";
    }
  }
  return null;
}
