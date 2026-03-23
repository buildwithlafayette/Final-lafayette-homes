/**
 * Lafayette Homes — Google Sheets Automation Script
 * ─────────────────────────────────────────────────
 * SETUP:
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script
 * 3. Delete the default code, paste this entire file
 * 4. Save (Ctrl+S) → name it "Lafayette Listings"
 * 5. Run setupSheet() once to create headers + formatting
 * 6. Paste your Zillow URLs in column K — then run syncAllZillow()
 *
 * After setup, a "Lafayette" menu appears in your sheet.
 * ─────────────────────────────────────────────────
 */

// ── Column map (1-indexed) ────────────────────────────────────────
const COL = {
  id:         1,   // A
  address:    2,   // B
  city:       3,   // C
  state:      4,   // D
  zipcode:    5,   // E
  beds:       6,   // F
  baths:      7,   // G
  sqft:       8,   // H
  price:      9,   // I
  status:     10,  // J
  zillowUrl:  11,  // K
  mlsNumber:  12,  // L
  photos:     13,  // M
  lastSync:   14,  // N  ← auto-filled by script
};

const HEADERS = [
  'id','address','city','state','zipcode',
  'beds','baths','sqft','price','status',
  'zillowUrl','mlsNumber','photos','lastSync'
];

const STATUS_COLORS = {
  'for sale':       { bg: '#0b4a2c', fg: '#ffffff' },
  'under contract': { bg: '#8a6000', fg: '#ffffff' },
  'sold':           { bg: '#5a5a5a', fg: '#ffffff' },
};

// ── Menu ─────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Lafayette')
    .addItem('Sync all Zillow prices + status', 'syncAllZillow')
    .addItem('Sync this row only', 'syncCurrentRow')
    .addSeparator()
    .addItem('Setup / reset sheet formatting', 'setupSheet')
    .addItem('Export availableHomes.json', 'exportJSON')
    .addToUi();
}

// ── One-time setup ────────────────────────────────────────────────
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Listings');
  if (!sheet) sheet = ss.insertSheet('Listings');
  sheet.activate();

  // Header row
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0b4a2c');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontSize(11);

  // Freeze header
  sheet.setFrozenRows(1);

  // Column widths
  sheet.setColumnWidth(COL.id, 130);
  sheet.setColumnWidth(COL.address, 260);
  sheet.setColumnWidth(COL.city, 110);
  sheet.setColumnWidth(COL.state, 60);
  sheet.setColumnWidth(COL.zipcode, 80);
  sheet.setColumnWidth(COL.beds, 60);
  sheet.setColumnWidth(COL.baths, 70);
  sheet.setColumnWidth(COL.sqft, 80);
  sheet.setColumnWidth(COL.price, 110);
  sheet.setColumnWidth(COL.status, 130);
  sheet.setColumnWidth(COL.zillowUrl, 300);
  sheet.setColumnWidth(COL.mlsNumber, 110);
  sheet.setColumnWidth(COL.photos, 420);
  sheet.setColumnWidth(COL.lastSync, 160);

  // Status dropdown validation
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['for sale', 'under contract', 'sold'], true)
    .build();
  sheet.getRange(2, COL.status, 500, 1).setDataValidation(statusRule);

  // Number formatting
  sheet.getRange(2, COL.price, 500, 1).setNumberFormat('$#,##0');
  sheet.getRange(2, COL.beds,  500, 1).setNumberFormat('0');
  sheet.getRange(2, COL.baths, 500, 1).setNumberFormat('0.0');
  sheet.getRange(2, COL.sqft,  500, 1).setNumberFormat('#,##0');

  // Alternate row shading
  applyRowShading(sheet);

  SpreadsheetApp.getUi().alert('Sheet setup complete! Add your listings starting in row 2.');
}

function applyRowShading(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 50);
  for (let r = 2; r <= lastRow; r++) {
    const bg = r % 2 === 0 ? '#f8f7f4' : '#ffffff';
    sheet.getRange(r, 1, 1, HEADERS.length).setBackground(bg);
  }
  colorStatusCells(sheet);
}

function colorStatusCells(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const statuses = sheet.getRange(2, COL.status, lastRow - 1, 1).getValues();
  statuses.forEach(([val], i) => {
    const row = i + 2;
    const s = (val || '').toString().toLowerCase().trim();
    const colors = STATUS_COLORS[s];
    const cell = sheet.getRange(row, COL.status);
    if (colors) {
      cell.setBackground(colors.bg).setFontColor(colors.fg).setFontWeight('bold');
    } else {
      cell.setBackground(null).setFontColor(null).setFontWeight('normal');
    }
  });
}

