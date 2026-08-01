/**
 * TrueCOA ONE CLICK WORKING
 *
 * Paste this entire file into a bound Google Sheet Apps Script project.
 * Run RUN_NOW.
 *
 * This version is intentionally blunt:
 * - Uses the active spreadsheet first
 * - Creates the COA sheet if missing
 * - Creates all required columns
 * - If no COA rows exist, creates a test row
 * - Generates PDF files even when optional fields are blank
 * - Writes the Drive PDF link to PDF_URL
 */

const TRUECOA = {
  SHEET_NAME: 'COA',
  LOG_SHEET_NAME: 'TRUECOA_RUN_LOG',
  FOLDER_NAME: 'TrueCOA Certificates',
  VERIFY_BASE_URL: 'https://frontend-pi-three-98.vercel.app/AUTHENTICATE',
  API_BASE_URL: 'https://coa.up.railway.app',
  // Existing production endpoint that already creates ScoreDetect + Polygon.
  // It appends a backend row, so RUN_NOW removes duplicate rows with the same COA_Code
  // after copying returned authentication fields into the current row.
  AUTH_API_URL: 'https://coa.up.railway.app/api/create',
  CREATE_SCOREDETECT: true,
  MINT_POLYGON: true,
  CONTRACT_ADDRESS: '0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1',
  QR_SIZE: 220,
  HEADERS: [
    'COA_Code',
    'QR_Code',
    'Signer',
    'Title',
    'Date',
    'Medium',
    'Edition',
    'Size',
    'Condition',
    'Description',
    'Provenance',
    'Assignor',
    'Third Party Authentication Notes',
    'SKU',
    'Image_URL',
    'NFT_TokenID',
    'Short_URL',
    'ScoreDetect_Cert_ID',
    'ScoreDetect_URL',
    'ScoreDetect_Transaction_URL',
    'Polygon_Metadata_URL',
    'Polygon_COA_Image_URL',
    'Blockchain_URL',
    'NFT_URL',
    'Cert_URL',
    'PDF_URL',
    'Auth_Status',
    'Auth_Error',
    'Status',
    'Completion_Date'
  ]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TrueCOA')
    .addItem('RUN NOW - Create COA PDFs', 'RUN_NOW')
    .addToUi();
}

function RUN_NOW() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from the Google Sheet: Extensions > Apps Script.');

  const runLog = [];
  try {
    runLog.push(['Started', new Date()]);
    runLog.push(['Spreadsheet', ss.getName()]);

    const sheet = ss.getSheetByName(TRUECOA.SHEET_NAME) || ss.insertSheet(TRUECOA.SHEET_NAME);
    runLog.push(['COA sheet', sheet.getName()]);

    const folder = getFolder_();
    runLog.push(['Drive folder', folder.getName()]);

    const headerMap = setupSheet_(sheet);
    runLog.push(['Headers created/mapped', Object.keys(headerMap).length]);

    let createdSample = false;
    if (!hasAnyCoaRows_(sheet, headerMap)) {
      createSampleRow_(sheet, headerMap);
      createdSample = true;
      runLog.push(['Sample row created', 'Yes']);
    } else {
      runLog.push(['Sample row created', 'No, existing COA rows found']);
    }

    const result = generatePdfs_(sheet, headerMap, folder);
    runLog.push(['Rows checked', result.rowsChecked]);
    runLog.push(['PDFs created', result.pdfsCreated]);
    runLog.push(['First PDF URL', result.firstPdfUrl || '']);
    result.errors.forEach(function(error, index) {
      runLog.push(['Error ' + (index + 1), error]);
    });
    runLog.push(['Finished', new Date()]);
    writeRunLog_(ss, runLog);

    SpreadsheetApp.getUi().alert(
      'TrueCOA RUN_NOW finished',
      [
        'Spreadsheet: ' + ss.getName(),
        'Sheet: ' + sheet.getName(),
        'Drive folder: ' + folder.getName(),
        createdSample ? 'Created sample row because no COA rows were found.' : '',
        'Rows checked: ' + result.rowsChecked,
        'PDFs created: ' + result.pdfsCreated,
        result.firstPdfUrl ? 'First PDF: ' + result.firstPdfUrl : '',
        result.errors.length ? '\nErrors:\n' + result.errors.slice(0, 8).join('\n') : '',
        '\nA visible audit log was written to the TRUECOA_RUN_LOG tab.'
      ].filter(Boolean).join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (err) {
    runLog.push(['Fatal error', err.message]);
    runLog.push(['Finished with failure', new Date()]);
    writeRunLog_(ss, runLog);
    throw err;
  }
}

function setupSheet_(sheet) {
  const existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const normalized = {};
  existing.forEach(function(header, index) {
    const key = normalize_(header);
    if (key) normalized[key] = index + 1;
  });

  TRUECOA.HEADERS.forEach(function(header) {
    if (!normalized[normalize_(header)]) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(header);
      normalized[normalize_(header)] = nextCol;
    }
  });

  const headerMap = getHeaderMap_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setFontWeight('bold')
    .setBackground('#355e3b')
    .setFontColor('#ffffff')
    .setWrap(true);
  sheet.setColumnWidth(col_(headerMap, 'description'), 320);
  sheet.setColumnWidth(col_(headerMap, 'image_url'), 260);
  sheet.setColumnWidth(col_(headerMap, 'scoredetect_url'), 260);
  sheet.setColumnWidth(col_(headerMap, 'polygon_coa_image_url'), 260);
  sheet.setColumnWidth(col_(headerMap, 'pdf_url'), 260);
  sheet.setColumnWidth(col_(headerMap, 'auth_error'), 360);
  return headerMap;
}

