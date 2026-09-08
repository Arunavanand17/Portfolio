/* ============================================================
   ARUNAV ANAND PORTFOLIO — Main JavaScript
   "Midnight Sakura" — Interactive & Animated
   ============================================================ */

'use strict';

/* ============================================================
   0. CYBER-SAKURA IOT NETWORK BACKGROUND (Full-page Canvas)
   ============================================================ */
(function initCyberNetwork() {
  const canvas = document.getElementById('cyberNetCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Respect reduced-motion preference
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) { canvas.style.display = 'none'; return; }

  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  /* ---- Colour palette ---- */
  const CYAN  = { r: 0,   g: 246, b: 255 };  // #00F6FF
  const PINK  = { r: 255, g: 158, b: 187 };  // #FF9EBB

  function rgba(c, a) {
    return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
  }

  /* ---- Node class ---- */
  const NODE_COUNT = Math.min(55, Math.floor(W * H / 28000));
  const CONNECT_DIST = Math.min(180, W * 0.16);

  class Node {
    constructor() { this.respawn(true); }

    respawn(initial = false) {
      this.x    = Math.random() * W;
      this.y    = initial ? Math.random() * H : H + 12;
      this.size = Math.random() * 2.5 + 1.2;
      // very slow drift
      this.vx   = (Math.random() - 0.5) * 0.18;
      this.vy   = -(Math.random() * 0.22 + 0.06);  // float upward slowly
      // colour: lerp between cyan and pink
      this.t    = Math.random();                    // 0 = cyan, 1 = pink
      this.dt   = (Math.random() - 0.5) * 0.002;   // colour-shift speed
      // breathing
      this.phase    = Math.random() * Math.PI * 2;
      this.breathHz = 0.4 + Math.random() * 0.6;   // slow breathing (Hz)
      this.opacity  = 0;
      this.fadeIn   = 0.008 + Math.random() * 0.006;
    }

    colour(extra = 0) {
      const a = this.t, b = 1 - a;
      return {
        r: Math.round(CYAN.r * b + PINK.r * a),
        g: Math.round(CYAN.g * b + PINK.g * a),
        b: Math.round(CYAN.b * b + PINK.b * a),
        extra,
      };
    }

    update(time) {
      this.opacity = Math.min(1, this.opacity + this.fadeIn);
      this.phase  += 0.016 * this.breathHz;
      this.t = Math.max(0, Math.min(1, this.t + this.dt));
      if (Math.random() < 0.001) this.dt *= -1; // occasionally reverse colour shift

      this.x += this.vx;
      this.y += this.vy;

      // Wrap sides
      if (this.x < -20) this.x = W + 20;
      if (this.x > W + 20) this.x = -20;
      // Respawn at bottom when off the top
      if (this.y < -20) this.respawn();
    }

    draw(time) {
      const breathScale = 0.75 + 0.25 * Math.sin(this.phase);
      const r = this.size * breathScale;
      const col = this.colour();
      const a = this.opacity * (0.45 + 0.35 * Math.sin(this.phase));

      // Outer glow
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 5);
      grd.addColorStop(0,   rgba(col, a * 0.9));
      grd.addColorStop(0.4, rgba(col, a * 0.3));
      grd.addColorStop(1,   rgba(col, 0));
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 5, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col, Math.min(1, a * 1.8));
      ctx.fill();
    }
  }

  /* ---- Data-packet class (tiny sparks drifting up along edges) ---- */
  class Packet {
    constructor(a, b) { this.reset(a, b); }

    reset(a, b) {
      this.ax = a.x; this.ay = a.y;
      this.bx = b.x; this.by = b.y;
      this.p  = 0;
      this.speed = 0.004 + Math.random() * 0.004;
      this.col = a.colour();
      this.alive = true;
    }

    update() {
      this.p += this.speed;
      if (this.p >= 1) { this.alive = false; }
    }

    draw() {
      const x = this.ax + (this.bx - this.ax) * this.p;
      const y = this.ay + (this.by - this.ay) * this.p;
      const a = Math.sin(this.p * Math.PI) * 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(this.col, a);
      ctx.fill();
      // tiny trailing glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 7);
      grd.addColorStop(0,   rgba(this.col, a * 0.6));
      grd.addColorStop(1,   rgba(this.col, 0));
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
  }

  /* ---- Setup ---- */
  const nodes   = Array.from({ length: NODE_COUNT }, () => new Node());
  let   packets = [];
  let   animFrame;
  let   lastPacketTime = 0;

  /* ---- Connection drawing ---- */
  function drawConnections() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i], nj = nodes[j];
        const dx = ni.x - nj.x, dy = ni.y - nj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CONNECT_DIST) continue;

        const fade = 1 - dist / CONNECT_DIST;
        const a = fade * fade * 0.22 * Math.min(ni.opacity, nj.opacity);

        // Colour-blend between the two nodes' colours
        const ci = ni.colour(), cj = nj.colour();
        const mr = Math.round((ci.r + cj.r) / 2);
        const mg = Math.round((ci.g + cj.g) / 2);
        const mb = Math.round((ci.b + cj.b) / 2);
        const mid = { r: mr, g: mg, b: mb };

        const grd = ctx.createLinearGradient(ni.x, ni.y, nj.x, nj.y);
        grd.addColorStop(0,   rgba(ci,  a * 0.9));
        grd.addColorStop(0.5, rgba(mid, a * 1.15));
        grd.addColorStop(1,   rgba(cj,  a * 0.9));

        ctx.beginPath();
        ctx.moveTo(ni.x, ni.y);
        ctx.lineTo(nj.x, nj.y);
        ctx.strokeStyle = grd;
        ctx.lineWidth   = fade * 1.2;
        ctx.stroke();
      }
    }
  }

  /* ---- Spawn packets occasionally along connected pairs ---- */
  function spawnPacket(now) {
    if (now - lastPacketTime < 420) return;
    if (packets.length > 18) return;
    lastPacketTime = now;

    // Find a random connected pair
    const shuffled = [...nodes].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        const dx = shuffled[i].x - shuffled[j].x;
        const dy = shuffled[i].y - shuffled[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < CONNECT_DIST) {
          packets.push(new Packet(shuffled[i], shuffled[j]));
          return;
        }
      }
    }
  }

  /* ---- Animation loop ---- */
  function animate(time = 0) {
    ctx.clearRect(0, 0, W, H);

    // Update & draw connections first (behind nodes)
    drawConnections();

    // Update & draw nodes
    nodes.forEach(n => { n.update(time); n.draw(time); });

    // Packets
    spawnPacket(time);
    packets = packets.filter(p => p.alive);
    packets.forEach(p => { p.update(); p.draw(); });

    animFrame = requestAnimationFrame(animate);
  }

  animate();

  /* ---- Resize ---- */
  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }, { passive: true });

  /* ---- Pause when tab hidden ---- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      animate();
    }
  });
})();


/* ============================================================
   1. TYPED TEXT EFFECT
   ============================================================ */
