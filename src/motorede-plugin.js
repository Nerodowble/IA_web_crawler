import 'dotenv/config';
import { GeminiBrowser } from './gemini-browser.js';

/**
 * Plugin de IA do MotoRede.
 *
 * Mesmo modelo do plugin de música: este computador fica atrás do roteador e
 * ninguém o chama de fora. É ELE quem pergunta ao MotoRede, a cada 5 s, "tem
 * tarefa para mim?". Cada tarefa traz um prompt pronto (montado pelo
 * MotoRede); a resposta do Gemini volta como veio, e o MotoRede valida.
 *
 *   POST {MOTOREDE_URL}/api/plugins
 *     { acao: 'aguardar', plugin, chave }          → { tarefas: [{ id, prompt }] }
 *     { acao: 'concluir', plugin, chave, id, resposta? }  (sem resposta = falhou)
 *
 * Perguntar também marca a IA como "no ar" no MotoRede por 20 s: com este
 * programa desligado, o app mostra "fora do ar" em vez de esperar à toa.
 *
 * Rodar: npm run plugin. Configuração no .env (ver .env.example).
 */

const MOTOREDE_URL = (process.env.MOTOREDE_URL || 'https://motorede-web.vercel.app').replace(/\/$/, '');
const PLUGIN_ID = process.env.MOTOREDE_PLUGIN_ID || 'ia';
const CHAVE = process.env.MOTOREDE_PLUGIN_CHAVE;
const INTERVALO_MS = 5_000;

if (!CHAVE) {
  console.error('Falta MOTOREDE_PLUGIN_CHAVE no .env (a mesma registrada em MOTOREDE_PLUGINS na Vercel).');
  process.exit(1);
}

const log = (texto) => console.log(`[${new Date().toLocaleString('pt-BR')}] ${texto}`);

async function api(corpo) {
  const r = await fetch(`${MOTOREDE_URL}/api/plugins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plugin: PLUGIN_ID, chave: CHAVE, ...corpo }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const erro = new Error(json.error || `MotoRede respondeu ${r.status}`);
    erro.status = r.status;
    throw erro;
  }
  return json;
}

const gemini = new GeminiBrowser();
const fila = [];
let processando = false;
let avisouFalha = false;
let rodando = true;

/** Uma tarefa por vez: o navegador tem uma página só. */
async function processar() {
  if (processando) return;
  processando = true;
  while (rodando && fila.length > 0) {
    const tarefa = fila.shift();
    const inicio = Date.now();
    let resposta = null;
    try {
      resposta = await gemini.ask(tarefa.prompt, { novaConversa: true });
    } catch (e) {
      log(`  a IA falhou: ${e.message}`);
    }
    try {
      const { resultado } = await api({ acao: 'concluir', id: tarefa.id, resposta: resposta || undefined });
      log(`  tarefa ${tarefa.id.slice(0, 8)} → ${resultado} (${Math.round((Date.now() - inicio) / 1000)} s)`);
    } catch (e) {
      log(`  não consegui entregar a tarefa ${tarefa.id.slice(0, 8)}: ${e.message}`);
    }
  }
  processando = false;
}

async function perguntar() {
  try {
    const { tarefas = [] } = await api({ acao: 'aguardar' });
    if (avisouFalha) log('Conexão com o MotoRede de volta.');
    avisouFalha = false;
    for (const t of tarefas) {
      if (typeof t?.id !== 'string' || typeof t?.prompt !== 'string') continue;
      log(`Tarefa recebida ${t.id.slice(0, 8)}.`);
      fila.push(t);
    }
    void processar();
  } catch (e) {
    if (e.status === 401) {
      log('O MotoRede recusou id + chave. Confira MOTOREDE_PLUGIN_ID e MOTOREDE_PLUGIN_CHAVE no .env.');
    } else if (!avisouFalha) {
      log(`Sem resposta do MotoRede: ${e.message}`);
    }
    avisouFalha = true;
  }
}

log(`Plugin de IA "${PLUGIN_ID}" ligado → ${MOTOREDE_URL}`);
log('Aguardando tarefas. Ctrl+C para desligar.');

// O laço de perguntar não espera a IA: enquanto ela pensa (até 2 min), o
// MotoRede continua vendo este computador como "no ar".
(async () => {
  while (rodando) {
    await perguntar();
    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
})();

async function desligar() {
  rodando = false;
  log('Desligando.');
  await gemini.close();
  process.exit(0);
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
