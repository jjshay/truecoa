/**
 * TrueCOA master Google Apps Script
 *
 * Paste this single file into Extensions > Apps Script for the COA spreadsheet.
 * It replaces the older COAGenerator, Combined, Mobile, Quick Start, and
 * Minimal scripts for sheet setup and PDF/HTML generation.
 *
 * This script does:
 * - Creates/repairs the COA sheet headers
 * - Creates an Instructions sheet
 * - Creates the Drive folder used for certificate HTML/PDF files
 * - Backfills ScoreDetect and Polygon display links from row data
 * - Creates verification QR codes
 * - Generates one COA PDF or bulk COA PDFs
 *
 * This script does not mint Polygon NFTs or create ScoreDetect records.
 * Those are created by the TrueCOA backend/app, then this script prints them.
 */

const TRUECOA_CONFIG = {
  SPREADSHEET_ID: '14GcZTEOMmfNdJvYmbS3CylAPEAz7z9NW_1rzvsfl6Ko',
  SHEET_NAME: 'COA',
  INSTRUCTIONS_SHEET_NAME: 'TrueCOA Instructions',
  VERIFY_BASE_URL: 'https://frontend-pi-three-98.vercel.app/AUTHENTICATE',
  API_BASE_URL: 'https://coa.up.railway.app',
  DRIVE_FOLDER_NAME: 'TrueCOA Certificates',
  CONTRACT_ADDRESS: '0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1',
  QR_SIZE: 220,
  REQUIRED_KEYS: ['COA_CODE', 'SIGNER', 'TITLE'],
  OUTPUT_KEYS: ['QR_CODE', 'SHORT_URL', 'CERT_URL', 'PDF_URL', 'STATUS', 'COMPLETION_DATE'],
  CANONICAL_HEADERS: [
    ['COA_CODE', 'COA_Code'],
    ['QR_CODE', 'QR_Code'],
    ['SIGNER', 'Signer'],
    ['TITLE', 'Title'],
    ['DATE', 'Date'],
    ['MEDIUM', 'Medium'],
    ['EDITION', 'Edition'],
    ['SIZE', 'Size'],
    ['CONDITION', 'Condition'],
    ['DESCRIPTION', 'Description'],
    ['PROVENANCE', 'Provenance'],
    ['ASSIGNOR', 'Assignor'],
    ['AUTH_NOTES', 'Third Party Authentication Notes'],
    ['SKU', 'SKU'],
    ['IMAGE_URL', 'Image_URL'],
    ['NFT_TOKEN_ID', 'NFT_TokenID'],
    ['SHORT_URL', 'Short_URL'],
    ['SCOREDETECT_CERT_ID', 'ScoreDetect_Cert_ID'],
    ['SCOREDETECT_URL', 'ScoreDetect_URL'],
    ['SCOREDETECT_TX_URL', 'ScoreDetect_Transaction_URL'],
    ['POLYGON_METADATA_URL', 'Polygon_Metadata_URL'],
    ['POLYGON_COA_IMAGE_URL', 'Polygon_COA_Image_URL'],
    ['BLOCKCHAIN_URL', 'Blockchain_URL'],
    ['NFT_URL', 'NFT_URL'],
    ['CERT_URL', 'Cert_URL'],
    ['PDF_URL', 'PDF_URL'],
    ['STATUS', 'Status'],
    ['COMPLETION_DATE', 'Completion_Date']
  ],
  HEADER_ALIASES: {
    COA_CODE: ['COA_Code', 'COA Code', 'Code'],
    QR_CODE: ['QR_Code', 'QR Code'],
    SIGNER: ['Signer', 'Artist'],
    TITLE: ['Title'],
    DATE: ['Date', 'Year'],
    MEDIUM: ['Medium'],
    EDITION: ['Edition', 'Edition '],
    SIZE: ['Size', 'Dimensions', 'Dims'],
    CONDITION: ['Condition'],
    DESCRIPTION: ['Description'],
    PROVENANCE: ['Provenance', 'PROVIDENCE', 'Provience', 'Providence'],
    ASSIGNOR: ['Assignor', 'Authenticator'],
    AUTH_NOTES: ['Third Party Authentication Notes', 'THIRD PARTY COA LINK', 'Auth Notes'],
    SKU: ['SKU'],
    IMAGE_URL: ['Image_URL', 'Image URL', 'Artwork_Image_URL'],
    NFT_TOKEN_ID: ['NFT_TokenID', 'NFT Token ID', 'Token_ID'],
    SHORT_URL: ['Short_URL', 'Short URL'],
    SCOREDETECT_CERT_ID: ['ScoreDetect_Cert_ID', 'ScoreDetect Cert ID', 'ScoreDetect Code', 'ScoreDetect_Code', 'ScoreDetect Certificate', 'ScoreDetect_Certificate_ID'],
    SCOREDETECT_URL: ['ScoreDetect_URL', 'ScoreDetect Link', 'ScoreDetect Verification URL', 'ScoreDetect_Verification_URL'],
    SCOREDETECT_TX_URL: ['ScoreDetect_Transaction_URL', 'ScoreDetect Tx URL', 'ScoreDetect Blockchain URL'],
    POLYGON_METADATA_URL: ['Polygon_Metadata_URL', 'NFT_Metadata_URL', 'Metadata_URL'],
    POLYGON_COA_IMAGE_URL: ['Polygon_COA_Image_URL', 'COA_Image_URL', 'Rendered_COA_Image_URL'],
    BLOCKCHAIN_URL: ['Blockchain_URL', 'Polygon_Token_URL'],
    NFT_URL: ['NFT_URL', 'Polygon_Marketplace_URL'],
    CERT_URL: ['Cert_URL', 'Certificate_URL'],
    PDF_URL: ['PDF_URL', 'Generated_PDF_URL', 'Print_PDF_URL'],
    STATUS: ['Status'],
    COMPLETION_DATE: ['Completion_Date', 'Generated', 'Generated_Date']
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TrueCOA')
    .addItem('RUN NOW: Setup + Create PDFs', 'SETUP_AND_RUN')
    .addItem('Setup/Repair Workbook Only', 'setupTrueCOAWorkbook')
    .addItem('Run Full COA Automation Only', 'runTrueCOAFullAutomation')
    .addItem('Validate Setup', 'validateTrueCOASetup')
    .addSeparator()
    .addItem('Backfill Auth Links', 'backfillTrueCOAAuthLinks')
    .addItem('Refresh QR Codes', 'refreshTrueCOAQRCodes')
    .addSeparator()
    .addItem('Generate Selected COA PDF', 'generateSelectedCOA')
    .addItem('Generate Missing COA PDFs', 'generateMissingCOAs')
    .addItem('Generate/Refresh All COA PDFs', 'generateAllCOAPDFs')
    .addSeparator()
    .addItem('Preview Selected COA HTML', 'previewSelectedCOA')
    .addItem('Create Sample Row', 'createSampleCOARow')
    .addToUi();
}

function RUN_NOW() {
  SETUP_AND_RUN();
}

function SETUP_AND_RUN() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, TRUECOA_CONFIG.SHEET_NAME);
  let headerMap = ensureAllHeaders_(sheet);
  formatCOASheet_(sheet);
  createInstructionsSheet_(ss);
  const folder = getOrCreateFolder_();
  headerMap = getHeaderMap_(sheet);

  const summary = processCOARows_(sheet, headerMap, false);
  SpreadsheetApp.getUi().alert(
    'TrueCOA setup + automation complete',
    [
      'Spreadsheet: ' + ss.getName(),
      'COA sheet: ' + sheet.getName(),
      'Drive folder: ' + folder.getName(),
      '',
      formatRunSummary_(summary)
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function setupTrueCOAWorkbook() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, TRUECOA_CONFIG.SHEET_NAME);
  let headerMap = ensureAllHeaders_(sheet);
  headerMap = getHeaderMap_(sheet);

  formatCOASheet_(sheet);
  createInstructionsSheet_(ss);
  const folder = getOrCreateFolder_();

  SpreadsheetApp.getUi().alert(
    'TrueCOA setup complete',
    [
      'Spreadsheet: ' + ss.getName(),
      'COA sheet: ' + sheet.getName(),
      'Drive folder: ' + folder.getName(),
      'Headers: ' + Object.keys(headerMap).length + ' mapped',
      'This only repairs workbook structure.',
      'To create PDFs, run RUN_NOW in Apps Script or TrueCOA > RUN NOW: Setup + Create PDFs.'
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function runTrueCOAFullAutomation() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, TRUECOA_CONFIG.SHEET_NAME);
  let headerMap = ensureAllHeaders_(sheet);
  formatCOASheet_(sheet);
  createInstructionsSheet_(ss);
  getOrCreateFolder_();
  headerMap = getHeaderMap_(sheet);

  const summary = processCOARows_(sheet, headerMap, false);
  SpreadsheetApp.getUi().alert(
    'TrueCOA automation complete',
    formatRunSummary_(summary),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function validateTrueCOASetup() {
  const sheet = getCOASheet_();
  const headerMap = getHeaderMap_(sheet);
  const required = TRUECOA_CONFIG.REQUIRED_KEYS.concat(TRUECOA_CONFIG.OUTPUT_KEYS);
  const missing = getMissingHeaders_(headerMap, required);
  const bitlyConfigured = !!getBitlyApiKey_();
  const folder = getOrCreateFolder_();

  SpreadsheetApp.getUi().alert(
    'TrueCOA setup',
    [
      'Spreadsheet: ' + getSpreadsheet_().getName(),
      'Sheet: ' + sheet.getName(),
      'Rows: ' + Math.max(0, sheet.getLastRow() - 1),
      'Drive folder: ' + folder.getName(),
      'Bitly: ' + (bitlyConfigured ? 'configured' : 'not configured, full URLs will be used'),
      'Headers: ' + (missing.length ? 'missing ' + missing.join(', ') : 'OK')
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function createSampleCOARow() {
  const sheet = getCOASheet_();
  const headerMap = ensureAllHeaders_(sheet);
  const row = {};
  row.COA_CODE = 'SAMPLE-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  row.SIGNER = 'Sample Artist';
  row.TITLE = 'Sample Artwork';
  row.DATE = String(new Date().getFullYear());
  row.MEDIUM = 'Screenprint';
  row.EDITION = 'AP';
  row.SIZE = '24 x 18 in';
  row.CONDITION = 'Excellent';
  row.DESCRIPTION = 'Sample row for testing TrueCOA PDF generation.';
  row.PROVENANCE = 'Gauntlet Gallery';
  row.ASSIGNOR = 'Gauntlet Gallery';
  row.SKU = row.COA_CODE;
  row.STATUS = '[sample]';

  const nextRow = Math.max(2, sheet.getLastRow() + 1);
  Object.keys(row).forEach(function(key) {
    setValue_(sheet, nextRow, headerMap, key, row[key]);
  });

  SpreadsheetApp.getUi().alert('Sample row created on row ' + nextRow + '.');
}

function backfillTrueCOAAuthLinks() {
  const sheet = getCOASheet_();
  const headerMap = ensureAllHeaders_(sheet);
  let updated = 0;

  for (let rowNum = 2; rowNum <= sheet.getLastRow(); rowNum++) {
    const row = getRow_(sheet, rowNum);
    const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
    if (!code) continue;

    updated += backfillRowAuthLinks_(sheet, rowNum, headerMap, row) ? 1 : 0;
  }

  SpreadsheetApp.getUi().alert('Backfilled authentication links on ' + updated + ' rows.');
}

function refreshTrueCOAQRCodes() {
  const sheet = getCOASheet_();
  const headerMap = ensureAllHeaders_(sheet);
  let updated = 0;

  for (let rowNum = 2; rowNum <= sheet.getLastRow(); rowNum++) {
    const row = getRow_(sheet, rowNum);
    const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
    if (!code) continue;

    const shortUrl = String(getValue_(row, headerMap, 'SHORT_URL')).trim();
    const qrTarget = shortUrl || buildVerifyUrl_(code);
    setValue_(sheet, rowNum, headerMap, 'QR_CODE', buildQrUrl_(qrTarget));
    updated++;
  }

  SpreadsheetApp.getUi().alert('Updated ' + updated + ' QR codes.');
}

function generateSelectedCOA() {
  const sheet = getCOASheet_();
  const selected = SpreadsheetApp.getActiveRange();
  if (!selected || selected.getRow() <= 1) {
    SpreadsheetApp.getUi().alert('Select a populated COA data row first.');
    return;
  }

  const result = processCOARow_(sheet, selected.getRow());
  SpreadsheetApp.getUi().alert(
    'COA generated',
    'COA: ' + result.code + '\nHTML: ' + result.htmlUrl + '\nPDF: ' + result.pdfUrl,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function generateMissingCOAs() {
  const sheet = getCOASheet_();
  const headerMap = ensureAllHeaders_(sheet);
  const summary = processCOARows_(sheet, headerMap, false);

  SpreadsheetApp.getUi().alert(
    'Generate Missing COA PDFs complete',
    formatRunSummary_(summary),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function generateAllCOAPDFs() {
  const sheet = getCOASheet_();
  const headerMap = ensureAllHeaders_(sheet);
  const summary = processCOARows_(sheet, headerMap, true);

  SpreadsheetApp.getUi().alert(
    'Generate/Refresh All COA PDFs complete',
    formatRunSummary_(summary),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function previewSelectedCOA() {
  const sheet = getCOASheet_();
  const selected = SpreadsheetApp.getActiveRange();
  if (!selected || selected.getRow() <= 1) {
    SpreadsheetApp.getUi().alert('Select a populated COA data row first.');
    return;
  }

  const headerMap = ensureAllHeaders_(sheet);
  const data = buildCertData_(getRow_(sheet, selected.getRow()), headerMap);
  const folder = getOrCreateFolder_();
  const file = folder.createFile('preview_' + safeName_(data.code || 'sample') + '.html', renderCertificateHtml_(data), MimeType.HTML);
  SpreadsheetApp.getUi().alert('Preview created:\n\n' + file.getUrl());
}

function processCOARow_(sheet, rowNum) {
  const headerMap = ensureAllHeaders_(sheet);
  assertHeaders_(headerMap, TRUECOA_CONFIG.REQUIRED_KEYS.concat(TRUECOA_CONFIG.OUTPUT_KEYS));

  let row = getRow_(sheet, rowNum);
  const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
  if (!code) throw new Error('COA_Code is required on row ' + rowNum);

  const signer = String(getValue_(row, headerMap, 'SIGNER')).trim();
  const title = String(getValue_(row, headerMap, 'TITLE')).trim();
  if (!signer || !title) throw new Error('Signer and Title are required on row ' + rowNum);

  const verifyUrl = buildVerifyUrl_(code);
  const existingShort = String(getValue_(row, headerMap, 'SHORT_URL')).trim();
  const shortUrl = existingShort || createShortLink_(verifyUrl, code);
  const qrUrl = buildQrUrl_(shortUrl);

  setValue_(sheet, rowNum, headerMap, 'COA_CODE', code);
  setValue_(sheet, rowNum, headerMap, 'SHORT_URL', shortUrl);
  setValue_(sheet, rowNum, headerMap, 'QR_CODE', qrUrl);
  backfillRowAuthLinks_(sheet, rowNum, headerMap, row);

  row = getRow_(sheet, rowNum);
  const data = buildCertData_(row, headerMap);
  data.shortUrl = shortUrl;
  data.qrUrl = qrUrl;

  const folder = getOrCreateFolder_();
  const baseName = safeName_(data.sku || data.code || ('row_' + rowNum));
  const htmlFile = folder.createFile(baseName + '.html', renderCertificateHtml_(data), MimeType.HTML);
  const pdfBlob = htmlFile.getAs(MimeType.PDF).setName(baseName + '.pdf');
  const pdfFile = folder.createFile(pdfBlob);

  setValue_(sheet, rowNum, headerMap, 'PDF_URL', pdfFile.getUrl());
  const existingCertUrl = String(getValue_(row, headerMap, 'CERT_URL')).trim();
  if (!existingCertUrl || isGeneratedCertificateUrl_(existingCertUrl)) {
    setValue_(sheet, rowNum, headerMap, 'CERT_URL', htmlFile.getUrl());
  }
  setValue_(sheet, rowNum, headerMap, 'STATUS', '[complete]');
  setValue_(sheet, rowNum, headerMap, 'COMPLETION_DATE', new Date());

  return {
    code: data.code,
    htmlUrl: htmlFile.getUrl(),
    pdfUrl: pdfFile.getUrl()
  };
}

function processCOARows_(sheet, headerMap, refreshAllPdfs) {
  const summary = {
    totalRows: Math.max(0, sheet.getLastRow() - 1),
    rowsWithCodes: 0,
    backfilled: 0,
    qrUpdated: 0,
    pdfGenerated: 0,
    skippedExistingPdf: 0,
    errors: []
  };

  for (let rowNum = 2; rowNum <= sheet.getLastRow(); rowNum++) {
    let row = getRow_(sheet, rowNum);
    const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
    if (!code) continue;
    summary.rowsWithCodes++;

    try {
      if (backfillRowAuthLinks_(sheet, rowNum, headerMap, row)) summary.backfilled++;

      row = getRow_(sheet, rowNum);
      const shortUrl = String(getValue_(row, headerMap, 'SHORT_URL')).trim();
      const qrTarget = shortUrl || buildVerifyUrl_(code);
      setValue_(sheet, rowNum, headerMap, 'QR_CODE', buildQrUrl_(qrTarget));
      summary.qrUpdated++;

      const pdfUrl = String(getValue_(row, headerMap, 'PDF_URL')).trim();
      const certUrl = String(getValue_(row, headerMap, 'CERT_URL')).trim();
      const needsPdf = refreshAllPdfs || (!pdfUrl && !isGeneratedCertificateUrl_(certUrl));
      if (!needsPdf) {
        summary.skippedExistingPdf++;
        continue;
      }

      processCOARow_(sheet, rowNum);
      summary.pdfGenerated++;
      Utilities.sleep(400);
    } catch (err) {
      summary.errors.push('Row ' + rowNum + ' (' + code + '): ' + err.message);
    }
  }

  return summary;
}

function formatRunSummary_(summary) {
  return [
    'Rows in sheet: ' + summary.totalRows,
    'Rows with COA_Code: ' + summary.rowsWithCodes,
    'Rows with auth links backfilled: ' + summary.backfilled,
    'QR codes updated: ' + summary.qrUpdated,
    'PDFs generated/refreshed: ' + summary.pdfGenerated,
    'Rows skipped because PDF already exists: ' + summary.skippedExistingPdf,
    summary.errors.length ? '\nErrors:\n' + summary.errors.slice(0, 8).join('\n') : '',
    !summary.rowsWithCodes ? '\nNo COA rows were found. Add rows in the COA sheet or create them from the TrueCOA app first.' : '',
    summary.rowsWithCodes && !summary.pdfGenerated && !summary.errors.length ? '\nNo PDFs were generated. If you want to overwrite existing PDFs, run TrueCOA > Generate/Refresh All COA PDFs.' : ''
  ].filter(Boolean).join('\n');
}

function backfillRowAuthLinks_(sheet, rowNum, headerMap, row) {
  const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
  const tokenId = String(getValue_(row, headerMap, 'NFT_TOKEN_ID')).trim();
  const certUrl = String(getValue_(row, headerMap, 'CERT_URL')).trim();
  const scoreDetectUrl = String(getValue_(row, headerMap, 'SCOREDETECT_URL')).trim();
  let changed = false;

  if (!scoreDetectUrl && isScoreDetectUrl_(certUrl)) {
    setValue_(sheet, rowNum, headerMap, 'SCOREDETECT_URL', certUrl);
    changed = true;
  }

  const currentScoreDetectUrl = scoreDetectUrl || (isScoreDetectUrl_(certUrl) ? certUrl : '');
  if (!String(getValue_(row, headerMap, 'SCOREDETECT_CERT_ID')).trim() && currentScoreDetectUrl) {
    const scoreDetectCode = extractScoreDetectCode_(currentScoreDetectUrl);
    if (scoreDetectCode) {
      setValue_(sheet, rowNum, headerMap, 'SCOREDETECT_CERT_ID', scoreDetectCode);
      changed = true;
    }
  }

  if (tokenId) {
    if (!String(getValue_(row, headerMap, 'BLOCKCHAIN_URL')).trim()) {
      setValue_(sheet, rowNum, headerMap, 'BLOCKCHAIN_URL', buildPolygonTokenUrl_(tokenId));
      changed = true;
    }
    if (!String(getValue_(row, headerMap, 'NFT_URL')).trim()) {
      setValue_(sheet, rowNum, headerMap, 'NFT_URL', buildOpenSeaUrl_(tokenId));
      changed = true;
    }
    if (!String(getValue_(row, headerMap, 'POLYGON_METADATA_URL')).trim()) {
      setValue_(sheet, rowNum, headerMap, 'POLYGON_METADATA_URL', buildPolygonMetadataUrl_(code));
      changed = true;
    }
    if (!String(getValue_(row, headerMap, 'POLYGON_COA_IMAGE_URL')).trim()) {
      setValue_(sheet, rowNum, headerMap, 'POLYGON_COA_IMAGE_URL', buildPolygonCoaImageUrl_(code));
      changed = true;
    }
  }

  return changed;
}

function buildCertData_(row, headerMap) {
  const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
  const shortUrl = String(getValue_(row, headerMap, 'SHORT_URL')).trim() || buildVerifyUrl_(code);
  const imageUrl = String(getValue_(row, headerMap, 'IMAGE_URL')).trim();
  const tokenId = String(getValue_(row, headerMap, 'NFT_TOKEN_ID')).trim();
  const certUrl = String(getValue_(row, headerMap, 'CERT_URL')).trim();
  const scoreDetectUrl = String(getValue_(row, headerMap, 'SCOREDETECT_URL')).trim() ||
    (isScoreDetectUrl_(certUrl) ? certUrl : '');

  return {
    code: code,
    sku: String(getValue_(row, headerMap, 'SKU')).trim(),
    artist: valueOr_(getValue_(row, headerMap, 'SIGNER'), 'Unknown Artist'),
    title: valueOr_(getValue_(row, headerMap, 'TITLE'), 'Untitled'),
    date: String(getValue_(row, headerMap, 'DATE')).trim(),
    medium: String(getValue_(row, headerMap, 'MEDIUM')).trim(),
    edition: String(getValue_(row, headerMap, 'EDITION')).trim(),
    size: String(getValue_(row, headerMap, 'SIZE')).trim(),
    condition: String(getValue_(row, headerMap, 'CONDITION')).trim(),
    description: String(getValue_(row, headerMap, 'DESCRIPTION')).trim(),
    provenance: String(getValue_(row, headerMap, 'PROVENANCE')).trim(),
    assignor: String(getValue_(row, headerMap, 'ASSIGNOR')).trim(),
    authNotes: String(getValue_(row, headerMap, 'AUTH_NOTES')).trim(),
    imageUrl: imageUrl,
    shortUrl: shortUrl,
    qrUrl: buildQrUrl_(shortUrl),
    verifyUrl: buildVerifyUrl_(code),
    tokenId: tokenId,
    blockchainUrl: String(getValue_(row, headerMap, 'BLOCKCHAIN_URL')).trim() || (tokenId ? buildPolygonTokenUrl_(tokenId) : ''),
    nftUrl: String(getValue_(row, headerMap, 'NFT_URL')).trim() || (tokenId ? buildOpenSeaUrl_(tokenId) : ''),
    polygonMetadataUrl: String(getValue_(row, headerMap, 'POLYGON_METADATA_URL')).trim() || (tokenId ? buildPolygonMetadataUrl_(code) : ''),
    polygonCoaImageUrl: String(getValue_(row, headerMap, 'POLYGON_COA_IMAGE_URL')).trim() || (tokenId ? buildPolygonCoaImageUrl_(code) : ''),
    certUrl: certUrl,
    scoreDetectUrl: scoreDetectUrl,
    scoreDetectCode: String(getValue_(row, headerMap, 'SCOREDETECT_CERT_ID')).trim() || extractScoreDetectCode_(scoreDetectUrl),
    scoreDetectTransactionUrl: String(getValue_(row, headerMap, 'SCOREDETECT_TX_URL')).trim(),
    pdfUrl: String(getValue_(row, headerMap, 'PDF_URL')).trim(),
    completionDate: new Date()
  };
}

function renderCertificateHtml_(d) {
  const details = [
    ['Artist', d.artist],
    ['Title', d.title],
    ['Date', d.date],
    ['Medium', d.medium],
    ['Dimensions', d.size],
    ['Edition', d.edition],
    ['Condition', d.condition],
    ['COA Code', d.code]
  ].filter(function(item) { return item[1]; });

  const detailHtml = details.map(function(item) {
    return '<div class="detail"><span>' + esc_(item[0]) + '</span><strong>' + esc_(item[1]) + '</strong></div>';
  }).join('');

  const imageHtml = d.imageUrl
    ? '<img class="art" src="' + esc_(d.imageUrl) + '" alt="' + esc_(d.title) + '">'
    : '<div class="art placeholder">Artwork image</div>';

  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<title>COA ' + esc_(d.code) + '</title>',
    '<style>',
    '@page{size:A4 landscape;margin:9mm}',
    '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#16241b;margin:0;background:#f5f2ea}',
    '.cert{min-height:190mm;border:2px solid #c9a227;background:#fff;padding:10mm;display:flex;flex-direction:column;gap:16px}',
    '.top{display:flex;justify-content:space-between;gap:22px;border-bottom:1px solid #d8c98b;padding-bottom:14px}',
    'h1{font-family:Georgia,serif;font-size:30px;margin:0;color:#355e3b;letter-spacing:0}',
    '.brand{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#94751d;margin-top:6px}',
    '.qr{width:116px;text-align:center;font-size:11px;color:#555}.qr img{width:96px;height:96px}',
    '.body{display:grid;grid-template-columns:38% 1fr;gap:22px;flex:1}.art{width:100%;height:112mm;object-fit:contain;background:#f3f3f3;border:0}',
    '.placeholder{display:flex;align-items:center;justify-content:center;color:#888;border:1px solid #ddd}',
    '.details{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.detail{border-bottom:1px solid #eee;padding-bottom:6px}.detail span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#967820}.detail strong{font-size:13px}',
    '.section{margin-top:14px}.section h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#355e3b;margin:0 0 6px}.section p{font-size:12px;line-height:1.42;margin:0;color:#333;word-break:break-word}',
    '.foot{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #d8c98b;padding-top:10px;font-size:10px;color:#555}',
    'a{color:#14291d;text-decoration:none}',
    '</style></head><body><main class="cert">',
    '<div class="top"><div><h1>Certificate of Authenticity</h1><div class="brand">TrueCOA / Gauntlet Gallery</div></div>',
    '<div class="qr"><img src="' + esc_(d.qrUrl) + '" alt="QR"><div>#' + esc_(d.code) + '</div></div></div>',
    '<div class="body"><div>' + imageHtml + '</div><div><div class="details">' + detailHtml + '</div>',
    d.description ? '<div class="section"><h2>Description</h2><p>' + esc_(d.description) + '</p></div>' : '',
    d.provenance ? '<div class="section"><h2>Provenance</h2><p>' + esc_(d.provenance) + '</p></div>' : '',
    d.authNotes ? '<div class="section"><h2>Authentication Notes</h2><p>' + esc_(d.authNotes) + '</p></div>' : '',
    '<div class="section"><h2>Digital Authentication</h2><p>' +
      'Signer: Gauntlet Gallery<br>' +
      'ScoreDetect Code: ' + esc_(d.scoreDetectCode || 'Not created') + '<br>' +
      (d.scoreDetectUrl ? 'ScoreDetect Link: <a href="' + esc_(d.scoreDetectUrl) + '">' + esc_(d.scoreDetectUrl) + '</a><br>' : 'ScoreDetect Link: Not created<br>') +
      (d.scoreDetectTransactionUrl ? 'ScoreDetect Tx: <a href="' + esc_(d.scoreDetectTransactionUrl) + '">' + esc_(d.scoreDetectTransactionUrl) + '</a><br>' : '') +
      'Polygon Token: ' + esc_(d.tokenId || 'Not minted') + '<br>' +
      (d.blockchainUrl ? 'Polygon Token Link: <a href="' + esc_(d.blockchainUrl) + '">' + esc_(d.blockchainUrl) + '</a><br>' : 'Polygon Token Link: Not minted<br>') +
      (d.polygonMetadataUrl ? 'Polygon Metadata Link: <a href="' + esc_(d.polygonMetadataUrl) + '">' + esc_(d.polygonMetadataUrl) + '</a><br>' : '') +
      (d.polygonCoaImageUrl ? 'Polygon COA Image Link: <a href="' + esc_(d.polygonCoaImageUrl) + '">' + esc_(d.polygonCoaImageUrl) + '</a><br>' : 'Polygon COA Image Link: Not minted<br>') +
      (d.nftUrl ? 'Polygon Marketplace Link: <a href="' + esc_(d.nftUrl) + '">' + esc_(d.nftUrl) + '</a>' : '') +
    '</p></div>',
    '</div></div>',
    '<div class="foot"><div>Verification: ' + esc_(d.shortUrl || d.verifyUrl) + '</div><div>Generated ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy') + '</div></div>',
    '</main></body></html>'
  ].join('');
}

function createInstructionsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, TRUECOA_CONFIG.INSTRUCTIONS_SHEET_NAME);
  sheet.clear();
  const rows = [
    ['TrueCOA Master Script'],
    ['Use this workbook with one script only: TrueCOA_Master_Code.gs.'],
    [''],
    ['Normal flow'],
    ['1. Create COA/product in the TrueCOA app with ScoreDetect and Polygon enabled.'],
    ['2. Confirm the row appears in the COA sheet.'],
    ['3. Run TrueCOA > Backfill Auth Links.'],
    ['4. Run TrueCOA > Generate Missing COA PDFs.'],
    ['5. Use PDF_URL for the generated Drive PDF.'],
    [''],
    ['Manual row flow'],
    ['1. Fill COA_Code, Signer, Title, and artwork metadata.'],
    ['2. Paste ScoreDetect_URL or Cert_URL if you created ScoreDetect manually.'],
    ['3. Paste NFT_TokenID if the Polygon NFT already exists.'],
    ['4. Run Backfill Auth Links and Generate Selected COA PDF.'],
    [''],
    ['Important'],
    ['ScoreDetect and Polygon are created by the TrueCOA backend/app, not by this Apps Script.'],
    ['Signer printed on the COA is fixed as Gauntlet Gallery.'],
    ['Assignee is intentionally not part of the master template.']
  ];
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(16);
  sheet.setColumnWidth(1, 760);
  sheet.setFrozenRows(1);
}

function formatCOASheet_(sheet) {
  sheet.setFrozenRows(1);
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return;

  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#355e3b');
  headerRange.setFontColor('#ffffff');
  headerRange.setWrap(true);

  const widths = {
    COA_CODE: 130,
    QR_CODE: 220,
    TITLE: 220,
    DESCRIPTION: 320,
    PROVENANCE: 260,
    IMAGE_URL: 260,
    SCOREDETECT_URL: 260,
    POLYGON_METADATA_URL: 260,
    POLYGON_COA_IMAGE_URL: 260,
    BLOCKCHAIN_URL: 260,
    NFT_URL: 260,
    CERT_URL: 260,
    PDF_URL: 260
  };
  const headerMap = getHeaderMap_(sheet);
  Object.keys(widths).forEach(function(key) {
    if (headerMap[key] !== undefined) sheet.setColumnWidth(headerMap[key] + 1, widths[key]);
  });
}

function ensureAllHeaders_(sheet) {
  let headerMap = getHeaderMap_(sheet);
  TRUECOA_CONFIG.CANONICAL_HEADERS.forEach(function(item) {
    const key = item[0];
    const header = item[1];
    if (headerMap[key] === undefined) {
      const nextColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextColumn).setValue(header);
      headerMap = getHeaderMap_(sheet);
    }
  });
  return headerMap;
}

function getSpreadsheet_() {
  if (TRUECOA_CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(TRUECOA_CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getCOASheet_() {
  const sheet = getSpreadsheet_().getSheetByName(TRUECOA_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + TRUECOA_CONFIG.SHEET_NAME + '" not found. Run Setup/Repair Workbook first.');
  return sheet;
}

function getRow_(sheet, rowNum) {
  return sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getHeaderMap_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const normalized = {};
  headers.forEach(function(header, idx) {
    const key = normalizeHeader_(header);
    if (key) normalized[key] = idx;
  });

  const map = {};
  Object.keys(TRUECOA_CONFIG.HEADER_ALIASES).forEach(function(key) {
    const aliases = TRUECOA_CONFIG.HEADER_ALIASES[key];
    for (let i = 0; i < aliases.length; i++) {
      const idx = normalized[normalizeHeader_(aliases[i])];
      if (idx !== undefined) {
        map[key] = idx;
        break;
      }
    }
  });
  return map;
}

function getMissingHeaders_(headerMap, keys) {
  return keys.filter(function(key) { return headerMap[key] === undefined; });
}

function assertHeaders_(headerMap, keys) {
  const missing = getMissingHeaders_(headerMap, keys);
  if (missing.length) throw new Error('Missing required columns: ' + missing.join(', '));
}

function getValue_(row, headerMap, key) {
  const idx = headerMap[key];
  return idx === undefined ? '' : (row[idx] || '');
}

function setValue_(sheet, rowNum, headerMap, key, value) {
  const idx = headerMap[key];
  if (idx !== undefined) sheet.getRange(rowNum, idx + 1).setValue(value);
}

function getOrCreateFolder_() {
  const folders = DriveApp.getFoldersByName(TRUECOA_CONFIG.DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(TRUECOA_CONFIG.DRIVE_FOLDER_NAME);
}

function buildVerifyUrl_(code) {
  return TRUECOA_CONFIG.VERIFY_BASE_URL.replace(/\/$/, '') + '/' + encodeURIComponent(code);
}

function buildPolygonTokenUrl_(tokenId) {
  return 'https://polygonscan.com/token/' + TRUECOA_CONFIG.CONTRACT_ADDRESS + '?a=' + encodeURIComponent(tokenId);
}

function buildOpenSeaUrl_(tokenId) {
  return 'https://opensea.io/assets/matic/' + TRUECOA_CONFIG.CONTRACT_ADDRESS + '/' + encodeURIComponent(tokenId);
}

function buildPolygonMetadataUrl_(code) {
  return TRUECOA_CONFIG.API_BASE_URL.replace(/\/$/, '') + '/api/nft/' + encodeURIComponent(code);
}

function buildPolygonCoaImageUrl_(code) {
  return TRUECOA_CONFIG.API_BASE_URL.replace(/\/$/, '') + '/api/coa-image/' + encodeURIComponent(code) + '.svg';
}

function isGeneratedCertificateUrl_(value) {
  return /(^https?:\/\/)?(drive|docs)\.google\.com\//i.test(String(value || '').trim());
}

function isScoreDetectUrl_(value) {
  return /^https?:\/\/([^\/]+\.)?scoredetect\.com\//i.test(String(value || '').trim());
}

function extractScoreDetectCode_(value) {
  const cleaned = String(value || '').trim().replace(/[?#].*$/, '');
  const match = cleaned.match(/\/([A-Za-z0-9_-]{8,})\/?$/);
  return match ? match[1] : '';
}

function buildQrUrl_(value) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' +
    TRUECOA_CONFIG.QR_SIZE + 'x' + TRUECOA_CONFIG.QR_SIZE +
    '&data=' + encodeURIComponent(value);
}

function createShortLink_(longUrl, code) {
  const apiKey = getBitlyApiKey_();
  if (!apiKey) return longUrl;

  try {
    const response = UrlFetchApp.fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify({ long_url: longUrl, title: 'COA-' + code }),
      muteHttpExceptions: true
    });
    const body = JSON.parse(response.getContentText());
    return response.getResponseCode() < 300 && body.link ? body.link : longUrl;
  } catch (err) {
    Logger.log('Bitly failed for ' + code + ': ' + err.message);
    return longUrl;
  }
}

function getBitlyApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('BITLY_API_KEY') || '';
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function safeName_(value) {
  return String(value || 'coa').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'coa';
}

function valueOr_(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function esc_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
