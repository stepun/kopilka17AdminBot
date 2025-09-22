const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.ADMIN_BOT_TOKEN;
const adminAppUrl = process.env.ADMIN_APP_URL || 'https://your-admin-app.railway.app';

// Авторизованные админы
const ADMIN_IDS = (process.env.ADMIN_IDS || '120962578').split(',').map(id => parseInt(id.trim()));

const bot = new TelegramBot(token);

function handleAdminBotMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'Админ';

  console.log('🔧 ADMIN BOT - User:', { id: userId, name: firstName });

  // Проверка прав админа
  if (!ADMIN_IDS.includes(userId)) {
    bot.sendMessage(chatId, '🚫 У вас нет прав администратора');
    return;
  }

  if (msg.text === '/start') {
    if (adminAppUrl.startsWith('https://')) {
      const keyboard = {
        inline_keyboard: [[
          {
            text: '🔧 Открыть админ панель',
            web_app: { url: adminAppUrl }
          }
        ]]
      };

      bot.sendMessage(
        chatId,
        `Добро пожаловать в админ панель, ${firstName}! 👨‍💼\n\n🔧 Управляйте системой "Копилка"\n📊 Просматривайте статистику\n👥 Мониторьте пользователей\n\nНажмите кнопку ниже для доступа:`,
        { reply_markup: keyboard }
      );
    } else {
      bot.sendMessage(
        chatId,
        `Админ панель готова! 🔧\n\n📱 Интерфейс: ${adminAppUrl}\n\n⚠️ Для Mini App нужен HTTPS домен.`
      );
    }
  } else if (msg.text && !msg.text.startsWith('/')) {
    if (adminAppUrl.startsWith('https://')) {
      const keyboard = {
        inline_keyboard: [[
          {
            text: '🔧 Открыть админ панель',
            web_app: { url: adminAppUrl }
          }
        ]]
      };

      bot.sendMessage(
        chatId,
        'Используйте кнопку ниже для доступа к админ панели:',
        { reply_markup: keyboard }
      );
    } else {
      bot.sendMessage(
        chatId,
        '🔧 Админ панель: ' + adminAppUrl + '\n\n⚠️ Для Mini App нужен HTTPS домен.'
      );
    }
  }
}

// Webhook endpoint для админ бота
function setupAdminWebhook(app) {
  app.post('/admin-webhook', (req, res) => {
    const update = req.body;

    if (update.message) {
      handleAdminBotMessage(update.message);
    }

    res.sendStatus(200);
  });
}

module.exports = {
  setupAdminWebhook,
  bot
};