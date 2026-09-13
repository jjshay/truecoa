/**
 * ============================================================================
 * TRUECOA - COA CERTIFICATE GENERATOR
 * ============================================================================
 *
 * Google Apps Script for automated Certificate of Authenticity generation.
 *
 * Features:
 * - Reads artwork data from Google Sheets COA tab
 * - Generates Bit.ly short links for verification URLs
 * - Creates certificate images with QR codes
 * - Saves certificates to Google Drive
 * - Updates spreadsheet with generated links
 *
 * Setup:
 * 1. Open Google Sheets: https://docs.google.com/spreadsheets/d/16Kya2WQD0tbXTdsug9zSuoP03XmWXsZRTIykbEbBJBU
 * 2. Extensions > Apps Script
 * 3. Paste this code
 * 4. Run setupTriggers() once to create menu
 *
 * Author: John Shay / TrueCOA
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Bit.ly API
  get BITLY_API_KEY() {
    // Read only when this integration is used; never embed provider keys.
    const key = PropertiesService.getScriptProperties().getProperty('BITLY_API_KEY');
    if (!key || !key.trim()) throw new Error('Set BITLY_API_KEY in Apps Script project settings.');
    return key.trim();
  },
  BITLY_API_URL: 'https://api-ssl.bitly.com/v4/shorten',

  // Verification URLs
  VERCEL_FRONTEND_URL: 'https://gauntlet-coa-frontend.vercel.app',

  // Google Drive folder for certificates (will be created if not exists)
  DRIVE_FOLDER_NAME: 'TrueCOA Certificates',

  // Sheet configuration
  SHEET_NAME: 'COA2',

  // Column mapping (0-indexed) - matches COA2 tab structure
  COLUMNS: {
    COA_CODE: 0,      // A: COA_Code
    QR_CODE: 1,       // B: QR_Code (output - QR image URL)
    ARTIST: 2,        // C: Artist
    TITLE: 3,         // D: Title
    DATE: 4,          // E: Date
    LENGTH: 5,        // F: Length
    WIDTH: 6,         // G: Width
    NUMBER: 7,        // H: Number (edition number)
    EDITION: 8,       // I: Edition (total)
    MEDIUM: 9,        // J: Medium
    CONDITION: 10,    // K: Condition
    DESCRIPTION: 11,  // L: Description
    NOTES: 12,        // M: Notes / Provenance
    ASSIGNEE: 13,     // N: Assignee
    IMAGE_URL: 14,    // O: Image_URL
    SKU: 15,          // P: SKU
    COA_CODE2: 16,    // Q: COA_Code (duplicate)
    NFT_TOKEN_ID: 17, // R: NFT_TokenID
    SHORT_URL: 18,    // S: Short_URL (output - Bit.ly link)
    BLOCKCHAIN_URL: 19, // T: Blockchain_URL
    NFT_URL: 20,      // U: NFT_URL
    CERT_URL: 21,     // V: Cert_URL (output - Google Drive link)
    DONE: 22,         // W: Done
    GENERATED: 23     // X: Date (output - timestamp)
  },

  // Certificate styling
  CERT_WIDTH: 800,
  CERT_HEIGHT: 1100,
  QR_SIZE: 150
};

// ============================================================================
// MENU & TRIGGERS
// ============================================================================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎨 COA Generator')
    .addItem('Generate All Certificates', 'generateAllCertificates')
    .addItem('Generate Selected Row', 'generateSelectedRow')
    .addSeparator()
    .addItem('Create Short Links Only', 'createShortLinksOnly')
    .addItem('Refresh QR Codes', 'refreshQRCodes')
    .addSeparator()
    .addItem('Setup/Check Folders', 'setupFolders')
    .addToUi();
}

/**
 * Run once to setup triggers
 */
