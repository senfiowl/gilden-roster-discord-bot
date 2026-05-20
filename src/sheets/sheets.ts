import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import path from 'path';

export interface PlayerExportRow {
  displayName: string;
  chars: Array<{
    name: string;
    server: string;
    className: string;
    ilvl: number;
  }>;
}

// ── Colours ───────────────────────────────────────────────────────────────────

// Official WoW class colours (matches types/index.ts)
const CLASS_HEX: Record<string, number> = {
  'Death Knight': 0xc41e3a,
  'Demon Hunter': 0xa330c9,
  'Druid':        0xff7c0a,
  'Evoker':       0x33937f,
  'Hunter':       0xaad372,
  'Mage':         0x3fc7eb,
  'Monk':         0x00ff98,
  'Paladin':      0xf48cba,
  'Priest':       0xcccccc,
  'Rogue':        0xfff468,
  'Shaman':       0x0070dd,
  'Warlock':      0x8788ee,
  'Warrior':      0xc69b3a,
};

type Rgb = { red: number; green: number; blue: number };

function hexToRgb(hex: number): Rgb {
  return {
    red:   ((hex >> 16) & 0xff) / 255,
    green: ((hex >> 8)  & 0xff) / 255,
    blue:  (hex         & 0xff) / 255,
  };
}

// WCAG relative luminance — determines whether dark or light text is more readable
function luminance({ red, green, blue }: Rgb): number {
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(red) + 0.7152 * lin(green) + 0.0722 * lin(blue);
}

const C = {
  header1:   hexToRgb(0x1a1a2e), // dark navy  — "Char1 / Char2" row
  header2:   hexToRgb(0x2d3561), // mid navy   — "Discordname / (Charname) / Klasse" row
  rowAlt:    hexToRgb(0xf5f7fa), // very light — alternating player rows
  rowWhite:  { red: 1, green: 1, blue: 1 } as Rgb,
  ilvlAlpha: 0.55,               // class colour gets mixed with white for ilvl rows
  white:     { red: 1,    green: 1,    blue: 1    } as Rgb,
  textLight: { red: 0.95, green: 0.95, blue: 0.95 } as Rgb,
  textDark:  { red: 0.1,  green: 0.1,  blue: 0.1  } as Rgb,
  border:    { red: 0.8,  green: 0.8,  blue: 0.8  } as Rgb,
  borderOuter: { red: 0.4, green: 0.4, blue: 0.4  } as Rgb,
};

function classBg(className: string): Rgb {
  const hex = CLASS_HEX[className];
  return hex !== undefined ? hexToRgb(hex) : C.rowWhite;
}

function classTextColor(bg: Rgb): Rgb {
  return luminance(bg) > 0.35 ? C.textDark : C.textLight;
}

// Blend class colour with white at reduced alpha — used for ilvl rows
function blendWithWhite(c: Rgb, alpha: number): Rgb {
  return {
    red:   c.red   * alpha + (1 - alpha),
    green: c.green * alpha + (1 - alpha),
    blue:  c.blue  * alpha + (1 - alpha),
  };
}

function solidBorder(color: Rgb): sheets_v4.Schema$Border {
  return { style: 'SOLID', colorStyle: { rgbColor: color } };
}

// ── Auth / sheet helpers ───────────────────────────────────────────────────────

function buildAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const scopes  = ['https://www.googleapis.com/auth/spreadsheets'];

  if (keyPath) return new google.auth.GoogleAuth({ keyFilename: path.resolve(keyPath), scopes });
  if (keyJson) return new google.auth.GoogleAuth({ credentials: JSON.parse(keyJson), scopes });
  throw new Error(
    'Google Sheets nicht konfiguriert — GOOGLE_SERVICE_ACCOUNT_PATH oder GOOGLE_SERVICE_ACCOUNT_JSON fehlt in .env'
  );
}

