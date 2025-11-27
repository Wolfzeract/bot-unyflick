const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // Adicionado para garantir o QR

const app = express();
app.use(express.json());

// O Render define a porta automaticamente, ou usa a 3000
const PORT = process.env.PORT || 3000;

let sock;

async function connectToWhatsApp() {
    // Cria pasta de autenticação
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Desativamos o nativo que estava dando erro
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            // AQUI ESTÁ A CORREÇÃO: Gerar o QR manualmente
            console.log("\n\nSCANEAR O QR CODE ABAIXO:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão caiu. Reconectando...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO COM SUCESSO!');
        }
    });
}

// Rota para o UnyFlick enviar mensagem
app.post('/enviar', async (req, res) => {
    const { numero, mensagem } = req.body;
    
    if (!sock) {
        return res.status(503).json({ error: "Bot ainda conectando..." });
    }

    try {
        // Formata número para padrão internacional (55 + DDD + numero)
        const id = '55' + numero.replace(/\D/g, '') + '@s.whatsapp.net';
        
        // Envia a mensagem
        await sock.sendMessage(id, { text: mensagem });
        
        console.log(`Mensagem enviada para ${numero}`);
        res.json({ status: 'Enviado com sucesso' });
    } catch (e) {
        console.error("Erro ao enviar:", e);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Rota de Saúde (Ping) para manter acordado
app.get('/', (req, res) => res.send('🤖 Bot UnyFlick Online e Pronto!'));

// Inicia tudo
connectToWhatsApp();

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
