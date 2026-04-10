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

const TELEGRAM_BOT_TOKEN = 'PASTE_YOUR_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'PASTE_YOUR_CHAT_ID';

const nameInput = form ? form.querySelector('#name') : null;
const contactType = form ? form.querySelector('#contactType') : null;
const contactInput = form ? form.querySelector('#contactField') : null;
const messageInput = form ? form.querySelector('#message') : null;

const contactTypeField = form ? form.querySelector('#contactTypeField') : null;
const contactFieldTrigger = form ? form.querySelector('#contactFieldTrigger') : null;
const contactFieldValue = form ? form.querySelector('#contactFieldValue') : null;
const contactFieldMenu = form ? form.querySelector('#contactFieldMenu') : null;
const contactFieldOptions = form ? [...form.querySelectorAll('.contact-field__option')] : [];

if (form && nameInput && contactType && contactInput && contactTypeField && contactFieldTrigger && contactFieldValue && contactFieldMenu) {
  setupContactDropdown();

  nameInput.addEventListener('beforeinput', handleNameBeforeInput);
  nameInput.addEventListener('input', handleNameInput);

  contactInput.addEventListener('beforeinput', handleContactBeforeInput);
  contactInput.addEventListener('input', handleContactInput);
  contactInput.addEventListener('focus', ensureContactPrefix);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameError = getNameError();
    const contactError = getContactError();

    validateName(true);
    validateContact(true);

    if (nameError) {
      showFormAlert(nameError, 'error');
      setFormStatus(nameError, 'error');
      nameInput.focus();
      return;
    }

    if (contactError) {
      showFormAlert(contactError, 'error');
      setFormStatus(contactError, 'error');
      contactInput.focus();
      return;
    }

    if (
      TELEGRAM_BOT_TOKEN === 'PASTE_YOUR_BOT_TOKEN' ||
      TELEGRAM_CHAT_ID === 'PASTE_YOUR_CHAT_ID'
    ) {
      showFormAlert('В script.js вставьте токен бота и chat_id.', 'error');
      setFormStatus('В script.js вставьте токен бота и chat_id.', 'error');
      return;
    }

    [nameInput, contactInput].forEach(markSuccessField);
    markContactTypeState(true);

    const name = nameInput.value.trim();
    const contact = contactInput.value.trim();
    const message = messageInput ? messageInput.value.trim() : '';
    const contactTypeLabel = getContactTypeLabel(contactType.value);

    const text = [
      'Новая заявка с сайта Breakcode',
      '',
      `Имя: ${name}`,
      `${contactTypeLabel}: ${contact}`,
      `Задача: ${message || 'Не указана'}`
    ].join('\n');

    try {
      const response = await fetch(LEAD_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          contact,
          contactType: contactType.value,
          contactTypeLabel,
          message,
          page: window.location.href,
          userAgent: navigator.userAgent
        })
      });

      const result = await safeJson(response);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || 'Ошибка при отправке');
      }

      showFormAlert('Заявка отправлена. Скоро свяжемся с вами.', 'success');
      setFormStatus('Заявка отправлена. Скоро свяжемся с вами.', 'success');

      window.setTimeout(() => {
        try {
          form.reset();

          if (contactType) {
            contactType.value = 'telegram';
          }

          if (typeof syncContactTypeUI === 'function') {
            syncContactTypeUI();
          }

          if (typeof resetContactField === 'function') {
            resetContactField();
          }

          if (typeof clearFieldState === 'function') {
            if (nameInput) clearFieldState(nameInput);
            if (contactInput) clearFieldState(contactInput);
            if (messageInput) clearFieldState(messageInput);
          }

          if (typeof clearContactTypeState === 'function') {
            clearContactTypeState();
          }
        } catch (uiError) {
          console.error('UI error after success:', uiError);
        }
      }, 200);
    } catch (error) {
      console.error('Submit error:', error);
      showFormAlert('Не удалось отправить заявку. Попробуйте позже.', 'error');
      setFormStatus('Ошибка отправки.', 'error');
    }
  });

  resetContactField();
}

function setupContactDropdown() {
  contactFieldTrigger.addEventListener('click', () => {
    const isOpen = contactTypeField.classList.contains('is-open');
    setDropdownOpen(!isOpen);
  });

  contactFieldTrigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!contactTypeField.classList.contains('is-open')) {
        setDropdownOpen(true);
      }
    }
    if (event.key === 'Escape') {
      setDropdownOpen(false);
    }
  });

  contactFieldOptions.forEach((option) => {
    option.addEventListener('click', () => {
      contactType.value = option.dataset.value || 'telegram';
      syncContactTypeUI();
      clearContactTypeState();
      clearFieldState(contactInput);
      resetContactField();
      setDropdownOpen(false);
      contactInput.focus();
    });
  });

  document.addEventListener('click', (event) => {
    if (!contactTypeField.contains(event.target)) {
      setDropdownOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setDropdownOpen(false);
    }
  });

  syncContactTypeUI();
}