const typedEl = document.getElementById('typedText');
const phrases = [
  'CSE-IoT Engineering Student',
  'Web Developer',
  'AI Enthusiast',
  'DSA Problem Solver',
  'Future JLPT N2 Scholar',
  'Google Student Ambassador'
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 75;

function typeText() {
  const currentPhrase = phrases[phraseIndex];

  if (isDeleting) {
    typedEl.textContent = currentPhrase.substring(0, charIndex - 1);
    charIndex--;
    typeSpeed = 40;
  } else {
    typedEl.textContent = currentPhrase.substring(0, charIndex + 1);
    charIndex++;
    typeSpeed = 75;
  }

  if (!isDeleting && charIndex === currentPhrase.length) {
    isDeleting = true;
    typeSpeed = 1800; // pause at end
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    typeSpeed = 400; // pause before next phrase
  }

  setTimeout(typeText, typeSpeed);
}

window.addEventListener('load', () => {
  setTimeout(typeText, 800);
});


/* ============================================================
   2. CHERRY BLOSSOM PETAL PARTICLE SYSTEM (Canvas)
   ============================================================ */
(function initPetals() {
  const canvas = document.getElementById('petalsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = canvas.width = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  // Respect reduced-motion preference
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    canvas.style.display = 'none';
    return;
  }

  const PETAL_COUNT = Math.min(35, Math.floor(W / 30));

  class Petal {
    constructor(initial) {
      this.reset(initial);
    }

    reset(initial = false) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : -20;
      this.size = Math.random() * 7 + 4;
      this.speedY = Math.random() * 0.6 + 0.25;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.015;
      this.opacity = Math.random() * 0.35 + 0.08;
      this.swayAmplitude = Math.random() * 1.2 + 0.4;
      this.swayFrequency = Math.random() * 0.01 + 0.003;
      this.tick = Math.random() * 1000;
      // Random pink shade
      const hue = 340 + Math.random() * 20;
      const sat = 70 + Math.random() * 20;
      const lit = 70 + Math.random() * 15;
      this.color = `hsla(${hue}, ${sat}%, ${lit}%, ${this.opacity})`;
    }

    update() {
      this.tick++;
      this.x += this.speedX + Math.sin(this.tick * this.swayFrequency) * this.swayAmplitude;
      this.y += this.speedY;
      this.rotation += this.rotSpeed;

      if (this.y > H + 30 || this.x < -30 || this.x > W + 30) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;

      // Draw a simple 5-petal sakura shape
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = Math.cos(angle) * this.size;
        const py = Math.sin(angle) * this.size;
        const cx1 = Math.cos(angle - 0.5) * this.size * 0.55;
        const cy1 = Math.sin(angle - 0.5) * this.size * 0.55;
        const cx2 = Math.cos(angle + 0.5) * this.size * 0.55;
        const cy2 = Math.sin(angle + 0.5) * this.size * 0.55;

        if (i === 0) ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(cx1, cy1, px, py);
        ctx.quadraticCurveTo(cx2, cy2, 0, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const petals = Array.from({ length: PETAL_COUNT }, () => new Petal(true));

  let animFrame;
  function animate() {
    ctx.clearRect(0, 0, W, H);
    petals.forEach(p => { p.update(); p.draw(); });
    animFrame = requestAnimationFrame(animate);
  }

  animate();

  // Resize handler
  const onResize = () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };

  window.addEventListener('resize', onResize, { passive: true });

  // Pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      animate();
    }
  });
})();


