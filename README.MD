# ThreatLens – Open-Source AML Investigation Platform

ThreatLens turns raw transaction exports into an investigation workspace. Upload a CSV and it detects money-laundering typologies, scores every account, maps the money network, traces funds hop by hop, drafts the Suspicious Activity Report and links related cases together.

**No sign-up, no login.** Every browser gets a private workspace automatically; share its key to collaborate.

---

## What it does

| | |
|---|---|
| **17 detectors** | High-value, structuring, round amounts, circular flows (chronological), rapid pass-through, fan-in (smurfing), fan-out, repeated counterparty, bursts, off-hours, new-account abuse, high-risk jurisdictions, shared identifiers, watchlist matches, dormant-account reactivation, out-of-pattern transfers and a Benford's-law forensic test. Every finding explains *what*, *why* and *which transactions*. |
| **Explainable risk** | Case and account scores (0–100) built from the findings, with the reasons listed. |
| **Fund tracing** | "Where did the money go?" / "Where did it come from?" – replays transfers in time order across up to 10 hops and shows a flow diagram with final destinations. |
| **SAR drafting** | One-click who / what / when / where / why / how narrative from the evidence. Edit, save, copy or print to PDF. |
| **Watchlist screening** | Your own list of names, accounts, emails, phones and IPs. Names are fuzzy-matched (typos, reordered names, titles). Bulk import from CSV/text. |
| **Seen before?** | ⌘K search across every case, plus automatic alerts when a case's accounts or identifiers appear in other cases. |
| **Cross-case analysis** | Link score from shared accounts, shared identifiers, cross-case money flows, typology/amount/time similarity, overlapping periods and common high-risk countries. |
| **Investigation workflow** | Case status, notes, an auto-generated checklist of next steps, transaction review (suspicious / cleared). |
| **Tunable detection** | Adjust thresholds per case to your risk appetite and re-run – review decisions are kept. |
| **Visual analysis** | Interactive network graph, world map, activity timeline, hour-of-day profile, Benford chart. |
| **Exports** | Transactions with flags (CSV), full analysis (JSON), printable report. |

## Quick start

Requirements: **Node.js 20+** and **MongoDB 6+** running locally (or a MongoDB Atlas URI).

```bash
git clone https://github.com/innovatewithkishlay/ThreatLens.git
cd ThreatLens

# 1. API (port 5002)
cd backend
cp .env.example .env        # optional - defaults work for local MongoDB
npm install
npm run dev

# 2. Web app (port 5173) - in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and click **Try the live demo** – it analyses a bundled dataset that contains every typology.

### Single-service production build

```bash
cd frontend && npm run build      # outputs frontend/dist
cd ../backend && NODE_ENV=production COOKIE_SECRET=<long-random-string> npm start
```

The API serves the built frontend on the same port.

## CSV format

One row per transfer. Only three columns are required:

| Column | Required | Accepted names (examples) |
|---|---|---|
| `fromAccount` | ✓ | from, sender, source, payer, debitAccount |
| `toAccount` | ✓ | to, receiver, beneficiary, payee, creditAccount |
| `amount` | ✓ | amount, value – `9500`, `$9,500.00`, `9.500,00` all work |
| `date` | | ISO 8601 (`2025-06-01T09:30:00`), `DD/MM/YYYY`, Unix time |
| `country` | | ISO code, e.g. `GB`, `NG` (`metadata.ipCountry` also works) |
| `email`, `mobile`, `ipAddress` | | Identifiers of the sending account |
| `accountHolder`, `accountType`, `accountOpened` | | Account details |
| `transactionId`, `currency`, `description` | | |

Comma, semicolon, tab and pipe separators are detected automatically. Invalid rows are skipped and reported. See `frontend/public/samples/` for examples (regenerate with `node backend/scripts/generate-samples.js`).

## Configuration

Backend `.env` (see `backend/.env.example`):

| Variable | Default | |
|---|---|---|
| `DB_URI` | `mongodb://127.0.0.1:27017/threatlens` | MongoDB connection string |
| `COOKIE_SECRET` | random per start (dev) | **Required in production** – signs workspace cookies |
| `PORT` | `5002` | |
| `CLIENT_URL` / `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins |
| `MAX_UPLOAD_MB` / `MAX_ROWS` | `10` / `25000` | Upload limits |

Default detection thresholds live in `backend/config/thresholds.js`.

## Workspaces & privacy

- Each browser receives a random workspace key in a signed, HTTP-only cookie. Cases and watchlists are only visible inside that workspace.
- Use the **Workspace** button to copy the key or a share link (`/join/<key>`) for a teammate or another device, or to start a fresh workspace.
- Uploaded files are parsed in memory and never written to disk.

## Project structure

```
backend/
  app.js                    Express app (also serves frontend/dist)
  config/                   env, security (helmet, CORS, rate limits), thresholds
  app/utils/                csvParser, anomalyDetector, fundTracer, caseComparator,
                            screening, reportBuilder, thresholdSettings
  app/services/             case + watchlist services
  app/routes/               cases, watchlist, workspace
  test/                     node:test unit + API tests
frontend/
  src/pages/                Home, Analyze, Cases, CaseView, CaseReport, Compare,
                            CompareResults, Watchlist, ...
  src/components/           layout, ui, case, viz (network, map, flow, charts)
```

## Development

```bash
cd backend && npm test               # 46 tests (API tests need MongoDB)
cd frontend && npm run lint && npm run build
```

## Contributing

Pull requests are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