function generatePdfs_(sheet, headerMap, folder) {
  const result = { rowsChecked: 0, pdfsCreated: 0, firstPdfUrl: '', errors: [] };
  const lastRow = sheet.getLastRow();

  for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
    const row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hasRowData = row.some(function(value) { return String(value || '').trim(); });
    if (!hasRowData) continue;
    result.rowsChecked++;

    try {
      authenticateRow_(sheet, rowNum, headerMap, row);
      const updatedRow = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      const data = buildData_(sheet, rowNum, headerMap, updatedRow);
      const html = renderHtml_(data);
      const baseName = safeName_(data.sku || data.code || 'coa_row_' + rowNum);
      const htmlFile = folder.createFile(baseName + '.html', html, MimeType.HTML);
      const pdfFile = folder.createFile(htmlFile.getAs(MimeType.PDF).setName(baseName + '.pdf'));

      set_(sheet, rowNum, headerMap, 'pdf_url', pdfFile.getUrl());
      if (!isScoreDetectUrl_(data.certUrl)) set_(sheet, rowNum, headerMap, 'cert_url', htmlFile.getUrl());
      set_(sheet, rowNum, headerMap, 'status', '[complete]');
      set_(sheet, rowNum, headerMap, 'completion_date', new Date());

      result.pdfsCreated++;
      if (!result.firstPdfUrl) result.firstPdfUrl = pdfFile.getUrl();
      Utilities.sleep(350);
    } catch (err) {
      result.errors.push('Row ' + rowNum + ': ' + err.message);
    }
  }

  return result;
}