function setDropdownOpen(isOpen) {
  contactTypeField.classList.toggle('is-open', isOpen);
  contactFieldTrigger.setAttribute('aria-expanded', String(isOpen));
  contactFieldMenu.setAttribute('aria-hidden', String(!isOpen));
}

function syncContactTypeUI() {
  const current = contactType.value || 'telegram';
  const labels = {
    telegram: 'Telegram',
    phone: 'Номер телефона',
    email: 'Электронная почта'
  };

  contactFieldValue.textContent = labels[current] || 'Telegram';

  contactFieldOptions.forEach((option) => {
    const isActive = option.dataset.value === current;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', String(isActive));
  });
}

function handleNameBeforeInput(event) {
  if (!event.data) return;
  if (!/^[A-Za-zА-Яа-яЁё\s]+$/.test(event.data)) {
    event.preventDefault();
  }
}

function handleNameInput() {
  const cleaned = nameInput.value.replace(/[^A-Za-zА-Яа-яЁё\s]/g, '');
  nameInput.value = cleaned.replace(/\s{2,}/g, ' ').replace(/^\s+/g, '');
  validateName(false);
}

function handleContactBeforeInput(event) {
  if (!event.data) return;
  const type = contactType.value;

  if (type === 'telegram' && !/^[A-Za-z0-9_@]+$/.test(event.data)) {
    event.preventDefault();
  }

  if (type === 'phone' && !/^\d+$/.test(event.data)) {
    event.preventDefault();
  }
}

function handleContactInput() {
  const type = contactType.value;
  const rawValue = contactInput.value;

  if (type === 'telegram') {
    const withoutAt = rawValue.replace(/@/g, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 32);
    contactInput.value = '@' + withoutAt;
    setCaretToEnd(contactInput);
  }

  if (type === 'phone') {
    let digits = rawValue.replace(/\D/g, '');

    if (digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }

    if (!digits.startsWith('7')) {
      digits = '7' + digits;
    }

    digits = digits.slice(0, 11);
    contactInput.value = formatRuPhone(digits);
    setCaretToEnd(contactInput);
  }

  validateContact(false);
}

function ensureContactPrefix() {
  if (contactType.value === 'telegram' && !contactInput.value) {
    contactInput.value = '@';
    setCaretToEnd(contactInput);
  }

  if (contactType.value === 'phone' && !contactInput.value) {
    contactInput.value = '+7';
    setCaretToEnd(contactInput);
  }
}

function validateName(markTouched = true) {
  const isValid = !getNameError();
  updateFieldState(nameInput, isValid, markTouched);
  return isValid;
}

function validateContact(markTouched = true) {
  const isValid = !getContactError();
  updateFieldState(contactInput, isValid, markTouched);
  markContactTypeState(isValid, markTouched);
  return isValid;
}

function getNameError() {
  const value = nameInput.value.trim();

  if (!value) return 'Введите имя';
  if (value.length < 3) return 'Введите минимум 3 буквы в имени';
  if (!/^[A-Za-zА-Яа-яЁё\s]+$/.test(value)) return 'Для имени допустимы только русские или английские буквы';

  return '';
}

function getContactError() {
  const value = contactInput.value.trim();
  const type = contactType.value;

  if (type === 'telegram') {
    if (!value || value === '@') return 'Введите ваш ник в Telegram';
    if (!/^@[A-Za-z0-9_]{4,32}$/.test(value)) return 'В нике Telagram могут быть только латиница, цифры и _';
    return '';
  }

  if (type === 'phone') {
    const digits = value.replace(/\D/g, '');
    if (!digits || digits === '7') return 'Введите номер РФ';
    if (!/^7\d{10}$/.test(digits)) return 'Введите полный номер';
    return '';
  }

  if (type === 'email') {
    if (!value) return 'Введите email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Введите корректный email';
    return '';
  }

  return '';
}

function updateFieldState(field, isValid, markTouched = true) {
  if (!field) return;

  field.classList.remove('is-error', 'is-success');

  if (!markTouched && !field.value.trim()) return;

  field.classList.add(isValid ? 'is-success' : 'is-error');
}

function clearFieldState(field) {
  if (!field) return;
  field.classList.remove('is-error', 'is-success');
}

function markSuccessField(field) {
  if (!field) return;
  field.classList.remove('is-error');
  field.classList.add('is-success');
}

function markContactTypeState(isValid, markTouched = true) {
  if (!contactTypeField) return;

  contactTypeField.classList.remove('is-error', 'is-success');

  if (!markTouched && !contactInput.value.trim()) return;

  contactTypeField.classList.add(isValid ? 'is-success' : 'is-error');
}

function clearContactTypeState() {
  if (!contactTypeField) return;
  contactTypeField.classList.remove('is-error', 'is-success');
}

