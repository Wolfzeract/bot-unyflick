const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
app.use(express.json());

// Porta que o Render usa
const PORT = process.env.PORT || 3000;

let sock;

async function connectToWhatsApp() {
    // Salva a sessão na pasta 'auth_info' (Atenção: No Render Free isso reseta se o server reiniciar)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // O QR Code vai aparecer nos "Logs" do site da Render
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            console.log("QR CODE GERADO (Veja nos Logs): ", qr);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão caiu. Reconectando...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO!');
        }
    });
}

// Rota para o UnyFlick chamar
app.post('/enviar', async (req, res) => {
    const { numero, mensagem } = req.body;
    
    if (!sock) {
        return res.status(503).json({ error: "Bot ainda conectando..." });
    }

    try {
        const id = '55' + numero.replace(/\D/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(id, { text: mensagem });
        res.json({ status: 'Enviado com sucesso' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar' });
    }
});

// Rota para manter acordado (Ping)
app.get('/', (req, res) => res.send('🤖 Bot UnyFlick Online'));

connectToWhatsApp();

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
