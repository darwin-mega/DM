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
        var datosParaCorreo = {}; // Objeto para construir el mensaje del correo

        for (var i = 0; i < headers.length; i++) {
            var header = headers[i].toString().toLowerCase().trim();
            var value = "";

            if (header === "nombre") {
                value = e.parameter.nombre;
                datosParaCorreo.nombre = value;
            } else if (header === "teléfono" || header === "telefono") {
                value = e.parameter.telefono;
                datosParaCorreo.telefono = value;
            } else if (header === "mail" || header === "email") {
                value = e.parameter.email;
                datosParaCorreo.email = value;
            } else if (header === "interés" || header === "interes") {
                value = e.parameter.plan;
                datosParaCorreo.plan = value;
            } else if (header === "mensaje") {
                value = e.parameter.mensaje;
                datosParaCorreo.mensaje = value;
            } else if (header === "fecha") {
                value = new Date();
            }

            newRow.push(value || "");
        }

        sheet.appendRow(newRow);

        // 2. Enviar Correo de Aviso
        sendNotificationEmail(datosParaCorreo);

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

function sendNotificationEmail(data) {
    var asunto = "🚀 Nuevo Lead en Sitio DM Marketing: " + (data.nombre || "Sin Nombre");
    var mensaje = "¡Hola! Tienes un nuevo contacto desde la web:\n\n" +
        "👤 Nombre: " + (data.nombre || "-") + "\n" +
        "📞 Teléfono: " + (data.telefono || "-") + "\n" +
        "📧 Email: " + (data.email || "-") + "\n" +
        "📌 Plan de Interés: " + (data.plan || "-") + "\n" +
        "📝 Mensaje: " + (data.mensaje || "-") + "\n\n" +
        "Revisa tu Google Sheet para más detalles.";

    MailApp.sendEmail(EMAIL_DESTINO, asunto, mensaje);
}