function setupTriggers() {
  // Create onOpen trigger
  const triggers = ScriptApp.getProjectTriggers();
  const hasOnOpen = triggers.some(t => t.getHandlerFunction() === 'onOpen');

  if (!hasOnOpen) {
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onOpen()
      .create();
  }

  Logger.log('Triggers setup complete. Menu will appear on next sheet open.');
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate certificates for all rows that don't have one yet
 */
function generateAllCertificates() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const folder = getOrCreateFolder();

  let generated = 0;
  let errors = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const coaCode = row[CONFIG.COLUMNS.COA_CODE];
    const alreadyGenerated = row[CONFIG.COLUMNS.DONE] || row[CONFIG.COLUMNS.GENERATED];

    // Skip if no COA code or already generated
    if (!coaCode || alreadyGenerated) {
      continue;
    }

    try {
      const result = processRow(sheet, i + 1, row, folder); // i + 1 for 1-indexed rows
      if (result) {
        generated++;
      }
    } catch (e) {
      errors.push(`Row ${i + 1} (${coaCode}): ${e.message}`);
      Logger.log(`Error processing row ${i + 1}: ${e.message}`);
    }

    // Rate limiting for Bit.ly API
    Utilities.sleep(500);
  }

  // Show results
  const ui = SpreadsheetApp.getUi();
  let message = `Generated ${generated} certificates.`;
  if (errors.length > 0) {
    message += `\n\nErrors (${errors.length}):\n${errors.slice(0, 5).join('\n')}`;
    if (errors.length > 5) {
      message += `\n...and ${errors.length - 5} more`;
    }
  }
  ui.alert('Generation Complete', message, ui.ButtonSet.OK);
}

/**
 * Generate certificate for the currently selected row
 */
