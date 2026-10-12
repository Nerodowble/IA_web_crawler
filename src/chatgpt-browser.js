import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ChatGPTBrowser {
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
      const profileDir = path.join(__dirname, '..', '.chatgpt-profile');
      this.context = await chromium.launchPersistentContext(profileDir, {
        headless,
        viewport: { width: 1440, height: 900 }
      });
    }

    const initialCookies = await this.context.cookies();
    console.log(`[ChatGPT] cookies antes do carregamento: ${initialCookies.length}`);
    this.page = this.context.pages()[0] || await this.context.newPage();
    this.started = true;
    await this.page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
    await this.logSessionState(initialCookies.length);
    return this.page;
  }

  async logSessionState(initialCookieCount) {
    const cookies = await this.context.cookies();
    const accountIndicator = await this.page.locator(
      '[aria-label*="Account" i], [aria-label*="conta" i], [data-testid*="profile" i]'
    ).count().catch(() => 0);
    console.log(`[ChatGPT] modo: ${this.anonymous ? 'ANÔNIMO' : 'PERFIL PERSISTENTE'}`);
    console.log(`[ChatGPT] cookies após carregamento: ${cookies.length}`);
    console.log(`[ChatGPT] perfil persistente carregado: ${this.anonymous ? 'não' : 'sim'}`);
    console.log(`[ChatGPT] cookies pré-existentes: ${initialCookieCount}`);
    console.log(`[ChatGPT] sessão: ${accountIndicator > 0 ? 'indicador de conta encontrado' : 'nenhum indicador de conta encontrado'}`);
    console.log(`[ChatGPT] URL: ${this.page.url()}`);
  }

  async ask(message) {
    const task = this.queue.then(() => this.askNow(message));
    this.queue = task.catch(() => {});
    return task;
  }

  async askNow(message) {
    const page = await this.start();
    const input = page.locator(
      '#prompt-textarea:visible, textarea:visible, [contenteditable="true"]:visible, [role="textbox"]:visible'
    ).first();
    try {
      await input.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      const title = await page.title().catch(() => 'sem título');
      const bodyPreview = (await page.locator('body').innerText().catch(() => ''))
        .replace(/\s+/g, ' ').trim().slice(0, 240);
      console.log(`[ChatGPT] diagnóstico: título="${title}"`);
      console.log(`[ChatGPT] diagnóstico: texto inicial="${bodyPreview}"`);
      const error = new Error('O ChatGPT não disponibilizou o campo de mensagem. Verifique o diagnóstico acima: pode ser bloqueio de login, região ou alteração da interface.');
      error.code = 'LOGIN_REQUIRED';
      throw error;
    }

    const before = await this.responseTexts(page);
    await input.fill(message);
    const send = page.locator(
      'button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Enviar" i]'
    ).first();
    if (await send.isVisible().catch(() => false)) await send.click();
    else await input.press('Enter');
    return this.waitForNewResponse(page, before);
  }

  async responseTexts(page) {
    return page.locator('[data-message-author-role="assistant"]')
      .allInnerTexts().catch(() => []);
  }

  async waitForNewResponse(page, before) {
    try {
      await page.waitForFunction(
        (previous) => {
          const texts = [...document.querySelectorAll('[data-message-author-role="assistant"]')]
            .map((node) => node.innerText?.trim() || '').filter(Boolean);
          return texts.length > previous.length && texts.at(-1).length > 0;
        },
        before,
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
      const error = new Error('O ChatGPT não respondeu dentro do tempo limite.');
      error.code = 'TIMEOUT';
      throw error;
    }
  }

  async close() {
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
  }
}
