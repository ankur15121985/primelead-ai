import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Download, ArrowRight, Sparkles, ShieldCheck, Zap, Smartphone } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';

export function QRGenerator() {
  useSeo('Free QR Code Generator — LeadFlow AI', 'Generate professional QR codes for your business in seconds. No signup required. Perfect for shop counters, exhibitions, pamphlets and visiting cards.');
  
  const [text, setText] = useState('');
  const [size, setSize] = useState(300);
  const [ qrUrl, setQrUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  const generateQR = () => {
    if (!text.trim()) return;
    setGenerating(true);
    // Use free QR code API
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    setQrUrl(url);
    setGenerating(false);
  };

  const downloadQR = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-code-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">Free Tool</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">QR Code Generator</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Generate professional QR codes for your business in seconds. No signup required.
        </p>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-2">
        {/* Generator Form */}
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="text-xl font-bold">Create Your QR Code</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter any text, URL, or contact information to generate a QR code.
          </p>
          
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Text or URL</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://yourwebsite.com, contact info, or any text..."
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">QR Code Size</label>
              <div className="mt-1.5 flex gap-3">
                {[200, 300, 400, 500].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      size === s 
                        ? 'bg-primary text-primary-foreground' 
                        : 'border bg-background hover:bg-accent'
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            </div>
            
            <button
              onClick={generateQR}
              disabled={!text.trim() || generating}
              className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="text-xl font-bold">Preview</h2>
          <div className="mt-6 flex flex-col items-center justify-center min-h-[300px]">
            {qrUrl ? (
              <div className="text-center">
                <img 
                  src={qrUrl} 
                  alt="Generated QR Code" 
                  className="rounded-xl border shadow-lg"
                  style={{ width: size, height: size }}
                />
                <button
                  onClick={downloadQR}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border bg-background px-6 py-2.5 font-semibold transition-all hover:bg-accent"
                >
                  <Download className="h-4 w-4" /> Download PNG
                </button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <QrCode className="mx-auto h-16 w-16 opacity-20" />
                <p className="mt-4">Enter text or URL and click "Generate"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          { icon: Zap, title: 'Instant Generation', desc: 'Create QR codes in milliseconds with our fast, reliable generator.' },
          { icon: Smartphone, title: 'Mobile Optimized', desc: 'QR codes work perfectly on all smartphones and scanning apps.' },
          { icon: ShieldCheck, title: 'No Signup Required', desc: 'Use the tool freely without creating an account or providing email.' },
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
        <h2 className="text-2xl font-bold">Need more than just QR codes?</h2>
        <p className="mt-2 max-w-xl mx-auto text-muted-foreground">
          LeadFlow AI includes QR lead capture, auto-assignment, follow-up reminders, and AI-powered messaging — all in one CRM built for Indian agencies.
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