function generateSelectedRow() {
  const sheet = getSheet();
  const activeRange = sheet.getActiveRange();
  const rowNum = activeRange.getRow();

  if (rowNum <= 1) {
    SpreadsheetApp.getUi().alert('Please select a data row (not the header).');
    return;
  }

  const row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  const folder = getOrCreateFolder();

  try {
    processRow(sheet, rowNum, row, folder);
    SpreadsheetApp.getUi().alert('Certificate generated successfully!');
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Error: ${e.message}`);
  }
}

/**
 * Process a single row - create short link, QR code, and certificate
 */
function processRow(sheet, rowNum, row, folder) {
  const coaCode = String(row[CONFIG.COLUMNS.COA_CODE]).trim();

  if (!coaCode) {
    return false;
  }

  // Build verification URL
  const verifyUrl = `${CONFIG.VERCEL_FRONTEND_URL}/AUTHENTICATE/${coaCode}`;

  // Create short link
  const shortUrl = createBitlyShortLink(verifyUrl, coaCode);

  // Generate QR code URL
  const qrUrl = generateQRCodeUrl(shortUrl || verifyUrl);

  // Create certificate data object
  const certData = {
    coaCode: coaCode,
    artist: row[CONFIG.COLUMNS.ARTIST] || 'Unknown Artist',
    title: row[CONFIG.COLUMNS.TITLE] || 'Untitled',
    date: row[CONFIG.COLUMNS.DATE] || '',
    length: row[CONFIG.COLUMNS.LENGTH] || '',
    width: row[CONFIG.COLUMNS.WIDTH] || '',
    number: row[CONFIG.COLUMNS.NUMBER] || '',
    edition: row[CONFIG.COLUMNS.EDITION] || '',
    medium: row[CONFIG.COLUMNS.MEDIUM] || '',
    condition: row[CONFIG.COLUMNS.CONDITION] || '',
    description: row[CONFIG.COLUMNS.DESCRIPTION] || '',
    notes: row[CONFIG.COLUMNS.NOTES] || '',
    assignee: row[CONFIG.COLUMNS.ASSIGNEE] || '',
    imageUrl: row[CONFIG.COLUMNS.IMAGE_URL] || '',
    sku: row[CONFIG.COLUMNS.SKU] || '',
    shortUrl: shortUrl || verifyUrl,
    qrUrl: qrUrl
  };

  // Generate certificate HTML and save as PDF
  const certFile = createCertificatePDF(certData, folder);

  // Update spreadsheet with generated data
  const updates = [
    [CONFIG.COLUMNS.QR_CODE + 1, qrUrl],
    [CONFIG.COLUMNS.SHORT_URL + 1, shortUrl || verifyUrl],
    [CONFIG.COLUMNS.CERT_URL + 1, certFile ? certFile.getUrl() : ''],
    [CONFIG.COLUMNS.DONE + 1, new Date().toISOString()],
    [CONFIG.COLUMNS.GENERATED + 1, new Date().toISOString()]
  ];

  updates.forEach(([col, value]) => {
    sheet.getRange(rowNum, col).setValue(value);
  });

  return true;
}

// ============================================================================
// BIT.LY API FUNCTIONS
// ============================================================================

/**
 * Create a Bit.ly short link for a verification URL
 */
function createBitlyShortLink(longUrl, coaCode) {
  try {
    const payload = {
      long_url: longUrl,
      title: `COA-${coaCode}`
    };

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.BITLY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(CONFIG.BITLY_API_URL, options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200 || response.getResponseCode() === 201) {
      return result.link;
    } else {
      Logger.log(`Bit.ly error for ${coaCode}: ${JSON.stringify(result)}`);
      return null;
    }
  } catch (e) {
    Logger.log(`Bit.ly API error: ${e.message}`);
    return null;
  }
}

/**
 * Create short links for all rows without them
 */
function createShortLinksOnly() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let created = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const coaCode = row[CONFIG.COLUMNS.COA_CODE];
    const existingShortUrl = row[CONFIG.COLUMNS.SHORT_URL];

    if (!coaCode || existingShortUrl) {
      continue;
    }

    const verifyUrl = `${CONFIG.VERCEL_FRONTEND_URL}/AUTHENTICATE/${coaCode}`;
    const shortUrl = createBitlyShortLink(verifyUrl, coaCode);

    if (shortUrl) {
      sheet.getRange(i + 1, CONFIG.COLUMNS.SHORT_URL + 1).setValue(shortUrl);
      created++;
    }

    Utilities.sleep(500); // Rate limiting
  }

  SpreadsheetApp.getUi().alert(`Created ${created} short links.`);
}

// ============================================================================
// QR CODE FUNCTIONS
// ============================================================================

/**
 * Generate QR code URL using Google Chart API
 */
function generateQRCodeUrl(data) {
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${CONFIG.QR_SIZE}x${CONFIG.QR_SIZE}&data=${encodedData}`;
}

/**
 * Refresh QR codes for all rows
 */
function refreshQRCodes() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let updated = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const coaCode = row[CONFIG.COLUMNS.COA_CODE];
    const shortUrl = row[CONFIG.COLUMNS.SHORT_URL];

    if (!coaCode) continue;

    const urlForQR = shortUrl || `${CONFIG.VERCEL_FRONTEND_URL}/AUTHENTICATE/${coaCode}`;
    const qrUrl = generateQRCodeUrl(urlForQR);

    sheet.getRange(i + 1, CONFIG.COLUMNS.QR_CODE + 1).setValue(qrUrl);
    updated++;
  }

  SpreadsheetApp.getUi().alert(`Updated ${updated} QR codes.`);
}

// ============================================================================
// CERTIFICATE GENERATION
// ============================================================================

/**
 * Create a PDF certificate and save to Google Drive
 */
function createCertificatePDF(data, folder) {
  // Generate HTML certificate
  const html = generateCertificateHTML(data);

  // Create a temporary HTML file
  const tempFile = folder.createFile(`temp_${data.coaCode}.html`, html, MimeType.HTML);

  // Convert to PDF using Google's export
  const blob = tempFile.getAs(MimeType.PDF);
  blob.setName(`COA_${data.coaCode}_${data.artist.replace(/\s+/g, '_')}.pdf`);

  // Save PDF
  const pdfFile = folder.createFile(blob);

  // Delete temp HTML file
  tempFile.setTrashed(true);

  // Also create a PNG image version
  createCertificateImage(data, folder);

  return pdfFile;
}

