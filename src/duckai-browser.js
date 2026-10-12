import { chromium } from 'playwright';

export class DuckAIBrowser {
  browser = null;
  context = null;
  page = null;
  queue = Promise.resolve();
  started = false;

  async start() {
    if (this.page && !this.page.isClosed()) return this.page;

    const headless = String(process.env.DUCKAI_HEADLESS ?? 'false').toLowerCase() !== 'false';
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext({ viewport: { width: 1440, height: 900 } });
    const initialCookies = await this.context.cookies();
    console.log(`[Duck.ai] cookies antes do carregamento: ${initialCookies.length}`);
    console.log(`[Duck.ai] modo: ANÔNIMO`);
    this.page = await this.context.newPage();
    this.started = true;
    await this.page.goto('https://duck.ai/', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2500);
    console.log(`[Duck.ai] cookies após carregamento: ${(await this.context.cookies()).length}`);
    console.log(`[Duck.ai] perfil persistente carregado: não`);
    console.log(`[Duck.ai] título: ${await this.page.title().catch(() => 'sem título')}`);
    console.log(`[Duck.ai] URL: ${this.page.url()}`);
    return this.page;
  }

  async ask(message) {
    const task = this.queue.then(() => this.askNow(message));
    this.queue = task.catch(() => {});
    return task;
  }

  async askNow(message) {
    const page = await this.start();
    console.log('[Duck.ai] aguardando campo de mensagem...');
    const input = await this.findInput(page);
    if (!input) {
      const title = await page.title().catch(() => 'sem título');
      const bodyPreview = (await page.locator('body').innerText().catch(() => ''))
        .replace(/\s+/g, ' ').trim().slice(0, 240);
      console.log(`[Duck.ai] diagnóstico: título="${title}"`);
      console.log(`[Duck.ai] diagnóstico: texto inicial="${bodyPreview}"`);
      const error = new Error('O Duck.ai não disponibilizou o campo de mensagem.');
      error.code = 'INPUT_NOT_FOUND';
      throw error;
    }
    console.log('[Duck.ai] campo de mensagem encontrado.');

    const before = await this.responseTexts(page);
    await input.fill(message);
    const send = page.locator(
      'button[type="submit"], button[aria-label*="Send" i], button[aria-label*="Enviar" i], [data-testid*="send" i]'
    ).last();
    if (await send.isVisible().catch(() => false)) await send.click();
    else await input.press('Enter');
    console.log('[Duck.ai] mensagem enviada; aguardando confirmação inicial...');
    await page.waitForTimeout(1000);
    await this.acceptConsent(page);
    return this.waitForNewResponse(page, before);
  }

  async acceptConsent(page) {
    const selectors = [
      'button[aria-label="Continuar"]',
      'button[aria-label="Continue"]',
      'button:has-text("Continuar")',
      'button:has-text("Continue")'
    ];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      for (const frame of page.frames()) {
        for (const selector of selectors) {
          const consent = frame.locator(selector).first();
          if (await consent.isVisible().catch(() => false)) {
            console.log(`[Duck.ai] confirmação de termos encontrada (${selector}); clicando.`);
            await consent.click();
            await page.waitForTimeout(1000);
            return;
          }
        }
      }
      await page.waitForTimeout(500);
    }
  }

  async findInput(page) {
    const selector = 'textarea:visible, [contenteditable="true"]:visible, [role="textbox"]:visible';
    for (let attempt = 0; attempt < 30; attempt += 1) {
      for (const frame of page.frames()) {
        const input = frame.locator(selector).first();
        if (await input.isVisible().catch(() => false)) return input;
      }
      await page.waitForTimeout(1000);
    }
    return null;
  }

  async responseTexts(page) {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant" i]',
      '[data-testid*="response" i]',
      'main article'
    ];
    for (const selector of selectors) {
      const texts = await page.locator(selector).allInnerTexts().catch(() => []);
      if (texts.length) return texts.map((text) => text.trim()).filter(Boolean);
    }
    return [];
  }

  async waitForNewResponse(page, before) {
    try {
      await page.waitForFunction(
        ({ selectors, previous }) => selectors.some((selector) => {
          const texts = [...document.querySelectorAll(selector)]
            .map((node) => node.innerText?.trim() || '').filter(Boolean);
          return texts.length > previous && texts.at(-1).length > 0;
        }),
        { selectors: [
          '[data-message-author-role="assistant"]',
          '[data-testid*="assistant" i]',
          '[data-testid*="response" i]',
          'main article'
        ], previous: before.length },
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
      const error = new Error('O Duck.ai não respondeu dentro do tempo limite.');
      error.code = 'TIMEOUT';
      throw error;
    }
  }

  async close() {
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
  }
}
