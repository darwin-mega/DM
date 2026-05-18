var SHEET_NAME = "Hoja 1"; // Ajusta si tu pestaña se llama diferente

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var doc = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = doc.getSheetByName(SHEET_NAME);
        if (!sheet) sheet = doc.getSheets()[0]; // Usa la primera hoja si no encuentra el nombre

        // Obtenemos las cabeceras actuales de tu hoja (Nombre, Teléfono, Mail, Interés)
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var nextRow = sheet.getLastRow() + 1;
        var newRow = [];

        // Recorremos tus columnas y buscamos el dato correspondiente del formulario
        for (var i = 0; i < headers.length; i++) {
            var header = headers[i].toString().trim(); // Nombre, Teléfono, etc.
            var value = "";

            // Lógica de mapeo: Columna Excel -> Campo Formulario
            if (header.equalsIgnoreCase("Nombre")) {
                value = e.parameter.nombre;
            } else if (header.equalsIgnoreCase("Teléfono") || header.equalsIgnoreCase("Telefono")) {
                value = e.parameter.telefono;
            } else if (header.equalsIgnoreCase("Mail") || header.equalsIgnoreCase("Email") || header.equalsIgnoreCase("Correo")) {
                value = e.parameter.email;
            } else if (header.equalsIgnoreCase("Interés") || header.equalsIgnoreCase("Interes") || header.equalsIgnoreCase("Plan")) {
                value = e.parameter.plan;
            } else if (header.equalsIgnoreCase("Mensaje")) {
                value = e.parameter.mensaje;
            } else if (header.equalsIgnoreCase("Fecha")) {
                value = new Date();
            }

            newRow.push(value || ""); // Si no hay dato, pone vacío
        }

        if (newRow.length > 0) {
            sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
        }

        return ContentService
            .createTextOutput(JSON.stringify({ 'result': 'success', 'row': nextRow }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    catch (e) {
        return ContentService
            .createTextOutput(JSON.stringify({ 'result': 'error', 'error': e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    finally {
        lock.releaseLock();
    }
}

// Función auxiliar para comparar texto ignorando mayúsculas
String.prototype.equalsIgnoreCase = function (compareString) {
    if (compareString === undefined || compareString === null) return false;
    return this.toUpperCase() === compareString.toUpperCase();
};
