const mineflayer = require('mineflayer');
const { bedrock } = require('mineflayer-bedrock'); // Cây cầu nối PE
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// 1. CẤU HÌNH (Lấy từ Environment Variables trên Render)
const CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID, 
    MC_HOST: process.env.MC_HOST, 
    MC_PORT: parseInt(process.env.MC_PORT) || 19132, 
    MC_USER: process.env.MC_USER || 'Bot_PE_Vip',
    MC_VER: process.env.MC_VER || '1.20.10' 
};

// 2. WEB SERVER (Giữ Render không ngủ)
const app = express();
app.get('/', (req, res) => res.send('Bot PE đang chạy!'));
app.listen(process.env.PORT || 3000);

// 3. DISCORD CLIENT
const discordClient = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent 
]});

let bot;

// 4. HÀM KHỞI TẠO BOT
function runBot() {
    if (bot) {
        bot.removeAllListeners();
        try { bot.quit(); } catch (e) {}
    }

    console.log(`🔄 Đang kết nối PE đến ${CONFIG.MC_HOST}...`);
    
    bot = mineflayer.createBot({
        host: CONFIG.MC_HOST,
        port: CONFIG.MC_PORT,
        username: CONFIG.MC_USER,
        version: CONFIG.MC_VER,
        viewDistance: 2
    });

    // KÍCH HOẠT GIAO THỨC BEDROCK (Để fix lỗi 26.1)
    bedrock(bot); 

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log('✅ Bot PE đã vào game thành công!');
        const mcData = require('minecraft-data')(bot.version);
        bot.pathfinder.setMovements(new Movements(bot, mcData));
    });

    // --- TÍNH NĂNG THEO NGƯỜI (COME) ---
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        
        const channel = discordClient.channels.cache.get(CONFIG.CHANNEL_ID);
        if (channel) channel.send(`💬 **[MC] ${username}:** ${message}`);

        if (message.toLowerCase() === 'come') {
            const player = bot.players[username];
            if (player && player.entity) {
                bot.chat(`Đang đến chỗ ${username}...`);
                bot.pathfinder.setGoal(new goals.GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 1));
            }
        }
    });

    bot.on('end', () => setTimeout(runBot, 15000));
    bot.on('error', (err) => console.log('⚠️ Lỗi:', err.message));
}

// 5. DISCORD COMMANDS (NGỦ & STATUS)
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== CONFIG.CHANNEL_ID) return;
    const msg = message.content.toLowerCase();

    if (msg === '!status') {
        message.reply(`❤️ HP: ${bot?.health || 0} | 📟 RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }

    if (msg.startsWith('!chat ')) {
        bot?.chat(message.content.slice(6));
        message.react('✅');
    }

    if (msg === '!sleep') {
        const bed = bot.findBlock({ matching: block => bot.isABed(block), maxDistance: 10 });
        if (bed) {
            bot.pathfinder.setGoal(new goals.GoalGetToBlock(bed.position.x, bed.position.y, bed.position.z));
            bot.once('goal_reached', async () => {
                try { await bot.sleep(bed); message.reply('😴 Bot đã ngủ!'); }
                catch (e) { message.reply('❌ Không thể ngủ bây giờ.'); }
            });
        } else { message.reply('❌ Không thấy giường!'); }
    }
});

runBot();
discordClient.login(CONFIG.DISCORD_TOKEN);
