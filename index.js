const bedrock = require('bedrock-protocol');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// 1. CẤU HÌNH BIẾN MÔI TRƯỜNG
const CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID,
    MC_HOST: process.env.MC_HOST,
    MC_PORT: parseInt(process.env.MC_PORT) || 19132,
    MC_USER: process.env.MC_USER || 'Bot_PE_247',
    MC_VER: process.env.MC_VER || '1.20.10'
};

// 2. WEB SERVER GIỮ RENDER SỐNG
const app = express();
app.get('/', (req, res) => res.send('Bot PE Protocol đang chạy 24/7!'));
app.listen(process.env.PORT || 3000, () => console.log('✅ Port Web đã mở'));

// 3. KHỞI TẠO DISCORD
const discordClient = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
]});

let client;

// 4. HÀM CHẠY BOT MINECRAFT PE
function startBot() {
    console.log(`🔄 Đang kết nối đến ${CONFIG.MC_HOST}...`);

    client = bedrock.createClient({
        host: CONFIG.MC_HOST,
        port: CONFIG.MC_PORT,
        username: CONFIG.MC_USER,
        offline: true, // Đặt true cho server lậu/Aternos
        version: CONFIG.MC_VER
    });

    // Khi bot vào game
    client.on('spawn', () => {
        console.log('✅ Bot đã xuất hiện trong Server!');
        sendToDiscord('✅ **Bot đã vào game thành công!**');
        
        // Chống bị kick Idle (Nhảy nhẹ mỗi 30s)
        setInterval(() => {
            if (client) {
                client.write('player_auth_input', {
                    pitch: 0, yaw: 0,
                    position: { x: 0, y: 0.1, z: 0 },
                    move_vector: { x: 0, z: 0 },
                    input_data: { jump_down: true },
                    input_mode: 'generic', play_mode: 'normal'
                });
            }
        }, 30000);
    });

    // Chat từ Game -> Discord
    client.on('text', (packet) => {
        if (packet.source_name === CONFIG.MC_USER || !packet.message) return;
        sendToDiscord(`💬 **[MC] ${packet.source_name}:** ${packet.message}`);
    });

    client.on('error', (err) => console.log('⚠️ Lỗi:', err.message));
    client.on('close', () => {
        console.log('❌ Kết nối đóng. Thử lại sau 15 giây...');
        setTimeout(startBot, 15000);
    });
}

// Hàm gửi tin nhắn qua Discord
function sendToDiscord(msg) {
    const channel = discordClient.channels.cache.get(CONFIG.CHANNEL_ID);
    if (channel) channel.send(msg);
}

// 5. ĐIỀU KHIỂN TỪ DISCORD
discordClient.on('messageCreate', (message) => {
    if (message.author.bot || message.channel.id !== CONFIG.CHANNEL_ID) return;
    const msg = message.content.toLowerCase();

    // --- LỆNH !HELP ---
    if (msg === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📜 Danh sách lệnh Bot Minecraft PE')
            .setDescription('Dưới đây là các lệnh bạn có thể dùng để điều khiển bot từ Discord:')
            .setColor(0x00AE86)
            .addFields(
                { name: '💬 !chat [nội dung]', value: 'Gửi tin nhắn vào trong game Minecraft.', inline: false },
                { name: '👥 !players', value: 'Xem danh sách những người đang online trong server.', inline: true },
                { name: '📍 !coords', value: 'Lấy tọa độ X, Y, Z hiện tại của bot.', inline: true },
                { name: '🖥️ !cmd [lệnh]', value: 'Chạy lệnh server (Ví dụ: !cmd time set day).', inline: false },
                { name: '📊 !status', value: 'Kiểm tra tình trạng RAM và kết nối của bot trên Render.', inline: true },
                { name: '👋 Game Command', value: 'Chat `come` trong game để bot đi đến chỗ bạn (Chỉ dùng được nếu bot có plugin di chuyển).', inline: false }
            )
            .setFooter({ text: 'Bot đang chạy 24/7 trên Render' })
            .setTimestamp();

        message.reply({ embeds: [helpEmbed] });
    }
        // --- LỆNH !RECONNECT ---
    if (msg === '!reconnect') {
        message.reply('🔄 Đang khởi động lại kết nối bot...');
        startBot(); // Gọi lại hàm khởi tạo để ép reconnect
    }
    
    // Lệnh Chat vào game
    if (msg.startsWith('!chat ')) {
        const content = message.content.slice(6);
        client.queue('text', {
            type: 'chat', needs_translation: false, source_name: client.username,
            xuid: '', platform_chat_id: '', message: content
        });
        message.react('✅');
    }

    // Lệnh xem danh sách người chơi
    if (msg === '!players') {
        const players = Object.values(client.players || {}).map(p => p.username).join(', ');
        message.reply(`👥 Người chơi online: ${players || 'Chỉ có mình bot'}`);
    }

    // Lệnh lấy tọa độ
    if (msg === '!coords') {
        const pos = client.entity?.position || {x: 0, y: 0, z: 0};
        message.reply(`📍 X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}, Z: ${Math.round(pos.z)}`);
    }

    // Lệnh chạy Command Server (Cần OP)
    if (msg.startsWith('!cmd ')) {
        const command = message.content.slice(5);
        client.write('command_request', {
            command: `/${command}`,
            origin: { type: 'player', uuid: '', request_id: '' },
            internal: false
        });
        message.reply(`🖥️ Đã gửi lệnh: /${command}`);
    }

    // Lệnh kiểm tra RAM
    if (msg === '!status') {
        const ram = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        message.reply(`📟 RAM sử dụng: ${ram}MB / 512MB`);
    }
});

startBot();
discordClient.login(CONFIG.DISCORD_TOKEN);