function authenticateRow_(sheet, rowNum, headerMap, row) {
  const code = val_(row, headerMap, 'coa_code').trim().toUpperCase();
  const signer = val_(row, headerMap, 'signer').trim();
  const title = val_(row, headerMap, 'title').trim();
  if (/^(TEST|SAMPLE)-/i.test(code) || val_(row, headerMap, 'auth_status').trim() === '[sample]') {
    set_(sheet, rowNum, headerMap, 'auth_status', '[sample]');
    set_(sheet, rowNum, headerMap, 'auth_error', 'Sample/test row: ScoreDetect and Polygon were not created.');
    return null;
  }
  if (!code || !signer || !title) {
    set_(sheet, rowNum, headerMap, 'auth_status', '[skipped]');
    set_(sheet, rowNum, headerMap, 'auth_error', 'Needs COA_Code, Signer, and Title before ScoreDetect/Polygon can be created.');
    return null;
  }

  const alreadyHasScoreDetect = val_(row, headerMap, 'scoredetect_url').trim() || isScoreDetectUrl_(val_(row, headerMap, 'cert_url'));
  const alreadyHasPolygon = val_(row, headerMap, 'nft_tokenid').trim() || val_(row, headerMap, 'blockchain_url').trim();
  const createScoreDetect = TRUECOA.CREATE_SCOREDETECT && !alreadyHasScoreDetect;
  const mintPolygon = TRUECOA.MINT_POLYGON && !alreadyHasPolygon;
  if (!createScoreDetect && !mintPolygon) {
    set_(sheet, rowNum, headerMap, 'auth_status', '[already authenticated]');
    set_(sheet, rowNum, headerMap, 'auth_error', '');
    return null;
  }

  const payload = {
    coaCode: code,
    signer: signer,
    title: title,
    date: val_(row, headerMap, 'date').trim(),
    medium: val_(row, headerMap, 'medium').trim(),
    edition: val_(row, headerMap, 'edition').trim(),
    size: val_(row, headerMap, 'size').trim(),
    condition: val_(row, headerMap, 'condition').trim(),
    description: val_(row, headerMap, 'description').trim(),
    provenance: val_(row, headerMap, 'provenance').trim(),
    assignor: val_(row, headerMap, 'assignor').trim(),
    authNotes: val_(row, headerMap, 'third_party_authentication_notes').trim(),
    sku: val_(row, headerMap, 'sku').trim(),
    imageUrl: val_(row, headerMap, 'image_url').trim(),
    createScoreDetect: createScoreDetect,
    mintPolygon: mintPolygon
  };

  try {
    set_(sheet, rowNum, headerMap, 'auth_status', '[creating]');
    set_(sheet, rowNum, headerMap, 'auth_error', '');
    const response = UrlFetchApp.fetch(TRUECOA.AUTH_API_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    const text = response.getContentText();
    const body = text ? JSON.parse(text) : {};
    if (status >= 400 || body.error) {
      throw new Error((body.error || 'Backend error') + (body.message ? ': ' + body.message : ''));
    }

    if (body.scoreDetect) {
      if (body.scoreDetect.certId) set_(sheet, rowNum, headerMap, 'scoredetect_cert_id', body.scoreDetect.certId);
      if (body.scoreDetect.verificationUrl) {
        set_(sheet, rowNum, headerMap, 'scoredetect_url', body.scoreDetect.verificationUrl);
        set_(sheet, rowNum, headerMap, 'cert_url', body.scoreDetect.verificationUrl);
      }
      if (body.scoreDetect.transactionUrl) set_(sheet, rowNum, headerMap, 'scoredetect_transaction_url', body.scoreDetect.transactionUrl);
    }

    if (body.polygon) {
      if (body.polygon.tokenId) set_(sheet, rowNum, headerMap, 'nft_tokenid', body.polygon.tokenId);
      if (body.polygon.blockchainUrl) set_(sheet, rowNum, headerMap, 'blockchain_url', body.polygon.blockchainUrl);
      if (body.polygon.nftUrl) set_(sheet, rowNum, headerMap, 'nft_url', body.polygon.nftUrl);
    }

    if (body.metadataUri) set_(sheet, rowNum, headerMap, 'polygon_metadata_url', body.metadataUri);
    set_(sheet, rowNum, headerMap, 'polygon_coa_image_url', TRUECOA.API_BASE_URL + '/api/coa-image/' + encodeURIComponent(code) + '.svg');
    set_(sheet, rowNum, headerMap, 'auth_status', body.operationErrors && body.operationErrors.length ? '[created with warnings]' : '[created]');
    set_(sheet, rowNum, headerMap, 'auth_error', body.operationErrors && body.operationErrors.length ? JSON.stringify(body.operationErrors) : '');
    removeDuplicateAppendedRows_(sheet, headerMap, code, rowNum);
    return body;
  } catch (err) {
    set_(sheet, rowNum, headerMap, 'auth_status', '[failed]');
    set_(sheet, rowNum, headerMap, 'auth_error', err.message);
    throw new Error('ScoreDetect/Polygon backend call failed: ' + err.message);
  }
}

function removeDuplicateAppendedRows_(sheet, headerMap, code, keepRowNum) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return 0;

  let removed = 0;
  for (let rowNum = sheet.getLastRow(); rowNum >= 2; rowNum--) {
    if (rowNum === keepRowNum) continue;
    const row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowCode = val_(row, headerMap, 'coa_code').trim().toUpperCase();
    if (rowCode === normalizedCode) {
      sheet.deleteRow(rowNum);
      removed++;
    }
  }
  return removed;
}

