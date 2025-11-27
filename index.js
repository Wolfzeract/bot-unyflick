const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // Importante para desenhar o QR Code

const app = express();
app.use(express.json());

// O Render define a porta automaticamente
const PORT = process.env.PORT || 3000;

let sock;

async function connectToWhatsApp() {
    // Salva a sessão na pasta 'auth_info'
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Desligamos o nativo que estava falhando
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // AQUI ESTÁ A MÁGICA: Se tiver QR Code, desenha ele na marra!
        if(qr) {
            console.log("\n\n>>> ESCANEIE O QR CODE ABAIXO RAPIDAMENTE: <<<\n");
            qrcode.generate(qr, { small: true });
            console.log("\n====================================================\n");
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão caiu. Reconectando...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ SUCESSO: BOT CONECTADO E PRONTO PARA COBRAR!');
        }
    });
}

// Rota que o UnyFlick vai chamar
app.post('/enviar', async (req, res) => {
    const { numero, mensagem } = req.body;
    
    if (!sock) {
        return res.status(503).json({ error: "Bot ainda conectando..." });
    }

    try {
        // Formata o número (55 + DDD + numero)
        const id = '55' + numero.replace(/\D/g, '') + '@s.whatsapp.net';
        
        await sock.sendMessage(id, { text: mensagem });
        console.log(`Mensagem enviada para ${numero}`);
        res.json({ status: 'Enviado com sucesso' });
    } catch (e) {
        console.error("Erro ao enviar:", e);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Rota para manter o bot acordado
app.get('/', (req, res) => res.send('🤖 Bot UnyFlick Online e Pronto!'));

// Inicia o bot
connectToWhatsApp();

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