function resetContactField() {
  if (!contactInput || !contactType) return;

  if (contactType.value === 'telegram') {
    contactInput.type = 'text';
    contactInput.inputMode = 'text';
    contactInput.placeholder = '@username';
    contactInput.maxLength = 33;
    contactInput.value = '@';
    setCaretToEnd(contactInput);
  }

  if (contactType.value === 'phone') {
    contactInput.type = 'tel';
    contactInput.inputMode = 'numeric';
    contactInput.placeholder = '+7 900 123-45-67';
    contactInput.maxLength = 16;
    contactInput.value = '+7';
    setCaretToEnd(contactInput);
  }

  if (contactType.value === 'email') {
    contactInput.type = 'email';
    contactInput.inputMode = 'email';
    contactInput.placeholder = 'mail@example.com';
    contactInput.removeAttribute('maxLength');
    contactInput.value = '';
  }

  setFormStatus('', '');
  syncContactTypeUI();
}

function formatRuPhone(digits) {
  let formatted = '+7';
  if (digits.length > 1) formatted += ' ' + digits.slice(1, 4);
  if (digits.length >= 5) formatted += ' ' + digits.slice(4, 7);
  if (digits.length >= 8) formatted += '-' + digits.slice(7, 9);
  if (digits.length >= 10) formatted += '-' + digits.slice(9, 11);
  return formatted;
}

function getContactTypeLabel(type) {
  if (type === 'telegram') return 'Telegram';
  if (type === 'phone') return 'Номер телефона';
  if (type === 'email') return 'Электронная почта';
  return 'Контакт';
}

function showFormAlert(message, type = 'success') {
  const existing = document.querySelector('.form-alert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.className = `form-alert ${type}`;
  alert.textContent = message;
  document.body.appendChild(alert);

  requestAnimationFrame(() => {
    alert.classList.add('is-visible');
  });

  setTimeout(() => {
    alert.classList.remove('is-visible');
    setTimeout(() => alert.remove(), 360);
  }, 3200);
}

function setFormStatus(message, type) {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.className = `form-status${type ? ' ' + type : ''}`;
}

function setCaretToEnd(input) {
  const length = input.value.length;
  requestAnimationFrame(() => {
    input.setSelectionRange(length, length);
  });
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
  const viewport = slider.querySelector('.case-viewport');
  const track = slider.querySelector('.case-slides');
  const dots = [...slider.querySelectorAll('.case-dot')];
  const originalSlides = [...track.querySelectorAll('.case-slide')];

  if (!viewport || !track || originalSlides.length < 2) return;

  const firstClone = originalSlides[0].cloneNode(true);
  const lastClone = originalSlides[originalSlides.length - 1].cloneNode(true);
  firstClone.classList.add('is-clone');
  lastClone.classList.add('is-clone');
  track.prepend(lastClone);
  track.append(firstClone);

  const total = originalSlides.length;
  const GAP = 12;
  let currentIndex = 1;
  let isDragging = false;
  let startX = 0;
  let dragOffset = 0;
  let baseTranslate = 0;
  let pointerId = null;

  const getStep = () => 355 + GAP;

  const getRealIndex = (virtualIndex) => {
    if (virtualIndex === 0) return total - 1;
    if (virtualIndex === total + 1) return 0;
    return virtualIndex - 1;
  };

  const setActiveDot = (realIndex) => {
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === realIndex);
    });
  };

  const applyTransform = (value) => {
    track.style.transform = `translate3d(${value}px, 0, 0)`;
  };

  const snapTo = (index, withTransition = true) => {
    currentIndex = index;
    track.style.transition = withTransition ? 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    baseTranslate = -(getStep() * currentIndex);
    applyTransform(baseTranslate);
    setActiveDot(getRealIndex(currentIndex));
  };

  const normalizeLoop = () => {
    if (currentIndex === 0) {
      snapTo(total, false);
    } else if (currentIndex === total + 1) {
      snapTo(1, false);
    }
  };

  const animateTo = (index) => {
    snapTo(index, true);
    const onEnd = () => {
      track.removeEventListener('transitionend', onEnd);
      normalizeLoop();
    };
    track.addEventListener('transitionend', onEnd);
  };

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (isDragging) return;
      animateTo(index + 1);
    });
  });

  viewport.addEventListener('pointerdown', (event) => {
    isDragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    dragOffset = 0;
    track.classList.add('dragging');
    track.style.transition = 'none';
    viewport.setPointerCapture(pointerId);
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!isDragging || event.pointerId !== pointerId) return;
    dragOffset = event.clientX - startX;
    applyTransform(baseTranslate + dragOffset * 0.92);
  });

  const endDrag = (event) => {
    if (!isDragging) return;
    if (event && pointerId !== null && event.pointerId !== pointerId) return;

    isDragging = false;
    track.classList.remove('dragging');

    const threshold = 48;
    if (dragOffset <= -threshold) {
      animateTo(currentIndex + 1);
    } else if (dragOffset >= threshold) {
      animateTo(currentIndex - 1);
    } else {
      animateTo(currentIndex);
    }

    dragOffset = 0;
    pointerId = null;
  };

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('dragstart', (event) => event.preventDefault());

  snapTo(1, false);
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
