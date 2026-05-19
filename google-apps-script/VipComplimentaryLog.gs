const SHEETS = {
  items: 'Items',
  staff: 'Staff',
  sessions: 'Sessions',
  sessionItems: 'SessionItems',
};

const HEADERS = {
  items: ['id', 'name', 'category', 'hpp', 'defaultQty', 'active'],
  staff: ['id', 'name', 'active'],
  sessions: ['id', 'date', 'startTime', 'endTime', 'bookingName', 'room', 'staffName', 'status', 'notes', 'createdAt', 'updatedAt'],
  sessionItems: [
    'sessionId',
    'id',
    'itemId',
    'itemName',
    'hpp',
    'preparedQty',
    'sealedLeftQty',
    'usedQty',
    'returnToStockQty',
    'totalCost',
    'majooInputDone',
  ],
};

function setupOnce() {
  ensureSheets_();
  return 'VIP Complimentary Log sheet setup complete';
}

function doGet(e) {
  try {
    ensureSheets_();
    const response = { ok: true, data: readStore_() };
    return output_(response, e && e.parameter && e.parameter.callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    ensureSheets_();
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    if (body.action !== 'write') throw new Error('Unsupported action');
    writeStore_(body.data || {});
    return output_({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    const name = SHEETS[key];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = HEADERS[key];
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsHeader = headers.some(function (header, index) {
      return current[index] !== header;
    });
    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function readStore_() {
  const items = readObjects_(SHEETS.items).map(function (row) {
    return {
      id: String(row.id || ''),
      name: String(row.name || ''),
      category: String(row.category || ''),
      hpp: number_(row.hpp),
      defaultQty: number_(row.defaultQty),
      active: bool_(row.active),
    };
  });

  const staff = readObjects_(SHEETS.staff).map(function (row) {
    return {
      id: String(row.id || ''),
      name: String(row.name || ''),
      active: bool_(row.active),
    };
  });

  const linesBySession = {};
  readObjects_(SHEETS.sessionItems).forEach(function (row) {
    const sessionId = String(row.sessionId || '');
    if (!linesBySession[sessionId]) linesBySession[sessionId] = [];
    linesBySession[sessionId].push({
      id: String(row.id || ''),
      itemId: String(row.itemId || ''),
      itemName: String(row.itemName || ''),
      hpp: number_(row.hpp),
      preparedQty: number_(row.preparedQty),
      sealedLeftQty: number_(row.sealedLeftQty),
      usedQty: number_(row.usedQty),
      returnToStockQty: number_(row.returnToStockQty),
      totalCost: number_(row.totalCost),
      majooInputDone: bool_(row.majooInputDone),
    });
  });

  const sessions = readObjects_(SHEETS.sessions).map(function (row) {
    const id = String(row.id || '');
    return {
      id: id,
      date: String(row.date || ''),
      startTime: String(row.startTime || ''),
      endTime: String(row.endTime || ''),
      bookingName: String(row.bookingName || ''),
      room: String(row.room || 'VIP Room'),
      staffName: String(row.staffName || ''),
      status: String(row.status || 'completed'),
      notes: String(row.notes || ''),
      createdAt: String(row.createdAt || ''),
      updatedAt: String(row.updatedAt || ''),
      items: linesBySession[id] || [],
    };
  });

  return {
    items: items,
    staff: staff,
    sessions: sessions,
  };
}

function writeStore_(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  const staff = Array.isArray(data.staff) ? data.staff : [];
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];

  writeRows_(SHEETS.items, HEADERS.items, items.map(function (item) {
    return [item.id, item.name, item.category, item.hpp, item.defaultQty, item.active === true];
  }));

  writeRows_(SHEETS.staff, HEADERS.staff, staff.map(function (person) {
    return [person.id, person.name, person.active === true];
  }));

  writeRows_(SHEETS.sessions, HEADERS.sessions, sessions.map(function (session) {
    return [
      session.id,
      session.date,
      session.startTime,
      session.endTime,
      session.bookingName,
      session.room,
      session.staffName,
      session.status,
      session.notes || '',
      session.createdAt,
      session.updatedAt,
    ];
  }));

  const sessionItemRows = [];
  sessions.forEach(function (session) {
    (session.items || []).forEach(function (item) {
      sessionItemRows.push([
        session.id,
        item.id,
        item.itemId,
        item.itemName,
        item.hpp,
        item.preparedQty,
        item.sealedLeftQty,
        item.usedQty,
        item.returnToStockQty,
        item.totalCost,
        item.majooInputDone === true,
      ]);
    });
  });
  writeRows_(SHEETS.sessionItems, HEADERS.sessionItems, sessionItemRows);
}

function readObjects_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values.shift();
  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '';
      });
    })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (header, index) {
        obj[header] = row[index];
      });
      return obj;
    });
}

function writeRows_(sheetName, headers, rows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}

function number_(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function bool_(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function output_(payload, callback) {
  if (callback && /^[A-Za-z0-9_.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ');').setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
