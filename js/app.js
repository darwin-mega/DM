document.addEventListener('DOMContentLoaded', () => {
    // Cookie consent for analytics. Advertising storage remains disabled.
    const consentStorageKey = 'dm_cookie_consent';

    function readConsent() {
        try {
            return localStorage.getItem(consentStorageKey);
        } catch (error) {
            return null;
        }
    }

    function saveConsent(value) {
        try {
            localStorage.setItem(consentStorageKey, value);
        } catch (error) {
            // Consent Mode still receives the choice for the current visit.
        }

        if (typeof window.gtag === 'function') {
            window.gtag('consent', 'update', {
                analytics_storage: value === 'granted' ? 'granted' : 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'dm_consent_update', analytics_consent: value });
    }

    function showConsentBanner() {
        if (document.querySelector('.cookie-consent')) return;

        const banner = document.createElement('aside');
        banner.className = 'cookie-consent';
        banner.setAttribute('aria-label', 'Preferencias de medición');
        banner.innerHTML = `
            <div class="cookie-consent__copy">
                <strong>Medir sin invadir.</strong>
                <p>Usamos Analytics para entender qué páginas ayudan y cuáles hay que mejorar. Podés aceptar o rechazar la medición.</p>
                <a href="cookies.html">Ver política de cookies</a>
            </div>
            <div class="cookie-consent__actions">
                <button type="button" class="cookie-consent__button cookie-consent__button--secondary" data-consent="denied">Rechazar</button>
                <button type="button" class="cookie-consent__button" data-consent="granted">Aceptar medición</button>
            </div>`;

        banner.querySelectorAll('[data-consent]').forEach(button => {
            button.addEventListener('click', () => {
                saveConsent(button.dataset.consent);
                banner.remove();
            });
        });

        document.body.appendChild(banner);
    }

    if (!readConsent()) {
        showConsentBanner();
    }

    const preferencesButton = document.querySelector('#cookie-preferences-button');
    preferencesButton?.addEventListener('click', () => {
        try {
            localStorage.removeItem(consentStorageKey);
        } catch (error) {
            // The banner can still be shown for the current visit.
        }
        showConsentBanner();
    });

    // Recommended GA4 event: measures commercial intent without calling it a lead.
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link || typeof window.gtag !== 'function') return;

        const href = link.getAttribute('href') || '';
        if (href === 'contacto.html' || href.endsWith('/contacto.html')) {
            window.gtag('event', 'select_content', {
                content_type: 'diagnostico_cta',
                item_id: 'diagnostico_gratuito'
            });
            return;
        }

        const workCard = link.closest('.work-card');
        if (workCard && /^https?:\/\//.test(link.href)) {
            const projectName = workCard.querySelector('h3')?.textContent?.trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '');

            window.gtag('event', 'select_content', {
                content_type: 'proyecto',
                item_id: projectName || 'proyecto_sin_nombre'
            });
        }
    });

    // Mobile Menu Logic
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
    const closeMenuBtn = document.querySelector('.close-menu-btn');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

    function toggleMenu(forceOpen) {
        if (!mobileMenuOverlay) return;

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : !mobileMenuOverlay.classList.contains('active');

        mobileMenuOverlay.classList.toggle('active', shouldOpen);
        mobileMenuOverlay.setAttribute('aria-hidden', String(!shouldOpen));
        mobileMenuBtn?.setAttribute('aria-expanded', String(shouldOpen));
        document.body.style.overflow = shouldOpen ? 'hidden' : '';
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => toggleMenu());
    }

    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', () => toggleMenu(false));
    }

    // Close menu when clicking a link
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobileMenuOverlay?.classList.contains('active')) {
            toggleMenu(false);
            mobileMenuBtn?.focus();
        }
    });

    // Scroll Reveal Animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal-section');
    revealElements.forEach(el => observer.observe(el));


    // Handling Active Nav Link based on URL
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav-links a');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (currentPath.includes(linkPath) && linkPath !== 'index.html') {
            link.classList.add('active');
        } else if (currentPath === '/' || currentPath.endsWith('index.html')) {
            if (linkPath === 'index.html') link.classList.add('active');
        }
    });

    // Smooth Scroll for anchor links (only if target exists on current page)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                // Close mobile menu if open
                if (mobileMenuOverlay?.classList.contains('active')) {
                    toggleMenu(false);
                }

                // Adjust scroll position to account for the fixed header.
                const headerOffset = document.querySelector('.header')?.offsetHeight || 92;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // --- Futuristic Scramble Effect ---
    class TextScramble {
        constructor(el) {
            this.el = el;
            this.chars = '01<>-_\\/[]{}+=*';
            this.update = this.update.bind(this);
        }
        setText(newText) {
            const oldText = this.el.textContent || '';
            if (oldText === newText) return Promise.resolve();

            const length = Math.max(oldText.length, newText.length);
            const promise = new Promise((resolve) => this.resolve = resolve);
            this.queue = [];
            for (let i = 0; i < length; i++) {
                const from = oldText[i] || '';
                const to = newText[i] || '';
                const start = Math.floor(Math.random() * 4);
                const end = start + 7 + Math.floor(Math.random() * 5);
                this.queue.push({ from, to, start, end });
            }
            cancelAnimationFrame(this.frameRequest);
            this.frame = 0;
            this.el.classList.add('is-scrambling');
            this.update();
            return promise;
        }
        update() {
            let output = '';
            let complete = 0;
            for (let i = 0, n = this.queue.length; i < n; i++) {
                let { from, to, start, end, char } = this.queue[i];
                if (this.frame >= end) {
                    complete++;
                    output += to;
                } else if (to === ' ') {
                    output += ' ';
                } else if (this.frame >= start) {
                    if (!char || Math.random() < 0.28) {
                        char = this.randomChar();
                        this.queue[i].char = char;
                    }
                    output += `<span class="dud">${char}</span>`;
                } else {
                    output += from;
                }
            }
            this.el.innerHTML = output;
            if (complete === this.queue.length) {
                this.el.textContent = this.queue.map(item => item.to).join('');
                this.el.classList.remove('is-scrambling');
                this.resolve();
            } else {
                this.frameRequest = requestAnimationFrame(this.update);
                this.frame++;
            }
        }
        randomChar() {
            return this.chars[Math.floor(Math.random() * this.chars.length)];
        }
    }

    const phrases = [
        'captación de clientes',
        'estrategia comercial',
        'contenido que convierte',
        'medición de resultados'
    ];
    
    const fxEl = document.querySelector('.futuristic-text');
    if (fxEl) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const fx = new TextScramble(fxEl);
        let counter = 1;

        fxEl.textContent = phrases[0];

        const next = () => {
            if (document.hidden) {
                setTimeout(next, 800);
                return;
            }

            fx.setText(phrases[counter]).then(() => {
                counter = (counter + 1) % phrases.length;
                setTimeout(next, 2600);
            });
        };

        if (!prefersReducedMotion) {
            setTimeout(next, 2600);
        }
    }
});
