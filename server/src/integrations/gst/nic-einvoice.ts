// ──────────────────────────────────────────────────────────────────
// NIC GSP — E-Invoice Adapter
// ──────────────────────────────────────────────────────────────────
// Real GSP adapter for NIC (National Informatics Centre) e-invoice API.
// Requires government credentials + GSP subscription.
//
// API Docs: https://einvoice1.gst.gov.in/Others/MasterCodes
// ──────────────────────────────────────────────────────────────────

import type {
  EInvoiceProvider,
  EInvoiceDocument,
} from "./einvoice";

export interface NICCredentials {
  gstin: string;
  userId: string;
  password: string;
  apiKey: string;
  apiSecret: string;
  requestTokenUrl: string;
  irnUrl: string;
  cancelUrl: string;
  ewpUrl: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonMap = Record<string, any>;

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

async function getToken(creds: NICCredentials): Promise<string> {
  if (cachedToken && tokenExpiry && tokenExpiry > new Date()) {
    return cachedToken;
  }

  const response = await fetch(creds.requestTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_name: creds.userId,
      password: creds.password,
      ip_address: "127.0.0.1",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NIC token request failed: ${error}`);
  }

  const data = (await response.json()) as JsonMap;
  cachedToken = data.token as string;
  tokenExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000);
  
  return cachedToken!;
}

export const nicEInvoiceProvider: EInvoiceProvider = {
  name: "nic",
  
  async generateIrn(doc: EInvoiceDocument) {
    const creds: NICCredentials = {
      gstin: doc.sellerGstin,
      userId: process.env.NIC_USER_ID || "",
      password: process.env.NIC_PASSWORD || "",
      apiKey: process.env.NIC_API_KEY || "",
      apiSecret: process.env.NIC_API_SECRET || "",
      requestTokenUrl: process.env.NIC_TOKEN_URL || "https://einvoice1.gst.gov.in/Auth/GetToken",
      irnUrl: process.env.NIC_IRN_URL || "https://einvoice1.gst.gov.in/einvoice/Major4",
      cancelUrl: process.env.NIC_CANCEL_URL || "https://einvoice1.gst.gov.in/einvoice/Cancel4",
      ewpUrl: process.env.NIC_EWP_URL || "https://einvoice1.gst.gov.in/ewayapi1",
    };

    try {
      const token = await getToken(creds);

      const payload = {
        Version: "1.1",
        TranDtls: { SupTyp: "B2B", RegRev: "N", ECMfg: "N", ITMdtls: "N" },
        DocDtls: {
          Typ: "INV",
          No: doc.invoiceNumber,
          Dt: doc.invoiceDate.toISOString().split("T")[0],
        },
        SellerDtls: {
          Gstin: doc.sellerGstin,
          TrdNm: doc.sellerName || "",
          Addr1: doc.sellerAddress || "NA",
          Loc: doc.sellerLocation || "NA",
          Pin: doc.sellerPin || 110001,
          Stcd: doc.sellerState || "07",
          Ph: doc.sellerPhone || "",
          Email: doc.sellerEmail || "",
        },
        BuyerDtls: {
          Gstin: doc.buyerGstin || "URP",
          TrdNm: doc.buyerName,
          Addr1: doc.buyerAddress || "NA",
          Loc: doc.buyerLocation || "NA",
          Pin: doc.buyerPin || 110001,
          Stcd: doc.buyerState || "07",
          Pos: doc.placeOfSupply || "07",
        },
        ItemList: doc.items.map((item, idx) => ({
          SlNo: String(idx + 1),
          PrdDesc: item.description,
          IsServc: item.isService ? "Y" : "N",
          HsnCd: item.hsnCode || "998314",
          Qty: item.quantity || 1,
          Unit: item.unit || "NOS",
          UnitPrice: item.unitPrice,
          TotAmt: item.totalAmount,
          Discount: item.discount || 0,
          PreTaxVal: item.preTaxValue || item.totalAmount,
          AssAmt: item.assessableAmount || item.totalAmount,
          GstRt: item.gstRate || 18,
          CgstAmt: item.cgstAmount || 0,
          SgstAmt: item.sgstAmount || 0,
          IgstAmt: item.igstAmount || 0,
          CesRt: 0, CesAmt: 0, CesNonAdvlAmt: 0,
          StateCesRt: 0, StateCesAmt: 0, StateCesNonAdvlAmt: 0,
          OthChrg: 0, TotItemVal: item.totalAmount,
        })),
        ValDtls: {
          AssVal: doc.subtotal,
          CgstVal: doc.cgst,
          SgstVal: doc.sgst,
          IgstVal: doc.igst,
          CessVal: 0, StCesVal: 0, RndOffAmt: 0,
          TotInvVal: doc.total,
        },
      };

      const response = await fetch(creds.irnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Gstin: creds.gstin,
          Userid: creds.userId,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ Data: JSON.stringify(payload) }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as JsonMap;
        throw new Error(String(error.message || `NIC API error: ${response.status}`));
      }

      const data = (await response.json()) as JsonMap;
      
      if (data.Status === 1) {
        const result: JsonMap = data.Result;
        return {
          irn: result.Irn as string,
          qrCode: (result.QrCode as string) || (result.SignedQRCode as string),
          irnDate: new Date().toISOString(),
          signedInvoice: (result.SignedInvoice as string) || "",
        };
      } else {
        throw new Error(String(data.Message || "IRN generation failed"));
      }
    } catch (error) {
      throw new Error(`NIC E-Invoice failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
  
  async verifyIrn(irn: string) {
    try {
      const creds: NICCredentials = {
        gstin: process.env.NIC_GSTIN || "",
        userId: process.env.NIC_USER_ID || "",
        password: process.env.NIC_PASSWORD || "",
        apiKey: process.env.NIC_API_KEY || "",
        apiSecret: process.env.NIC_API_SECRET || "",
        requestTokenUrl: process.env.NIC_TOKEN_URL || "https://einvoice1.gst.gov.in/Auth/GetToken",
        irnUrl: process.env.NIC_IRN_URL || "https://einvoice1.gst.gov.in/einvoice/Major4",
        cancelUrl: process.env.NIC_CANCEL_URL || "",
        ewpUrl: process.env.NIC_EWP_URL || "",
      };

      const token = await getToken(creds);

      const response = await fetch(`${creds.irnUrl}?action=VRFY&irn=${irn}`, {
        headers: {
          Gstin: creds.gstin,
          Userid: creds.userId,
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`NIC verification failed: ${response.status}`);
      }

      const data = (await response.json()) as JsonMap;
      
      return {
        valid: data.Status === 1,
        details: String(data.Result?.Status || data.Message),
      };
    } catch (error) {
      return {
        valid: false,
        details: error instanceof Error ? error.message : "Verification failed",
      };
    }
  },
  
  async cancelIrn(irn: string, reason: string, remark: string) {
    try {
      const creds: NICCredentials = {
        gstin: process.env.NIC_GSTIN || "",
        userId: process.env.NIC_USER_ID || "",
        password: process.env.NIC_PASSWORD || "",
        apiKey: process.env.NIC_API_KEY || "",
        apiSecret: process.env.NIC_API_SECRET || "",
        requestTokenUrl: process.env.NIC_TOKEN_URL || "https://einvoice1.gst.gov.in/Auth/GetToken",
        irnUrl: process.env.NIC_IRN_URL || "https://einvoice1.gst.gov.in/einvoice/Major4",
        cancelUrl: process.env.NIC_CANCEL_URL || "https://einvoice1.gst.gov.in/einvoice/Cancel4",
        ewpUrl: process.env.NIC_EWP_URL || "",
      };

      const token = await getToken(creds);

      const response = await fetch(creds.cancelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Gstin: creds.gstin,
          Userid: creds.userId,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          Irn: irn,
          Rsn: reason,
          Rmrk: remark || "Cancelled via PRIMELEAD AI",
        }),
      });

      if (!response.ok) {
        throw new Error(`NIC cancel failed: ${response.status}`);
      }

      const data = (await response.json()) as JsonMap;
      
      return {
        cancelled: data.Status === 1,
      };
    } catch (error) {
      throw new Error(`NIC Cancel failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
};
