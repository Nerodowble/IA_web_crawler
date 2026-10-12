import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GeminiBrowser } from './gemini-browser.js';
import { ChatGPTBrowser } from './chatgpt-browser.js';
import { DuckAIBrowser } from './duckai-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const defaultProvider = (process.env.PROVIDER || 'gemini').toLowerCase();
const providers = {
  gemini: new GeminiBrowser(),
  chatgpt: new ChatGPTBrowser(),
  duckai: new DuckAIBrowser()
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const remoteAccessToken = process.env.REMOTE_ACCESS_TOKEN || '';
const authenticateRemote = (req, res, next) => {
  if (!remoteAccessToken) {
    return res.status(503).json({ error: 'Acesso remoto não configurado.' });
  }
  const supplied = req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedBuffer = Buffer.from(remoteAccessToken);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(401).json({ error: 'Token ausente ou inválido.' });
  }
  next();
};

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    defaultProvider,
    providers: Object.fromEntries(Object.entries(providers).map(([name, instance]) => [name, {
      browserStarted: instance.started
    }]))
  });
});

app.post('/api/chat', authenticateRemote, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!message) {
    return res.status(400).json({ error: 'Envie uma mensagem em "message".' });
  }

  if (message.length > 12000) {
    return res.status(413).json({ error: 'A mensagem deve ter no máximo 12.000 caracteres.' });
  }

  const provider = typeof req.body?.provider === 'string'
    ? req.body.provider.toLowerCase()
    : defaultProvider;
  const aiBrowser = providers[provider];
  if (!aiBrowser) {
    return res.status(400).json({ error: 'Provedor inválido. Use "gemini", "chatgpt" ou "duckai".' });
  }

  try {
    const answer = await aiBrowser.ask(message);
    return res.json({ answer, provider: `${provider}-web` });
  } catch (error) {
    console.error(error);
    const status = error.code === 'LOGIN_REQUIRED' ? 428 : error.code === 'TIMEOUT' ? 504 : 502;
    return res.status(status).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor disponível em http://localhost:${port}`);
  console.log('O navegador do provedor escolhido será aberto quando chegar a primeira mensagem.');
});

const shutdown = async () => {
  await Promise.all(Object.values(providers).map((provider) => provider.close()));
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
