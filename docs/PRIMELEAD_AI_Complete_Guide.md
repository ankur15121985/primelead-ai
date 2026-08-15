# PRIMELEAD AI — Complete User & Admin Guide

**AI-powered CRM & Lead Management for Indian Businesses**

> Every lead captured. Every lead assigned. Every follow-up remembered.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Marketing Site & Authentication](#3-marketing-site--authentication)
4. [User Dashboard](#4-user-dashboard)
5. [Lead Management](#5-lead-management)
6. [Sales Pipeline](#6-sales-pipeline)
7. [Follow-ups & Tasks](#7-follow-ups--tasks)
8. [QR Code Lead Capture](#8-qr-code-lead-capture)
9. [Quotations (GST)](#9-quotations-gst)
10. [Invoices (GST)](#10-invoices-gst)
11. [AI CRM Assistant](#11-ai-crm-assistant)
12. [AI Follow-up Writer](#12-ai-follow-up-writer)
13. [Integrations & Webhooks](#13-integrations--webhooks)
14. [Reports & Analytics](#14-reports--analytics)
15. [Billing & Subscriptions](#15-billing--subscriptions)
16. [Team Management](#16-team-management)
17. [Settings](#17-settings)
18. [Calendar](#18-calendar)
19. [Contacts](#19-contacts)
20. [Notifications](#20-notifications)
21. [Super-Admin Panel](#21-super-admin-panel)
22. [Troubleshooting](#22-troubleshooting)

---

## 1. Introduction

### What is PRIMELEAD AI?

PRIMELEAD AI is a **production-style SaaS CRM** designed specifically for Indian businesses. It combines:

- A **premium marketing website** with professional landing pages
- A **fully working multi-tenant CRM** for lead management
- **AI-powered features** for follow-up writing and conversational insights
- **GST-compliant quotations and invoices** with PDF generation
- **QR code lead capture** for physical locations
- **Integration-ready webhooks** for WhatsApp, Facebook, IndiaMART, and more

### Target Audience

| User Type | Role | Access Level |
|-----------|------|--------------|
| Business Owner | Full control | Everything — billing, team, settings, integrations |
| Admin | Operations | Everything except billing and ownership settings |
| Manager | Team Lead | Team leads, reports, quotations, invoices |
| Salesperson | Field Sales | Own leads, follow-ups, AI writer |

### Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query
- **Backend:** Node.js, TypeScript, Express, Prisma ORM
- **Database:** SQLite (dev) / PostgreSQL (production)
- **Auth:** bcrypt, JWT (httpOnly cookies), CSRF protection, rate limiting
- **AI:** OpenAI-compatible provider abstraction

---

## 2. Getting Started

### System Requirements

- **Node.js 18+** (tested on Node 24)
- **npm** (comes with Node)
- No Docker required for development

### Installation Steps

#### Step 1: Clone and Install Dependencies

```bash
cd Compute
npm install
```

This installs all dependencies for both the client and server workspaces.

#### Step 2: Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set:
- A strong `JWT_SECRET` (e.g., `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- Optional: `AI_API_KEY` and `AI_MODEL` for AI features

#### Step 3: Initialize Database

```bash
npm run db:migrate    # Creates SQLite schema
npm run db:seed       # Seeds demo data
```

#### Step 4: Start Development Server

```bash
npm run dev           # Runs API (port 4000) + Web (port 5173)
```

Open **http://localhost:5173** in your browser.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@primelead.demo | Demo@1234 |
| Manager | manager@primelead.demo | Demo@1234 |
| Salesperson | karan@primelead.demo | Demo@1234 |
| Salesperson | pooja@primelead.demo | Demo@1234 |

---

## 3. Marketing Site & Authentication

### 3.1 Marketing Homepage

**URL:** http://localhost:5173

The homepage features:
- **Hero Section:** Value proposition with "Start Free" CTA
- **Features Grid:** Core capabilities with icons
- **Lead Sources Section:** Integration options
- **Pricing Section:** Three tiers (Starter, Growth, Business)
- **FAQ Section:** Common questions
- **Footer:** Navigation and company info

**Navigation Links:**
- Home
- Features
- Lead Sources
- Pricing
- FAQ
- Contact
- Log In

### 3.2 User Registration (Signup)

**Step-by-step:**

1. Click **"Start Free"** on the homepage or navigate to `/signup`
2. Fill in the registration form:
   - **Full Name** (required)
   - **Email Address** (required)
   - **Password** (required, minimum 8 characters)
   - **Organization Name** (required)
   - **Business Type** (dropdown: Services, Retail, Real Estate, Healthcare, Education, IT, Manufacturing, Other)
   - **Phone Number** (optional)
3. Click **"Create Account"**
4. You'll receive a verification email (in dev mode, check console logs)
5. Complete the **Onboarding Wizard**:
   - Confirm business type
   - Optionally add sample data
   - Optionally invite team members
6. You're now logged in as the **Owner** of your new organization

### 3.3 User Login

**Step-by-step:**

1. Click **"Log In"** in the top-right corner
2. Enter your **email** and **password**
3. Click **"Log In"**
4. You'll be redirected to the **Dashboard**

**Security Features:**
- Rate limiting: 5 login attempts per 10 minutes per IP
- Passwords hashed with bcrypt (10 rounds)
- JWT stored in httpOnly cookie (`pl_session`)
- CSRF protection on all state-changing requests

### 3.4 Password Reset

**Step-by-step:**

1. On the login page, click **"Forgot Password?"**
2. Enter your email address
3. Click **"Send Reset Link"**
4. Check your email for the reset link (in dev, check console)
5. Click the link and enter your new password
6. Click **"Reset Password"**
7. Log in with your new password

### 3.5 Email Verification

After signup, a verification email is sent:
1. Check your inbox (or console in dev mode)
2. Click the verification link
3. Your email is now verified

---

## 4. User Dashboard

**URL:** /app/dashboard (after login)

The dashboard is your **daily command center** showing all key metrics at a glance.

### 4.1 Top Stat Cards

| Card | Description | Color Coding |
|------|-------------|--------------|
| **Total Leads** | All leads in your CRM | Blue |
| **New Leads** | Leads not yet contacted | Green |
| **Qualified Leads** | Leads in qualification stage | Yellow |
| **Won Deals** | Successfully closed deals | Purple |
| **Pipeline Value** | Total value of open deals | Blue |
| **Revenue** | Total revenue from won deals | Green |
| **Conversion Rate** | Leads → Won percentage | Blue |
| **Overdue Follow-ups** | Follow-ups past due | Red (urgent) |

### 4.2 Charts & Visualizations

#### Leads by Source (Pie Chart)
Shows distribution of leads from:
- Website
- WhatsApp
- Facebook
- IndiaMART
- QR Code
- Referral
- Cold Call
- Other

#### Leads by Owner (Bar Chart)
Shows lead distribution across team members.

#### Conversion Funnel (Funnel Chart)
Visual pipeline showing:
1. New → Contacted
2. Contacted → Qualified
3. Qualified → Proposal
4. Proposal → Won

#### 14-Day Trend (Line Chart)
Daily lead creation trend over the last 2 weeks.

### 4.3 Today's Follow-ups

A prioritized list of follow-ups due today:
- **Call** follow-ups (phone icon)
- **WhatsApp** follow-ups (chat icon)
- **Email** follow-ups (mail icon)
- **Meeting** follow-ups (calendar icon)

Click any follow-up to jump to the lead detail page.

### 4.4 Overdue Leads

**Red-highlighted section** showing follow-ups that have passed their due date. These need immediate attention!

### 4.5 Recent Leads

Shows the 5 most recently created or updated leads with:
- Lead name
- Company
- Source
- Status
- Assigned salesperson

### 4.6 Top Salespeople

Leaderboard showing top performers by:
- Leads handled
- Deals won
- Revenue generated

---

## 5. Lead Management

**URL:** /app/leads

### 5.1 Viewing All Leads

The leads table displays all leads with:
- **Search Box:** Type any name, phone, email, or company
- **Filter Dropdowns:** Status, Source, Owner, Priority, Date Range
- **Sortable Columns:** Click any column header to sort
- **Pagination:** 20 leads per page

### 5.2 Adding a New Lead

**Step-by-step:**

1. Click **"Leads"** in the left sidebar
2. Click **"Add Lead"** button (top-right)
3. Fill in the lead form:
   - **Name** (required)
   - **Phone Number** (optional)
   - **Email** (optional)
   - **Company** (optional)
   - **Source** (dropdown: Website, WhatsApp, Facebook, etc.)
   - **Priority** (Low, Medium, High, Urgent)
   - **Expected Value** (₹ amount)
   - **Notes** (optional)
   - **Tags** (comma-separated)
4. Click **"Create Lead"**

**What happens automatically:**
- Duplicate detection (by phone/email)
- Lead scoring (0-100 based on priority, value, contact completeness)
- Auto-assignment to least-loaded salesperson
- Notification sent to assigned salesperson
- Activity logged in lead timeline

### 5.3 Lead Detail Page

Click any lead name to open the full detail view.

#### Left Panel: Lead Information
- **Customer Info:** Name, phone, email, company
- **Tags:** Color-coded labels
- **Notes:** Free-text notes
- **Custom Fields:** Organization-specific fields
- **Timeline:** Complete history of all interactions

#### Right Sidebar: Actions & Quick Info
- **Assigned Salesperson:** Current owner
- **Next Follow-up:** Scheduled date/time
- **Lead Score:** 0-100 rating
- **Priority Level:** Low/Medium/High/Urgent
- **AI Suggestions:** Contextual recommendations

#### Action Buttons (One-Tap)
- 📞 **Call:** Opens phone dialer
- 💬 **WhatsApp:** Opens WhatsApp with pre-filled message
- ✉️ **Email:** Opens email client
- **Add Note:** Record interaction details
- **Schedule Follow-up:** Pick date/time for next contact
- **Change Stage:** Move lead in pipeline
- **Change Owner:** Reassign to team member
- **Mark Won/Lost:** Close the deal

### 5.4 Bulk Operations

1. Select multiple leads using checkboxes
2. Use the bulk action toolbar:
   - **Assign:** Assign selected leads to one salesperson
   - **Change Status:** Update status for all selected
   - **Add Tag:** Apply a tag to all selected
   - **Delete:** Remove selected leads (soft delete)

### 5.5 Import Leads from CSV

**Step-by-step:**

1. Click **"Import"** on the Leads page
2. Prepare your CSV file with columns:
   - Name, Phone, Email, Company, Expected Value, Notes
3. Click **"Choose File"** and select your CSV
4. Click **"Upload"**
5. The system will:
   - Skip duplicate leads automatically
   - Show how many were created and skipped
   - Auto-assign new leads

### 5.6 Export Leads

1. Apply any filters you want (optional)
2. Click **"Export"** button
3. A CSV file downloads with your filtered view

---

## 6. Sales Pipeline

**URL:** /app/pipeline

### 6.1 Pipeline Overview

The pipeline is a **Kanban-style board** with columns representing deal stages:

```
New → Contacted → Qualified → Proposal → Negotiation → Won | Lost
```

### 6.2 Drag-and-Drop

**Step-by-step:**

1. Open the Pipeline page
2. See all leads organized by stage
3. **Drag** a lead card from one column
4. **Drop** it into the next stage column
5. The move is automatically:
   - Logged in the lead's timeline
   - Reflected in reports
   - Triggers stage-change notifications

### 6.3 Lead Card Information

Each card displays:
- Customer name
- Company
- Expected value (₹)
- Assigned salesperson
- Lead source
- Next follow-up date
- Lead score (color-coded)

### 6.4 Customizing Stages

Managers and above can:
1. Click **"Add Stage"** to create new pipeline stages
2. **Drag stages** to reorder them
3. Mark stages as **Won** or **Lost** stages

---

## 7. Follow-ups & Tasks

**URL:** /app/tasks

### 7.1 Follow-up Views

| View | Shows | Action Required |
|------|-------|-----------------|
| **Today** | Follow-ups due today | High priority |
| **Overdue** | Past-due follow-ups | URGENT - act now |
| **Upcoming** | Next few days | Plan ahead |
| **Missed** | Auto-detected missed | Review and reschedule |
| **Completed** | Finished follow-ups | Reference only |

### 7.2 Creating a Follow-up

**From a Lead Detail Page:**

1. Open any lead
2. Click **"Schedule Follow-up"**
3. Choose:
   - **Type:** Call / WhatsApp / Email / Meeting / Task
   - **Date & Time:** When to follow up
   - **Notes:** What to discuss
4. Click **"Schedule"**
5. The follow-up appears on your Tasks page

### 7.3 Completing a Follow-up

1. Open the Follow-ups page
2. Find the task you completed
3. Click the **circular checkbox** next to it
4. Done! It moves to "Completed" view

### 7.4 Automatic Overdue Detection

- The system checks every minute for overdue tasks
- Overdue tasks automatically change status to "Missed"
- Notifications are sent for overdue items
- Dashboard shows overdue count in red

### 7.5 Calendar View

**URL:** /app/calendar

- Monthly calendar showing all follow-ups, calls, and meetings
- Click any task to jump to its lead
- Color-coded by task type

---

## 8. QR Code Lead Capture

**URL:** /app/qr-codes

### 8.1 Creating a QR Code

**Step-by-step (Owner/Admin/Manager only):**

1. Click **"QR Codes"** in the sidebar
2. Click **"Create QR Code"**
3. Fill in the form:
   - **Title:** e.g., "Shop Counter", "Exhibition Stall"
   - **Description:** Brief purpose
   - **Campaign:** Select existing or create new
   - **Fields:** Choose what customers fill in:
     - Name (checkbox)
     - Phone (checkbox)
     - Email (checkbox)
     - Message (checkbox)
4. Click **"Generate QR Code"**

### 8.2 Using the QR Code

- **Download PNG:** High-resolution image for printing
- **Copy Link:** Share via WhatsApp/email
- **Display:** Show on screen at your location

### 8.3 Customer Experience

When a customer scans the QR code:
1. Opens a mobile-friendly form
2. Shows your business name and campaign
3. Fills in requested fields
4. Submits the form
5. Receives confirmation message

### 8.4 What Happens Behind the Scenes

1. A new lead is created with source = "QR"
2. Lead is linked to the campaign
3. Auto-assigned to a salesperson
4. Salesperson receives notification
5. Scan count and conversion rate updated

### 8.5 QR Code Management

Each QR code card shows:
- **Scans:** Total number of scans
- **Leads Captured:** Leads created
- **Conversion Rate:** Leads / Scans percentage

**Actions:**
- **Pause:** Stop accepting new submissions
- **Resume:** Start accepting again
- **Delete:** Remove permanently (Manager+ only)

---

## 9. Quotations (GST)

**URL:** /app/quotations

### 9.1 Creating a Quotation

**Step-by-step:**

1. Click **"Quotations"** in the sidebar
2. Click **"New Quotation"**
3. Add customer details:
   - **Customer Name** (required)
   - **Company** (optional)
   - **GSTIN** (optional, for GST compliance)
   - **Email** (optional)
   - **Phone** (optional)
4. Add line items:
   - **Description** (required)
   - **Quantity** (required)
   - **Rate** (required, in ₹)
   - **Discount %** (optional)
   - **Tax %** (e.g., 18 for 18% GST)
   - **GST Type:** CGST+SGST (same state) or IGST (inter-state)
5. Add document-level discount (optional)
6. Set validity period (e.g., 15 days)
7. Add payment terms
8. Click **"Create Quotation"**

### 9.2 Quotation Numbering

- Auto-generated: `QT-2026-0001`
- Sequential within your organization
- Unique across all quotations

### 9.3 GST Calculation

The system automatically calculates:
- **Taxable Amount** = (Quantity × Rate) - Discount
- **CGST** = Taxable × (Tax% / 2)
- **SGST** = Taxable × (Tax% / 2)
- **IGST** = Taxable × Tax% (inter-state)
- **Total** = Sum of all taxable + tax amounts - document discount

### 9.4 Quotation Workflow

```
Draft → Sent → Accepted / Rejected / Expired
         ↓
    Converted to Invoice
```

**Status Definitions:**
- **Draft:** Being prepared
- **Sent:** Shared with customer
- **Accepted:** Customer agreed
- **Rejected:** Customer declined
- **Expired:** Past validity date
- **Converted:** Already converted to invoice

### 9.5 Converting to Invoice

1. Open the quotation
2. Click **"Convert to Invoice"**
3. System creates an invoice with all customer and item details
4. Quotation status changes to "Converted"
5. Invoice appears in the Invoices section

### 9.6 Downloading PDF

1. Open any quotation
2. Click **"Download PDF"**
3. Professional A4 PDF includes:
   - Your business header
   - Customer details
   - Line items table
   - GST breakdown
   - Terms and conditions
   - Total amount

---

## 10. Invoices (GST)

**URL:** /app/invoices

### 10.1 Creating an Invoice

**Step-by-step:**

1. Click **"Invoices"** in the sidebar
2. Click **"New Invoice"**
3. Add customer details (same as quotation)
4. Add line items with HSN/SAC codes (optional)
5. Set **Due Date**
6. Add payment terms
7. Click **"Create Invoice"**

### 10.2 Invoice Numbering

- Auto-generated: `INV-2026-0001`
- Sequential within your organization

### 10.3 Recording Payments

**Step-by-step:**

1. Open the invoice
2. Click the **₹ (Payment) icon**
3. Enter the payment amount
4. Click **"Record Payment"**
5. System automatically:
   - Updates paid amount
   - Changes status to "Partially Paid" or "Paid"
   - Records payment in history
   - Logs audit trail

### 10.4 Invoice Status

| Status | Meaning |
|--------|---------|
| **Draft** | Being prepared |
| **Sent** | Shared with customer |
| **Partially Paid** | Some amount received |
| **Paid** | Fully paid |
| **Overdue** | Past due date |
| **Cancelled** | No longer valid |

### 10.5 Payment History

Each invoice shows:
- Total amount
- Amount paid
- Outstanding balance
- Payment history with dates

---

## 11. AI CRM Assistant

**URL:** /app/ai-assistant

### 11.1 What Can AI Answer?

The AI assistant reads your **live CRM data** and answers questions like:

- "How many leads do we have this week?"
- "Which leads are overdue for follow-up?"
- "Show me leads worth more than ₹5 lakh"
- "Which source gives us the most leads?"
- "What is our conversion rate?"
- "Who is our top salesperson this month?"

### 11.2 Using the Assistant

**Step-by-step:**

1. Click **"AI Assistant"** in the sidebar
2. Type your question in the chat box
3. Press Enter or click Send
4. AI responds with data-backed answer
5. Conversation is saved for reference

### 11.3 Data Privacy

- **Salespeople:** Only see their own leads' data
- **Managers/Owners:** See all organization data
- **No external data:** AI only reads from your CRM

### 11.4 Configuration

If AI says "Connect your key":
1. Go to **Settings → AI**
2. Enter your AI API key
3. Select provider (OpenAI-compatible)
4. Save settings

---

## 12. AI Follow-up Writer

### 12.1 What It Does

Never stare at a blank message box again! The AI reads the lead's:
- Complete interaction history
- Previous messages
- Current stage
- Expected value
- Notes and tags

And writes a **ready-to-send follow-up message**.

### 12.2 Using the AI Writer

**Step-by-step:**

1. Open any lead detail page
2. Click **"Write Follow-up"** (AI button)
3. Choose options:
   - **Channel:** WhatsApp / Email / Call
   - **Tone:** Professional / Friendly / Short / Persuasive
   - **Language:** English / Hindi / Hinglish
   - **Objective:** What you want to achieve
4. Click **"Generate"**
5. Review the generated message
6. Edit if needed
7. Copy and send!

### 12.3 Example Outputs

**Professional WhatsApp (English):**
> "Hi [Name], I hope this message finds you well. Following up on our conversation about [topic]. I wanted to check if you had any questions about the proposal we discussed. Looking forward to hearing from you!"

**Friendly Hindi:**
> "नमस्ते [Name], उम्मीद है आप अच्छे होंगे। हमारी पिछली बातचीत के बारे में फॉलो अप कर रहा था। क्या आपके कोई सवाल हैं?"

---

## 13. Integrations & Webhooks

**URL:** /app/integrations

### 13.1 Available Integrations

| Source | Description |
|--------|-------------|
| **WhatsApp** | Receive leads via WhatsApp Business API |
| **Facebook** | Facebook Lead Ads integration |
| **Instagram** | Instagram Lead Forms |
| **Google Ads** | Google Ads lead tracking |
| **IndiaMART** | IndiaMART seller leads |
| **JustDial** | JustDial business leads |
| **TradeIndia** | TradeIndia supplier leads |
| **Shopify** | E-commerce order leads |
| **Zapier** | Connect 5000+ apps |
| **REST API** | Custom integrations |

### 13.2 Connecting a Source

**Step-by-step (Manager+ only):**

1. Click **"Integrations"** in the sidebar
2. Find the source you want to connect
3. Click **"Connect"**
4. You'll receive:
   - **Webhook URL:** Where to send leads
   - **Webhook Secret:** For authentication (shown once!)
5. Copy and store the secret securely
6. Configure your external system to POST leads to the webhook URL

### 13.3 Webhook Authentication

External systems must include:
```
Header: x-webhook-secret: <your-secret>
Body: { "name": "...", "phone": "...", "email": "..." }
```

### 13.4 Lead Processing Pipeline

When a webhook receives a lead:
1. Verify the secret (constant-time comparison)
2. Resolve the organization from the secret
3. Validate the lead data
4. Check for duplicates (phone/email)
5. Create the lead with source = the integration name
6. Auto-assign to a salesperson
7. Log activity and send notification

### 13.5 Managing Integrations

- **Pause:** Stop receiving leads without disconnecting
- **Resume:** Start receiving again
- **Disconnect:** Remove the integration entirely

---

## 14. Reports & Analytics

**URL:** /app/reports

### 14.1 Selecting Date Range

1. Click **"Reports"** in the sidebar
2. Use the date picker to select:
   - **From Date:** Start of analysis period
   - **To Date:** End of analysis period
3. Maximum range: 366 days

### 14.2 Report Metrics

#### Cards
- **Leads Created:** Total new leads
- **Leads Won:** Successfully closed
- **Leads Lost:** Unsuccessful
- **Conversion Rate:** Won / Total percentage
- **Win Rate:** Won / (Won + Lost) percentage
- **Open Leads:** Currently active
- **Tasks Done:** Completed follow-ups
- **Tasks Missed:** Overdue follow-ups
- **Quotations:** Count and total value
- **Invoices:** Count and total value
- **Revenue:** Total payments received
- **Activity Count:** Total interactions

#### Charts
- **By Source:** Pie chart of lead sources
- **By Owner:** Bar chart of lead distribution
- **By Status:** Breakdown of lead statuses
- **By Stage:** Pipeline stage distribution
- **Trend:** Daily lead creation over time

### 14.3 Exporting Reports

1. Set your date range
2. Click **"Export CSV"**
3. Download the complete report data

---

## 15. Billing & Subscriptions

**URL:** /app/billing

### 15.1 Available Plans

| Plan | Features | Price |
|------|----------|-------|
| **Starter** | Basic CRM, 5 users, 500 leads | ₹999/month |
| **Growth** | Full CRM, 15 users, 5000 leads, AI features | ₹2,499/month |
| **Business** | Unlimited users/leads, priority support | ₹4,999/month |

### 15.2 Subscription Management

**Step-by-step:**

1. Click **"Billing"** in the sidebar
2. View current plan and usage
3. Toggle between **Monthly/Yearly** billing
4. Click **"Upgrade"** to change plans
5. In demo mode, changes apply instantly

### 15.3 Payment History

View all past payments with:
- Date
- Amount
- Status (Paid/Pending)
- Plan details

---

## 16. Team Management

**URL:** /app/team

### 16.1 Viewing Team Members

The team page shows all members with:
- Name and email
- Role (Owner/Admin/Manager/Sales)
- Status (Active/Inactive)
- Leads assigned

### 16.2 Adding Team Members

**Step-by-step (Owner/Admin/Manager):**

1. Click **"Team"** in the sidebar
2. Click **"Add Member"**
3. Fill in:
   - **Name** (required)
   - **Email** (required)
   - **Role** (dropdown)
   - **Password** (optional, can set later)
4. Click **"Add Member"**
5. New member receives a set-password email

### 16.3 Changing Roles

1. Find the team member
2. Click the **role dropdown**
3. Select the new role
4. Changes take effect immediately

**Role Hierarchy:**
```
Owner > Admin > Manager > Salesperson
```

### 16.4 Deactivating Members

1. Find the team member
2. Click **"Deactivate"**
3. Member can no longer log in
4. Their leads remain assigned (can be reassigned)

### 16.5 Automatic Lead Assignment

New leads are assigned based on:
1. **Source Rules:** Custom rules per source (Settings → Assignment)
2. **Least-Loaded:** Salesperson with fewest open leads
3. **Round-Robin:** Equal distribution among available salespeople

---

## 17. Settings

**URL:** /app/settings

### 17.1 Profile Settings

Update your personal information:
- **Name**
- **Phone Number**
- **Job Title**

### 17.2 Organization Settings

- **Organization Name**
- **Business Type**
- **Logo URL**

### 17.3 Assignment Rules

Configure which salesperson handles which lead source:

1. Go to **Settings → Assignment Rules**
2. For each source, select:
   - A specific salesperson, OR
   - **Auto-assign** (least-loaded + round-robin)

**Example:**
- Website leads → Priya (web specialist)
- WhatsApp leads → Karan (communication expert)
- IndiaMART leads → Auto-assign

### 17.4 AI Configuration

1. Go to **Settings → AI**
2. Enter your **API Key** (stored server-side, never shown again)
3. Select **Provider** (OpenAI-compatible)
4. Optionally set **Model** (e.g., gpt-4o-mini)
5. Click **"Save"**

**Supported Providers:**
- OpenAI
- Anthropic (Claude)
- Google (Gemini)
- Custom OpenAI-compatible endpoints

---

## 18. Calendar

**URL:** /app/calendar

### 18.1 Monthly View

- See all follow-ups, calls, and meetings
- Color-coded by task type
- Click any task to jump to its lead

### 18.2 Creating Events

Events are created through:
- Lead detail page → Schedule Follow-up
- Direct task creation

---

## 19. Contacts

**URL:** /app/contacts

### 19.1 Contact Directory

A separate customer directory for:
- People not yet leads
- Vendor contacts
- Partner contacts

### 19.2 Managing Contacts

**Add Contact:**
1. Click **"Contacts"**
2. Click **"Add Contact"**
3. Fill in details:
   - Name (required)
   - Phone, Email, Company (optional)
   - Tags (e.g., VIP, Supplier)
   - Notes
4. Click **"Save"**

**Link to Lead:**
- Optionally link a contact to an existing lead

---

## 20. Notifications

### 20.1 Bell Icon

The 🔔 icon at the top shows:
- **Unread count** badge
- Recent notifications

### 20.2 Notification Types

- "3 follow-ups are overdue"
- "New lead assigned to you"
- "Lead has not been contacted for 24 hours"
- "Quotation accepted by customer"
- "Payment received"

### 20.3 Managing Notifications

- Click a notification → jumps to the relevant lead/page
- **Mark as Read:** Click the notification
- **Mark All Read:** Click the checkmark button

---

## 21. Super-Admin Panel

**URL:** /admin

### 21.1 Access Control

**Who can access:**
- Only emails listed in `SUPER_ADMIN_EMAILS` env variable
- Set in `server/.env`:
  ```
  SUPER_ADMIN_EMAILS=you@yourcompany.com
  ```

**How to access:**
1. Log in with a super-admin email
2. Click your avatar → **Admin Panel**
3. Or navigate directly to `/admin`

### 21.2 Admin Overview

**URL:** /admin/overview

Shows platform-wide metrics:
- **Total Organizations:** All registered businesses
- **Active Organizations:** Currently active
- **Total Users:** All accounts
- **Total Leads:** Across all organizations
- **Won Leads:** Successfully closed
- **Won Value:** Total revenue
- **QR Codes, Quotations, Invoices:** Platform usage

Plus:
- **Top Organizations:** By leads and revenue
- **Recent Signups:** Latest registrations
- **Error Feed:** Recent system errors

### 21.3 Organization Management

**URL:** /admin/organizations

View all organizations with:
- Name
- Owner
- Users count
- Leads count
- Pipeline value
- Status (Active/Suspended)

**Actions:**
- **View Details:** Click org name
- **Suspend:** Temporarily disable org (users can't log in)
- **Re-activate:** Restore access
- **Change Plan:** Switch between Starter/Growth/Business

### 21.4 Organization Detail

**URL:** /admin/organizations/:id

Detailed view showing:
- Organization info
- Team members
- Recent leads (15)
- Recent activity (15)
- Subscription status
- Usage statistics

### 21.5 User Management

**URL:** /admin/users

View all users across all organizations:
- Name and email
- Organization
- Role
- Status (Active/Inactive)

**Actions:**
- **Deactivate:** Prevent login
- **Re-activate:** Restore access
- **Change Role:** Update user permissions

### 21.6 System Health

**URL:** /admin/system

Technical diagnostics:
- **Uptime:** Server running time
- **Node Version:** Runtime version
- **Platform:** Operating system
- **Memory Usage:** Current allocation
- **Load Average:** System load
- **CPU Count:** Available processors
- **Database:** Connectivity status
- **Environment:** Redacted config (safe to view)

### 21.7 Error Feed

Real-time error monitoring:
- Shows last 50 non-routine errors
- Updates automatically
- Click **"Clear Errors"** to reset
- Errors include:
  - API errors (excluding 401/404 noise)
  - Database issues
  - Integration failures

---

## 22. Troubleshooting

### Common Issues

#### "403 CSRF" Error
**Cause:** CSRF token rotated by recent `/auth/me` call
**Fix:** The client automatically handles this; refresh the page

#### "401 Unauthorized" After Login
**Cause:** Session expired (default 7 days)
**Fix:** Log in again

#### QR Code Doesn't Render
**Cause:** `qrcode` package missing
**Fix:** Run `npm install` in server directory

#### Port Already in Use
**Cause:** Stale node processes
**Fix:**
```bash
# Find process using port 4000 or 5173
lsof -i :4000
lsof -i :5173

# Kill the process
kill -9 <PID>
```

#### AI Features Say "Connect Your Key"
**Cause:** No AI API key configured
**Fix:** Go to Settings → AI and enter your key

#### New Route Returns 404
**Cause:** Route not mounted in app.ts
**Fix:** Add `app.use('/api/x', xRoutes)` in `server/src/app.ts`

#### Prisma Changes Not Taking Effect
**Cause:** Client not regenerated
**Fix:** Run `npx prisma generate` in server directory

---

## Appendix A: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search box |
| `Esc` | Close dialogs |
| `Ctrl+S` | Save (in forms) |

## Appendix B: API Quick Reference

### Authentication
- `POST /api/auth/signup` — Create account
- `POST /api/auth/login` — Log in
- `POST /api/auth/logout` — Log out
- `GET /api/auth/me` — Get current user

### Leads
- `GET /api/leads` — List leads
- `POST /api/leads` — Create lead
- `PATCH /api/leads/:id` — Update lead
- `DELETE /api/leads/:id` — Delete lead

### Pipeline
- `GET /api/pipeline` — Get pipeline stages
- `POST /api/pipeline/stages` — Add stage

### Tasks
- `GET /api/tasks` — List tasks
- `POST /api/tasks` — Create task
- `PATCH /api/tasks/:id` — Update task

### Quotations
- `GET /api/quotations` — List quotations
- `POST /api/quotations` — Create quotation
- `GET /api/quotations/:id/pdf` — Download PDF

### Invoices
- `GET /api/invoices` — List invoices
- `POST /api/invoices` — Create invoice
- `POST /api/invoices/:id/payment` — Record payment

### AI
- `POST /api/ai/chat` — Ask AI assistant
- `POST /api/ai/follow-up` — Generate follow-up

### Admin
- `GET /api/admin/overview` — Platform stats
- `GET /api/admin/orgs` — All organizations
- `PATCH /api/admin/orgs/:id` — Suspend/activate org

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Lead** | A potential customer or sales opportunity |
| **Pipeline** | Visual representation of sales stages |
| **Follow-up** | Scheduled contact with a lead |
| **GST** | Goods and Services Tax (Indian tax system) |
| **CGST** | Central GST (same state) |
| **SGST** | State GST (same state) |
| **IGST** | Integrated GST (inter-state) |
| **HSN** | Harmonized System of Nomenclature (product codes) |
| **SAC** | Services Accounting Code (service codes) |
| **Webhook** | HTTP callback for real-time data sync |
| **Multi-tenant** | Single app serving multiple organizations |
| **RBAC** | Role-Based Access Control |

---

**Document Version:** 1.0
**Last Updated:** August 10, 2026
**Application Version:** PRIMELEAD AI v0.1.0

*For developer documentation, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)*
*For API reference, see [API.md](../API.md)*