async function resolveSheet(
  api: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string | undefined,
): Promise<{ sheetId: number; title: string }> {
  const res    = await api.spreadsheets.get({ spreadsheetId });
  const sheets = res.data.sheets ?? [];
  const sheet  = tabName ? sheets.find(s => s.properties?.title === tabName) : sheets[0];
  if (!sheet) throw new Error(tabName ? `Sheet-Tab "${tabName}" nicht gefunden` : 'Keine Sheets gefunden');
  return { sheetId: sheet.properties?.sheetId ?? 0, title: sheet.properties?.title ?? 'Sheet1' };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportRosterToSheets(players: PlayerExportRow[]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID fehlt in .env');

  const api = google.sheets({ version: 'v4', auth: buildAuth() });
  const { sheetId, title } = await resolveSheet(api, spreadsheetId, process.env.GOOGLE_SHEET_TAB);

  const sorted = [
    ...players.filter(p => p.chars.length > 0),
    ...players.filter(p => p.chars.length === 0),
  ];
  const maxChars  = Math.max(...sorted.map(p => p.chars.length), 1);
  const totalCols = 1 + maxChars * 2;

  // ── Build cell values + track char positions for colouring ──────────────────

  interface CharPos { row: number; col: number; className: string; hasIlvlRow: boolean }
  const charPositions: CharPos[] = [];

  const header1: string[] = [''];
  for (let i = 1; i <= maxChars; i++) header1.push(`Char${i}`, '');

  const header2: string[] = ['Discordname'];
  for (let i = 0; i < maxChars; i++) header2.push('(Charname)', 'Klasse');

  const values: (string | number)[][] = [header1, header2];
  let currentRow = 2; // 0-based; rows 0+1 are headers

  sorted.forEach((player, playerIdx) => {
    const nameRow: (string | number)[] = [player.displayName];
    const ilvlRow: (string | number)[] = [''];

    player.chars.forEach((char, i) => {
      const col = 1 + i * 2;
      nameRow.push(`${char.name}-${char.server}`, char.className);
      ilvlRow.push(char.ilvl, '');
      charPositions.push({ row: currentRow, col, className: char.className, hasIlvlRow: true });
    });

    // Pad empty char slots
    for (let i = player.chars.length; i < maxChars; i++) {
      nameRow.push('', '');
      ilvlRow.push('', '');
    }

    values.push(nameRow);
    currentRow++;
    if (player.chars.length > 0) {
      values.push(ilvlRow);
      currentRow++;
    }
  });

  // ── Write data ───────────────────────────────────────────────────────────────

  await api.spreadsheets.values.clear({ spreadsheetId, range: `'${title}'` });
  await api.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  // ── Formatting requests ───────────────────────────────────────────────────────

  const requests: sheets_v4.Schema$Request[] = [];
  const totalRows = currentRow;

  // 1. Freeze first 2 rows
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // 2. Unmerge + re-merge Char group headers
  requests.push({
    unmergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: totalCols },
    },
  });
  for (let i = 0; i < maxChars; i++) {
    requests.push({
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 0, endRowIndex: 1,
          startColumnIndex: 1 + i * 2, endColumnIndex: 3 + i * 2,
        },
        mergeType: 'MERGE_ALL',
      },
    });
  }

  // 3. Header row 1 — dark navy, white text, bold, centred
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.header1,
          textFormat: { bold: true, foregroundColor: C.textLight, fontSize: 11 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });

  // 4. Header row 2 — mid navy, white text, bold, centred
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.header2,
          textFormat: { bold: true, foregroundColor: C.textLight, fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  });

  // 5. Discordname column (A) in subheader — left-align
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
      fields: 'userEnteredFormat(horizontalAlignment)',
    },
  });

  // 6. Data area — white background, standard text
  if (totalRows > 2) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.rowWhite,
            textFormat: { bold: false, foregroundColor: C.textDark, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
      },
    });
  }

  // 7. Class colours — char name + class columns, + faded version for ilvl row
  for (const { row, col, className, hasIlvlRow } of charPositions) {
    const bg      = classBg(className);
    const fgColor = classTextColor(bg);

    // Name row: char name cell + class cell
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: col, endColumnIndex: col + 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            textFormat: { foregroundColor: fgColor, bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // ilvl row: faded class colour, only the char name column (ilvl value cell)
    if (hasIlvlRow) {
      const fadedBg = blendWithWhite(bg, C.ilvlAlpha);
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: row + 1, endRowIndex: row + 2, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: fadedBg,
              textFormat: { foregroundColor: C.textDark, bold: false },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    }
  }

  // 8. Borders — full table
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: totalCols },
      top:             solidBorder(C.borderOuter),
      bottom:          solidBorder(C.borderOuter),
      left:            solidBorder(C.borderOuter),
      right:           solidBorder(C.borderOuter),
      innerHorizontal: solidBorder(C.border),
      innerVertical:   solidBorder(C.border),
    },
  });

  // 9. Auto-resize all columns
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: totalCols },
    },
  });

  await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}
