import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from './Navbar';

export function Footer() {
  return (
    <footer className="border-t bg-slate-950 text-slate-300">
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm text-slate-400">
            The AI-powered CRM for Indian businesses. Every lead captured. Every lead assigned. Every follow-up remembered.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Product</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-white" to="/features">Features</Link></li>
            <li><Link className="hover:text-white" to="/lead-sources">Lead Sources</Link></li>
            <li><Link className="hover:text-white" to="/pricing">Pricing</Link></li>
            <li><Link className="hover:text-white" to="/faq">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Company</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-white" to="/contact">Contact</Link></li>
            <li><Link className="hover:text-white" to="/signup">Start Free</Link></li>
            <li><Link className="hover:text-white" to="/login">Log in</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Get in touch</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> hello@primelead.example</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +91 98xxx xxxxx</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Bengaluru, India</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} PRIMELEAD AI. All rights reserved. (Demo product — not affiliated with any real CRM.)</p>
          <p className="flex gap-4">
            <span>Terms</span><span>Privacy</span><span>Security</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
