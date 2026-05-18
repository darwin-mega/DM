var SHEET_NAME = "Hoja 1";
var EMAIL_DESTINO = "dar1win22@gmail.com"; // Tu correo para recibir las alertas

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var doc = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = doc.getSheetByName(SHEET_NAME);
        if (!sheet) sheet = doc.getSheets()[0];

        // 1. Guardar en Excel
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        var newRow = [];
        var datos = {}; // Objeto simple para el correo

        for (var i = 0; i < headers.length; i++) {
            var header = headers[i].toString().toLowerCase().trim();
            var value = "";

            // Mapeo EXACTO de tus columnas
            if (header === "nombre") {
                value = e.parameter.nombre;
                datos.nombre = value;
            } else if (header === "teléfono" || header === "telefono") {
                value = e.parameter.telefono;
                datos.telefono = value;
            } else if (header === "mail") {
                value = e.parameter.email;
                datos.email = value;
            } else if (header === "interés" || header === "interes") {
                value = e.parameter.plan;
                datos.plan = value;
            } else if (header === "mensaje") { // Si añadiste esta columna
                value = e.parameter.mensaje;
                datos.mensaje = value;
            } else if (header === "fecha") {
                value = new Date();
            }

            newRow.push(value || "");
        }

        sheet.appendRow(newRow);

        // 2. ENVIAR CORREO (Sin condiciones, fuerza el envío siempre)
        MailApp.sendEmail({
            to: EMAIL_DESTINO,
            subject: "🚀 Nuevo Lead Web: " + (datos.nombre || "Sin Nombre"),
            body: "Nuevo contacto recibido desde la web:\n\n" +
                "👤 Nombre: " + (datos.nombre || "-") + "\n" +
                "📞 Teléfono: " + (datos.telefono || "-") + "\n" +
                "📧 Email: " + (datos.email || "-") + "\n" +
                "📌 Plan: " + (datos.plan || "-") + "\n" +
                "📝 Mensaje: " + (datos.mensaje || "-")
        });

        return ContentService
            .createTextOutput(JSON.stringify({ 'result': 'success', 'row': sheet.getLastRow() }))
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
