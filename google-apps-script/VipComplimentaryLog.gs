const SHEETS = {
  items: 'Items',
  staff: 'Staff',
  sessions: 'Sessions',
  sessionItems: 'SessionItems',
  roles: 'Roles',
  checklistTemplates: 'ChecklistTemplates',
  checklistTemplateItems: 'ChecklistTemplateItems',
  checklistRuns: 'ChecklistRuns',
  checklistRunItems: 'ChecklistRunItems',
  photoUploads: 'PhotoUploads',
  settings: 'Settings',
};

const HEADERS = {
  items: ['id', 'name', 'category', 'hpp', 'defaultQty', 'active'],
  staff: [
    'staffId',
    'staffName',
    'roleId',
    'openingTemplateId',
    'closingTemplateId',
    'isActive',
    'permissionLevel',
    'createdAt',
    'updatedAt',
  ],
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
  roles: ['roleId', 'roleName', 'description', 'isActive', 'createdAt', 'updatedAt'],
  checklistTemplates: ['templateId', 'templateName', 'templateType', 'roleId', 'description', 'isActive', 'createdAt', 'updatedAt'],
  checklistTemplateItems: [
    'templateItemId',
    'templateId',
    'itemName',
    'itemDescription',
    'sortOrder',
    'photoRequired',
    'noteRequired',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  checklistRuns: [
    'runId',
    'date',
    'staffId',
    'staffName',
    'roleId',
    'roleName',
    'templateId',
    'templateName',
    'templateType',
    'status',
    'startedAt',
    'completedAt',
    'createdAt',
    'updatedAt',
  ],
  checklistRunItems: [
    'runItemId',
    'runId',
    'templateItemId',
    'itemName',
    'itemDescription',
    'status',
    'note',
    'photoUrl',
    'photoThumbnailUrl',
    'photoRequired',
    'noteRequired',
    'completedAt',
    'createdAt',
    'updatedAt',
  ],
  photoUploads: ['photoId', 'runId', 'runItemId', 'staffId', 'staffName', 'fileName', 'fileUrl', 'thumbnailUrl', 'uploadedAt'],
  settings: ['key', 'value'],
};

const PHOTO_ROOT_FOLDER = 'Nomono Staff Checklist';

function setupOnce() {
  ensureSheets_();
  ensureFolder_(PHOTO_ROOT_FOLDER);
  return 'Nomono VIP + Staff SOP Checklist setup complete';
}

function doGet(e) {
  try {
    ensureSheets_();
    const action = String((e && e.parameter && e.parameter.action) || 'read');
    if (action !== 'read') throw new Error('Unsupported action');
    return output_({ ok: true, data: readStore_() }, e && e.parameter && e.parameter.callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    ensureSheets_();
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');

    if (body.action === 'write') {
      writeStore_(body.data || {});
      return output_({ ok: true, savedAt: new Date().toISOString() });
    }

    if (body.action === 'uploadPhoto') {
      const uploaded = savePhoto_(body);
      appendPhotoUpload_(uploaded);
      return output_({ ok: true, fileUrl: uploaded.fileUrl, thumbnailUrl: uploaded.thumbnailUrl, uploadedAt: uploaded.uploadedAt });
    }

    throw new Error('Unsupported action');
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
      staffId: String(row.staffId || row.id || ''),
      staffName: String(row.staffName || row.name || ''),
      roleId: String(row.roleId || ''),
      openingTemplateId: String(row.openingTemplateId || ''),
      closingTemplateId: String(row.closingTemplateId || ''),
      isActive: bool_(row.isActive || row.active),
      permissionLevel: String(row.permissionLevel || 'Staff'),
      createdAt: String(row.createdAt || ''),
      updatedAt: String(row.updatedAt || ''),
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
    roles: readObjects_(SHEETS.roles).map(function (row) {
      return {
        roleId: String(row.roleId || ''),
        roleName: String(row.roleName || ''),
        description: String(row.description || ''),
        isActive: bool_(row.isActive),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
      };
    }),
    checklistTemplates: readObjects_(SHEETS.checklistTemplates).map(function (row) {
      return {
        templateId: String(row.templateId || ''),
        templateName: String(row.templateName || ''),
        templateType: String(row.templateType || 'opening'),
        roleId: String(row.roleId || ''),
        description: String(row.description || ''),
        isActive: bool_(row.isActive),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
      };
    }),
    checklistTemplateItems: readObjects_(SHEETS.checklistTemplateItems).map(function (row) {
      return {
        templateItemId: String(row.templateItemId || ''),
        templateId: String(row.templateId || ''),
        itemName: String(row.itemName || ''),
        itemDescription: String(row.itemDescription || ''),
        sortOrder: number_(row.sortOrder),
        photoRequired: bool_(row.photoRequired),
        noteRequired: bool_(row.noteRequired),
        isActive: bool_(row.isActive),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
      };
    }),
    checklistRuns: readObjects_(SHEETS.checklistRuns).map(function (row) {
      return {
        runId: String(row.runId || ''),
        date: String(row.date || ''),
        staffId: String(row.staffId || ''),
        staffName: String(row.staffName || ''),
        roleId: String(row.roleId || ''),
        roleName: String(row.roleName || ''),
        templateId: String(row.templateId || ''),
        templateName: String(row.templateName || ''),
        templateType: String(row.templateType || 'opening'),
        status: String(row.status || 'in_progress'),
        startedAt: String(row.startedAt || ''),
        completedAt: String(row.completedAt || ''),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
      };
    }),
    checklistRunItems: readObjects_(SHEETS.checklistRunItems).map(function (row) {
      return {
        runItemId: String(row.runItemId || ''),
        runId: String(row.runId || ''),
        templateItemId: String(row.templateItemId || ''),
        itemName: String(row.itemName || ''),
        itemDescription: String(row.itemDescription || ''),
        status: String(row.status || 'pending'),
        note: String(row.note || ''),
        photoUrl: String(row.photoUrl || ''),
        photoThumbnailUrl: String(row.photoThumbnailUrl || row.photoUrl || ''),
        photoRequired: bool_(row.photoRequired),
        noteRequired: bool_(row.noteRequired),
        completedAt: String(row.completedAt || ''),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
      };
    }),
    photoUploads: readObjects_(SHEETS.photoUploads).map(function (row) {
      return {
        photoId: String(row.photoId || ''),
        runId: String(row.runId || ''),
        runItemId: String(row.runItemId || ''),
        staffId: String(row.staffId || ''),
        staffName: String(row.staffName || ''),
        fileName: String(row.fileName || ''),
        fileUrl: String(row.fileUrl || ''),
        thumbnailUrl: String(row.thumbnailUrl || row.fileUrl || ''),
        uploadedAt: String(row.uploadedAt || ''),
      };
    }),
  };
}

function writeStore_(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  const staff = Array.isArray(data.staff) ? data.staff : [];
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const checklistTemplates = Array.isArray(data.checklistTemplates) ? data.checklistTemplates : [];
  const checklistTemplateItems = Array.isArray(data.checklistTemplateItems) ? data.checklistTemplateItems : [];
  const checklistRuns = Array.isArray(data.checklistRuns) ? data.checklistRuns : [];
  const checklistRunItems = Array.isArray(data.checklistRunItems) ? data.checklistRunItems : [];
  const photoUploads = Array.isArray(data.photoUploads) ? data.photoUploads : [];

  const runById = {};
  checklistRuns.forEach(function (run) {
    runById[run.runId] = run;
  });

  const normalizedRunItems = checklistRunItems.map(function (item) {
    if (item.photoDataUrl && !item.photoUrl) {
      const run = runById[item.runId] || {};
      const uploaded = savePhoto_({
        dataUrl: item.photoDataUrl,
        fileName: item.photoFileName || buildPhotoFileName_(run, item),
        runId: item.runId,
        runItemId: item.runItemId,
        staffId: run.staffId || '',
        staffName: run.staffName || '',
        templateType: run.templateType || 'Checklist',
        date: run.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      });
      item.photoUrl = uploaded.fileUrl;
      item.photoThumbnailUrl = uploaded.thumbnailUrl;
      photoUploads.push(uploaded);
    }
    return item;
  });

  writeRows_(SHEETS.items, HEADERS.items, items.map(function (item) {
    return [item.id, item.name, item.category, item.hpp, item.defaultQty, item.active === true];
  }));

  writeRows_(SHEETS.staff, HEADERS.staff, staff.map(function (person) {
    return [
      person.staffId,
      person.staffName,
      person.roleId,
      person.openingTemplateId,
      person.closingTemplateId,
      person.isActive === true,
      person.permissionLevel || 'Staff',
      person.createdAt || '',
      person.updatedAt || '',
    ];
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

  writeRows_(SHEETS.roles, HEADERS.roles, roles.map(function (role) {
    return [role.roleId, role.roleName, role.description, role.isActive === true, role.createdAt || '', role.updatedAt || ''];
  }));

  writeRows_(SHEETS.checklistTemplates, HEADERS.checklistTemplates, checklistTemplates.map(function (template) {
    return [
      template.templateId,
      template.templateName,
      template.templateType,
      template.roleId,
      template.description || '',
      template.isActive === true,
      template.createdAt || '',
      template.updatedAt || '',
    ];
  }));

  writeRows_(SHEETS.checklistTemplateItems, HEADERS.checklistTemplateItems, checklistTemplateItems.map(function (item) {
    return [
      item.templateItemId,
      item.templateId,
      item.itemName,
      item.itemDescription || '',
      item.sortOrder,
      item.photoRequired === true,
      item.noteRequired === true,
      item.isActive === true,
      item.createdAt || '',
      item.updatedAt || '',
    ];
  }));

  writeRows_(SHEETS.checklistRuns, HEADERS.checklistRuns, checklistRuns.map(function (run) {
    return [
      run.runId,
      run.date,
      run.staffId,
      run.staffName,
      run.roleId,
      run.roleName,
      run.templateId,
      run.templateName,
      run.templateType,
      run.status,
      run.startedAt || '',
      run.completedAt || '',
      run.createdAt || '',
      run.updatedAt || '',
    ];
  }));

  writeRows_(SHEETS.checklistRunItems, HEADERS.checklistRunItems, normalizedRunItems.map(function (item) {
    return [
      item.runItemId,
      item.runId,
      item.templateItemId,
      item.itemName,
      item.itemDescription || '',
      item.status,
      item.note || '',
      item.photoUrl || '',
      item.photoThumbnailUrl || item.photoUrl || '',
      item.photoRequired === true,
      item.noteRequired === true,
      item.completedAt || '',
      item.createdAt || '',
      item.updatedAt || '',
    ];
  }));

  const uniqueUploads = {};
  photoUploads.forEach(function (photo) {
    uniqueUploads[photo.runItemId || photo.photoId] = photo;
  });
  writeRows_(SHEETS.photoUploads, HEADERS.photoUploads, Object.keys(uniqueUploads).map(function (key) {
    const photo = uniqueUploads[key];
    return [
      photo.photoId || Utilities.getUuid(),
      photo.runId || '',
      photo.runItemId || '',
      photo.staffId || '',
      photo.staffName || '',
      photo.fileName || '',
      photo.fileUrl || '',
      photo.thumbnailUrl || photo.fileUrl || '',
      photo.uploadedAt || '',
    ];
  }));
}

function savePhoto_(payload) {
  if (!payload.dataUrl) throw new Error('Photo dataUrl is required');

  const matches = String(payload.dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid image data');

  const contentType = matches[1];
  const bytes = Utilities.base64Decode(matches[2]);
  const date = String(payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  const month = date.slice(0, 7);
  const typeFolder = titleCase_(String(payload.templateType || 'Checklist'));
  const folder = ensureFolderPath_([PHOTO_ROOT_FOLDER, month, typeFolder]);
  const fileName = sanitizeFileName_(payload.fileName || date + '_' + payload.staffName + '_' + payload.runItemId + '.jpg');
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const fileUrl = file.getUrl();
  const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
  const uploadedAt = new Date().toISOString();

  return {
    photoId: Utilities.getUuid(),
    runId: String(payload.runId || ''),
    runItemId: String(payload.runItemId || ''),
    staffId: String(payload.staffId || ''),
    staffName: String(payload.staffName || ''),
    fileName: fileName,
    fileUrl: fileUrl,
    thumbnailUrl: thumbnailUrl,
    uploadedAt: uploadedAt,
  };
}

function appendPhotoUpload_(photo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.photoUploads);
  sheet.appendRow([
    photo.photoId,
    photo.runId,
    photo.runItemId,
    photo.staffId,
    photo.staffName,
    photo.fileName,
    photo.fileUrl,
    photo.thumbnailUrl,
    photo.uploadedAt,
  ]);
}

function buildPhotoFileName_(run, item) {
  const date = run.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return sanitizeFileName_([date, run.staffName || 'Staff', run.templateType || 'Checklist', item.itemName || item.runItemId].join('_') + '.jpg');
}

function readObjects_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();
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
  sheet.getRange(1, 1, Math.max(rows.length + 1, 2), headers.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);
}

function ensureFolderPath_(parts) {
  let folder = ensureFolder_(parts[0]);
  for (let i = 1; i < parts.length; i += 1) {
    const iterator = folder.getFoldersByName(parts[i]);
    folder = iterator.hasNext() ? iterator.next() : folder.createFolder(parts[i]);
  }
  return folder;
}

function ensureFolder_(name) {
  const iterator = DriveApp.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : DriveApp.createFolder(name);
}

function sanitizeFileName_(value) {
  return String(value || 'photo.jpg')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 160);
}

function titleCase_(value) {
  const raw = String(value || 'Checklist');
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
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
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