// ── Zillow sync ───────────────────────────────────────────────────
function syncAllZillow() {
  const sheet = getListingsSheet();
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('No listings found.'); return; }

  let updated = 0, skipped = 0, errors = 0;
  const ui = SpreadsheetApp.getUi();

  for (let row = 2; row <= lastRow; row++) {
    const zillowUrl = sheet.getRange(row, COL.zillowUrl).getValue().toString().trim();
    if (!zillowUrl || !zillowUrl.includes('zillow.com')) { skipped++; continue; }

    const status = (sheet.getRange(row, COL.status).getValue() || '').toLowerCase();
    if (status === 'sold') { skipped++; continue; } // don't re-fetch sold homes

    try {
      const data = fetchZillowData(zillowUrl);
      if (data) {
        if (data.price)  sheet.getRange(row, COL.price).setValue(data.price);
        if (data.status) sheet.getRange(row, COL.status).setValue(data.status);
        if (data.beds)   sheet.getRange(row, COL.beds).setValue(data.beds);
        if (data.baths)  sheet.getRange(row, COL.baths).setValue(data.baths);
        if (data.sqft)   sheet.getRange(row, COL.sqft).setValue(data.sqft);
        sheet.getRange(row, COL.lastSync).setValue(new Date());
        updated++;
      } else {
        errors++;
      }
      Utilities.sleep(1500); // be polite, don't hammer Zillow
    } catch(e) {
      Logger.log('Row ' + row + ' error: ' + e.message);
      errors++;
    }
  }

  colorStatusCells(sheet);
  ui.alert(
    'Zillow sync complete\n\n' +
    '✓ Updated: ' + updated + '\n' +
    '– Skipped (no URL or sold): ' + skipped + '\n' +
    '✗ Errors: ' + errors + '\n\n' +
    (errors > 0 ? 'Check View → Logs for details on errors.' : '')
  );
}

function syncCurrentRow() {
  const sheet = getListingsSheet();
  if (!sheet) return;
  const row = sheet.getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('Click a listing row first (not the header).'); return; }

  const zillowUrl = sheet.getRange(row, COL.zillowUrl).getValue().toString().trim();
  if (!zillowUrl) { SpreadsheetApp.getUi().alert('No Zillow URL in this row.'); return; }

  try {
    const data = fetchZillowData(zillowUrl);
    if (data) {
      if (data.price)  sheet.getRange(row, COL.price).setValue(data.price);
      if (data.status) sheet.getRange(row, COL.status).setValue(data.status);
      if (data.beds)   sheet.getRange(row, COL.beds).setValue(data.beds);
      if (data.baths)  sheet.getRange(row, COL.baths).setValue(data.baths);
      if (data.sqft)   sheet.getRange(row, COL.sqft).setValue(data.sqft);
      sheet.getRange(row, COL.lastSync).setValue(new Date());
      colorStatusCells(sheet);
      SpreadsheetApp.getUi().alert('Row updated:\n\nPrice: $' + (data.price||'N/A') + '\nStatus: ' + (data.status||'N/A'));
    } else {
      SpreadsheetApp.getUi().alert('Could not pull data from Zillow. The listing may be off-market or Zillow blocked the request.\n\nUpdate manually.');
    }
  } catch(e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

// ── Zillow data fetcher ───────────────────────────────────────────
// Reads the public Zillow listing page and extracts embedded JSON data.
// No API key needed. Works on public listings.
// If Zillow changes their page structure this may need updating.

function fetchZillowData(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('Zillow returned ' + response.getResponseCode() + ' for ' + url);
      return null;
    }

    const html = response.getContentText();

    // Strategy 1: Extract from __NEXT_DATA__ (most reliable)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const props = nextData?.props?.pageProps;

        // Try homeDetails path
        const home = props?.homeDetails || props?.listing || props?.initialReduxState?.gdp?.building;
        if (home) {
          return extractFromHomeObject(home);
        }

        // Try searching deeper
        const gdp = props?.initialReduxState?.gdp;
        if (gdp) {
          return extractFromGDP(gdp);
        }
      } catch(e) {
        Logger.log('__NEXT_DATA__ parse error: ' + e.message);
      }
    }

    // Strategy 2: Extract from JSON-LD structured data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (const match of jsonLdMatches) {
      try {
        const content = match.replace(/<script[^>]*>/, '').replace('</script>', '');
        const ld = JSON.parse(content);
        const result = extractFromJSONLD(ld);
        if (result && result.price) return result;
      } catch(e) {}
    }

    // Strategy 3: Regex patterns as last resort
    return extractViaRegex(html);

  } catch(e) {
    Logger.log('fetchZillowData error for ' + url + ': ' + e.message);
    return null;
  }
}

function extractFromHomeObject(home) {
  const price = home.price || home.listingPrice?.price || home.zestimate?.amount;
  const statusRaw = home.homeStatus || home.listing_sub_type || home.homeStatusForHDP || '';
  return {
    price: price ? parseFloat(String(price).replace(/[^0-9.]/g,'')) : null,
    status: normalizeStatus(statusRaw),
    beds:   home.bedrooms || home.beds || null,
    baths:  home.bathrooms || home.baths || null,
    sqft:   home.livingArea || home.livingAreaValue || home.sqft || null,
  };
}

function extractFromGDP(gdp) {
  const building = gdp?.building || {};
  return {
    price:  gdp.price || building.price || null,
    status: normalizeStatus(gdp.homeStatus || building.homeStatus || ''),
    beds:   building.bedrooms || gdp.bedrooms || null,
    baths:  building.bathrooms || gdp.bathrooms || null,
    sqft:   building.livingArea || gdp.livingArea || null,
  };
}

