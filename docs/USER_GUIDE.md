# LeadFlow AI — User Guide

> **For business owners, managers and salespeople.** This guide walks you through every feature, step by step. No technical knowledge needed.

**LeadFlow AI** is your team's CRM — it captures every enquiry, assigns it to the right salesperson, reminds you to follow up, and lets AI write your follow-up messages.

## 🎯 Built for Indian Marketing & Web Dev Agencies

LeadFlow AI is specifically designed for Indian marketing and web development agencies. Unlike generic CRMs like Zoho or HubSpot, we focus on:

- **GST-compliant quotations & invoices** — out of the box, no configuration needed
- **WhatsApp-native workflows** — your leads already live in WhatsApp, so should your CRM
- **AI follow-up writer** — never write another follow-up from scratch
- **QR code lead capture** — capture leads from your office, storefront, or events

This specificity makes us the perfect fit for 3-5 person agencies who find generic CRMs overwhelming.

**Quick links**

| I want to… | Go to |
|---|---|
| Log in | [Section 1](#1-logging-in) |
| See my day at a glance | [Section 2](#2-the-dashboard) |
| Add a lead | [Section 3](#3-adding-and-managing-leads) |
| Drag leads through the sales pipeline | [Section 4](#4-the-sales-pipeline) |
| Never miss a follow-up | [Section 5](#5-follow-ups--tasks) |
| Get leads from a printed QR code | [Section 6](#6-qr-lead-capture) |
| Let AI write a follow-up message | [Section 7](#7-ai-follow-up-writer) |
| Manage my team | [Section 8](#8-team-management) |
| Change my profile / organisation settings | [Section 9](#9-settings) |

---

## Getting started

### 1. Logging in

1. Open the LeadFlow AI web address you were given (e.g. `http://localhost:5173`).
2. Click **Log in** (top-right).
3. Enter the email and password your manager gave you.

> **First time?** Your organisation owner can invite you by email, or you can click **Start Free** and create your own business account in under 2 minutes.

### The three roles

| Role | What they see & do |
|---|---|
| **Owner** | Everything — billing, team, settings, integrations |
| **Admin** | Everything except billing and ownership-sensitive settings |
| **Manager** | Team's leads and reports |
| **Salesperson** | Their own leads and assigned follow-ups |

---

## 2. The Dashboard

The dashboard is your **morning check-in**. You'll see:

- **Top cards** — Total Leads, New Leads, Qualified, Won Deals, Pipeline Value, Revenue, Conversion Rate, Overdue Follow-ups
- **Charts** — leads by source, leads by salesperson, conversion funnel, 14-day trend
- **Today's Follow-ups** — the most important list on the screen: *who do I need to contact today?*
- **Overdue Leads** — follow-ups that slipped (fix these first!)
- **Recent Leads** and **Top Salespeople**

**Tip:** If you see red **Overdue** cards, open the Follow-ups page — those need your attention first.

---

## 3. Adding and managing leads

### Add a lead manually

1. Click **Leads** in the left menu.
2. Click **Add lead** (top-right).
3. Fill in the customer's **name** (required), phone, email, company, source, priority and expected value.
4. Click **Create lead**.

> **What happens next, automatically:** LeadFlow checks for duplicates, gives the lead a **score** (0–100 based on priority, value and contact details), and **assigns it to the least-loaded salesperson**. The salesperson gets a notification.

### The leads table

- **Search** — type any name, phone, email or company in the search box
- **Filter** — by status, source, owner, priority, date range
- **Sort** — click any column header
- **Pagination** — 20 leads per page

### Bulk actions

Tick the checkboxes of several leads, then use the toolbar to:

- **Assign** them all to one salesperson
- **Change status** in one go
- **Add a tag** (e.g. "hot", "festival offer")
- **Delete** them

### Import from Excel / CSV

1. Click **Import** on the Leads page.
2. Choose a `.csv` file with columns: `Name, Phone, Email, Company, Expected Value, Notes`.
3. Click **Upload**. Duplicates are skipped automatically and you'll see how many were created.

### Export

Click **Export** to download your current view (with filters applied) as a CSV file.

---

## Lead detail page

Click any lead to open its full profile:

- **Left:** customer info, tags, notes, custom fields, and the **timeline** (every call, WhatsApp, email, note, stage change, quotation…)
- **Right sidebar:** assigned salesperson, next follow-up, score, priority, **AI suggestions**

**Action buttons (one tap):**

- 📞 **Call** — opens the dialer
- 💬 **WhatsApp** — opens WhatsApp with a pre-filled message
- ✉️ **Email** — opens your email app
- **Add note** — record what happened
- **Schedule follow-up** — pick a date & time; it lands on your Follow-ups page
- **Change stage / owner / status** — move the lead forward
- **Mark won / lost**

---

## 4. The sales pipeline

The pipeline is a **Kanban board** with columns:

`New → Contacted → Qualified → Proposal → Negotiation → Won | Lost`

**To move a lead:** simply **drag and drop** the card into the next column.

- Every move is **logged in the lead's timeline** automatically.
- Cards show the customer, company, value, owner, source, next follow-up and score — so you can prioritise at a glance.
- **Won** deals count toward your revenue; **Lost** ones are kept for learning, not forgotten.

---

## 5. Follow-ups & tasks

This page answers the single most useful question in sales: **"Who do I need to contact today?"**

Open **Follow-ups** from the menu. You get views:

| View | Shows |
|---|---|
| **Today** | Follow-ups due today (including this hour) |
| **Overdue** | Missed follow-ups — red, act now |
| **Upcoming** | The next few days |
| **Missed** | Follow-ups that lapsed (auto-detected) |
| **Completed** | What you've finished |

**To complete a follow-up:** tap the circular checkbox. Done!

**To create one:** open any lead → **Schedule follow-up**, pick a kind (Call / WhatsApp / Email / Meeting / Task), a date & time, and notes.

> LeadFlow **reminds you automatically** — overdue follow-ups raise notifications, and overdue tasks are detected in the background every minute.

---

## 6. QR lead capture

Print a QR code, stick it on your shop counter, exhibition stall, visiting card, or bill — customers scan it, fill a tiny form on their phone, and the lead lands straight in your CRM.

### Create a QR code (Owner / Admin / Manager)

1. Click **QR Codes** in the left menu.
2. Click **Create QR Code**.
3. Give it a **title** (e.g. "Shop Counter"), pick or create a **campaign**, add a short description, and choose which fields customers fill in (Name, Phone, Email, Message).
4. Click **Generate QR code**.

### Use it

- **Download the PNG** and print it (or display it on a screen).
- **Copy the link** to send by WhatsApp/email.
- Every card shows live stats: **scans**, **leads captured**, and **conversion %**.

### What the customer sees

When they scan, they get a clean mobile form with your business name. They submit their details → a lead is created with source **QR**, linked to the campaign, **auto-assigned** to a salesperson, and the salesperson is notified.

> **Pause or delete** a QR from its card (the pause button stops new submissions; delete removes it permanently — both are manager-only actions).

---

## 7. Quotations (Sell → Quotations)

1. Click **Quotations → New quotation**.
2. Add the customer (name, company, GSTIN, email).
3. Add line items: description, quantity, rate and GST %. Pick **CGST+SGST** for same-state or **IGST** for inter-state — totals update live.
4. Add a document discount if any, set how many days the quote is valid, and add payment terms.
5. **Create quotation** — a number like `QT-2026-0001` is generated automatically.
6. **Download PDF** and send it by email/WhatsApp. Mark it **Sent**, then **Accepted** once the customer agrees.
7. One click on **Convert to invoice** turns it into a real invoice — no re-typing.

> Tip: quotations linked to a lead (use the lead detail page → Quotation button) show up on that lead's timeline automatically.

## 8. Invoices (Sell → Invoices)

1. Click **Invoices → New invoice**, add the customer and items (optionally with HSN/SAC codes).
2. Set a due date and terms; GST is calculated automatically.
3. **Download PDF** and share it. Track money in: click the ₹ icon to **record a payment** — the invoice auto-advances to *Partially paid* or *Paid*.
4. The status badge shows *Draft / Sent / Partially paid / Paid / Overdue* at a glance, and the list shows how much is still outstanding.

## 9. AI CRM assistant (Sell → AI Assistant)

Ask questions in plain words and get answers from **your** live CRM data:

- *"How many leads this week?"*
- *"Which leads are overdue for a follow-up?"*
- *"Show me leads worth more than ₹5 lakh."*
- *"Which source gives us the most leads?"*
- *"What is our conversion rate?"*

Salespeople only ever see their own leads' data in the answers. If no AI key is configured, the assistant explains how to enable it (Settings → AI) instead of pretending to work.

## 10. Integrations (Grow → Integrations)

Connect lead sources so enquiries flow in automatically:

1. Open **Integrations** and pick a source (WhatsApp, Facebook, IndiaMART, JustDial, Shopify, Zapier…).
2. Click **Connect** — you get a **webhook URL** and a one-time **secret**.
3. In the external system (or your developer), POST leads to that URL with the `x-webhook-secret` header. Each lead is deduplicated, auto-assigned to a salesperson, and appears instantly.
4. Use **Pause/Resume** to stop incoming leads without disconnecting, or **Disconnect** to remove it.

## 11. Reports (Sell → Reports)

Pick a date range and see: leads by source, by owner, by status, a daily trend, conversion & win rates, quotation/invoice value and revenue collected. Use **Export CSV** for your own analysis.

## 12. Billing (Grow → Billing)

See your current plan, switch between **Monthly/Yearly**, upgrade to Growth or Business, and review payment history. In the demo, plan changes apply instantly (no payment taken).

## 13. Calendar & Contacts

- **Calendar** — every follow-up, call and meeting on one month view; click a task to jump to its lead.
- **Contacts** — keep your customer directory tidy, tag people (VIP, Property…) and link them to leads.

## 14. AI follow-up writer

Never stare at a blank message box again.

1. Open a lead.
2. Click **Write follow-up** (AI button).
3. Choose the **channel** (WhatsApp / Email / Call), a **tone** (Professional / Friendly / Short / Persuasive), a **language** (English / Hindi / Hinglish), and what you want to achieve.
4. Click **Generate** — the AI reads the lead's actual history (notes, previous messages, stage, value) and writes a ready-to-send message.
5. **Edit it if you like**, then send or copy.

> Requires an AI key to be configured. If not configured, the button shows a friendly "connect your AI key" message instead — it never pretends to work.

---

## 8. Team management

**Owners, Admins and Managers:** click **Team** to:

- **Add a member** — name, email, role (Salesperson / Manager / Admin / Owner). They'll receive a set-password email.
- **Change roles** as people grow.
- **Deactivate** accounts (they can no longer log in).

**Automatic assignment:** new leads go to the **least-loaded salesperson**. Owners can fine-tune rules per lead source in **Settings → Assignment rules** (e.g. all Website leads → Priya).

---

## 9. Settings

Click your avatar (bottom-left) → **Settings**.

- **Profile** — your name, phone, title
- **Organisation** — business name, business type
- **Assignment rules** — which source feeds which salesperson
- **AI** — paste your AI API key (stored safely server-side, never shown again)

---

## Notifications (🔔)

The bell at the top-right shows unread notifications, e.g.:

- "3 follow-ups are overdue."
- "New lead assigned to you."
- "Lead has not been contacted for 24 hours."

Click the bell to read them; they link straight to the lead.

---

## Handy tips

- 💡 **Start every day with Follow-ups → Overdue**, then **Today**.
- 💡 **Use tags** like `hot`, `festival`, `follow-up-friday` to filter fast.
- 💡 **Log every interaction** — one-tap WhatsApp/email/call notes keep the timeline (and the AI writer) accurate.
- 💡 **Mark deals Won** the moment they close — your dashboard revenue updates instantly.
- 💡 On mobile, use the **bottom navigation** — Leads, Pipeline, Follow-ups and QR Codes are always one tap away.

---

## Getting help

- Your **organisation owner** handles accounts, roles and settings.
- The person who runs this website (the *website handler*) has an **Admin panel** (accessible only with the admin email) where they can see all organisations, user accounts and system health — contact them for anything account- or server-related.

*Need the maintenance/developer guide? See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).*
