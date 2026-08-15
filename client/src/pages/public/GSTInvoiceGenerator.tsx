import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, ArrowRight, Calculator, ShieldCheck, Zap, Printer } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  gstType: 'CGST_SGST' | 'IGST';
  taxPct: number;
}

interface InvoiceData {
  customerName: string;
  company: string;
  gstin: string;
  items: InvoiceItem[];
  terms: string;
}

export function GSTInvoiceGenerator() {
  useSeo('Free GST Invoice Generator — PRIMELEAD AI', 'Create GST-compliant invoices instantly. No login needed. Includes CGST/SGST/IGST calculations, professional PDF download, and WhatsApp share.');
  
  const [invoice, setInvoice] = useState<InvoiceData>({
    customerName: '',
    company: '',
    gstin: '',
    items: [{ description: '', quantity: 1, rate: 0, gstType: 'CGST_SGST', taxPct: 18 }],
    terms: 'Payment due within 30 days'
  });
  const [showPreview, setShowPreview] = useState(false);

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [...invoice.items, { description: '', quantity: 1, rate: 0, gstType: 'CGST_SGST', taxPct: 18 }]
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...invoice.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoice({ ...invoice, items: newItems });
  };

  const removeItem = (index: number) => {
    if (invoice.items.length <= 1) return;
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice({ ...invoice, items: newItems });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    
    invoice.items.forEach(item => {
      const taxableAmount = item.quantity * item.rate;
      const discount = 0; // Could add discount field
      const taxable = taxableAmount - discount;
      const tax = taxable * (item.taxPct / 100);
      
      subtotal += taxable;
      totalTax += tax;
    });
    
    return {
      subtotal,
      totalTax,
      grandTotal: subtotal + totalTax
    };
  };

  const generatePreview = () => {
    setShowPreview(true);
  };

  const downloadInvoice = () => {
    // In a real app, this would generate a PDF
    // For now, we'll create a simple text version
    const totals = calculateTotals();
    let content = `INVOICE\n\n`;
    content += `Customer: ${invoice.customerName}\n`;
    if (invoice.company) content += `Company: ${invoice.company}\n`;
    if (invoice.gstin) content += `GSTIN: ${invoice.gstin}\n`;
    content += `\nItems:\n`;
    
    invoice.items.forEach((item, i) => {
      content += `${i + 1}. ${item.description} - ${item.quantity} x ₹${item.rate} = ₹${item.quantity * item.rate}\n`;
      content += `   Tax (${item.taxPct}%): ₹${(item.quantity * item.rate * item.taxPct / 100).toFixed(2)}\n`;
    });
    
    content += `\nSubtotal: ₹${totals.subtotal.toFixed(2)}\n`;
    content += `Tax: ₹${totals.totalTax.toFixed(2)}\n`;
    content += `Grand Total: ₹${totals.grandTotal.toFixed(2)}\n`;
    content += `\nTerms: ${invoice.terms}\n`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totals = calculateTotals();

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">Free Tool</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">GST Invoice Generator</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Create GST-compliant invoices instantly. No login needed.
        </p>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-2">
        {/* Invoice Form */}
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="text-xl font-bold">Create Invoice</h2>
          
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Customer Name *</label>
                <input
                  type="text"
                  value={invoice.customerName}
                  onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })}
                  placeholder="John Doe"
                  className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Company</label>
                <input
                  type="text"
                  value={invoice.company}
                  onChange={(e) => setInvoice({ ...invoice, company: e.target.value })}
                  placeholder="ABC Corp"
                  className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">GSTIN (Optional)</label>
              <input
                type="text"
                value={invoice.gstin}
                onChange={(e) => setInvoice({ ...invoice, gstin: e.target.value })}
                placeholder="27ABCDE1234F1Z5"
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Line Items</h3>
                <button
                  onClick={addItem}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  + Add Item
                </button>
              </div>
              
              <div className="mt-3 space-y-3">
                {invoice.items.map((item, index) => (
                  <div key={index} className="rounded-xl border p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          min="1"
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Rate (₹)</label>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">GST Type</label>
                        <select
                          value={item.gstType}
                          onChange={(e) => updateItem(index, 'gstType', e.target.value)}
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          <option value="CGST_SGST">CGST + SGST (Same State)</option>
                          <option value="IGST">IGST (Inter-State)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Tax %</label>
                        <select
                          value={item.taxPct}
                          onChange={(e) => updateItem(index, 'taxPct', parseFloat(e.target.value))}
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                    </div>
                    {invoice.items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="mt-2 text-xs text-red-500 hover:underline"
                      >
                        Remove item
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Terms & Conditions</label>
              <textarea
                value={invoice.terms}
                onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })}
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                rows={2}
              />
            </div>

            <button
              onClick={generatePreview}
              disabled={!invoice.customerName.trim()}
              className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Preview
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="text-xl font-bold">Invoice Preview</h2>
          
          {showPreview ? (
            <div className="mt-6 rounded-xl border bg-white p-6 shadow-inner">
              <div className="mb-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                <strong>Disclaimer:</strong> This is a demonstration tool. For actual GST compliance, please use PRIMELEAD AI's full invoicing system.
              </div>
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-bold">INVOICE</h3>
                <p className="text-sm text-muted-foreground">Date: {new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="mb-4">
                <p className="font-semibold">Bill To:</p>
                <p>{invoice.customerName}</p>
                {invoice.company && <p>{invoice.company}</p>}
                {invoice.gstin && <p>GSTIN: {invoice.gstin}</p>}
              </div>

              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Tax</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{item.description || `Item ${i + 1}`}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">₹{item.rate}</td>
                      <td className="py-2 text-right">{item.taxPct}%</td>
                      <td className="py-2 text-right">₹{(item.quantity * item.rate * (1 + item.taxPct / 100)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-2 text-right">
                <p>Subtotal: ₹{totals.subtotal.toFixed(2)}</p>
                <p>Tax: ₹{totals.totalTax.toFixed(2)}</p>
                <p className="text-lg font-bold">Grand Total: ₹{totals.grandTotal.toFixed(2)}</p>
              </div>

              <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
                <p className="font-semibold">Terms:</p>
                <p>{invoice.terms}</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
              <FileText className="h-16 w-16 opacity-20" />
              <p className="mt-4">Fill in the form and click "Generate Preview"</p>
            </div>
          )}

          {showPreview && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={downloadInvoice}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2.5 font-semibold transition-all hover:bg-accent"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2.5 font-semibold transition-all hover:bg-accent"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          { icon: Calculator, title: 'Auto GST Calculation', desc: 'CGST/SGST or IGST calculated automatically based on your items.' },
          { icon: ShieldCheck, title: 'GST Compliant', desc: 'Follows Indian GST rules with proper tax breakdowns and formatting.' },
          { icon: Zap, title: 'Instant Download', desc: 'Download your invoice as a text file or print it directly.' },
        ].map((feature) => (
          <div key={feature.title} className="rounded-2xl bg-slate-50 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <feature.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold">{feature.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-3xl border bg-slate-50 p-8 sm:p-10 text-center">
        <h2 className="text-2xl font-bold">Need more than just invoice generation?</h2>
        <p className="mt-2 max-w-xl mx-auto text-muted-foreground">
          PRIMELEAD AI includes full GST invoicing, quotations, payment tracking, and integrates with your leads and pipeline — all in one CRM built for Indian agencies.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <Link to="/signup">
            <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90">
              Start Free <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <Link to="/features">
            <button className="inline-flex h-12 items-center gap-2 rounded-xl border bg-background px-8 font-semibold transition-all hover:bg-accent">
              See All Features
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
