# API local de IA via scraping de navegador

Projeto que expõe uma API local e automatiza interfaces web de IA com Playwright. O servidor abre um Chromium headless, preenche o chat e captura a resposta renderizada na página. Não usa APIs oficiais dos provedores.

## Como executar

1. Instale o Node.js 20 ou superior.
2. Instale as dependências e o Chromium:

   ```bash
   npm install
   npm run browser:install
   ```

3. Execute:

   ```bash
   npm run dev
   ```

4. Abra http://localhost:3000 e envie uma mensagem. O navegador roda em modo headless por padrão.

Para renovar a sessão manualmente, defina `HEADLESS=false` no `.env`, execute o servidor, faça login e depois volte para `HEADLESS=true`.

O modo anônimo é o padrão (`ANONYMOUS=true`): não carrega `.browser-profile`, não reutiliza cookies e não exige conta do servidor. O Google permite algumas interações de texto sem login, mas essa disponibilidade pode variar por região e por recurso. Se o Gemini exigir autenticação, a requisição retornará um erro claro, pois o site não oferece acesso anônimo naquele ambiente.

Ao iniciar o navegador, o terminal informa o modo usado, a quantidade de cookies carregados, a URL e se encontrou um indicador visual de conta. Em modo anônimo, a confirmação principal é `modo: ANÔNIMO`: o Playwright cria um contexto novo sem carregar o perfil persistente.

## Endpoint

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Explique o que é web scraping em duas frases."}'
```

O endpoint devolve `{ "answer": "...", "provider": "gemini-web" }`. O frontend possui um seletor para alternar entre Gemini, ChatGPT e Duck.ai por mensagem. Também é possível escolher diretamente via JSON:

```json
{ "provider": "chatgpt", "message": "Olá" }
```

Para usar o Duck.ai:

```json
{ "provider": "duckai", "message": "Olá" }
```

O Duck.ai sempre usa uma sessão anônima sem perfil persistente.

## Acesso remoto temporário para testes

No Windows, execute `scripts\iniciar-remoto.ps1`. O script inicia a API e cria um túnel temporário Cloudflare. O endereço muda quando o túnel reinicia. O endpoint `/api/chat` exige o token Bearer guardado em `.remote-access-token`; mantenha esse arquivo privado. Exemplo para o sistema cliente:

```http
POST https://SEU-ENDERECO.trycloudflare.com/api/chat
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

```json
{ "message": "Explique web scraping em uma frase." }
```

O túnel é para desenvolvimento e testes, não para produção nem disponibilidade contínua.

O Duck.ai roda em modo visível por padrão para facilitar a inspeção da confirmação inicial. Para ocultar essa janela depois, use `DUCKAI_HEADLESS=true`.

Para definir o ChatGPT como provedor padrão, altere o `.env`:

```env
PROVIDER=chatgpt
ANONYMOUS=true
```

O seletor do frontend permite trocar o provedor sem reiniciar o servidor. O ChatGPT pode permitir uso sem conta em regiões suportadas, mas mantém uma única conversa enquanto estiver deslogado. [Documentação oficial da OpenAI](https://help.openai.com/en/articles/9125172-the-chatgpt-home-page)

A sessão do navegador é armazenada localmente em `.browser-profile/`, que está no `.gitignore`. Não compartilhe essa pasta, pois ela contém os dados da sessão autenticada.

## Próximos passos

Os seletores da interface podem mudar quando o Gemini for atualizado. Se isso acontecer, ajuste os seletores em `src/gemini-browser.js`. Automatize somente uma conta e uma página cujo uso permita esse tipo de automação, respeitando os limites e os termos aplicáveis.
