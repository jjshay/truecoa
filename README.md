# TrueCOA

<!-- portfolio-navigation:start -->
[Project brief](docs/PROJECT_BRIEF.md) · [Structured project record](project.json) · [Portfolio](https://github.com/jjshay)

<!-- portfolio-navigation:end -->

TrueCOA (truecoa.com) is a blockchain-anchored certificate of authenticity platform for fine art and collectibles, operated as a sister platform to [Gauntlet Gallery](https://gauntlet.gallery) — a San Francisco authenticated collectibles gallery specializing in street art (Shepard Fairey, KAWS, Banksy, Death NYC), designer toys (BE@RBRICK by Medicom Toy, KAWS vinyl figures), signed music memorabilia, and NASA Apollo-era astronaut autographs authenticated by Zarelli Space Authentication.

Authentication records are written to the Polygon network with secondary Bitcoin timestamp anchoring, creating a permanent, publicly verifiable provenance record independent of any gallery or seller. Any buyer can verify a TrueCOA record at any time via a public URL lookup using the unique COA identifier — no intermediary required.

TrueCOA is used for high-value items including KAWS Companion figures, BE@RBRICK collaboration releases, Apollo astronaut autographs (Buzz Aldrin, Michael Collins — authenticated by Zarelli Space Authentication, PSA, and NGC), and Shepard Fairey screen prints.

The stack combines:

- a React frontend for verification and certificate display
- an Express backend that reads certificate metadata from Google Sheets
- a Polygon ERC-721 contract for on-chain COA verification
- Google Apps Script helpers for certificate generation and sheet-side workflows

The current repository reflects both the live verification product and the print-proof / exact-layout work used to produce branded COA output.

## Current State

- Frontend certificate UI is driven by backend API data from `GET /api/verify/:coaCode`
- Frontend creation UI posts new COA records to `POST /api/create`
- Backend verification is sheet-backed and blockchain-aware
- Local backend is configured against spreadsheet `14GcZTEOMmfNdJvYmbS3CylAPEAz7z9NW_1rzvsfl6Ko`
- Minimal one-file Apps Script is configured for the `COA` tab in that sheet
- Approved horizontal print baseline exists in the exact-template work and related exported assets
- eBay-ready COA imagery has been packaged from the approved landscape proof

## Repository Structure

```text
truecoa/
├── backend/                  # Express verification API
├── contracts/                # Solidity COA contract
├── docs/                     # Supporting documentation
├── frontend/                 # Vite/React verification frontend
├── google-apps-script/       # Sheet-side generation helpers and HTML templates
├── scripts/                  # Deploy and mint scripts
├── README.md                 # Product + developer overview
└── SIMPLE_GUIDE.md           # Older quick-start guidance
```

## System Flow

```text
QR code / manual COA code
        |
        v
Frontend (/AUTHENTICATE/:code)
        |
        v
Backend /api/verify/:coaCode
        |
        +--> Google Sheets metadata lookup
        |
        +--> Polygon NFT verification
        |
        v
Rendered COA + verification state
```

## Key Components

### Frontend

Location: [`frontend`](frontend)

Responsibilities:

- accept manual COA entry or QR scan
- call the backend verification API
- render a certificate view from backend fields
- display blockchain verification and supporting links

Primary implementation files:

- [`App.jsx`](frontend/src/App.jsx)
- [`index.css`](frontend/src/index.css)

### Backend

Location: [`backend`](backend)

Responsibilities:

- initialize Google Sheets access using service-account credentials
- look up COA rows by `COA_Code`
- verify mint status against the Polygon contract
- normalize response data for the frontend
- proxy artwork images from Google Drive when needed

Primary implementation file:

- [`index.js`](backend/index.js)

### Smart Contract

Location: [`contracts/GauntletCOA.sol`](contracts/GauntletCOA.sol)

Responsibilities:

- map COA codes to ERC-721 token IDs
- enforce unique minting
- expose verification read methods used by the backend

### Google Apps Script / Template Layer

Location: [`google-apps-script`](google-apps-script)

Responsibilities:

- generate certificate assets from sheet data
- produce preview / exact HTML templates
- manage short links and generated artifacts in Drive

The current minimal Apps Script entrypoint is `google-apps-script/TrueCOA_Minimal_Code.gs`.

## API Surface

### `GET /health`

Returns service status and Google Sheets initialization state.

### `GET /api/verify/:coaCode`

Returns:

- COA metadata from Google Sheets
- blockchain verification status from Polygon
- normalized fields used by the frontend certificate display

### `GET /api/image/:coaCode`

Looks up the certificate image URL from the sheet and proxies the image bytes.

### `GET /api/nft/:coaCode`

Returns marketplace-style NFT metadata for a COA code. The `image`/`image_url`
fields point to the rendered COA media endpoint so Polygon NFT marketplaces show
the certificate image first, with the description and traits beside it.

### `GET /api/coa-image/:coaCode.svg`

Returns the rendered COA image used by NFT metadata.

### `POST /api/create`

Creates a COA row in Google Sheets and can optionally create a ScoreDetect
record and mint a Polygon NFT when those options are selected.

## Local Development

### Backend

```bash
cd backend
npm install
npm start
```

Expected env inputs include:

- `SPREADSHEET_ID`
- `SHEET_NAME`
- `GOOGLE_CREDENTIALS`
- `CONTRACT_ADDRESS`
- `POLYGON_RPC`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Expected frontend env input:

- `VITE_API_URL`

## Documentation Added In This Update

- [Strategy](./docs/STRATEGY.md)
- [Technical Analysis](./docs/TECHNICAL_ANALYSIS.md)

## Recommended Next Steps

1. Replace older Apps Script variants with `TrueCOA_Minimal_Code.gs` in the live Sheet project.
2. Add a stable export path for marketplace-ready COA imagery so the process is not tied to manual local rendering.
3. Add automated validation for the verification payload shape and frontend certificate rendering.
