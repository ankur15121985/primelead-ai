# PRIMELEAD AI — MVP Execution Guide

## Quick Start (1 command)

```bash
cd Compute && bash scripts/start-mvp.sh
```

This automatically:
1. Installs all dependencies
2. Sets up SQLite database with all 54 tables
3. Starts the API server on port 3001
4. Starts the client on port 5173
5. Opens WebSocket signaling for video calls

---

## Step-by-Step Setup

### 1. Prerequisites

- **Node.js 18+** (recommended: 20 LTS)
- **npm 9+**
- **Git**

```bash
node -v   # Should show v18.x.x or higher
npm -v    # Should show 9.x.x or higher
```

### 2. Clone & Install

```bash
git clone <repository-url>
cd Compute

# Install root + client + server dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 3. Environment Setup

```bash
cd server

# Create .env file
cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
PORT=3001
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET="change-this-in-production"
JWT_SECRET="change-this-in-production"
PAYMENT_WEBHOOK_SECRET="test-webhook-secret"
SUPER_ADMIN_EMAILS="admin@primelead.ai"
API_RATE_LIMIT=100000
LOGIN_RATE_LIMIT=500
EOF

cd ..
```

### 4. Database Setup

```bash
cd server
npx prisma generate
npx prisma db push
cd ..
```

### 5. Start Development

**Terminal 1 — API Server:**
```bash
cd server
PORT=3001 npx tsx src/index.ts
```

**Terminal 2 — Client:**
```bash
cd client
npm run dev
```

### 6. Open Browser

- **Client:** http://localhost:5173
- **API Health:** http://localhost:3001/api/health

---

## Running Tests

```bash
cd Compute

# Run all 243 tests
cd server && npx vitest run

# Run specific test suites
npx vitest run src/services/email-templates.test.ts    # Email templates
npx vitest run src/services/message-queue.test.ts      # Message queue
npx vitest run src/services/sms-leads.test.ts          # SMS lead generation
npx vitest run src/services/recording.test.ts          # Recording + meeting notes
npx vitest run src/services/bulk-calls.test.ts         # Bulk calls + video + SMS
npx vitest run src/integrations/gst/                   # GST providers
npx vitest run src/tests/api.test.ts                   # API E2E tests
```

---

## Build for Production

```bash
cd Compute

# Build both server and client
npm run build

# Or build individually
npm run build -w server
npm run build -w client

# Run production
cd server
NODE_ENV=production node dist/index.js
```

---

## Docker Deployment

```bash
cd Compute

# Build Docker image
docker build -t primelead .

# Run with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Create new org + user |
| POST | /api/auth/login | Login with email + password |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |

### Leads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/leads | List leads |
| POST | /api/leads | Create lead |
| GET | /api/leads/:id | Get lead detail |
| PATCH | /api/leads/:id | Update lead |

### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/calls | List calls |
| POST | /api/calls | Log a call |
| GET | /api/calls/stats | Call statistics |
| POST | /api/bulk-calls/initiate | Start bulk call batch |
| GET | /api/bulk-calls/queue | Dialer queue |

### Video Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/video/rooms | Create video room |
| GET | /api/video/rooms | List rooms |
| POST | /api/video/rooms/:id/join | Join room |
| POST | /api/video/rooms/:id/leave | Leave room |
| POST | /api/video/rooms/:id/end | End room (host) |

### Recordings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/recordings | Start recording |
| POST | /api/recordings/:id/complete | Complete recording |
| POST | /api/recordings/:id/transcript | Save transcript |
| GET | /api/recordings | List recordings |

### Meeting Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/meeting-notes | Generate AI notes |
| GET | /api/meeting-notes | List notes |
| PATCH | /api/meeting-notes/:id | Edit notes |

### SMS
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /webhooks/sms | Inbound SMS webhook (Twilio) |
| GET | /api/sms | List inbound SMS |
| GET | /api/sms/call-ready | Leads ready for calls |
| POST | /api/sms-outbound/send | Send SMS reply |
| POST | /webhooks/sms/status | Delivery status callback |

### Reports & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/reports/v2 | Execute report |
| POST | /api/report-scheduler | Schedule reports |
| GET | /api/analytics | Dashboard analytics |

---

## WebSocket Signaling (Video Calls)

