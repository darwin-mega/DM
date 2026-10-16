document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#diagnostico-form');
    if (!form) return;

    const button = form.querySelector('button[type="submit"]');
    const status = document.querySelector('#form-status');
    const isTest = new URLSearchParams(window.location.search).get('prueba') === '1';
    let sending = false;
    let completed = false;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (sending || completed || !form.reportValidity()) return;
        if (form.elements._honey.value) return;

        sending = true;
        button.disabled = true;
        button.textContent = 'Enviando…';
        form.setAttribute('aria-busy', 'true');
        status.textContent = 'Estamos enviando tu solicitud.';
        status.dataset.state = 'sending';
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 25000);

        try {
            const data = Object.fromEntries(new FormData(form));
            delete data.privacidad;
            data._subject = isTest ? 'PRUEBA — Formulario DM Marketing' : 'Nueva solicitud de diagnóstico — DM Marketing';
            const response = await fetch(form.dataset.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            const result = await response.json();
            if (!response.ok || ![true, 'true'].includes(result.success) || /activat|confirm.*email|verify.*email/i.test(result.message || '')) {
                throw new Error('submission_not_confirmed');
            }

            completed = true;
            status.dataset.state = 'success';
            status.textContent = isTest
                ? 'Prueba enviada. Comprobá la recepción del correo antes de dar el formulario por verificado.'
                : 'Tu solicitud fue enviada. Te responderemos al correo que nos dejaste para coordinar el diagnóstico.';
            status.focus();
            button.textContent = 'Solicitud enviada';
            // Only a successful provider response counts as a lead. Never send personal data.
            if (!isTest && typeof window.gtag === 'function') {
                window.gtag('event', 'generate_lead', { form_id: 'diagnostico', lead_source: 'web_form' });
            }
            form.reset();
        } catch (error) {
            status.dataset.state = 'error';
            status.textContent = 'No pudimos confirmar el envío. Podés intentar nuevamente o escribirnos al correo que figura debajo. Si ya enviaste una solicitud, evitá repetirla.';
            status.focus();
            button.disabled = false;
            button.textContent = 'Enviar solicitud';
        } finally {
            window.clearTimeout(timeout);
            sending = false;
            form.removeAttribute('aria-busy');
        }
    });
});
