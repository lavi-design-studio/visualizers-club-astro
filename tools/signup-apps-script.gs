// The Visualizers Club: the sign-up form's sheet (src/pages/dang-ky.astro sends to it).
// Set up, once:
//   1. Make a Google Sheet (any name). Extensions → Apps Script. Paste all of this over what is there. Save.
//   2. Deploy → New deployment → type: Web app. Execute as: Me. Who has access: Anyone. Deploy, allow.
//   3. Copy the web app's URL (it ends in /exec) and give it to Claude (SIGNUP_URL in dang-ky.astro).
// Each sign-up is a row in the sheet "Đăng ký": the time, the name, the Discord nick, the wish. The ninth is
// the last: a lock holds the sheet while one is written, so two at once never make a tenth. A Discord nick
// already in the sheet is not taken twice. To give a place back, delete its row.
const CAP = 9;
const SHEET = 'Đăng ký';

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(['Thời gian', 'Tên', 'Discord', 'Mong muốn']); sh.setFrozenRows(1); }
  return sh;
}
function taken_(sh) { return Math.max(0, sh.getLastRow() - 1); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
// (a value starting = + - @ would be read by the sheet as a formula: kept as text)
function safe_(v, n) { const s = String(v == null ? '' : v).trim().slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; }

// how many places are taken (the page asks as it opens)
function doGet() {
  const sh = sheet_();
  return out_({ ok: true, taken: Math.min(CAP, taken_(sh)), cap: CAP });
}

// a sign-up: written if there is a place and the nick is new
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    let d = {};
    try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'bad' }); }
    const sh = sheet_(), t = taken_(sh);
    if (d.website) return out_({ ok: true, taken: Math.min(CAP, t), cap: CAP });   // (the hidden field a bot fills: thanked, not kept)
    const name = safe_(d.name, 80), discord = safe_(d.discord, 40), wish = safe_(d.wish, 1000);
    if (!name || !discord || !wish) return out_({ ok: false, error: 'missing', taken: t, cap: CAP });
    if (t >= CAP) return out_({ ok: false, error: 'full', taken: t, cap: CAP });
    const nicks = t ? sh.getRange(2, 3, t, 1).getValues().map(r => String(r[0]).replace(/^'/, '').trim().toLowerCase()) : [];
    if (nicks.indexOf(discord.replace(/^'/, '').toLowerCase()) >= 0) return out_({ ok: false, error: 'dup', taken: t, cap: CAP });
    sh.appendRow([new Date(), name, discord, wish]);
    SpreadsheetApp.flush();
    return out_({ ok: true, taken: t + 1, cap: CAP });
  } finally {
    lock.releaseLock();
  }
}
