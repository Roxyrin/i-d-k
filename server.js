const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Токен вашего Telegram-бота (если не задан, включится режим локальной разработки)
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const PORT = process.env.PORT || 3000;

// База данных в памяти (хранит пользователей и их инвентарь)
const users = new Map();

// Каталог NFT-подарков / маркет
const marketItems = [
    { id: 1, name: 'Big Year #13736', price: 40000, dailyYield: 4, icon: '🎁' },
    { id: 2, name: 'Ginger Cookie #9931', price: 130000, dailyYield: 6, icon: '🍪' },
    { id: 3, name: 'Love Potion #5771', price: 135000, dailyYield: 6, icon: '🔮' },
    { id: 4, name: 'Kissed Frog #12019', price: 45000, dailyYield: 6, icon: '👑' }
];

/**
 * Валидация подписи initData от Telegram Mini App
 */
function verifyTelegramWebAppData(initData, botToken) {
    if (!initData) return false;
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
            
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        
        return calculatedHash === hash;
    } catch (e) {
        return false;
    }
}

/**
 * Middleware авторизации
 */
const authMiddleware = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];

    // Если токен не настроен или данных нет — для теста пускаем как дефолтного юзера
    if (BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN' || !initData) {
        req.user = { id: 12345678, username: 'roxy_eyes' };
        return next();
    }

    if (!verifyTelegramWebAppData(initData, BOT_TOKEN)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Telegram signature' });
    }
    
    const urlParams = new URLSearchParams(initData);
    const user = JSON.parse(urlParams.get('user'));
    req.user = user;
    next();
};

/* ==================== API МАРШРУТЫ ==================== */

// 1. Получить профиль и баланс
app.get('/api/user', authMiddleware, (req, res) => {
    let user = users.get(req.user.id);
    if (!user) {
        user = { 
            id: req.user.id, 
            username: req.user.username || 'Player', 
            balance: 6000000, // Стартовый баланс Айсов
            inventory: [] 
        };
        users.set(req.user.id, user);
    }
    res.json(user);
});

// 2. Получить список товаров на маркете
app.get('/api/market', (req, res) => {
    res.json(marketItems);
});

// 3. Купить предмет в маркете
app.post('/api/market/buy', authMiddleware, (req, res) => {
    const { itemId } = req.body;
    let user = users.get(req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const item = marketItems.find(i => i.id === itemId);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }

    if (user.balance < item.price) {
        return res.status(400).json({ error: 'Недостаточно Айсов' });
    }

    user.balance -= item.price;
    user.inventory.push({ ...item, purchasedAt: new Date().toISOString() });
    users.set(req.user.id, user);

    res.json({ success: true, balance: user.balance, inventory: user.inventory });
});

// 4. Логика мини-игр (серверный расчет победы/поражения)
app.post('/api/games/play', authMiddleware, (req, res) => {
    const { gameType, betAmount } = req.body;
    let user = users.get(req.user.id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!betAmount || betAmount <= 0 || user.balance < betAmount) {
        return res.status(400).json({ error: 'Некорректная ставка' });
    }

    user.balance -= betAmount;

    // Шанс выигрыша 48%
    const win = Math.random() < 0.48;
    let payout = 0;

    if (win) {
        payout = betAmount * 2;
        user.balance += payout;
    }

    users.set(req.user.id, user);

    res.json({ win, payout, balance: user.balance, gameType });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
