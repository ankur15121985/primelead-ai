// ──────────────────────────────────────────────────────────────────
// ClearTax GSP — E-Invoice & E-Way Bill Adapter
// ──────────────────────────────────────────────────────────────────
// Real GSP adapter for ClearTax e-invoice API.
// Requires ClearTax GSP subscription + API credentials.
//
// API Docs: https://developers.cleartax.in/
// ──────────────────────────────────────────────────────────────────

import type {
  EInvoiceProvider,
  EInvoiceDocument,
} from "./einvoice";

export interface ClearTaxCredentials {
  gstin: string;
  authToken: string;
  baseUrl: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonMap = Record<string, any>;

export const clearTaxEInvoiceProvider: EInvoiceProvider = {
  name: "cleartax",
  
  async generateIrn(doc: EInvoiceDocument) {
    const creds: ClearTaxCredentials = {
      gstin: doc.sellerGstin,
      authToken: process.env.CLEARTAX_AUTH_TOKEN || "",
      baseUrl: process.env.CLEARTAX_API_URL || "https://api-sandbox.cleartax.in",
    };

    if (!creds.authToken) {
      throw new Error("ClearTax requires CLEARTAX_AUTH_TOKEN environment variable");
    }

    const payload = {
      transaction_name: "B2B",
      document_number: doc.invoiceNumber,
      document_date: doc.invoiceDate.toISOString().split("T")[0],
      document_type: "INV",
      seller_gstin: doc.sellerGstin,
      seller_legal_name: doc.sellerName || "",
      seller_address1: doc.sellerAddress || "NA",
      seller_location: doc.sellerLocation || "NA",
      seller_pincode: doc.sellerPin || 110001,
      seller_state_code: doc.sellerState || "07",
      seller_phone: doc.sellerPhone || "",
      seller_email: doc.sellerEmail || "",
      buyer_gstin: doc.buyerGstin || "URP",
      buyer_legal_name: doc.buyerName,
      buyer_address1: doc.buyerAddress || "NA",
      buyer_location: doc.buyerLocation || "NA",
      buyer_pincode: doc.buyerPin || 110001,
      buyer_state_code: doc.buyerState || "07",
      place_of_supply: doc.placeOfSupply || "07",
      line_items: doc.items.map((item, idx) => ({
        serial_number: idx + 1,
        product_description: item.description,
        is_service: item.isService || false,
        hsn_code: item.hsnCode || "998314",
        quantity: item.quantity || 1,
        unit: item.unit || "NOS",
        unit_price: item.unitPrice,
        total_amount: item.totalAmount,
        discount: item.discount || 0,
        taxable_amount: item.assessableAmount || item.totalAmount,
        gst_rate: item.gstRate || 18,
        cgst_amount: item.cgstAmount || 0,
        sgst_amount: item.sgstAmount || 0,
        igst_amount: item.igstAmount || 0,
        cess_amount: 0,
        state_cess_amount: 0,
        pre_tax_amount: item.preTaxValue || 0,
      })),
      total_value: doc.subtotal,
      total_cgst: doc.cgst,
      total_sgst: doc.sgst,
      total_igst: doc.igst,
      total_cess: 0,
      total_state_cess: 0,
      total_discount: 0,
      round_off: 0,
      grand_total: doc.total,
      payment_terms: doc.paymentTerms || "",
      notes: doc.notes || "",
    };

    const response = await fetch(`${creds.baseUrl}/api/1/invoice/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.authToken}`,
        "x-gstin": creds.gstin,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as JsonMap;
      throw new Error(String(error.message || `ClearTax API error: ${response.status}`));
    }

    const data = (await response.json()) as JsonMap;
    
    if (data.status === "SUCCESS" && data.data) {
      const result: JsonMap = data.data;
      return {
        irn: result.irn as string,
        qrCode: (result.qrcode as string) || (result.signed_qrcode as string),
        irnDate: String(result.acknowledgement_date || new Date().toISOString()),
        signedInvoice: (result.signed_invoice as string) || "",
      };
    } else {
      throw new Error(String(data.message || data.error || "IRN generation failed"));
    }
  },
  
  async verifyIrn(irn: string) {
    const creds: ClearTaxCredentials = {
      gstin: process.env.CLEARTAX_GSTIN || "",
      authToken: process.env.CLEARTAX_AUTH_TOKEN || "",
      baseUrl: process.env.CLEARTAX_API_URL || "https://api-sandbox.cleartax.in",
    };

    if (!creds.authToken) {
      return { valid: false, details: "ClearTax requires CLEARTAX_AUTH_TOKEN" };
    }

    try {
      const response = await fetch(
        `${creds.baseUrl}/api/1/invoice/verify?irn=${irn}`,
        {
          headers: {
            Authorization: `Bearer ${creds.authToken}`,
            "x-gstin": creds.gstin,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`ClearTax verification failed: ${response.status}`);
      }

      const data = (await response.json()) as JsonMap;
      
      return {
        valid: data.status === "SUCCESS" && (data.data?.invoice_status === "ACTIVE"),
        details: String(data.data?.invoice_status || data.message),
      };
    } catch (error) {
      return {
        valid: false,
        details: error instanceof Error ? error.message : "Verification failed",
      };
    }
  },
  
  async cancelIrn(irn: string, reason: string, remark: string) {
    const creds: ClearTaxCredentials = {
      gstin: process.env.CLEARTAX_GSTIN || "",
      authToken: process.env.CLEARTAX_AUTH_TOKEN || "",
      baseUrl: process.env.CLEARTAX_API_URL || "https://api-sandbox.cleartax.in",
    };

    if (!creds.authToken) {
      throw new Error("ClearTax requires CLEARTAX_AUTH_TOKEN");
    }

    try {
      const response = await fetch(`${creds.baseUrl}/api/1/invoice/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.authToken}`,
          "x-gstin": creds.gstin,
        },
        body: JSON.stringify({
          irn,
          cancel_reason: reason,
          cancel_remarks: remark || "Cancelled via PRIMELEAD AI",
        }),
      });

      if (!response.ok) {
        throw new Error(`ClearTax cancel failed: ${response.status}`);
      }

      const data = (await response.json()) as JsonMap;
      
      return {
        cancelled: data.status === "SUCCESS",
      };
    } catch (error) {
      throw new Error(`ClearTax Cancel failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
};
