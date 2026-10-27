/**
 * The 8 yearly totals of the Business profit step (Myself filing), by their
 * Business Books label. Since 16-Oct they come from the reviewed, mapped
 * Business Books (lib/tax/business-books-figures.ts); the packet check in
 * lib/tax/business-schedule-fields.ts still compares them with the saved
 * Business Profit as a safety net.
 *
 * This module deliberately imports NOTHING: the review screen and the wizard
 * read these names while their own module bodies run, and reading them
 * through a module that could be mid-evaluation gives
 * "Cannot convert undefined or null to object" (seen in Next.js dev, 16-Oct).
 * A cycle cannot run through a module with no imports.
 */
export const BUSINESS_BOOKS_ANNUAL_LABELS = {
  businessGrossSales: "Sales for the year",
  businessOtherRevenue: "Other business receipts",
  businessCostOfSales: "Cost of sales",
  businessOperatingExpenses: "Business expenses",
  businessDepreciation: "Depreciation",
  businessInadmissibleExpenses: "Expenses that are not allowed",
  businessLossBroughtForward: "Business loss brought forward",
  businessWithholdingDeducted: "Tax already deducted on business receipts",
} as const;

export type BusinessBooksAnnualKey = keyof typeof BUSINESS_BOOKS_ANNUAL_LABELS;

/** The 8 keys, in the order the Business profit step shows them. */
export const BUSINESS_BOOKS_FIGURE_KEYS: readonly BusinessBooksAnnualKey[] = [
  "businessGrossSales",
  "businessOtherRevenue",
  "businessCostOfSales",
  "businessOperatingExpenses",
  "businessDepreciation",
  "businessInadmissibleExpenses",
  "businessLossBroughtForward",
  "businessWithholdingDeducted",
];

/**
 * The 7 labels after Sales: Sales has its own "positive amount" requirement,
 * these 7 accept 0 (a blank stops Save & Approve Map).
 */
export const BUSINESS_BOOKS_FIGURE_LABELS_AFTER_SALES: readonly string[] =
  BUSINESS_BOOKS_FIGURE_KEYS.filter(
    (key) => key !== "businessGrossSales",
  ).map((key) => BUSINESS_BOOKS_ANNUAL_LABELS[key]);

/** Every yearly figure blank: the state before the Books are mapped. */
export function emptyBusinessBooksFigures(): Record<
  BusinessBooksAnnualKey,
  null
> {
  const out = {} as Record<BusinessBooksAnnualKey, null>;
  for (const key of BUSINESS_BOOKS_FIGURE_KEYS) out[key] = null;
  return out;
}