function extractFromJSONLD(ld) {
  if (!ld || typeof ld !== 'object') return null;
  const offers = ld.offers || (Array.isArray(ld) && ld.find(i => i.offers)?.offers);
  const price = offers?.price || offers?.lowPrice;
  if (!price) return null;
  return {
    price: parseFloat(String(price).replace(/[^0-9.]/g,'')),
    status: normalizeStatus(ld.availability || offers?.availability || ''),
    beds: null, baths: null, sqft: null,
  };
}

function extractViaRegex(html) {
  const priceMatch = html.match(/"price"\s*:\s*(\d{5,8})/);
  const statusMatch = html.match(/"homeStatus"\s*:\s*"([^"]+)"/);
  const bedsMatch   = html.match(/"bedrooms"\s*:\s*(\d+)/);
  const bathsMatch  = html.match(/"bathrooms"\s*:\s*([\d.]+)/);
  const sqftMatch   = html.match(/"livingArea"\s*:\s*(\d+)/);

  if (!priceMatch && !statusMatch) return null;

  return {
    price:  priceMatch  ? parseFloat(priceMatch[1])  : null,
    status: statusMatch ? normalizeStatus(statusMatch[1]) : null,
    beds:   bedsMatch   ? parseInt(bedsMatch[1])      : null,
    baths:  bathsMatch  ? parseFloat(bathsMatch[1])   : null,
    sqft:   sqftMatch   ? parseInt(sqftMatch[1])       : null,
  };
}

function normalizeStatus(raw) {
  const s = (raw || '').toLowerCase().replace(/_/g,' ').trim();
  if (s.includes('contract') || s.includes('pending') || s.includes('contingent')) return 'under contract';
  if (s.includes('sold') || s.includes('off market') || s.includes('recently sold')) return 'sold';
  if (s.includes('for sale') || s.includes('active') || s === 'active') return 'for sale';
  return null; // can't determine, don't overwrite
}

// ── Timed auto-sync (optional) ────────────────────────────────────
// Run createDailyTrigger() ONCE from the Lafayette menu to schedule
// automatic Zillow sync every morning at 7am.

function createDailyTrigger() {
  // Remove existing triggers first
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAllZillow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAllZillow')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  SpreadsheetApp.getUi().alert('Daily sync scheduled for 7:00 AM. Zillow data will update automatically every morning.');
}

function removeDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAllZillow') ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getUi().alert('Automatic sync removed.');
}

// ── Export availableHomes.json ────────────────────────────────────
// Generates the JSON file for the website. Copy output to availableHomes.json in GitHub.

function exportJSON() {
  const sheet = getListingsSheet();
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('No data to export.'); return; }

  const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const homes = [];

  data.forEach(row => {
    const id      = row[COL.id - 1]?.toString().trim();
    const address = row[COL.address - 1]?.toString().trim();
    if (!id || !address) return;

    const photosRaw = row[COL.photos - 1]?.toString().trim() || '';
    const photos = photosRaw ? photosRaw.split('|').map(p => p.trim()).filter(Boolean) : [];

    homes.push({
      id,
      address,
      city:       row[COL.city     - 1]?.toString().trim() || '',
      state:      row[COL.state    - 1]?.toString().trim() || '',
      zipcode:    row[COL.zipcode  - 1]?.toString().trim() || '',
      beds:       parseNumOrNull(row[COL.beds   - 1]),
      baths:      parseNumOrNull(row[COL.baths  - 1]),
      sqft:       parseNumOrNull(row[COL.sqft   - 1]),
      price:      parseNumOrNull(row[COL.price  - 1]),
      status:     row[COL.status   - 1]?.toString().trim().toLowerCase() || '',
      zillowUrl:  row[COL.zillowUrl - 1]?.toString().trim() || '',
      mlsNumber:  row[COL.mlsNumber - 1]?.toString().trim() || '',
      photos,
    });
  });

  const json = JSON.stringify(homes, null, 2);

  // Show in a dialog so you can copy it
  const ui = SpreadsheetApp.getUi();
  const htmlOutput = HtmlService.createHtmlOutput(
    '<p style="font-family:monospace;font-size:11px">Copy this JSON and paste it into <strong>availableHomes.json</strong> in your GitHub repo:</p>' +
    '<textarea style="width:100%;height:320px;font-size:11px;font-family:monospace">' +
    json.replace(/</g,'&lt;').replace(/>/g,'&gt;') +
    '</textarea>' +
    '<p style="font-size:11px;color:#666">Or use Google Sheets API / Zapier to auto-push this to GitHub.</p>'
  ).setWidth(700).setHeight(450).setTitle('availableHomes.json — Copy to GitHub');
  ui.showModalDialog(htmlOutput, 'Export availableHomes.json');
}

function parseNumOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/[^0-9.]/g,''));
  return isNaN(n) ? null : n;
}

function getListingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Listings');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('No "Listings" sheet found. Run Lafayette → Setup first.');
    return null;
  }
  return sheet;
}
