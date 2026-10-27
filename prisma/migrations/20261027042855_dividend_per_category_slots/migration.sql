-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "dividendSubcategory" TEXT;

-- RenameIndex
ALTER INDEX "ServicesInvoiceEvidence_filingDraftId_sourceDocumentId_invoiceK" RENAME TO "ServicesInvoiceEvidence_filingDraftId_sourceDocumentId_invo_key";
