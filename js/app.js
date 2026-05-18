document.addEventListener('DOMContentLoaded', () => {
    console.log('DM Marketing Site Loaded');

    // Typewriter effect for Hero Title
    const heroTitle = document.querySelector('.hero h1');
    if (heroTitle) {
        const text = heroTitle.textContent.trim();
        heroTitle.innerHTML = '';
        heroTitle.classList.remove('reveal-text');
        heroTitle.style.opacity = '1';
        heroTitle.style.transform = 'translateY(0)';
        heroTitle.style.animation = 'none';

        // Creamos spans ocultos para preservar el espacio y evitar que el texto salte
        const chars = [];
        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i];
            span.style.visibility = 'hidden';
            heroTitle.appendChild(span);
            chars.push(span);
        }
        
        let i = 0;
        const typeSpeed = 35;

        // Cursor inicial antes de escribir
        const initialCursor = document.createElement('span');
        initialCursor.classList.add('typing-cursor');
        heroTitle.insertBefore(initialCursor, heroTitle.firstChild);

        function typeWriter() {
            if (i === 0) {
                initialCursor.remove();
            }
            if (i > 0) {
                chars[i - 1].classList.remove('typing-cursor');
            }
            if (i < chars.length) {
                chars[i].style.visibility = 'visible';
                chars[i].classList.add('typing-cursor');
                i++;
                setTimeout(typeWriter, typeSpeed);
            } else {
                if (chars.length > 0) {
                    chars[chars.length - 1].classList.add('typing-cursor');
                    setTimeout(() => chars[chars.length - 1].classList.remove('typing-cursor'), 4000);
                }
            }
        }
        
        setTimeout(typeWriter, 300);
    }

    // Mobile Menu Logic
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
    const closeMenuBtn = document.querySelector('.close-menu-btn');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

    function toggleMenu() {
        mobileMenuOverlay.classList.toggle('active');
        document.body.style.overflow = mobileMenuOverlay.classList.contains('active') ? 'hidden' : '';
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMenu);
    }

    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', toggleMenu);
    }

    // Close menu when clicking a link
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', toggleMenu);
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
                if (mobileMenuOverlay.classList.contains('active')) {
                    toggleMenu();
                }

                // Adjust scroll position to account for fixed header (140px)
                const headerOffset = 140;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // Pre-select plan in contact form
    const selectPlanBtns = document.querySelectorAll('.select-plan-btn');
    const planSelect = document.getElementById('plan');

    selectPlanBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const planName = btn.getAttribute('data-plan');
            if (planSelect) {
                planSelect.value = planName;
            }
        });
    });

    // WhatsApp Chat Widget Logic
    // WhatsApp Chat Widget Logic
    const waWidget = document.getElementById('waWidget');
    const waToggle = document.getElementById('waToggle');
    const waClose = document.getElementById('waClose');
    const waMessageInput = document.getElementById('waMessageInput');
    const waSendBtn = document.getElementById('waSendBtn');
    let hasWaOpenedOnce = false;

    if (waWidget && waToggle && waClose) {
        // Toggle open/close on button click
        waToggle.addEventListener('click', () => {
            waWidget.classList.toggle('open');
            hasWaOpenedOnce = true;
        });

        // Open on hover
        waWidget.addEventListener('mouseenter', () => {
            if (!waWidget.classList.contains('open')) {
                waWidget.classList.add('open');
                hasWaOpenedOnce = true;
            }
        });

        // Close on X click
        waClose.addEventListener('click', (e) => {
            e.stopPropagation();
            waWidget.classList.remove('open');
        });

        // Auto-open once on scroll to bottom
        window.addEventListener('scroll', () => {
            const scrollPos = window.scrollY + window.innerHeight;
            const threshold = document.documentElement.scrollHeight - 50;
            if (scrollPos >= threshold && !hasWaOpenedOnce) {
                waWidget.classList.add('open');
                hasWaOpenedOnce = true;
            }
        });

        // Send logic
        const sendWaMessage = () => {
            let message = 'Hola, quiero más información.';
            if (waMessageInput && waMessageInput.value.trim() !== '') {
                message = waMessageInput.value.trim();
            }
            window.open(`https://wa.me/59894893040?text=${encodeURIComponent(message)}`, '_blank');
            if (waMessageInput) waMessageInput.value = '';
            waWidget.classList.remove('open');
        };

        if (waSendBtn) {
            waSendBtn.addEventListener('click', sendWaMessage);
        }

        if (waMessageInput) {
            waMessageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendWaMessage();
            });
        }
    }

    // Contact Form Submission Handler
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('form-message');

    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const btn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = btn.innerText;
            btn.innerText = 'Enviando...';
            btn.disabled = true;

            const formData = new FormData(contactForm);
            const action = contactForm.getAttribute('action');

            fetch(action, {
                method: 'POST',
                body: formData,
                mode: 'no-cors' // Essential for Google Apps Script to work from external domains
            })
                .then(() => {
                    // Success State
                    const nombreUsuario = formData.get('nombre') || 'Hola';
                    const planSeleccionado = formData.get('plan') || 'Consulta';

                    // REPLACE THIS WITH YOUR REAL NUMBER (No spaces, include country code)
                    const numeroWhatsApp = '59894893040';

                    const textoMensaje = `Hola, soy ${nombreUsuario}. Acabo de solicitar información sobre: ${planSeleccionado} desde la web.`;
                    const linkWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(textoMensaje)}`;

                    formMessage.style.display = 'block';
                    formMessage.style.color = '#333';
                    formMessage.innerHTML = `
                        <div style="text-align: center; padding: 20px; background: #e8fdf0; border-radius: 8px; border: 1px solid #25D366;">
                            <p style="font-weight: bold; color: #0F2E50; margin-bottom: 10px;">¡Paso 1 completado!</p>
                            <p style="font-size: 0.9rem; margin-bottom: 15px;">Tus datos llegaron. Para activar el diagnóstico, confirma por WhatsApp:</p>
                            <a href="${linkWhatsApp}" target="_blank" class="btn" style="background-color: #25D366; color: white; border: none; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none;">
                                Finalizar en WhatsApp 
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            </a>
                        </div>
                    `;
                    contactForm.reset();
                })
                .catch(error => {
                    console.error('Error:', error);
                    formMessage.style.display = 'block';
                    formMessage.style.color = 'red';
                    formMessage.innerText = 'Nota: La solicitud se envió, pero hubo un problema de red. Te contactaremos pronto.';
                })
                .finally(() => {
                    btn.innerText = originalBtnText;
                    btn.disabled = false;

                    setTimeout(() => {
                        formMessage.style.display = 'none';
                    }, 8000);
                });
        });
    }

    // --- Futuristic Scramble Effect ---
    class TextScramble {
        constructor(el) {
            this.el = el;
            this.chars = '!<>-_\\/[]{}—=+*^?#________';
            this.update = this.update.bind(this);
        }
        setText(newText) {
            const oldText = this.el.textContent || '';
            const length = Math.max(oldText.length, newText.length);
            const promise = new Promise((resolve) => this.resolve = resolve);
            this.queue = [];
            for (let i = 0; i < length; i++) {
                const from = oldText[i] || '';
                const to = newText[i] || '';
                const start = Math.floor(Math.random() * 40);
                const end = start + Math.floor(Math.random() * 40);
                this.queue.push({ from, to, start, end });
            }
            cancelAnimationFrame(this.frameRequest);
            this.frame = 0;
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
        'Estrategia Comercial',
        'Contenido y Anuncios',
        'Captación de Clientes',
        'Medición de Resultados'
    ];
    
    const fxEl = document.querySelector('.futuristic-text');
    if (fxEl) {
        const fx = new TextScramble(fxEl);
        let counter = 0;
        const next = () => {
            fx.setText(phrases[counter]).then(() => {
                setTimeout(next, 2500); // Wait 2.5s before scrambling to the next word
            });
            counter = (counter + 1) % phrases.length;
        };
        
        setTimeout(next, 1000); // Start effect 1 second after load
    }
});