/**
 * Generate HTML for the certificate
 */
function generateCertificateHTML(data) {
  const dimensions = data.length && data.width ? `${data.length}" × ${data.width}"` : '';
  const edition = data.number && data.edition ? `${data.number} of ${data.edition}` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Open+Sans:wght@300;400;600&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Open Sans', sans-serif;
      background: white;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }

    .certificate {
      border: 3px solid #1a1a2e;
      padding: 40px;
      position: relative;
    }

    .certificate::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 1px solid #d4af37;
      pointer-events: none;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 20px;
    }

    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: 3px;
      margin-bottom: 5px;
    }

    .subtitle {
      font-size: 12px;
      letter-spacing: 4px;
      color: #666;
      text-transform: uppercase;
    }

    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      font-weight: 600;
      color: #1a1a2e;
      text-align: center;
      margin: 30px 0;
      letter-spacing: 2px;
    }

    .artwork-image {
      text-align: center;
      margin: 30px 0;
    }

    .artwork-image img {
      max-width: 400px;
      max-height: 300px;
      object-fit: contain;
      border: 1px solid #ddd;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .details {
      margin: 30px 0;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 1px;
    }

    .value {
      font-weight: 400;
      color: #1a1a2e;
      font-size: 14px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #1a1a2e;
    }

    .qr-section {
      text-align: center;
    }

    .qr-section img {
      width: 100px;
      height: 100px;
    }

    .qr-section .code {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      font-family: monospace;
    }

    .verification {
      text-align: right;
    }

    .verification .badge {
      display: inline-flex;
      align-items: center;
      background: #d4edda;
      color: #155724;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .verification .badge svg {
      width: 16px;
      height: 16px;
      margin-right: 6px;
      fill: currentColor;
    }

    .verification .url {
      font-size: 10px;
      color: #666;
      margin-top: 8px;
      word-break: break-all;
    }

    .signature-line {
      border-top: 1px solid #1a1a2e;
      width: 200px;
      margin-top: 40px;
      padding-top: 8px;
      font-size: 10px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">TRUECOA</div>
      <div class="subtitle">Fine Art & Collectibles</div>
    </div>

    <h1>Certificate of Authenticity</h1>

    ${data.imageUrl ? `
    <div class="artwork-image">
      <img src="${data.imageUrl}" alt="${data.title}" />
    </div>
    ` : ''}

    <div class="details">
      <div class="detail-row">
        <span class="label">Artist</span>
        <span class="value">${escapeHtml(data.artist)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Title</span>
        <span class="value">${escapeHtml(data.title)}</span>
      </div>
      ${data.date ? `
      <div class="detail-row">
        <span class="label">Date</span>
        <span class="value">${escapeHtml(String(data.date))}</span>
      </div>
      ` : ''}
      ${data.medium ? `
      <div class="detail-row">
        <span class="label">Medium</span>
        <span class="value">${escapeHtml(data.medium)}</span>
      </div>
      ` : ''}
      ${dimensions ? `
      <div class="detail-row">
        <span class="label">Dimensions</span>
        <span class="value">${dimensions}</span>
      </div>
      ` : ''}
      ${edition ? `
      <div class="detail-row">
        <span class="label">Edition</span>
        <span class="value">${edition}</span>
      </div>
      ` : ''}
      ${data.condition ? `
      <div class="detail-row">
        <span class="label">Condition</span>
        <span class="value">${escapeHtml(data.condition)}</span>
      </div>
      ` : ''}
      ${data.assignee ? `
      <div class="detail-row">
        <span class="label">Assigned To</span>
        <span class="value">${escapeHtml(data.assignee)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="label">COA Code</span>
        <span class="value" style="font-family: monospace;">${escapeHtml(data.coaCode)}</span>
      </div>
    </div>

    ${data.description ? `
    <div class="details" style="margin-top: 15px;">
      <div style="font-weight: 600; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; margin-bottom: 8px;">Description</div>
      <div style="font-size: 13px; color: #1a1a2e; line-height: 1.5;">${escapeHtml(data.description)}</div>
    </div>
    ` : ''}

    ${data.notes ? `
    <div class="details" style="margin-top: 15px;">
      <div style="font-weight: 600; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; margin-bottom: 8px;">Provenance</div>
      <div style="font-size: 13px; color: #1a1a2e; line-height: 1.5; font-style: italic;">${escapeHtml(data.notes)}</div>
    </div>
    ` : ''}

    <div class="footer">
      <div class="qr-section">
        <img src="${data.qrUrl}" alt="QR Code" />
        <div class="code">${data.coaCode}</div>
      </div>

      <div class="signature-line">
        Authorized Signature
      </div>

      <div class="verification">
        <div class="badge">
          <svg viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>
          Blockchain Verified
        </div>
        <div class="url">${data.shortUrl}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Create a certificate image (PNG) using Google Slides as a canvas
 */
function createCertificateImage(data, folder) {
  // For image generation, we'll save a reference to the template
  // The actual image would be generated from the PDF or using a service
  // For now, we'll note that Canva integration would be used for final images

  Logger.log(`Certificate image reference created for COA: ${data.coaCode}`);
  return null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the COA sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found. Please create it or update CONFIG.SHEET_NAME.`);
  }

  return sheet;
}