/* ============================================================
   3. NAVBAR — Scroll Behaviour & Active Links
   ============================================================ */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const allNavLinks = document.querySelectorAll('.nav-link');

  // Scroll → add .scrolled class
  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    updateActiveLink();
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  // Hamburger toggle
  hamburger.addEventListener('click', () => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!expanded));
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('open');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
  });

  // Close menu on link click
  allNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Active link tracking via IntersectionObserver
  const sections = document.querySelectorAll('section[id]');
  const sectionMap = {};

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sectionMap[entry.target.id] = true;
      } else {
        delete sectionMap[entry.target.id];
      }
    });
    updateActiveLink();
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));

  function updateActiveLink() {
    const activeId = Object.keys(sectionMap)[0];
    allNavLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
    });
  }
})();


/* ============================================================
   4. SCROLL REVEAL (Intersection Observer)
   ============================================================ */
(function initScrollReveal() {
  const revealTargets = [
    { selector: '.about-card',       delay: 0 },
    { selector: '.fact-card',        delay: 0.05 },
    { selector: '.skill-category',   delay: 0 },
    { selector: '.project-card',     delay: 0 },
    { selector: '.timeline-item',    delay: 0 },
    { selector: '.contact-info-card', delay: 0 },
    { selector: '.contact-form',     delay: 0.1 },
    { selector: '.section-header',   delay: 0 },
  ];

  revealTargets.forEach(({ selector, delay }) => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${delay * i}s`;
    });
  });

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();


/* ============================================================
   5. SKILL BAR ANIMATION (Trigger on Scroll)
   ============================================================ */
(function initSkillBars() {
  const fills = document.querySelectorAll('.skill-fill');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        const targetWidth = fill.getAttribute('data-width');
        // slight delay for visual effect
        setTimeout(() => {
          fill.style.width = targetWidth + '%';
        }, 200);
        observer.unobserve(fill);
      }
    });
  }, { threshold: 0.3 });

  fills.forEach(fill => observer.observe(fill));
})();


/* ============================================================
   6. BACK TO TOP BUTTON
   ============================================================ */
(function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();


/* ============================================================
   7. CONTACT FORM VALIDATION & SUBMISSION
   ============================================================ */
(function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const nameInput    = document.getElementById('formName');
  const emailInput   = document.getElementById('formEmail');
  const messageInput = document.getElementById('formMessage');
  const submitBtn    = document.getElementById('submitBtn');
  const formSuccess  = document.getElementById('formSuccess');
  const nameError    = document.getElementById('nameError');
  const emailError   = document.getElementById('emailError');
  const messageError = document.getElementById('messageError');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showError(el, msg) {
    el.textContent = msg;
    el.previousElementSibling?.classList.add('field-error-active');
  }

  function clearError(el) {
    el.textContent = '';
  }

  // Real-time validation
  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim().length >= 2) clearError(nameError);
  });

  emailInput.addEventListener('input', () => {
    if (emailRegex.test(emailInput.value.trim())) clearError(emailError);
  });

  messageInput.addEventListener('input', () => {
    if (messageInput.value.trim().length >= 10) clearError(messageError);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;

    if (nameInput.value.trim().length < 2) {
      showError(nameError, 'Please enter your name (min. 2 characters).');
      valid = false;
    } else {
      clearError(nameError);
    }

    if (!emailRegex.test(emailInput.value.trim())) {
      showError(emailError, 'Please enter a valid email address.');
      valid = false;
    } else {
      clearError(emailError);
    }

    if (messageInput.value.trim().length < 10) {
      showError(messageError, 'Message must be at least 10 characters.');
      valid = false;
    } else {
      clearError(messageError);
    }

    if (!valid) return;

    // Simulate async submission
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Sending…';

    await new Promise(r => setTimeout(r, 1400));

    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Send Message';
    form.reset();
    formSuccess.classList.add('show');

    setTimeout(() => {
      formSuccess.classList.remove('show');
    }, 5000);
  });
})();


/* ============================================================
   8. PROJECT CARD — Magnetic / Tilt effect (subtle)
   ============================================================ */
(function initCardTilt() {
  const cards = document.querySelectorAll('.project-card, .fact-card');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();


/* ============================================================
   9. SMOOTH ANCHOR SCROLL (with nav offset)
   ============================================================ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();


/* ============================================================
   10. FLOATING SAKURA CURSOR TRAIL (Desktop only)
   ============================================================ */
(function initCursorTrail() {
  if (window.innerWidth < 768) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const trailCount = 6;
  const trails = [];

  for (let i = 0; i < trailCount; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      border-radius: 50%;
      width: ${10 - i}px;
      height: ${10 - i}px;
      background: rgba(255, 158, 187, ${0.4 - i * 0.055});
      box-shadow: 0 0 ${8 - i}px rgba(255, 158, 187, 0.4);
      transform: translate(-50%, -50%);
      transition: left ${0.08 + i * 0.04}s ease, top ${0.08 + i * 0.04}s ease, opacity 0.3s ease;
      opacity: 0;
    `;
    document.body.appendChild(el);
    trails.push(el);
  }

  document.addEventListener('mousemove', (e) => {
    trails.forEach(t => {
      t.style.left = e.clientX + 'px';
      t.style.top  = e.clientY + 'px';
      t.style.opacity = '1';
    });
  });

  document.addEventListener('mouseleave', () => {
    trails.forEach(t => t.style.opacity = '0');
  });
})();


