// The Visualizers Club: the sign-up form's sheet (src/pages/dang-ky.astro sends to it).
// Set up, once:
//   1. Make a Google Sheet (any name). Extensions → Apps Script. Paste all of this over what is there. Save.
//   2. Deploy → New deployment → type: Web app. Execute as: Me. Who has access: Anyone. Deploy, allow.
//   3. Copy the web app's URL (it ends in /exec) and give it to Claude (SIGNUP_URL in dang-ky.astro).
// After changing this code: Deploy → Manage deployments → the pencil → Version: New version → Deploy
// (the URL stays the same; allow again if it asks: the email needs Gmail's permission).
//
// The sheet "Đăng ký", one row a sign-up:
//   Thời gian · Tên · Discord · Mong muốn · Mã chuyển khoản · Trạng thái · Xác nhận lúc · Ghi chú
// A sign-up comes in as "Chờ chuyển khoản" with its own transfer code (VSC and four letters), and an
// email tells you. When the money is in, set its Trạng thái to "Đã nhận tiền": the time is filled in,
// its place shows as taken on the site, and the page of the one who signed up says their place is
// confirmed. "Huỷ" gives the place back. Nine places at most, counting those waiting to pay: a lock
// holds the sheet while one is written, so two at once never make a tenth. A Discord nick already
// signed up (and not cancelled) is not taken twice.
const CAP = 9;
const SHEET = 'Đăng ký';
const HEAD = ['Thời gian', 'Tên', 'Discord', 'Mong muốn', 'Mã chuyển khoản', 'Trạng thái', 'Xác nhận lúc', 'Ghi chú'];
const WAIT = 'Chờ chuyển khoản', PAID = 'Đã nhận tiền', DROP = 'Huỷ';
const NOTIFY = '';   // where the email goes; empty: the Google account the script runs as
const COL = { time: 1, name: 2, discord: 3, wish: 4, code: 5, status: 6, confirmed: 7 };

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) sh = ss.insertSheet(SHEET);
  // (the header, and the status's choices, kept as they should be: an older sheet is brought up to date)
  const head = sh.getRange(1, 1, 1, HEAD.length);
  if (head.getValues()[0].join('|') !== HEAD.join('|')) {
    head.setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList([WAIT, PAID, DROP], true).setAllowInvalid(false).build();
    sh.getRange(2, COL.status, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  return sh;
}
function rows_(sh) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
}
// the places: paid, waiting to pay (both taken), and the rest free
function counts_(rows) {
  let paid = 0, wait = 0;
  for (const r of rows) {
    if (!r[COL.name - 1]) continue;
    const s = String(r[COL.status - 1] || WAIT);
    if (s === PAID) paid++; else if (s !== DROP) wait++;
  }
  return { paid: paid, wait: wait, taken: Math.min(CAP, paid + wait), cap: CAP };
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
// (a value starting = + - @ would be read by the sheet as a formula: kept as text)
function safe_(v, n) { const s = String(v == null ? '' : v).trim().slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; }
const plain_ = v => String(v).replace(/^'/, '').trim();
function code_(rows) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', used = rows.map(r => String(r[COL.code - 1]));
  for (;;) { let c = 'VSC'; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; if (used.indexOf(c) < 0) return c; }
}
const state_ = s => (s === PAID ? 'paid' : s === DROP ? 'drop' : 'wait');

// the places (and, given ?code=, how that sign-up stands): the page asks as it opens, and while it waits
function doGet(e) {
  const rows = rows_(sheet_()), o = counts_(rows);
  o.ok = true;
  const code = e && e.parameter && String(e.parameter.code || '').trim().toUpperCase();
  if (code) {
    const r = rows.filter(r => String(r[COL.code - 1]).toUpperCase() === code)[0];
    o.status = r ? state_(String(r[COL.status - 1] || WAIT)) : 'none';
    if (r) o.name = plain_(r[COL.name - 1]);
  }
  return out_(o);
}

// a sign-up: written if there is a place and the nick is new, then an email to you
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let row = null, o;
  try {
    let d = {};
    try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'bad' }); }
    const sh = sheet_(), rows = rows_(sh), c = counts_(rows);
    if (d.website) return out_(Object.assign({ ok: true, code: 'VSC0000' }, c));   // (the hidden field a bot fills: thanked, not kept)
    const name = safe_(d.name, 80), discord = safe_(d.discord, 40), wish = safe_(d.wish, 1000);
    if (!name || !discord || !wish) return out_(Object.assign({ ok: false, error: 'missing' }, c));
    if (c.paid + c.wait >= CAP) return out_(Object.assign({ ok: false, error: 'full' }, c));
    const nick = plain_(discord).toLowerCase();
    if (rows.some(r => plain_(r[COL.discord - 1]).toLowerCase() === nick && String(r[COL.status - 1]) !== DROP)) return out_(Object.assign({ ok: false, error: 'dup' }, c));
    const code = code_(rows);
    row = [new Date(), name, discord, wish, code, WAIT, '', ''];
    sh.appendRow(row);
    SpreadsheetApp.flush();
    o = Object.assign({ ok: true, code: code }, counts_(rows.concat([row])));
  } finally {
    lock.releaseLock();
  }
  try {
    const to = NOTIFY || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, `[Visualizers Club] Đăng ký mới: ${plain_(row[1])} (${row[4]})`,
      `Tên: ${plain_(row[1])}\nDiscord: ${plain_(row[2])}\nMong muốn: ${plain_(row[3])}\n\nMã chuyển khoản: ${row[4]}\n` +
      `Đã giữ ${o.paid + o.wait}/${CAP} chỗ (${o.paid} đã nhận tiền, ${o.wait} đang chờ).\n\n` +
      `Khi nhận được tiền, chọn "Đã nhận tiền" ở cột Trạng thái:\n${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`);
  } catch (err) {}   // (no email, no harm: the row is written)
  return out_(o);
}

// as you change a status: the time it was confirmed filled in (and cleared if it is set back)
function onEdit(e) {
  const r = e && e.range;
  if (!r || r.getSheet().getName() !== SHEET || r.getRow() < 2 || r.getColumn() > COL.status || r.getLastColumn() < COL.status) return;
  const sh = r.getSheet();
  for (let i = r.getRow(); i <= r.getLastRow(); i++) {
    const s = String(sh.getRange(i, COL.status).getValue()), at = sh.getRange(i, COL.confirmed);
    if (s === PAID && !at.getValue()) at.setValue(new Date());
    if (s !== PAID && at.getValue()) at.clearContent();
  }
}
