# TrueCOA Google Apps Script Master

Use one Google Apps Script file:

- `TrueCOA_Master_Code.gs`

You do not need to install these older script variants:

- `COAGenerator.gs`
- `COAGenerator_Combined.gs`
- `COA_Generator_Mobile.gs`
- `QUICK_START.gs`
- `TrueCOA_Minimal_Code.gs`

## Install

1. Open the COA Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Delete the old script code from the Apps Script editor.
4. Paste the full contents of `TrueCOA_Master_Code.gs`.
5. Save.
6. Run `setupTrueCOAWorkbook` once and approve permissions.
7. Reload the Google Sheet.
8. Use **TrueCOA > 2. Run Full COA Automation** to process rows and create PDFs.

## Normal Flow

1. Create the COA/product in the TrueCOA app with ScoreDetect and Polygon enabled.
2. Confirm the row appears in the `COA` sheet.
3. Run **TrueCOA > 2. Run Full COA Automation**.
5. Use `PDF_URL` for the generated COA PDF.

## Manual Row Flow

1. Fill `COA_Code`, `Signer`, `Title`, and artwork metadata.
2. Paste `ScoreDetect_URL` or a ScoreDetect link into `Cert_URL`.
3. Paste `NFT_TokenID` if the Polygon NFT already exists.
4. Run **TrueCOA > 2. Run Full COA Automation**.

## What Setup Does

`setupTrueCOAWorkbook` only creates/repairs the workbook structure. It does not generate COA PDFs.

To actually process the rows, run **TrueCOA > 2. Run Full COA Automation**.

## Important

The master Apps Script prints and organizes the COA PDFs. It does not create the ScoreDetect record or mint the Polygon NFT. Those are created by the TrueCOA backend/app.

The printed signer is fixed as `Gauntlet Gallery`, and Assignee is intentionally not part of the master template.