/* ============================================================
   11. SECTION — Staggered Fact Card Delays
   ============================================================ */
(function initFactCardDelays() {
  const factCards = document.querySelectorAll('.fact-card');
  factCards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.07}s`;
  });
})();


/* ============================================================
   12. TIMELINE — Progressive Line Animation
   ============================================================ */
(function initTimeline() {
  const timelineItems = document.querySelectorAll('.timeline-item');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateX(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  timelineItems.forEach((item, i) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-20px)';
    item.style.transition = `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`;
    observer.observe(item);
  });
})();


/* ============================================================
   13. PERFORMANCE: Pause petals on scroll (optional perf boost)
   ============================================================ */
// The petal canvas already pauses when tab hidden, which is the main perf case.
// Additional lazy loading or pause on scroll can be added here if needed.


/* ============================================================
   14. KEYBOARD NAVIGATION — ESC to close menu
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const hamburger = document.getElementById('hamburger');
    const navLinks  = document.getElementById('navLinks');
    if (navLinks.classList.contains('open')) {
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
});


/* ============================================================
   15. TECH TAGS — Random entrance animation
   ============================================================ */
(function animateTechTags() {
  const tags = document.querySelectorAll('.tech-tag');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const children = entry.target.querySelectorAll('.tech-tag');
        children.forEach((tag, i) => {
          setTimeout(() => {
            tag.style.opacity = '1';
            tag.style.transform = 'translateY(0)';
          }, i * 60);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.tech-tags').forEach(container => {
    container.querySelectorAll('.tech-tag').forEach(tag => {
      tag.style.opacity = '0';
      tag.style.transform = 'translateY(10px)';
      tag.style.transition = 'opacity 0.4s ease, transform 0.4s ease, background 0.2s, border-color 0.2s, color 0.2s';
    });
    observer.observe(container);
  });
})();
