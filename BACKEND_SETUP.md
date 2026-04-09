# Backend setup for Telegram leads

## Где добавить переменные
Cloudflare Dashboard → Workers & Pages → ваш проект → Settings → Environment variables

## Добавить:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

После добавления сделайте redeploy проекта.

## Как это работает
Форма отправляет POST-запрос на `/api/lead`, а серверная функция Cloudflare Pages Functions уже отправляет сообщение в Telegram.