function buildData_(sheet, rowNum, headerMap, row) {
  let code = val_(row, headerMap, 'coa_code').trim().toUpperCase();
  if (!code) {
    code = 'COA-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + rowNum;
    set_(sheet, rowNum, headerMap, 'coa_code', code);
  }

  const tokenId = val_(row, headerMap, 'nft_tokenid').trim();
  const verifyUrl = TRUECOA.VERIFY_BASE_URL.replace(/\/$/, '') + '/' + encodeURIComponent(code);
  const shortUrl = val_(row, headerMap, 'short_url').trim() || verifyUrl;
  const certUrl = val_(row, headerMap, 'cert_url').trim();
  const scoreDetectUrl = val_(row, headerMap, 'scoredetect_url').trim() || (isScoreDetectUrl_(certUrl) ? certUrl : '');
  const scoreDetectCode = val_(row, headerMap, 'scoredetect_cert_id').trim() || extractScoreDetectCode_(scoreDetectUrl);
  const polygonMetadataUrl = val_(row, headerMap, 'polygon_metadata_url').trim() || TRUECOA.API_BASE_URL + '/api/nft/' + encodeURIComponent(code);
  const polygonCoaImageUrl = val_(row, headerMap, 'polygon_coa_image_url').trim() || TRUECOA.API_BASE_URL + '/api/coa-image/' + encodeURIComponent(code) + '.svg';
  const blockchainUrl = val_(row, headerMap, 'blockchain_url').trim() || (tokenId ? 'https://polygonscan.com/token/' + TRUECOA.CONTRACT_ADDRESS + '?a=' + encodeURIComponent(tokenId) : '');
  const nftUrl = val_(row, headerMap, 'nft_url').trim() || (tokenId ? 'https://opensea.io/assets/matic/' + TRUECOA.CONTRACT_ADDRESS + '/' + encodeURIComponent(tokenId) : '');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=' + TRUECOA.QR_SIZE + 'x' + TRUECOA.QR_SIZE + '&data=' + encodeURIComponent(shortUrl);
  const qrImage = buildQrImage_(qrUrl);

  set_(sheet, rowNum, headerMap, 'short_url', shortUrl);
  set_(sheet, rowNum, headerMap, 'qr_code', qrUrl);
  if (scoreDetectUrl) set_(sheet, rowNum, headerMap, 'scoredetect_url', scoreDetectUrl);
  if (scoreDetectCode) set_(sheet, rowNum, headerMap, 'scoredetect_cert_id', scoreDetectCode);
  if (polygonMetadataUrl) set_(sheet, rowNum, headerMap, 'polygon_metadata_url', polygonMetadataUrl);
  if (polygonCoaImageUrl) set_(sheet, rowNum, headerMap, 'polygon_coa_image_url', polygonCoaImageUrl);
  if (blockchainUrl) set_(sheet, rowNum, headerMap, 'blockchain_url', blockchainUrl);
  if (nftUrl) set_(sheet, rowNum, headerMap, 'nft_url', nftUrl);

  return {
    code: code,
    sku: val_(row, headerMap, 'sku').trim(),
    artist: val_(row, headerMap, 'signer').trim() || 'Unknown Artist',
    title: val_(row, headerMap, 'title').trim() || 'Untitled',
    date: val_(row, headerMap, 'date').trim(),
    medium: val_(row, headerMap, 'medium').trim(),
    edition: val_(row, headerMap, 'edition').trim(),
    size: val_(row, headerMap, 'size').trim(),
    condition: val_(row, headerMap, 'condition').trim(),
    description: val_(row, headerMap, 'description').trim(),
    provenance: val_(row, headerMap, 'provenance').trim(),
    authNotes: val_(row, headerMap, 'third_party_authentication_notes').trim(),
    imageUrl: val_(row, headerMap, 'image_url').trim(),
    qrUrl: qrUrl,
    qrImage: qrImage,
    shortUrl: shortUrl,
    certUrl: certUrl,
    tokenId: tokenId,
    scoreDetectCode: scoreDetectCode,
    scoreDetectUrl: scoreDetectUrl,
    scoreDetectTxUrl: val_(row, headerMap, 'scoredetect_transaction_url').trim(),
    blockchainUrl: blockchainUrl,
    polygonMetadataUrl: polygonMetadataUrl,
    polygonCoaImageUrl: polygonCoaImageUrl,
    nftUrl: nftUrl
  };
}

