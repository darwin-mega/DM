var SHEET_NAME = "Hoja 1"; // Asegúrate de que coincida con el nombre de la pestaña abajo

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var doc = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = doc.getSheetByName(SHEET_NAME);

        // Si la hoja no existe, usa la primera activa
        if (!sheet) {
            sheet = doc.getSheets()[0];
        }

        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var nextRow = sheet.getLastRow() + 1;

        var newRow = headers.map(function (header) {
            return header === 'Fecha' ? new Date() : e.parameter[header.toLowerCase()] || '';
        });

        // Si no hay cabeceras o no coinciden, forzamos un orden estándar
        if (newRow.length === 0 || newRow.every(val => val === '')) {
            newRow = [
                new Date(),
                e.parameter.nombre,
                e.parameter.email,
                e.parameter.telefono,
                e.parameter.plan,
                e.parameter.mensaje
            ];
        }

        sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);

        return ContentService
            .createTextOutput(JSON.stringify({ 'result': 'success', 'row': nextRow }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    catch (e) {
        return ContentService
            .createTextOutput(JSON.stringify({ 'result': 'error', 'error': e }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    finally {
        lock.releaseLock();
    }
}

function setup() {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName(SHEET_NAME);

    if (!sheet) {
        sheet = doc.getSheets()[0];
    }

    sheet.getRange(1, 1, 1, 6).setValues([['Fecha', 'Nombre', 'Email', 'Telefono', 'Plan', 'Mensaje']]);
}