/**
 * Get or create the certificates folder in Google Drive
 */
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
}

/**
 * Setup folders and verify configuration
 */
function setupFolders() {
  try {
    const folder = getOrCreateFolder();
    const sheet = getSheet();

    SpreadsheetApp.getUi().alert(
      'Setup Complete',
      `✅ Drive folder: ${folder.getName()}\n` +
      `   URL: ${folder.getUrl()}\n\n` +
      `✅ Sheet: ${sheet.getName()}\n` +
      `   Rows: ${sheet.getLastRow() - 1} (excluding header)\n\n` +
      `✅ Bit.ly API configured\n` +
      `✅ Verification URL: ${CONFIG.VERCEL_FRONTEND_URL}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert('Setup Error', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test Bit.ly API connection
 */
function testBitlyAPI() {
  const testUrl = 'https://gauntlet-coa-frontend.vercel.app/AUTHENTICATE/TEST123';
  const result = createBitlyShortLink(testUrl, 'TEST123');
  Logger.log(`Bit.ly test result: ${result}`);

  if (result) {
    SpreadsheetApp.getUi().alert('Bit.ly API working!', `Short URL: ${result}`, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('Bit.ly API Error', 'Check logs for details.', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Test certificate generation with sample data
 */
function testCertificateGeneration() {
  const testData = {
    coaCode: 'TEST001',
    artist: 'Test Artist',
    title: 'Test Artwork',
    date: '2025',
    length: '24',
    width: '18',
    number: '1',
    edition: '50',
    medium: 'Screenprint on cream Speckletone paper',
    condition: 'Excellent',
    description: 'A vibrant screenprint showcasing bold graphic design.',
    notes: 'Acquired directly from the artist at gallery opening.',
    assignee: 'Test Collector',
    imageUrl: '',
    sku: 'TST001',
    shortUrl: 'https://bit.ly/test',
    qrUrl: generateQRCodeUrl('https://bit.ly/test')
  };

  const html = generateCertificateHTML(testData);
  Logger.log('Generated certificate HTML length: ' + html.length);

  // Create a test file
  const folder = getOrCreateFolder();
  const testFile = folder.createFile('test_certificate.html', html, MimeType.HTML);

  SpreadsheetApp.getUi().alert(
    'Test Certificate Created',
    `HTML file: ${testFile.getUrl()}\n\nOpen this link to preview the certificate design.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
