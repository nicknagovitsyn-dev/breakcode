export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const name = String(body?.name || '').trim();
    const contact = String(body?.contact || '').trim();
    const contactType = String(body?.contactType || '').trim();
    const contactTypeLabel = String(body?.contactTypeLabel || '').trim();
    const message = String(body?.message || '').trim();
    const page = String(body?.page || '').trim();

    if (!name || !contact || !contactType) {
      return json({ ok: false, message: 'Не заполнены обязательные поля.' }, 400);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
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

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text
        })
      }
    );

    const telegramResult = await telegramResponse.json().catch(() => null);

    if (!telegramResponse.ok || !telegramResult?.ok) {
      return json({ ok: false, message: 'Ошибка отправки в Telegram.' }, 502);
    }

    return json({ ok: true, message: 'Заявка отправлена. Скоро свяжемся с вами.' }, 200);
  } catch (error) {
    return json({ ok: false, message: 'Ошибка обработки формы.' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store'
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}