function renderHtml_(d) {
  const imageHtml = d.imageUrl
    ? '<img src="' + esc_(d.imageUrl) + '" alt="' + esc_(d.title) + '">'
    : '<div class="art-placeholder">Artwork image</div>';

  const generatedDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const polygonPageValue = d.polygonCoaImageUrl || d.polygonMetadataUrl || d.nftUrl || d.blockchainUrl;
  const blockchainValue = polygonPageValue || d.scoreDetectUrl || d.shortUrl;
  const certificateValue = d.scoreDetectCode || d.code;
  const detail = function(label, value) {
    if (!value) return '';
    return '<div class="detail"><span class="label">' + esc_(label) + '</span><span class="value">' + esc_(value) + '</span></div>';
  };
  const linkDetail = function(label, value) {
    if (!value) return '';
    return '<div class="detail"><span class="label">' + esc_(label) + '</span><span class="value"><a href="' + esc_(value) + '">' + esc_(value) + '</a></span></div>';
  };

  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>COA ' + esc_(d.code) + '</title>',
    '<style>',
    '@page{size:A4 landscape;margin:0}',
    '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:"Helvetica Neue",Arial,sans-serif;color:#1d1d1f}',
    '.page{width:297mm;height:210mm;overflow:hidden;position:relative;--copy-size:11px;--title-drop:12.7mm;--body-drop:24.1mm;--left-gutter:14mm;--right-gutter:14mm;--column-gap:14mm;--art-width:132mm;--title-size:35px;--title-tracking:.14em;background:#f8f7f2}',
    '.page:before{content:"";position:absolute;inset:7mm;border:2px solid rgba(53,94,59,.28);box-shadow:0 0 14px rgba(0,0,0,.22);pointer-events:none}',
    '.page:after{content:"";position:absolute;inset:0;background:rgba(255,255,255,.76);pointer-events:none;z-index:1}',
    '.title-bar{position:absolute;top:var(--title-drop);left:var(--left-gutter);right:var(--right-gutter);z-index:2;height:20mm;padding:4mm 0 1.5mm;display:grid;grid-template-columns:22mm minmax(0,1fr) 22mm;column-gap:4mm;align-items:center}',
    '.title-bar h1{grid-column:2;margin:0;text-align:center;font-family:Georgia,"Times New Roman",serif;font-size:var(--title-size);letter-spacing:var(--title-tracking);text-transform:uppercase;color:rgb(71,98,75);font-weight:800;white-space:nowrap}',
    '.qr-block{grid-column:3;justify-self:end;text-align:center}.qr-block img{display:block;width:56px;height:56px;margin-bottom:3px}.qr-block span{display:block;width:100%;text-align:center;font-size:14px;font-weight:800;color:#c9a227;letter-spacing:.08em;line-height:calc(1em + 2px)}',
    '.main{position:absolute;top:33mm;left:var(--left-gutter);right:var(--right-gutter);bottom:3mm;z-index:2;display:flex;flex-direction:column}',
    '.body{flex:1;display:grid;grid-template-columns:var(--art-width) 1fr;column-gap:var(--column-gap);min-height:0;margin-top:var(--body-drop);background:rgba(255,255,255,.92);border-radius:4mm;padding:2mm}',
    '.left{display:flex;align-items:flex-start;justify-content:flex-start;padding-top:2px}.left img{width:var(--art-width);height:auto;max-height:104mm;object-fit:contain;object-position:center;border:none;box-shadow:none;background:transparent}.art-placeholder{width:var(--art-width);height:104mm;display:flex;align-items:center;justify-content:center;color:#888;border:1px solid #ddd;background:#f7f7f7}',
    '.right{display:flex;flex-direction:column;min-height:0}.section{margin-bottom:5px}.section + .section{padding-top:calc(4mm + 10px + 2pt)}.section h2{margin:0 0 2px;padding-bottom:1px;border-bottom:1px solid rgba(0,0,0,.08);font-size:13px;line-height:calc(1em + 2px);letter-spacing:.1em;text-transform:uppercase;color:#355e3b}',
    '.detail{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:calc(1px + 1pt) 0;padding-left:12px;font-size:var(--copy-size);line-height:calc(1em + 2px)}.detail .label{min-width:78px;font-size:var(--copy-size);letter-spacing:.03em;color:#c9a227;font-weight:700}.detail .value{flex:1;text-align:left;font-weight:500;color:#173c6b;word-break:break-word}',
    '.copy{margin:0;padding-left:12px;font-size:var(--copy-size);line-height:calc(1em + 4px);color:#173c6b;word-break:break-word}',
    '.footer{flex-shrink:0;display:grid;grid-template-columns:var(--art-width) 1fr;gap:var(--column-gap);align-items:center;border-top:1px solid rgba(0,0,0,.08);padding-top:2.5mm}.partners{display:flex;align-items:center;gap:7mm;width:100%;white-space:nowrap}.partners .powered{font-size:var(--copy-size);color:#355e3b;line-height:calc(1em + 2px);font-weight:700}.partner-text{font-size:14px;font-weight:800;color:#173c6b}.partner-text.score{color:#222}.partner-text.poly{color:#5135d8}.footer-note{font-size:var(--copy-size);line-height:calc(1em + 2px);text-align:right;color:#355e3b;font-weight:700;white-space:nowrap}a{color:#173c6b;text-decoration:none}',
    '</style></head><body><div class="page">',
    '<div class="title-bar"><h1>Certificate of Authenticity</h1><div class="qr-block"><img src="' + esc_(d.qrImage || d.qrUrl) + '" alt="QR code"><span>#' + esc_(d.code) + '</span></div></div>',
    '<div class="main"><div class="body"><div class="left">' + imageHtml + '</div><div class="right">',
    '<div class="section"><h2>DETAILS:</h2>',
    detail('Artist', d.artist),
    detail('Title', d.title),
    detail('Date', d.date),
    detail('Medium', d.medium),
    detail('Dimensions', d.size),
    detail('Edition', d.edition),
    detail('Condition', d.condition),
    '</div>',
    d.description ? '<div class="section"><h2>DESCRIPTION:</h2><p class="copy">' + esc_(d.description) + '</p></div>' : '',
    d.provenance ? '<div class="section"><h2>PROVENANCE:</h2><p class="copy">' + esc_(d.provenance) + '</p></div>' : '',
    '<div class="section"><h2>DIGITAL AUTHENTICATION:</h2>',
    detail('Date', generatedDate),
    linkDetail('Blockchain', blockchainValue),
    detail('Certificate', certificateValue),
    detail('Signer', 'Gauntlet Gallery'),
    '</div>',
    '</div></div><div class="footer"><div class="partners"><span class="powered">Powered by:</span><span class="partner-text">TrueCOA</span><span class="partner-text score">ScoreDetect</span><span class="partner-text poly">polygon</span></div><div class="footer-note">Secured by Polygon blockchain.<br>Transparent authenticity.</div></div></div>',
    '</div></body></html>'
  ].join('');
}

