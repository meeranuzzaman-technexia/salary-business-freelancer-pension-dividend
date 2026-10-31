import { getTy2026SubcategoryOptions } from "./rules/ty2026/subcategories";
import { bankProfitCertificateSubcategory } from "./bank-profit-document-slot";

export type FilingDocumentSlotResolution =
  | {
      success: true;
      documentType: string;
      bankAccountId: string | null;
      /**
       * TY2026 dividend-card subcategory when the upload targets a
       * per-category dividend certificate slot ("dividend_certificate:ipp",
       * "dividend_certificate:reit-and-other", ...). Null otherwise.
       */
      dividendSubcategory: string | null;
    }
  | {
      success: false;
      error: string;
    };

const BANK_STATEMENT_TYPE = "bank_statement";
const BANK_STATEMENT_SLOT_PREFIX = `${BANK_STATEMENT_TYPE}:`;
const DIVIDEND_CERT_TYPE = "dividend_certificate";
const DIVIDEND_CERT_SLOT_PREFIX = `${DIVIDEND_CERT_TYPE}:`;

/**
 * Builds an exact document-slot predicate. Keeping `bankAccountId: null` for
 * non-bank documents is intentional: omitting the property would make the
 * lookup span every account-linked document of the same type.
 */
export function buildFilingDocumentSlotWhere(
  filingDraftId: string,
  userId: string,
  documentType: string,
  bankAccountId: string | null,
  dividendSubcategory: string | null = null,
) {
  // Same rule as bankAccountId: keep the key present (null when it does not
  // apply) so a per-category dividend slot never collides with, or replaces,
  // another category's certificate in the same draft.
  return { filingDraftId, userId, documentType, bankAccountId, dividendSubcategory };
}

/** The allowed dividend certificate slot identities, from the TY2026 catalog. */
function isKnownDividendSubcategory(value: string) {
  return getTy2026SubcategoryOptions("dividend").some(
    (option) => option.subcategory === value,
  );
}

/** Builds the only valid bank-statement cleanup boundary. */
export function buildBankStatementCleanupWhere(
  filingDraftId: string,
  userId: string,
  bankAccountId: string,
  previousDocumentId: string,
) {
  return {
    filingDraftId,
    userId,
    OR: [{ sourceDocumentId: previousDocumentId }, { bankAccountId }],
  };
}

/**
 * Resolves the authoritative server-side identity of a filing-document slot.
 *
 * Bank statements must always identify one configured account. The account ID
 * embedded in `bank_statement:<id>` cannot be overridden by another form field,
 * and non-bank documents cannot be linked to a bank account.
 */
export function resolveFilingDocumentSlot(
  requestedDocumentType: string,
  suppliedBankAccountId?: string | null,
): FilingDocumentSlotResolution {
  const requestedType = requestedDocumentType.trim();
  const suppliedAccountId = suppliedBankAccountId?.trim() || null;

  if (requestedType.startsWith("bank_certificate:") && !bankProfitCertificateSubcategory(requestedType)) {
    return { success: false, error: "Select a supported Bank Profit category" };
  }

  if (requestedType.startsWith(BANK_STATEMENT_SLOT_PREFIX)) {
    const slotAccountId = requestedType
      .slice(BANK_STATEMENT_SLOT_PREFIX.length)
      .trim();

    if (!slotAccountId) {
      return {
        success: false,
        error: "Select the bank account for this statement",
      };
    }

    if (suppliedAccountId && suppliedAccountId !== slotAccountId) {
      return {
        success: false,
        error: "Bank statement slot does not match the selected account",
      };
    }

    return {
      success: true,
      documentType: BANK_STATEMENT_TYPE,
      bankAccountId: slotAccountId,
      dividendSubcategory: null,
    };
  }

  if (requestedType.startsWith(DIVIDEND_CERT_SLOT_PREFIX)) {
    const subcategory = requestedType.slice(DIVIDEND_CERT_SLOT_PREFIX.length).trim();
    if (!subcategory) {
      return { success: false, error: "Select the dividend category for this certificate" };
    }
    if (!isKnownDividendSubcategory(subcategory)) {
      return { success: false, error: "Dividend certificate slot does not match a TY2026 dividend category" };
    }
    if (suppliedAccountId) {
      return {
        success: false,
        error: "Only bank statements can be linked to a bank account",
      };
    }
    return {
      success: true,
      documentType: DIVIDEND_CERT_TYPE,
      bankAccountId: null,
      dividendSubcategory: subcategory,
    };
  }

  if (requestedType === BANK_STATEMENT_TYPE) {
    if (!suppliedAccountId) {
      return {
        success: false,
        error: "Select the bank account for this statement",
      };
    }

    return {
      success: true,
      documentType: BANK_STATEMENT_TYPE,
      bankAccountId: suppliedAccountId,
      dividendSubcategory: null,
    };
  }

  if (suppliedAccountId) {
    return {
      success: false,
      error: "Only bank statements can be linked to a bank account",
    };
  }

  return {
    success: true,
    documentType: requestedType,
    bankAccountId: null,
    dividendSubcategory: null,
  };
}
