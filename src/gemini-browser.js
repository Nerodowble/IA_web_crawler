import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class GeminiBrowser {
  browser = null;
  context = null;
  page = null;
  queue = Promise.resolve();
  started = false;
  anonymous = false;

  async start() {
    if (this.page && !this.page.isClosed()) return this.page;
    const headless = String(process.env.HEADLESS ?? 'true').toLowerCase() !== 'false';
    this.anonymous = String(process.env.ANONYMOUS ?? 'true').toLowerCase() === 'true';
    if (this.anonymous) {
      this.browser = await chromium.launch({ headless });
      this.context = await this.browser.newContext({ viewport: { width: 1440, height: 900 } });
    } else {
      const profileDir = path.join(__dirname, '..', '.browser-profile');
      this.context = await chromium.launchPersistentContext(profileDir, {
        headless,
        viewport: { width: 1440, height: 900 }
      });
    }
    const initialCookies = await this.context.cookies();
    console.log(`[Gemini] cookies antes do carregamento: ${initialCookies.length}`);
    this.page = this.context.pages()[0] || await this.context.newPage();
    this.started = true;
    await this.page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
    await this.logSessionState(initialCookies.length);
    return this.page;
  }

  async logSessionState(initialCookieCount) {
    const cookies = await this.context.cookies();
    const accountIndicator = await this.page.locator(
      '[aria-label*="Google Account" i], [aria-label*="Conta do Google" i], [data-email]'
    ).count().catch(() => 0);
    const mode = this.anonymous ? 'ANÃ”NIMO' : 'PERFIL PERSISTENTE';
    const account = accountIndicator > 0 ? 'indicador de conta encontrado' : 'nenhum indicador de conta encontrado';
    console.log(`[Gemini] modo: ${mode}`);
    console.log(`[Gemini] cookies apÃ³s carregamento: ${cookies.length}`);
    console.log(`[Gemini] perfil persistente carregado: ${this.anonymous ? 'nÃ£o' : 'sim'}`);
    console.log(`[Gemini] cookies prÃ©-existentes: ${initialCookieCount}`);
    console.log(`[Gemini] sessÃ£o: ${account}`);
    console.log(`[Gemini] URL: ${this.page.url()}`);
  }

  async ask(message, { novaConversa = false } = {}) {
    const task = this.queue.then(() => this.askNow(message, novaConversa));
    this.queue = task.catch(() => {});
    return task;
  }

  async askNow(message, novaConversa = false) {
    const page = await this.start();
    // Conversa nova: a resposta não herda o contexto da pergunta anterior.
    if (novaConversa) await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
    await this.ensureLoggedIn(page);
    const before = await this.responseTexts(page);
    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.fill(message);

    const send = page.locator(
      'button[aria-label*="Send" i], button[aria-label*="Enviar" i], [data-testid*="send" i]'
    ).first();
    if (await send.isVisible().catch(() => false)) await send.click();
    else await input.press('Enter');
    return this.waitForNewResponse(page, before);
  }

  async ensureLoggedIn(page) {
    if (page.url().includes('accounts.google.com')) {
      const error = new Error('A página do Gemini redirecionou para o login.');
      error.code = 'LOGIN_REQUIRED';
      throw error;
    }

    const input = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
    try {
      await input.waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      const error = new Error(`O campo de mensagem do Gemini não apareceu. URL atual: ${page.url()}`);
      error.code = 'GEMINI_INPUT_UNAVAILABLE';
      throw error;
    }
  }
  async responseTexts(page) {
    return page.locator('message-content, .model-response-text, [data-message-author-role="model"]')
      .allInnerTexts().catch(() => []);
  }

  async waitForNewResponse(page, before) {
    try {
      await page.waitForFunction(
        ({ selectors, previous }) => {
          const nodes = [...document.querySelectorAll(selectors)];
          const texts = nodes.map((node) => node.innerText?.trim() || '').filter(Boolean);
          return texts.length > previous.length && texts.at(-1).length > 0;
        },
        { selectors: 'message-content, .model-response-text, [data-message-author-role="model"]', previous: before },
        { timeout: 120000 }
      );

      let last = '';
      let stable = 0;
      for (let i = 0; i < 30; i += 1) {
        await page.waitForTimeout(500);
        const current = (await this.responseTexts(page)).at(-1) || '';
        if (current === last && current) stable += 1;
        else stable = 0;
        last = current;
        if (stable >= 3) return current;
      }
      return last;
    } catch {
      const error = new Error('O Gemini nÃ£o respondeu dentro do tempo limite.');
      error.code = 'TIMEOUT';
      throw error;
    }
  }

  async close() {
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
  }
}