function createSampleRow_(sheet, headerMap) {
  const rowNum = Math.max(2, sheet.getLastRow() + 1);
  const code = 'TEST-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  set_(sheet, rowNum, headerMap, 'coa_code', code);
  set_(sheet, rowNum, headerMap, 'signer', 'Sample Artist');
  set_(sheet, rowNum, headerMap, 'title', 'Sample Artwork');
  set_(sheet, rowNum, headerMap, 'date', String(new Date().getFullYear()));
  set_(sheet, rowNum, headerMap, 'medium', 'Screenprint');
  set_(sheet, rowNum, headerMap, 'edition', 'AP');
  set_(sheet, rowNum, headerMap, 'size', '24 x 18 in');
  set_(sheet, rowNum, headerMap, 'condition', 'Excellent');
  set_(sheet, rowNum, headerMap, 'description', 'Sample COA row created to verify PDF generation works.');
  set_(sheet, rowNum, headerMap, 'provenance', 'Gauntlet Gallery');
  set_(sheet, rowNum, headerMap, 'sku', code);
  set_(sheet, rowNum, headerMap, 'auth_status', '[sample]');
}

function hasAnyCoaRows_(sheet, headerMap) {
  for (let rowNum = 2; rowNum <= sheet.getLastRow(); rowNum++) {
    const row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (val_(row, headerMap, 'coa_code').trim()) return true;
  }
  return false;
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(header, index) {
    const key = normalize_(header);
    if (key) map[key] = index;
  });
  return map;
}

