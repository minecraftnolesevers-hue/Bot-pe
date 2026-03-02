const mineflayer = require('mineflayer');
const { bedrock } = require('mineflayer-bedrock');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder'); // Thêm goals
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// ==========================================
// 1. CẤU HÌNH HỆ THỐNG
// ==========================================
const CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID, 
    MC_HOST: process.env.MC_HOST, 
    MC_PORT: parseInt(process.env.MC_PORT) || 19132, 
    MC_USER: process.env.MC_USER || 'Bot_Render_Vip',
    MC_VER: process.env.MC_VER || '1.20.10'
};

const app = express();
app.get('/', (req, res) => res.send('Bot Minecraft PE đang hoạt động!'));
app.listen(process.env.PORT || 3000, () => console.log(`✅ Web Server Ready`));

const discordClient = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent 
]});

let bot;

// ==========================================
// 4. HÀM KHỞI TẠO BOT
// ==========================================
function createBot() {
    if (bot) {
        bot.removeAllListeners();
        try { bot.quit(); } catch (e) {}
    }

    bot = mineflayer.createBot({
        host: CONFIG.MC_HOST,
        port: CONFIG.MC_PORT,
        username: CONFIG.MC_USER,
        version: CONFIG.MC_VER,
        viewDistance: 2, 
        checkTimeoutInterval: 90000
    });

    bedrock(bot); 
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log('✅ Bot đã vào game!');
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.allowParkour = true;
        bot.pathfinder.setMovements(movements);
        
        bot._client.write('set_chunk_cache_radius', { radius: 2 });
    });

    // --- TÍNH NĂNG ĐI THEO KHI CHAT "COME" TRONG GAME ---
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        
        // Log chat về Discord
        const channel = discordClient.channels.cache.get(CONFIG.CHANNEL_ID);
        if (channel) channel.send(`💬 **[MC] ${username}:** ${message}`);

        if (message.toLowerCase() === 'come') {
            const target = bot.players[username]?.entity;
            if (!target) {
                bot.chat('Mình không thấy bạn ở đâu cả!');
                return;
            }
            const p = target.position;
            bot.pathfinder.setGoal(new goals.GoalNear(p.x, p.y, p.z, 1));
            bot.chat(`Đang đến chỗ của ${username}...`);
        }
    });

    bot.on('error', (err) => console.log('⚠️ Lỗi:', err.message));
    bot.on('end', () => setTimeout(createBot, 15000));
}

// ==========================================
// 5. LỆNH TỪ DISCORD (Bao gồm !sleep)
// ==========================================
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== CONFIG.CHANNEL_ID) return;
    const msg = message.content.toLowerCase();

    // Lệnh Status
    if (msg === '!status') {
        const usage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        message.reply(`📊 RAM: ${usage}MB/512MB | ❤️ HP: ${bot?.health || 0}`);
    }

    // Lệnh Chat
    if (msg.startsWith('!chat ')) {
        bot?.chat(message.content.slice(6));
        message.react('✅');
    }

    // Lệnh !sleep (Tìm giường và ngủ)
    if (msg === '!sleep') {
        const mcData = require('minecraft-data')(bot.version);
        const bed = bot.findBlock({
            matching: block => bot.isABed(block),
            maxDistance: 10
        });

        if (bed) {
            const p = bed.position;
            bot.pathfinder.setGoal(new goals.GoalGetToBlock(p.x, p.y, p.z));
            
            // Đợi bot di chuyển tới giường rồi mới ngủ
            bot.once('goal_reached', async () => {
                try {
                    await bot.sleep(bed);
                    message.reply('🛏️ Bot đang ngủ...');
                } catch (err) {
                    message.reply(`❌ Lỗi khi ngủ: ${err.message}`);
                }
            });
        } else {
            message.reply('❌ Không tìm thấy giường trong phạm vi 10 ô!');
        }
    }
});

// Kiểm tra RAM định kỳ
setInterval(() => {
    if ((process.memoryUsage().heapUsed / 1024 / 1024) > 420) {
        bot?.quit();
    }
}, 60000);

createBot();
discordClient.login(CONFIG.DISCORD_TOKEN);
