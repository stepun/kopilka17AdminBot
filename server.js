const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Авторизованные админы (ID в переменных окружения)
const ADMIN_IDS = (process.env.ADMIN_IDS || '120962578').split(',').map(id => parseInt(id.trim()));

// PostgreSQL подключение (та же база что и у основного бота)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/savings_bot',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для проверки прав админа
function requireAdmin(req, res, next) {
  const telegramInitData = req.headers['x-telegram-init-data'];

  if (!telegramInitData) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const initData = new URLSearchParams(telegramInitData);
    const user = JSON.parse(initData.get('user') || '{}');

    if (!ADMIN_IDS.includes(user.id)) {
      return res.status(403).json({ error: 'Access denied. Admin rights required.' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authorization data' });
  }
}

// API Routes

// Статистика общая
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM goals WHERE is_active = true) as active_goals,
        (SELECT COUNT(*) FROM goals WHERE is_active = false) as completed_goals,
        (SELECT SUM(current_amount) FROM goals WHERE is_active = true) as total_saved,
        (SELECT SUM(target_amount) FROM goals WHERE is_active = true) as total_target,
        (SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours') as transactions_today
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Список пользователей
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT
        u.*,
        COUNT(g.id) as goals_count,
        SUM(g.current_amount) as total_saved
      FROM users u
      LEFT JOIN goals g ON u.id = g.user_id AND g.is_active = true
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json(users.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Список всех целей
app.get('/api/admin/goals', requireAdmin, async (req, res) => {
  try {
    const goals = await pool.query(`
      SELECT
        g.*,
        u.first_name,
        u.username,
        u.telegram_id
      FROM goals g
      JOIN users u ON g.user_id = u.id
      ORDER BY g.created_at DESC
      LIMIT 100
    `);

    res.json(goals.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Транзакции
app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
  try {
    const transactions = await pool.query(`
      SELECT
        t.*,
        g.name as goal_name,
        u.first_name,
        u.username
      FROM transactions t
      JOIN goals g ON t.goal_id = g.id
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 100
    `);

    res.json(transactions.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Логи активности
app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  try {
    const activity = await pool.query(`
      SELECT
        al.*,
        u.first_name,
        u.username
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 50
    `);

    res.json(activity.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Информация об администраторе
app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json(req.adminUser);
});

// Главная страница админки
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Admin panel running on port ${PORT}`);
  console.log(`Authorized admins: ${ADMIN_IDS.join(', ')}`);
});