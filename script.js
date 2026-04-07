const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.getElementById('mobile-nav');
const backToTop = document.getElementById('backToTop');
const siteFooter = document.getElementById('siteFooter');
const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');
const parallaxElements = document.querySelectorAll('[data-parallax]');

if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const revealElements = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

revealElements.forEach(el => observer.observe(el));

const form = document.getElementById('leadForm');
const formStatus = document.getElementById('formStatus');

// Вставьте сюда свои данные Telegram
const TELEGRAM_BOT_TOKEN = 'PASTE_YOUR_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'PASTE_YOUR_CHAT_ID';

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const telegram = document.getElementById('telegram').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !telegram) {
      setFormStatus('Пожалуйста, заполните имя и Telegram.', 'error');
      return;
    }

    if (
      TELEGRAM_BOT_TOKEN === 'PASTE_YOUR_BOT_TOKEN' ||
      TELEGRAM_CHAT_ID === 'PASTE_YOUR_CHAT_ID'
    ) {
      setFormStatus('В script.js нужно вставить токен Telegram-бота и chat_id.', 'error');
      return;
    }

    const text = [
      'Новая заявка с сайта Breakcode',
      '',
      `Имя: ${name}`,
      `Telegram: ${telegram}`,
      `Задача: ${message || 'Не указана'}`
    ].join('\n');

    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка при отправке');
      }

      form.reset();
      setFormStatus('Заявка отправлена. Команда скоро свяжется с вами.', 'success');
    } catch (error) {
      setFormStatus('Не удалось отправить заявку. Проверьте токен, chat_id или настройки бота.', 'error');
      console.error(error);
    }
  });
}

function setFormStatus(message, type) {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.className = `form-status ${type}`;
}

let lenisInstance = null;

function handleScrollState(scrollTop = window.scrollY) {
  updateScrollbar(scrollTop);
  updateBackToTop(scrollTop);
  updateProcessFlow(scrollTop);
  updateParallax(scrollTop);
}

if (window.Lenis) {
  lenisInstance = new Lenis({
    duration: 1.05,
    smoothWheel: true,
    smoothTouch: false,
    syncTouch: true,
    gestureOrientation: 'vertical'
  });

  function raf(time) {
    lenisInstance.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  lenisInstance.on('scroll', ({ scroll }) => {
    handleScrollState(scroll);
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      lenisInstance.scrollTo(target, { offset: -70 });
    });
  });

  window.__lenis = lenisInstance;
} else {
  window.addEventListener('scroll', () => handleScrollState(window.scrollY), { passive: true });
}

const sliders = document.querySelectorAll('[data-slider]');

sliders.forEach((slider) => {
  const slides = slider.querySelectorAll('.case-slide');
  const dots = slider.querySelectorAll('.case-dot');
  const slidesTrack = slider.querySelector('.case-slides');
  if (!slides.length || !slidesTrack) return;

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'case-arrow case-arrow-prev interactive';
  prevButton.setAttribute('aria-label', 'Предыдущий слайд');
  prevButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'case-arrow case-arrow-next interactive';
  nextButton.setAttribute('aria-label', 'Следующий слайд');
  nextButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;

  slider.append(prevButton, nextButton);

  let current = 0;

  function activate(index) {
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    slidesTrack.style.transform = `translateX(-${index * 100}%)`;
    prevButton.disabled = index === 0;
    nextButton.disabled = index === slides.length - 1;
    current = index;
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      activate(index);
    });
  });

  prevButton.addEventListener('click', () => {
    if (current === 0) return;
    activate(current - 1);
  });

  nextButton.addEventListener('click', () => {
    if (current >= slides.length - 1) return;
    activate(current + 1);
  });

  let startX = 0;
  let isDragging = false;

  slidesTrack.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    isDragging = true;
  });

  slidesTrack.addEventListener('pointerup', (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - startX;
    if (deltaX > 50 && current > 0) {
      activate(current - 1);
    } else if (deltaX < -50 && current < slides.length - 1) {
      activate(current + 1);
    }
    isDragging = false;
  });

  slidesTrack.addEventListener('pointercancel', () => {
    isDragging = false;
  });

  slidesTrack.addEventListener('pointerleave', () => {
    isDragging = false;
  });

  function handleKey(event) {
    if (event.key === 'ArrowLeft' && current > 0) {
      activate(current - 1);
    }
    if (event.key === 'ArrowRight' && current < slides.length - 1) {
      activate(current + 1);
    }
  }

  slider.addEventListener('keydown', handleKey);

  activate(0);
});