Connect to `ws://localhost:3001/ws/signaling?token=<jwt>&room=<roomId>`

### Message Protocol

```json
// Join room (auto on connect)
{ "type": "room-state", "participants": [...] }

// SDP exchange
{ "type": "sdp-offer", "targetUserId": "...", "sdp": "..." }
{ "type": "sdp-answer", "targetUserId": "...", "sdp": "..." }
{ "type": "ice-candidate", "targetUserId": "...", "candidate": "..." }

// Controls
{ "type": "mute" }
{ "type": "unmute" }
{ "type": "video-on" }
{ "type": "video-off" }

// Chat
{ "type": "chat", "message": "Hello!" }

// Recording
{ "type": "recording-started" }
{ "type": "recording-stopped" }
```

---

## Testing SMS Webhook

```bash
# Simulate inbound SMS from Twilio
curl -X POST http://localhost:3001/webhooks/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+919876543210&To=+18005550000&Body=Hi, I'm interested in your product"

# Check SMS status updates
curl -X POST http://localhost:3001/webhooks/sms/status \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"SM123","MessageStatus":"delivered","To":"+919876543210"}'
```

---

## Project Structure

```
Compute/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/app/         # 53 page components
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # Custom React hooks
│   │   └── App.tsx            # Router + routes
│   └── public/                # Static assets + service worker
├── server/                    # Express API
│   ├── src/
│   │   ├── routes/            # 25+ route files
│   │   ├── services/          # 35+ service files
│   │   ├── integrations/      # GST, payment providers
│   │   ├── middleware/         # Auth, rate limiting, CSRF
│   │   └── app.ts             # Express app setup
│   ├── prisma/
│   │   ├── schema.prisma      # 54 database models
│   │   └── migrations/        # 12 migrations
│   └── tests/                 # 243 automated tests
├── scripts/
│   ├── start-mvp.sh           # MVP startup script
│   ├── migrate-to-postgres.sh # PostgreSQL migration
│   └── switch-db.sh           # Database switcher
└── docs/
    ├── MVP_GUIDE.md           # This file
    ├── DEVELOPER_GUIDE.md     # Developer setup
    └── DEPLOYMENT.md          # Production deployment
```

---

## Database Models (54 tables)

### Core
- Organization, User, Role, Team, Session
- Lead, Contact, Company, CompanyContact
- Task, Activity, Notification

### Sales Pipeline
- Pipeline, PipelineStage, AutomationRule, AutomationRun

### Financial
- Quotation, QuotationItem, Invoice, InvoiceItem
- CreditNote, CreditNoteItem, DebitNote, DebitNoteItem
- Payment, Subscription, Plan, Referral

### Communication
- Conversation, Message, Call, Meeting
- Recording, MeetingNotes, SmsInbound, SmsOutbound
- ScheduledMessage, ScheduledMessageLog, EmailTemplate

### Intelligence
- Company, Icp, Persona, ScoringRule, IntentSignal
- Sequence, SequenceStep, SequenceEnrollment
- ConversationAnalysis, AiResearchReport

### Video
- VideoRoom, VideoParticipant

### Infrastructure
- WebhookEndpoint, WebhookDelivery, ApiKey
- AuditLog, LoginHistory, MfaSecret, RecoveryCode
- ConsentRecord, SuppressionEntry, DataExport

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | file:./dev.db | Database connection string |
| PORT | 3001 | API server port |
| NODE_ENV | development | Environment mode |
| CLIENT_ORIGIN | http://localhost:5173 | CORS origin |
| SESSION_SECRET | — | Session encryption key |
| JWT_SECRET | — | JWT signing key |
| STORAGE_PROVIDER | local | Storage: local/s3/r2 |
| AWS_S3_BUCKET | — | S3 bucket name |
| WHATSAPP_ACCESS_TOKEN | — | WhatsApp API token |
| WHATSAPP_PHONE_NUMBER_ID | — | WhatsApp phone ID |

---

## Troubleshooting

### "Port already in use"
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
# Or use a different port
PORT=3002 npx tsx src/index.ts
```

### "Database locked"
```bash
# Delete and recreate the database
cd server
rm -f prisma/dev.db prisma/dev.db-journal
npx prisma db push
```

### "Module not found"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```