function getFolder_() {
  const folders = DriveApp.getFoldersByName(TRUECOA.FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(TRUECOA.FOLDER_NAME);
}

function buildQrImage_(qrUrl) {
  try {
    const response = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (response.getResponseCode && response.getResponseCode() >= 400) return qrUrl;
    const blob = response.getBlob();
    const bytes = blob.getBytes();
    const contentType = blob.getContentType() || 'image/png';
    return 'data:' + contentType + ';base64,' + Utilities.base64Encode(bytes);
  } catch (err) {
    return qrUrl;
  }
}

function writeRunLog_(ss, rows) {
  const sheet = ss.getSheetByName(TRUECOA.LOG_SHEET_NAME) || ss.insertSheet(TRUECOA.LOG_SHEET_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, 2).setValues([['TrueCOA RUN_NOW Log', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy')]]);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#355e3b').setFontColor('#ffffff');
  if (rows.length) {
    sheet.getRange(3, 1, rows.length, 2).setValues(rows);
  }
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 760);
  sheet.setFrozenRows(1);
}

function val_(row, headerMap, key) {
  const index = headerMap[key];
  return index === undefined ? '' : String(row[index] || '');
}

function set_(sheet, rowNum, headerMap, key, value) {
  const index = headerMap[key];
  if (index !== undefined) sheet.getRange(rowNum, index + 1).setValue(value);
}

function col_(headerMap, key) {
  return headerMap[key] === undefined ? 1 : headerMap[key] + 1;
}

function normalize_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function safeName_(value) {
  return String(value || 'coa').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'coa';
}

function isScoreDetectUrl_(value) {
  return /^https?:\/\/([^\/]+\.)?scoredetect\.com\//i.test(String(value || '').trim());
}

function extractScoreDetectCode_(value) {
  const cleaned = String(value || '').trim().replace(/[?#].*$/, '');
  const match = cleaned.match(/\/([A-Za-z0-9_-]{8,})\/?$/);
  return match ? match[1] : '';
}

function esc_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