const scrollbar = document.getElementById('scrollbarX');
const scrollbarThumb = document.getElementById('scrollbarThumb');

function updateScrollbar(scrollTop = window.scrollY) {
  if (!scrollbar || !scrollbarThumb) return;

  const doc = document.documentElement;
  const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
  const progress = scrollTop / maxScroll;

  const trackWidth = scrollbar.clientWidth;
  const thumbWidth = Math.max(trackWidth * 0.18, 64);
  const maxLeft = trackWidth - thumbWidth;
  const left = maxLeft * progress;

  scrollbarThumb.style.width = `${thumbWidth}px`;
  scrollbarThumb.style.transform = `translateX(${left}px)`;
}

function updateBackToTop(scrollTop = window.scrollY) {
  if (!backToTop) return;
  const threshold = window.innerHeight * 1.4;
  backToTop.classList.toggle('visible', scrollTop > threshold);
}

if (scrollbar && scrollbarThumb) {
  let isDragging = false;

  const pointerMove = (clientX) => {
    const rect = scrollbar.getBoundingClientRect();
    const thumbWidth = scrollbarThumb.offsetWidth;
    const minX = rect.left;
    const maxX = rect.right - thumbWidth;
    const clamped = Math.min(Math.max(clientX, minX), maxX);
    const progress = (clamped - minX) / Math.max(rect.width - thumbWidth, 1);
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const targetY = maxScroll * progress;

    if (window.__lenis) {
      window.__lenis.scrollTo(targetY, { immediate: true });
    } else {
      window.scrollTo({ top: targetY, behavior: 'auto' });
    }
  };

  scrollbarThumb.addEventListener('mousedown', (event) => {
    isDragging = true;
    document.body.style.userSelect = 'none';
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    pointerMove(event.clientX - scrollbarThumb.offsetWidth / 2);
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  scrollbar.addEventListener('click', (event) => {
    if (event.target === scrollbarThumb) return;
    pointerMove(event.clientX - scrollbarThumb.offsetWidth / 2);
  });
}

const faqItems = document.querySelectorAll('.faq-item');

function openFaq(item, immediate = false) {
  const answer = item.querySelector('.faq-answer');
  const inner = item.querySelector('.faq-answer-inner');
  if (!answer || !inner) return;

  item.open = true;
  item.classList.add('is-open');

  if (immediate) {
    answer.style.transition = 'none';
    answer.style.height = `${inner.scrollHeight}px`;
    answer.style.opacity = '1';
    requestAnimationFrame(() => {
      answer.style.transition = '';
    });
    return;
  }

  answer.style.height = '0px';
  requestAnimationFrame(() => {
    answer.style.height = `${inner.scrollHeight}px`;
    answer.style.opacity = '1';
  });
}

function closeFaq(item, immediate = false) {
  const answer = item.querySelector('.faq-answer');
  const inner = item.querySelector('.faq-answer-inner');
  if (!answer || !inner) return;

  answer.style.height = `${inner.scrollHeight}px`;
  answer.style.opacity = '1';

  if (immediate) {
    answer.style.transition = 'none';
    answer.style.height = '0px';
    answer.style.opacity = '0';
    item.classList.remove('is-open');
    item.open = false;
    requestAnimationFrame(() => {
      answer.style.transition = '';
    });
    return;
  }

  requestAnimationFrame(() => {
    answer.style.height = '0px';
    answer.style.opacity = '0';
  });

  item.classList.remove('is-open');
  window.setTimeout(() => {
    if (!item.classList.contains('is-open')) item.open = false;
  }, 340);
}

faqItems.forEach((item, index) => {
  const summary = item.querySelector('summary');
  if (index === 0) {
    openFaq(item, true);
  } else {
    closeFaq(item, true);
  }

  summary.addEventListener('click', (event) => {
    event.preventDefault();
    const isOpen = item.classList.contains('is-open');
    if (isOpen) {
      closeFaq(item);
    } else {
      openFaq(item);
    }
  });
});

window.addEventListener('resize', () => {
  faqItems.forEach((item) => {
    if (item.classList.contains('is-open')) {
      const answer = item.querySelector('.faq-answer');
      const inner = item.querySelector('.faq-answer-inner');
      answer.style.height = `${inner.scrollHeight}px`;
    }
  });
  handleScrollState(window.scrollY);
});

const processFlow = document.getElementById('processFlow');
const processLineFill = document.getElementById('processLineFill');
const processSteps = document.querySelectorAll('.process-step');
let processCompleted = false;

function updateProcessFlow(scrollTop = window.scrollY) {
  if (!processFlow || !processLineFill || !processSteps.length) return;

  if (processCompleted) {
    processLineFill.style.width = '100%';
    processSteps.forEach(step => step.classList.add('active'));
    return;
  }

  const rect = processFlow.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const start = viewportHeight * 0.78;
  const end = viewportHeight * 0.22;
  const raw = (start - rect.top) / Math.max(start - end, 1);
  const progress = Math.min(Math.max(raw, 0), 1);

  if (progress >= 1) {
    processCompleted = true
    processLineFill.style.width = '100%';
    processSteps.forEach(step => step.classList.add('active'));
    return;
  }

  processLineFill.style.width = `${progress * 100}%`;

  const activeCount = Math.ceil(progress * processSteps.length);
  processSteps.forEach((step, index) => {
    step.classList.toggle('active', index < activeCount);
  });
}

const teamSlider = document.querySelector('[data-team-slider]');
const teamTrack = document.querySelector('[data-team-track]');
const teamPrev = document.querySelector('[data-team-prev]');
const teamNext = document.querySelector('[data-team-next]');

if (teamSlider && teamTrack && teamPrev && teamNext) {
  const scrollAmount = () => Math.max(teamTrack.clientWidth * 0.86, 260);

  teamPrev.addEventListener('click', () => {
    teamTrack.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  });

  teamNext.addEventListener('click', () => {
    teamTrack.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
  });
}

if (siteFooter && backToTop) {
  const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      backToTop.classList.toggle('on-footer', entry.isIntersecting);
    });
  }, { threshold: 0.2 });

  footerObserver.observe(siteFooter);
}

