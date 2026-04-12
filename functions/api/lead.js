const MAX_BODY_BYTES = 12_000;
const MAX_NAME_LENGTH = 80;
const MAX_CONTACT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 500;
const ALLOWED_CONTACT_TYPES = new Set(['telegram', 'phone', 'email']);

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return json({ ok: false, message: 'Неверный формат запроса.' }, 415);
    }

    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength && contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, message: 'Слишком большой запрос.' }, 413);
    }

    if (!isAllowedOrigin(request)) {
      return json({ ok: false, message: 'Недопустимый источник запроса.' }, 403);
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
      return json({ ok: false, message: 'Некорректный тип контакта.' }, 400);
    }

    if (!isValidName(name)) {
      return json({ ok: false, message: 'Некорректное имя.' }, 400);
    }

    if (contactType === 'telegram' && !isValidTelegram(contact)) {
      return json({ ok: false, message: 'Некорректный Telegram.' }, 400);
    }

    if (contactType === 'phone' && !isValidPhone(contact)) {
      return json({ ok: false, message: 'Некорректный номер телефона.' }, 400);
    }

    if (contactType === 'email' && !isValidEmail(contact)) {
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
      return json({
        ok: false,
        message: 'Ошибка отправки в Telegram.',
        debug: tgResult
      }, 502);
    }

    console.log('[LEAD] Sent successfully', {
      requestId,
      ip: maskIp(clientIp),
      contactType,
      page: trimLog(page || '—', 180)
    });

    return json({ ok: true, message: 'Заявка отправлена. Скоро свяжемся с вами.' }, 200);
  } catch (error) {
    return json({
      ok: false,
      message: 'Ошибка обработки формы.',
      debug: String(error?.message || error)
    }, 500);
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
