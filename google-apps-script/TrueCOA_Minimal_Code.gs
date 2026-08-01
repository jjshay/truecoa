/**
 * TrueCOA minimal Google Apps Script
 *
 * One-file sheet helper for the current TrueCOA stack:
 * - Validates the live COA sheet headers
 * - Generates verification links and QR URLs
 * - Creates a printable certificate HTML + PDF in Drive
 * - Updates the COA row output columns
 *
 * Not included:
 * - Image Finder sidebars
 * - Website form handler
 * - AI copy generation
 * - Polygon minting
 *
 * Polygon minting now belongs in the backend API, not Apps Script.
 */

const TRUECOA_CONFIG = {
  SPREADSHEET_ID: '14GcZTEOMmfNdJvYmbS3CylAPEAz7z9NW_1rzvsfl6Ko',
  SHEET_NAME: 'COA',
  VERIFY_BASE_URL: 'https://frontend-pi-three-98.vercel.app/AUTHENTICATE',
  API_BASE_URL: 'https://coa.up.railway.app',
  DRIVE_FOLDER_NAME: 'TrueCOA Certificates',
  CONTRACT_ADDRESS: '0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1',
  QR_SIZE: 220,
  REQUIRED_KEYS: ['COA_CODE', 'QR_CODE', 'SIGNER', 'TITLE', 'SHORT_URL', 'CERT_URL', 'STATUS', 'COMPLETION_DATE'],
  HEADER_ALIASES: {
    COA_CODE: ['COA_Code'],
    QR_CODE: ['QR_Code'],
    SIGNER: ['Signer', 'Artist'],
    TITLE: ['Title'],
    DATE: ['Date'],
    MEDIUM: ['Medium'],
    EDITION: ['Edition', 'Edition '],
    SIZE: ['Size', 'Dimensions'],
    CONDITION: ['Condition'],
    DESCRIPTION: ['Description'],
    PROVENANCE: ['PROVIDENCE', 'Provience', 'Provenance', 'Providence'],
    ASSIGNOR: ['Assignor', 'Authenticator'],
    ASSIGNEE: ['Assignee'],
    AUTH_NOTES: ['Third Party Authentication Notes', 'THIRD PARTY COA LINK'],
    SKU: ['SKU'],
    IMAGE_URL: ['Image_URL'],
    NFT_TOKEN_ID: ['NFT_TokenID'],
    SHORT_URL: ['Short_URL'],
    SCOREDETECT_CERT_ID: ['ScoreDetect_Cert_ID', 'ScoreDetect Cert ID', 'ScoreDetect Code', 'ScoreDetect_Code', 'ScoreDetect Certificate', 'ScoreDetect_Certificate_ID'],
    SCOREDETECT_URL: ['ScoreDetect_URL', 'ScoreDetect Link', 'ScoreDetect Verification URL', 'ScoreDetect_Verification_URL'],
    SCOREDETECT_TX_URL: ['ScoreDetect_Transaction_URL', 'ScoreDetect Tx URL', 'ScoreDetect Blockchain URL'],
    POLYGON_METADATA_URL: ['Polygon_Metadata_URL', 'NFT_Metadata_URL', 'Metadata_URL'],
    POLYGON_COA_IMAGE_URL: ['Polygon_COA_Image_URL', 'COA_Image_URL', 'Rendered_COA_Image_URL'],
    BLOCKCHAIN_URL: ['Blockchain_URL'],
    NFT_URL: ['NFT_URL'],
    CERT_URL: ['Cert_URL'],
    PDF_URL: ['PDF_URL', 'Generated_PDF_URL', 'Print_PDF_URL'],
    STATUS: ['Status'],
    COMPLETION_DATE: ['Completion_Date']
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TrueCOA')
    .addItem('Validate Setup', 'validateTrueCOASetup')
    .addSeparator()
    .addItem('Generate Selected COA', 'generateSelectedCOA')
    .addItem('Generate Missing COAs', 'generateMissingCOAs')
    .addItem('Generate/Refresh All COA PDFs', 'generateAllCOAPDFs')
    .addItem('Refresh QR Codes', 'refreshTrueCOAQRCodes')
    .addSeparator()
    .addItem('Preview Selected COA', 'previewSelectedCOA')
    .addToUi();
}

function validateTrueCOASetup() {
  const sheet = getCOASheet_();
  const headerMap = getHeaderMap_(sheet);
  const missing = getMissingHeaders_(headerMap, TRUECOA_CONFIG.REQUIRED_KEYS);
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

function generateSelectedCOA() {
  const sheet = getCOASheet_();
  const selected = SpreadsheetApp.getActiveRange();
  if (!selected || selected.getRow() <= 1) {
    SpreadsheetApp.getUi().alert('Select a populated COA data row first.');
    return;
  }

  const rowNum = selected.getRow();
  const result = processCOARow_(sheet, rowNum);
  SpreadsheetApp.getUi().alert(
    'COA generated',
    'COA: ' + result.code + '\nPDF: ' + result.pdfUrl,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function generateMissingCOAs() {
  const sheet = getCOASheet_();
  let headerMap = getHeaderMap_(sheet);
  assertHeaders_(headerMap, TRUECOA_CONFIG.REQUIRED_KEYS);
  headerMap = ensureHeader_(sheet, headerMap, 'PDF_URL');

  let generated = 0;
  const lastRow = sheet.getLastRow();
  for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
    const row = getRow_(sheet, rowNum);
    const code = String(getValue_(row, headerMap, 'COA_CODE')).trim();
    const certUrl = String(getValue_(row, headerMap, 'CERT_URL')).trim();
    const pdfUrl = String(getValue_(row, headerMap, 'PDF_URL')).trim();
    if (!code || pdfUrl || isGeneratedCertificateUrl_(certUrl)) continue;

    processCOARow_(sheet, rowNum);
    generated++;
    Utilities.sleep(400);
  }

  SpreadsheetApp.getUi().alert('Generated ' + generated + ' missing COAs.');
}

function generateAllCOAPDFs() {
  const sheet = getCOASheet_();
  let headerMap = getHeaderMap_(sheet);
  assertHeaders_(headerMap, TRUECOA_CONFIG.REQUIRED_KEYS);
  headerMap = ensureHeader_(sheet, headerMap, 'PDF_URL');

  let generated = 0;
  const errors = [];
  const lastRow = sheet.getLastRow();
  for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
    const row = getRow_(sheet, rowNum);
    const code = String(getValue_(row, headerMap, 'COA_CODE')).trim();
    if (!code) continue;

    try {
      processCOARow_(sheet, rowNum);
      generated++;
      Utilities.sleep(400);
    } catch (err) {
      errors.push('Row ' + rowNum + ' (' + code + '): ' + err.message);
    }
  }

  SpreadsheetApp.getUi().alert(
    'Generated/refreshed ' + generated + ' COA PDFs.' +
    (errors.length ? '\n\nErrors:\n' + errors.slice(0, 6).join('\n') : '')
  );
}

function refreshTrueCOAQRCodes() {
  const sheet = getCOASheet_();
  const headerMap = getHeaderMap_(sheet);
  assertHeaders_(headerMap, ['COA_CODE', 'QR_CODE']);

  let updated = 0;
  for (let rowNum = 2; rowNum <= sheet.getLastRow(); rowNum++) {
    const row = getRow_(sheet, rowNum);
    const code = String(getValue_(row, headerMap, 'COA_CODE')).trim();
    if (!code) continue;

    const shortUrl = String(getValue_(row, headerMap, 'SHORT_URL')).trim();
    const qrTarget = shortUrl || buildVerifyUrl_(code);
    setValue_(sheet, rowNum, headerMap, 'QR_CODE', buildQrUrl_(qrTarget));
    updated++;
  }

  SpreadsheetApp.getUi().alert('Updated ' + updated + ' QR codes.');
}

function previewSelectedCOA() {
  const sheet = getCOASheet_();
  const selected = SpreadsheetApp.getActiveRange();
  if (!selected || selected.getRow() <= 1) {
    SpreadsheetApp.getUi().alert('Select a populated COA data row first.');
    return;
  }

  const headerMap = getHeaderMap_(sheet);
  const data = buildCertData_(getRow_(sheet, selected.getRow()), headerMap);
  const folder = getOrCreateFolder_();
  const file = folder.createFile('preview_' + safeName_(data.code || 'sample') + '.html', renderCertificateHtml_(data), MimeType.HTML);
  SpreadsheetApp.getUi().alert('Preview created:\n\n' + file.getUrl());
}

function processCOARow_(sheet, rowNum) {
  let headerMap = getHeaderMap_(sheet);
  assertHeaders_(headerMap, TRUECOA_CONFIG.REQUIRED_KEYS);
  headerMap = ensureHeader_(sheet, headerMap, 'PDF_URL');

  const row = getRow_(sheet, rowNum);
  const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
  if (!code) throw new Error('COA_Code is required on row ' + rowNum);

  const verifyUrl = buildVerifyUrl_(code);
  const existingShort = String(getValue_(row, headerMap, 'SHORT_URL')).trim();
  const shortUrl = existingShort || createShortLink_(verifyUrl, code);
  const qrUrl = buildQrUrl_(shortUrl);

  setValue_(sheet, rowNum, headerMap, 'COA_CODE', code);
  setValue_(sheet, rowNum, headerMap, 'SHORT_URL', shortUrl);
  setValue_(sheet, rowNum, headerMap, 'QR_CODE', qrUrl);

  const tokenId = String(getValue_(row, headerMap, 'NFT_TOKEN_ID')).trim();
  if (tokenId) {
    const blockchainUrl = 'https://polygonscan.com/token/' + TRUECOA_CONFIG.CONTRACT_ADDRESS + '?a=' + encodeURIComponent(tokenId);
    const nftUrl = 'https://opensea.io/assets/matic/' + TRUECOA_CONFIG.CONTRACT_ADDRESS + '/' + encodeURIComponent(tokenId);
    setValue_(sheet, rowNum, headerMap, 'BLOCKCHAIN_URL', blockchainUrl);
    setValue_(sheet, rowNum, headerMap, 'NFT_URL', nftUrl);
  }

  const updatedRow = getRow_(sheet, rowNum);
  const data = buildCertData_(updatedRow, headerMap);
  data.shortUrl = shortUrl;
  data.qrUrl = qrUrl;

  const folder = getOrCreateFolder_();
  const baseName = safeName_(data.sku || data.code || ('row_' + rowNum));
  const htmlFile = folder.createFile(baseName + '.html', renderCertificateHtml_(data), MimeType.HTML);
  const pdfBlob = htmlFile.getAs(MimeType.PDF).setName(baseName + '.pdf');
  const pdfFile = folder.createFile(pdfBlob);

  const existingCertUrl = String(getValue_(updatedRow, headerMap, 'CERT_URL')).trim();
  if (headerMap.PDF_URL !== undefined) {
    setValue_(sheet, rowNum, headerMap, 'PDF_URL', pdfFile.getUrl());
  } else if (!existingCertUrl) {
    setValue_(sheet, rowNum, headerMap, 'CERT_URL', pdfFile.getUrl());
  }
  setValue_(sheet, rowNum, headerMap, 'STATUS', '[complete]');
  setValue_(sheet, rowNum, headerMap, 'COMPLETION_DATE', new Date());

  return {
    code: data.code,
    htmlUrl: htmlFile.getUrl(),
    pdfUrl: pdfFile.getUrl()
  };
}

function buildCertData_(row, headerMap) {
  const code = String(getValue_(row, headerMap, 'COA_CODE')).trim().toUpperCase();
  const shortUrl = String(getValue_(row, headerMap, 'SHORT_URL')).trim() || buildVerifyUrl_(code);
  const imageUrl = String(getValue_(row, headerMap, 'IMAGE_URL')).trim();
  const tokenId = String(getValue_(row, headerMap, 'NFT_TOKEN_ID')).trim();
  const blockchainUrl = String(getValue_(row, headerMap, 'BLOCKCHAIN_URL')).trim() ||
    (tokenId ? 'https://polygonscan.com/token/' + TRUECOA_CONFIG.CONTRACT_ADDRESS + '?a=' + encodeURIComponent(tokenId) : '');
  const certUrl = String(getValue_(row, headerMap, 'CERT_URL')).trim();
  const scoreDetectUrl = String(getValue_(row, headerMap, 'SCOREDETECT_URL')).trim() ||
    (isScoreDetectUrl_(certUrl) ? certUrl : '');
  const pdfUrl = String(getValue_(row, headerMap, 'PDF_URL')).trim();
  const polygonMetadataUrl = String(getValue_(row, headerMap, 'POLYGON_METADATA_URL')).trim() ||
    (tokenId ? buildPolygonMetadataUrl_(code) : '');
  const polygonCoaImageUrl = String(getValue_(row, headerMap, 'POLYGON_COA_IMAGE_URL')).trim() ||
    (tokenId ? buildPolygonCoaImageUrl_(code) : '');

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
    assignee: String(getValue_(row, headerMap, 'ASSIGNEE')).trim(),
    authNotes: String(getValue_(row, headerMap, 'AUTH_NOTES')).trim(),
    imageUrl: imageUrl,
    shortUrl: shortUrl,
    qrUrl: buildQrUrl_(shortUrl),
    verifyUrl: buildVerifyUrl_(code),
    tokenId: tokenId,
    blockchainUrl: blockchainUrl,
    nftUrl: String(getValue_(row, headerMap, 'NFT_URL')).trim(),
    polygonMetadataUrl: polygonMetadataUrl,
    polygonCoaImageUrl: polygonCoaImageUrl,
    certUrl: certUrl,
    scoreDetectUrl: scoreDetectUrl,
    scoreDetectCode: String(getValue_(row, headerMap, 'SCOREDETECT_CERT_ID')).trim() || extractScoreDetectCode_(scoreDetectUrl),
    scoreDetectTransactionUrl: String(getValue_(row, headerMap, 'SCOREDETECT_TX_URL')).trim(),
    pdfUrl: pdfUrl,
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
    '@page{size:letter landscape;margin:0.35in}',
    '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#16241b;margin:0;background:#f5f2ea}',
    '.cert{min-height:7.8in;border:2px solid #c9a227;background:#fff;padding:0.35in;display:flex;flex-direction:column;gap:18px}',
    '.top{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #d8c98b;padding-bottom:16px}',
    'h1{font-family:Georgia,serif;font-size:32px;margin:0;color:#14291d;letter-spacing:.02em}',
    '.brand{font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#94751d;margin-top:6px}',
    '.qr{width:118px;text-align:center;font-size:12px;color:#555}.qr img{width:100px;height:100px}',
    '.body{display:grid;grid-template-columns:38% 1fr;gap:24px;flex:1}.art{width:100%;height:4.6in;object-fit:contain;background:#f3f3f3;border:1px solid #ddd}',
    '.placeholder{display:flex;align-items:center;justify-content:center;color:#888}',
    '.details{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.detail{border-bottom:1px solid #eee;padding-bottom:6px}.detail span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#967820}.detail strong{font-size:14px}',
    '.section{margin-top:18px}.section h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#967820;margin:0 0 6px}.section p{font-size:13px;line-height:1.45;margin:0;color:#333;word-break:break-word}',
    '.foot{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #d8c98b;padding-top:12px;font-size:11px;color:#555}',
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

function getSpreadsheet_() {
  if (TRUECOA_CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(TRUECOA_CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getCOASheet_() {
  const sheet = getSpreadsheet_().getSheetByName(TRUECOA_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + TRUECOA_CONFIG.SHEET_NAME + '" not found.');
  return sheet;
}

function getRow_(sheet, rowNum) {
  return sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normalized = {};
  headers.forEach(function(header, idx) {
    normalized[normalizeHeader_(header)] = idx;
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

function ensureHeader_(sheet, headerMap, key) {
  if (headerMap[key] !== undefined) return headerMap;

  const aliases = TRUECOA_CONFIG.HEADER_ALIASES[key];
  if (!aliases || !aliases.length) throw new Error('No header alias configured for ' + key);

  const nextColumn = sheet.getLastColumn() + 1;
  sheet.getRange(1, nextColumn).setValue(aliases[0]);
  return getHeaderMap_(sheet);
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