function updateParallax(scrollTop = window.scrollY) {
  parallaxElements.forEach((el) => {
    const speed = Number(el.dataset.parallax || 0);
    const offset = scrollTop * speed;
    el.style.transform = `translate3d(0, ${offset}px, 0)`;
  });
}

const canUseCursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (canUseCursor && cursorDot && cursorRing) {
  document.body.classList.add('cursor-enabled');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  const interactiveTargets = document.querySelectorAll('.interactive, a, button, summary, input, textarea');

  const showCursor = () => {
    cursorDot.style.opacity = '1';
    cursorRing.style.opacity = '1';
  };

  const hideCursor = () => {
    cursorDot.style.opacity = '0';
    cursorRing.style.opacity = '0';
  };

  window.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    showCursor();
  });

  window.addEventListener('mousedown', () => {
    cursorRing.classList.add('is-hover');
    cursorDot.classList.add('is-hover');
  });

  window.addEventListener('mouseup', () => {
    cursorRing.classList.remove('is-hover');
    cursorDot.classList.remove('is-hover');
  });

  window.addEventListener('mouseleave', hideCursor);
  window.addEventListener('mouseenter', showCursor);

  interactiveTargets.forEach((target) => {
    target.addEventListener('mouseenter', () => {
      cursorRing.classList.add('is-hover');
      cursorDot.classList.add('is-hover');
    });
    target.addEventListener('mouseleave', () => {
      cursorRing.classList.remove('is-hover');
      cursorDot.classList.remove('is-hover');
    });
  });

  const renderCursor = () => {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    requestAnimationFrame(renderCursor);
  };

  requestAnimationFrame(renderCursor);
}

handleScrollState(window.scrollY);
