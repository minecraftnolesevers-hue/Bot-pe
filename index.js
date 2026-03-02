const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// 1. CẤU HÌNH HỆ THỐNG
const CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID, 
    MC_HOST: process.env.MC_HOST, 
    MC_PORT: parseInt(process.env.MC_PORT) || 19132, 
    MC_USER: process.env.MC_USER || 'Bot_Render_Vip',
    MC_VER: process.env.MC_VER || '1.20.10'
};

// 2. WEB SERVER (Giữ Render không tắt bot)
const app = express();
app.get('/', (req, res) => res.send('Bot Minecraft PE đang hoạt động!'));
app.listen(process.env.PORT || 3000);

// 3. DISCORD CLIENT
const discordClient = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent 
]});

let bot;

// 4. HÀM KHỞI TẠO BOT
function startBot() {
    if (bot) {
        bot.removeAllListeners();
        try { bot.quit(); } catch (e) {}
    }

    console.log('🔄 Đang kết nối đến Minecraft...');
    
    bot = mineflayer.createBot({
        host: CONFIG.MC_HOST,
        port: CONFIG.MC_PORT,
        username: CONFIG.MC_USER,
        version: CONFIG.MC_VER,
        viewDistance: 2, // Tối ưu RAM cho Render
        checkTimeoutInterval: 90000
    });

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log('✅ Bot đã vào game!');
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.allowParkour = true; // Cho phép bot nhảy qua khe hở
        bot.pathfinder.setMovements(movements);
    });

    // --- XỬ LÝ CHAT TRONG GAME (Lệnh COME) ---
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        
        // Gửi tin nhắn từ game về Discord
        const channel = discordClient.channels.cache.get(CONFIG.CHANNEL_ID);
        if (channel) channel.send(`💬 **[MC] ${username}:** ${message}`);

        // Lệnh COME: Bot đi đến vị trí người chat
        if (message.toLowerCase() === 'come') {
            const player = bot.players[username];
            if (player && player.entity) {
                const target = player.entity.position;
                bot.chat(`Đang đến chỗ của ${username}...`);
                // GoalNear(x, y, z, khoảng cách dừng lại)
                bot.pathfinder.setGoal(new goals.GoalNear(target.x, target.y, target.z, 1));
            } else {
                bot.chat('Mình không thấy bạn, hãy lại gần mình hơn!');
            }
        }
    });

    bot.on('error', (err) => console.log('⚠️ Lỗi:', err.message));
    bot.on('end', () => {
        console.log('❌ Mất kết nối, đang thử lại...');
        setTimeout(startBot, 15000);
    });
}

// 5. LỆNH TỪ DISCORD (Lệnh !SLEEP và !STATUS)
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== CONFIG.CHANNEL_ID) return;
    const msg = message.content.toLowerCase();

    // Lệnh Status
    if (msg === '!status') {
        const usage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        message.reply(`❤️ HP: ${bot?.health || 0} | 📊 RAM: ${usage}MB/512MB`);
    }

    // Chat vào game
    if (msg.startsWith('!chat ')) {
        const content = message.content.slice(6);
        bot?.chat(content);
        message.react('✅');
    }

    // Lệnh NGỦ (!sleep)
    if (msg === '!sleep') {
        const bed = bot.findBlock({
            matching: block => bot.isABed(block),
            maxDistance: 10
        });

        if (bed) {
            message.reply('🛏️ Đã tìm thấy giường, đang di chuyển đến để ngủ...');
            const p = bed.position;
            // Đi tới giường
            bot.pathfinder.setGoal(new goals.GoalGetToBlock(p.x, p.y, p.z));
            
            // Khi đến nơi thì ngủ
            bot.once('goal_reached', async () => {
                try {
                    await bot.sleep(bed);
                    message.reply('😴 Bot đã đi ngủ!');
                } catch (err) {
                    message.reply(`❌ Không thể ngủ: ${err.message}`);
                }
            });
        } else {
            message.reply('❌ Không tìm thấy giường nào trong bán kính 10 ô!');
        }
    }
});

// Kiểm tra RAM để tránh sập Render
setInterval(() => {
    if ((process.memoryUsage().heapUsed / 1024 / 1024) > 420) {
        console.log('♻️ RAM quá cao, khởi động lại bot...');
        bot?.quit();
    }
}, 60000);

// CHẠY HỆ THỐNG
startBot();
discordClient.login(CONFIG.DISCORD_TOKEN);
