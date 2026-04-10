const MAX_BODY_BYTES = 12_000;
const MAX_NAME_LENGTH = 80;
const MAX_CONTACT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 500;
const ALLOWED_CONTACT_TYPES = new Set(['telegram', 'phone', 'email']);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

// Простое in-memory ограничение для Pages Functions.
// Работает как мягкий антиспам-слой и не требует UI-изменений.
const ipRateLimitStore = new Map();

export async function onRequestPost(context) {
  const { request, env } = context;
  const clientIp = getClientIp(request);
  const requestId = crypto.randomUUID();

  try {
    console.log('[LEAD] Incoming request', {
      requestId,
      ip: maskIp(clientIp),
      method: request.method,
      origin: request.headers.get('origin') || '',
      ua: trimLog(request.headers.get('user-agent') || '', 160)
    });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      console.warn('[LEAD] Rejected invalid content-type', {
        requestId,
        ip: maskIp(clientIp),
        contentType
      });
      return json({ ok: false, message: 'Неверный формат запроса.' }, 415);
    }

    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength && contentLength > MAX_BODY_BYTES) {
      console.warn('[LEAD] Rejected oversized body', {
        requestId,
        ip: maskIp(clientIp),
        contentLength
      });
      return json({ ok: false, message: 'Слишком большой запрос.' }, 413);
    }

    if (!isAllowedOrigin(request)) {
      console.warn('[LEAD] Rejected invalid origin', {
        requestId,
        ip: maskIp(clientIp),
        origin: request.headers.get('origin') || ''
      });
      return json({ ok: false, message: 'Недопустимый источник запроса.' }, 403);
    }

    if (!checkRateLimit(clientIp)) {
      console.warn('[RATE LIMIT] Blocked request', {
        requestId,
        ip: maskIp(clientIp),
        limit: RATE_LIMIT_MAX_REQUESTS,
        windowMs: RATE_LIMIT_WINDOW_MS
      });
      return json(
        { ok: false, message: 'Слишком много заявок. Попробуйте немного позже.' },
        429
      );
    }

    const body = await request.json();

    const name = normalizeText(body?.name, MAX_NAME_LENGTH);
    const contact = normalizeText(body?.contact, MAX_CONTACT_LENGTH);
    const contactType = normalizeText(body?.contactType, 20);
    const contactTypeLabel = normalizeText(body?.contactTypeLabel, 40);
    const message = normalizeText(body?.message, MAX_MESSAGE_LENGTH);
    const page = normalizeText(body?.page, MAX_PAGE_LENGTH);

    if (!name || !contact || !contactType) {
      console.warn('[VALIDATION] Missing required fields', {
        requestId,
        ip: maskIp(clientIp),
        hasName: Boolean(name),
        hasContact: Boolean(contact),
        hasContactType: Boolean(contactType)
      });
      return json({ ok: false, message: 'Не заполнены обязательные поля.' }, 400);
    }

    if (!ALLOWED_CONTACT_TYPES.has(contactType)) {
      console.warn('[VALIDATION] Invalid contact type', {
        requestId,
        ip: maskIp(clientIp),
        contactType
      });
      return json({ ok: false, message: 'Некорректный тип контакта.' }, 400);
    }

    if (!isValidName(name)) {
      console.warn('[VALIDATION] Invalid name', {
        requestId,
        ip: maskIp(clientIp),
        nameLength: name.length
      });
      return json({ ok: false, message: 'Некорректное имя.' }, 400);
    }

    if (contactType === 'telegram' && !isValidTelegram(contact)) {
      console.warn('[VALIDATION] Invalid telegram', {
        requestId,
        ip: maskIp(clientIp),
        contactPreview: maskContact(contact, contactType)
      });
      return json({ ok: false, message: 'Некорректный Telegram.' }, 400);
    }

    if (contactType === 'phone' && !isValidPhone(contact)) {
      console.warn('[VALIDATION] Invalid phone', {
        requestId,
        ip: maskIp(clientIp),
        contactPreview: maskContact(contact, contactType)
      });
      return json({ ok: false, message: 'Некорректный номер телефона.' }, 400);
    }

    if (contactType === 'email' && !isValidEmail(contact)) {
      console.warn('[VALIDATION] Invalid email', {
        requestId,
        ip: maskIp(clientIp),
        contactPreview: maskContact(contact, contactType)
      });
      return json({ ok: false, message: 'Некорректный email.' }, 400);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.error('[CONFIG] Missing Telegram env vars', {
        requestId,
        hasBotToken: Boolean(env.TELEGRAM_BOT_TOKEN),
        hasChatId: Boolean(env.TELEGRAM_CHAT_ID)
      });
      return json({ ok: false, message: 'Не настроены переменные окружения на сервере.' }, 500);
    }

    const text = [
      'Новая заявка с сайта Breakcode',
      '',
      `Имя: ${escapeHtml(name)}`,
      `${escapeHtml(contactTypeLabel || contactType)}: ${escapeHtml(contact)}`,
      `Задача: ${escapeHtml(message || 'Не указана')}`,
      `Страница: ${escapeHtml(page || '—')}`
    ].join('\n');

    const tgResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          chat_id: env.TELEGRAM_CHAT_ID,
          text
        })
      }
    );

    const tgResult = await tgResponse.json().catch(() => null);

    if (!tgResponse.ok || !tgResult?.ok) {
      console.error('[TELEGRAM] Send failed', {
        requestId,
        status: tgResponse.status,
        description: trimLog(tgResult?.description || '', 200),
        errorCode: tgResult?.error_code || null
      });
      return json({ ok: false, message: 'Ошибка отправки в Telegram.' }, 502);
    }

    console.log('[LEAD] Sent successfully', {
      requestId,
      ip: maskIp(clientIp),
      contactType,
      page: trimLog(page || '—', 180)
    });

    return json({ ok: true, message: 'Заявка отправлена. Скоро свяжемся с вами.' }, 200);
  } catch (error) {
    console.error('[SERVER] Unhandled lead error', {
      requestId,
      ip: maskIp(clientIp),
      error: trimLog(String(error?.message || error), 240)
    });
    return json({ ok: false, message: 'Ошибка обработки формы.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set([
    requestOrigin,
    'https://breakcode.ru',
    'https://www.breakcode.ru'
  ]);

  return allowedOrigins.has(origin);
}

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const history = ipRateLimitStore.get(ip) || [];
  const freshHistory = history.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (freshHistory.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRateLimitStore.set(ip, freshHistory);
    return false;
  }

  freshHistory.push(now);
  ipRateLimitStore.set(ip, freshHistory);

  if (ipRateLimitStore.size > 500) {
    for (const [key, timestamps] of ipRateLimitStore.entries()) {
      const active = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
      if (active.length) {
        ipRateLimitStore.set(key, active);
      } else {
        ipRateLimitStore.delete(key);
      }
    }
  }

  return true;
}

function normalizeText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function isValidName(name) {
  return /^[A-Za-zА-Яа-яЁё\s]{3,}$/.test(name);
}

function isValidTelegram(contact) {
  return /^@[A-Za-z0-9_]{4,32}$/.test(contact);
}

function isValidPhone(contact) {
  const digits = contact.replace(/\D/g, '');
  return /^7\d{10}$/.test(digits);
}

function isValidEmail(contact) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
}

function maskIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';

  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + ':****';
  }

  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  return 'masked';
}

function maskContact(contact, type) {
  if (!contact) return '';

  if (type === 'email') {
    const [namePart, domain] = contact.split('@');
    if (!domain) return '***';
    return `${(namePart || '').slice(0, 2)}***@${domain}`;
  }

  if (type === 'phone') {
    const digits = contact.replace(/\D/g, '');
    return digits.length >= 4 ? `***${digits.slice(-4)}` : '***';
  }

  if (type === 'telegram') {
    return contact.length > 4 ? `${contact.slice(0, 3)}***` : '***';
  }

  return '***';
}

function trimLog(value, maxLength = 120) {
  const normalized = String(value || '').replace(/\s{2,}/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength) + '…';
}
