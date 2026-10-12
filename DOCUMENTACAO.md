# Projeto de automação de chats de IA via navegador

## 1. Visão geral

Este projeto expõe uma API HTTP local para conversar com interfaces web de serviços de inteligência artificial por meio de automação de navegador.

O projeto não utiliza as APIs oficiais dos provedores. Em vez disso, o Playwright abre uma sessão de navegador, acessa a página pública do serviço, preenche o campo de mensagem, aciona o envio e captura a resposta renderizada na página.

O fluxo principal é:

```text
Cliente HTTP ou frontend
          |
          v
POST /api/chat
          |
          v
Seleciona o provedor
          |
          v
Playwright abre o navegador
          |
          v
Página web do provedor
          |
          v
Campo preenchido e mensagem enviada
          |
          v
Resposta renderizada capturada
          |
          v
JSON devolvido ao cliente
```

O frontend local permite selecionar o provedor por mensagem. Atualmente, os provedores cadastrados são:

| Provedor | Situação | Sessão usada | Execução headless |
|---|---|---|---|
| Gemini Web | Validado | Anônima por padrão ou perfil persistente opcional | Funciona no cenário validado |
| ChatGPT Web | Experimental | Anônima por padrão ou perfil persistente opcional | Bloqueado por Cloudflare no teste |
| Duck.ai | Experimental | Sempre anônima | CAPTCHA/Cloudflare no teste |

Para o cenário definido neste projeto — sem API oficial, sem conta logada, sem GPU local e execução em servidor — o Gemini Web é o único provedor validado.

## 2. Objetivo do projeto

O objetivo é criar uma camada própria de acesso que permita a outros sistemas requisitarem respostas de um modelo de IA usando um endpoint HTTP local.

O projeto foi pensado para:

- testar automação de interfaces web de IA;
- disponibilizar uma API simples para aplicações próprias;
- evitar expor uma chave de API no frontend;
- selecionar provedores diferentes sem alterar o cliente;
- funcionar em uma máquina sem GPU, usando o processamento remoto do provedor web;
- permitir evolução posterior para captura de páginas, resumo e análise de conteúdo.

O projeto não é um SDK oficial de nenhum dos provedores. A interface web, os seletores HTML e as regras de acesso podem mudar a qualquer momento.

## 3. Estrutura de arquivos

```text
IA_web_crawler/
├── .env.example
├── .gitignore
├── DOCUMENTACAO.md
├── README.md
├── package.json
├── public/
│   └── index.html
└── src/
    ├── chatgpt-browser.js
    ├── duckai-browser.js
    ├── gemini-browser.js
    └── server.js
```

### `src/server.js`

É o servidor HTTP principal. Ele:

- inicializa o Express;
- serve o frontend estático;
- expõe `GET /health`;
- expõe `POST /api/chat`;
- valida a mensagem recebida;
- escolhe o provedor solicitado;
- mantém uma instância independente de cada navegador;
- encerra os contextos do Playwright quando o processo recebe sinal de encerramento.

### `src/gemini-browser.js`

Implementa o adaptador do Gemini Web. Ele controla:

- abertura de `https://gemini.google.com/app`;
- modo anônimo com contexto novo;
- modo persistente com `.browser-profile`;
- detecção básica da disponibilidade da interface;
- preenchimento do campo de mensagem;
- clique no botão de envio ou uso da tecla Enter;
- captura progressiva da última resposta;
- logs da sessão.

### `src/chatgpt-browser.js`

Implementa o adaptador experimental do ChatGPT Web. O endereço usado é `https://chatgpt.com/`.

O adaptador possui suporte aos mesmos conceitos gerais do Gemini, mas o teste realizado encontrou a página `Just a moment...`, indicando uma verificação do Cloudflare antes da interface do chat. Por isso, o ChatGPT não está validado para execução headless sem supervisão.

### `src/duckai-browser.js`

Implementa o adaptador experimental do Duck.ai. O endereço usado é `https://duck.ai/`.

O Duck.ai exige uma confirmação inicial dos termos de privacidade e serviço. O código tenta clicar automaticamente no botão `button[aria-label="Continuar"]` após o envio da primeira mensagem. Durante os testes, entretanto, o serviço também apresentou CAPTCHA/Cloudflare.

Por esse motivo, o Duck.ai permanece útil para inspeção manual, mas não é considerado um provedor automático confiável neste momento.

### `public/index.html`

É a interface de teste. Ela contém:

- seletor de provedor;
- campo de mensagem;
- botão de envio;
- área para resposta;
- mensagens de status;
- chamada `fetch` para `POST /api/chat`.

### `.env.example`

Contém as variáveis de ambiente disponíveis sem incluir segredos.

### `.browser-profile/` e `.chatgpt-profile/`

Esses diretórios são usados apenas quando o modo persistente é habilitado. Eles estão no `.gitignore` porque podem conter cookies e dados de sessão.

## 4. Tecnologias

- Node.js 20 ou superior;
- Express 5;
- Playwright;
- Chromium instalado pelo Playwright;
- HTML, CSS e JavaScript no frontend;
- `dotenv` para carregar variáveis do arquivo `.env`.

## 5. Instalação

### 5.1 Pré-requisitos

Instale o Node.js 20 ou superior. Confirme a instalação:

```bash
node --version
npm --version
```

### 5.2 Dependências

Na raiz do projeto:

```bash
npm install
```

### 5.3 Navegador do Playwright

Instale o Chromium usado pelo Playwright:

```bash
npm run browser:install
```

### 5.4 Configuração

Copie o arquivo de exemplo:

No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Prompt de Comando:

```cmd
copy .env.example .env
```

Para o cenário atualmente validado, o `.env` pode conter:

```env
PORT=3000
HEADLESS=true
ANONYMOUS=true
PROVIDER=gemini
DUCKAI_HEADLESS=false
```

Não existe chave de API do Gemini, ChatGPT ou Duck.ai no projeto.

### 5.5 Inicialização

Modo de desenvolvimento:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

Abra no navegador:

```text
http://localhost:3000
```

## 6. Variáveis de ambiente

### `PORT`

Porta HTTP do servidor.

Valor padrão:

```env
PORT=3000
```

### `HEADLESS`

Controla o modo do Gemini e do ChatGPT.

Valores:

```env
HEADLESS=true
HEADLESS=false
```

Com `true`, a janela do navegador não é exibida. Com `false`, uma janela visível é aberta para inspeção ou login manual.

### `ANONYMOUS`

Controla se Gemini e ChatGPT usam contexto novo ou perfil persistente.

Modo anônimo:

```env
ANONYMOUS=true
```

Nesse modo:

- o Playwright cria um navegador novo;
- cookies anteriores não são carregados;
- nenhum perfil local é reutilizado;
- não é necessário armazenar uma conta no servidor.

Modo persistente:

```env
ANONYMOUS=false
```

Nesse modo, o Gemini usa `.browser-profile` e o ChatGPT usa `.chatgpt-profile`. Esses diretórios podem armazenar dados de uma sessão autenticada e devem ser protegidos.

### `PROVIDER`

Define o provedor padrão quando o corpo da requisição não informa outro.

Valores aceitos:

```env
PROVIDER=gemini
PROVIDER=chatgpt
PROVIDER=duckai
```

O frontend sempre envia o provedor escolhido no seletor.

### `DUCKAI_HEADLESS`

Controla exclusivamente o modo do Duck.ai.

O padrão é visível para facilitar a investigação do CAPTCHA e da confirmação inicial:

```env
DUCKAI_HEADLESS=false
```

Para tentar o Duck.ai em modo invisível:

```env
DUCKAI_HEADLESS=true
```

Essa variável não altera o modo do Gemini ou do ChatGPT.

## 7. Endpoint `GET /health`

O endpoint de saúde verifica se o servidor está funcionando e informa se cada navegador já foi inicializado.

Requisição:

```bash
curl http://localhost:3000/health
```

Exemplo de resposta:

```json
{
  "ok": true,
  "defaultProvider": "gemini",
  "providers": {
    "gemini": {
      "browserStarted": false
    },
    "chatgpt": {
      "browserStarted": false
    },
    "duckai": {
      "browserStarted": false
    }
  }
}
```

O navegador só é aberto quando chega a primeira mensagem daquele provedor.

## 8. Endpoint `POST /api/chat`

### 8.1 Requisição mínima

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Explique web scraping em duas frases.\"}"
```

Nesse caso, o provedor usado é o definido em `PROVIDER`.

### 8.2 Escolhendo o Gemini

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"gemini\",\"message\":\"Mensagem de teste\"}"
```

### 8.3 Escolhendo o ChatGPT

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"chatgpt\",\"message\":\"Mensagem de teste\"}"
```

Este provedor é experimental e pode retornar erro caso o Cloudflare bloqueie o navegador.

### 8.4 Escolhendo o Duck.ai

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"duckai\",\"message\":\"Mensagem de teste\"}"
```

Este provedor é experimental e pode exibir confirmação inicial ou CAPTCHA.

### 8.5 Corpo da requisição

```json
{
  "provider": "gemini",
  "message": "Mensagem de teste"
}
```

Campos:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `provider` | string | não | `gemini`, `chatgpt` ou `duckai`. Se ausente, usa `PROVIDER`. |
| `message` | string | sim | Texto enviado ao campo do chat. |

O servidor rejeita mensagens vazias e mensagens maiores que 12.000 caracteres.

### 8.6 Resposta de sucesso

```json
{
  "answer": "Web scraping é o processo de extrair dados de páginas web de forma automatizada.",
  "provider": "gemini-web"
}
```

### 8.7 Respostas de erro

Mensagem ausente:

```http
400 Bad Request
```

Provedor inválido:

```json
{
  "error": "Provedor inválido. Use \"gemini\", \"chatgpt\" ou \"duckai\"."
}
```

Login necessário ou interface indisponível:

```http
428 Precondition Required
```

Tempo limite:

```http
504 Gateway Timeout
```

Falha do navegador ou da página:

```http
502 Bad Gateway
```

## 9. Frontend

O frontend está em `public/index.html` e é servido automaticamente pelo Express.

Ao enviar o formulário, o navegador faz uma chamada semelhante a:

```javascript
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: provider.value,
    message: message.value
  })
});
```

O frontend não recebe cookies do provedor, não recebe credenciais e não executa diretamente a automação. A chave do processo é o backend, que mantém o controle do Playwright.

## 10. Como o modo anônimo funciona

No modo anônimo, o adaptador chama o Playwright com `chromium.launch()` e cria um contexto novo com `browser.newContext()`.

Esse contexto não utiliza:

- `.browser-profile`;
- `.chatgpt-profile`;
- cookies antigos;
- armazenamento local anterior;
- sessão de uma conta Google ou OpenAI.

O site ainda pode criar cookies técnicos durante o carregamento. Por isso, o número de cookies depois da abertura pode ser maior que zero mesmo no modo anônimo. O indicador importante é:

```text
cookies pré-existentes: 0
perfil persistente carregado: não
```

No Gemini, um log válido do cenário anônimo é semelhante a:

```text
[Gemini] cookies antes do carregamento: 0
[Gemini] modo: ANÔNIMO
[Gemini] cookies após carregamento: 2
[Gemini] perfil persistente carregado: não
[Gemini] cookies pré-existentes: 0
[Gemini] sessão: nenhum indicador de conta encontrado
```

## 11. Logs do Gemini

O adaptador do Gemini registra:

- quantidade de cookies antes do carregamento;
- modo anônimo ou perfil persistente;
- quantidade de cookies após o carregamento;
- se um perfil persistente foi carregado;
- presença de um indicador visual de conta;
- URL final da página.

Esses logs não são uma prova absoluta de autenticação, mas permitem verificar se o processo carregou ou não um perfil local.

## 12. Logs do ChatGPT

O adaptador do ChatGPT registra informações equivalentes. Durante o teste foi observado:

```text
[ChatGPT] título="Just a moment..."
```

Esse título significa que a página ficou em uma etapa de verificação do Cloudflare antes de carregar o campo de mensagem. O problema não foi falta de login nem um simples seletor errado.

## 13. Logs do Duck.ai

O adaptador do Duck.ai informa:

```text
[Duck.ai] cookies antes do carregamento: 0
[Duck.ai] modo: ANÔNIMO
[Duck.ai] perfil persistente carregado: não
[Duck.ai] título: Duck.ai by DuckDuckGo. Private AI chat. Free.
[Duck.ai] aguardando campo de mensagem...
```

Na primeira conversa, o Duck.ai pode apresentar uma caixa informando que o usuário aceita a Política de Privacidade e os Termos de Serviço ao clicar em “Continuar”.

O código tenta localizar:

```css
button[aria-label="Continuar"]
```

e também as variantes em inglês e por texto visível. Essa confirmação aparece depois que a primeira mensagem é enviada, por isso o código aguarda um segundo antes de procurar o botão.

Durante o teste, o Duck.ai também apresentou CAPTCHA/Cloudflare. Isso impede que ele seja considerado confiável para execução headless e sem supervisão.

## 14. Por que o Gemini é o provedor principal

O Gemini foi o único provedor testado que atendeu simultaneamente às condições desejadas:

- acesso pela interface web;
- interação sem usar a API oficial;
- modo anônimo;
- ausência de conta persistente;
- execução headless;
- resposta capturada pelo Playwright.

O comportamento pode mudar devido a alterações no site, disponibilidade regional, limites de uso ou alterações nos seletores HTML.

## 15. Limitações conhecidas

### 15.1 Alterações de interface

Os adaptadores dependem de elementos da página, como:

- `textarea`;
- elementos `contenteditable`;
- `role="textbox"`;
- botões com `aria-label`;
- atributos `data-testid`;
- elementos usados para identificar respostas.

Se o provedor alterar esses elementos, o fluxo pode parar mesmo que a página continue funcionando manualmente.

### 15.2 Cloudflare e CAPTCHA

Cloudflare e outros sistemas anti automação podem bloquear:

- Chromium headless;
- endereços IP de servidores;
- automação repetitiva;
- navegadores sem histórico;
- padrões de navegação automatizados.

O projeto não tenta burlar CAPTCHA ou mascarar automação. Quando há bloqueio, o comportamento correto é registrar o diagnóstico e informar que o provedor está indisponível para aquele modo de execução.

### 15.3 Limites anônimos

Uma sessão anônima pode ter limites menores, uma única conversa, ausência de histórico e restrições de recursos. O site pode solicitar login no futuro, mesmo que tenha funcionado anteriormente sem conta.

### 15.4 Concorrência

Cada adaptador possui uma fila interna e processa uma mensagem por vez. Isso evita que duas requisições misturem seus textos e respostas na mesma conversa.

Esse mecanismo não é uma fila distribuída. Se o servidor for executado em várias instâncias, cada instância terá seu próprio navegador e sua própria fila.

### 15.5 Estado da conversa

No modo anônimo, as mensagens enviadas na mesma página podem permanecer na conversa atual. O adaptador não implementa ainda uma conversa independente por requisição.

Para isolamento completo, seria necessário abrir um contexto ou uma página nova a cada chamada, o que aumentaria o tempo e o consumo de recursos.

### 15.6 Falhas de rede

A rede do servidor precisa alcançar o domínio do provedor e carregar seus recursos JavaScript. Bloqueios de firewall, DNS, proxy, VPN ou regras do ambiente podem impedir o carregamento.

## 16. Solução de problemas

### O navegador não abre

Confirme a instalação do Chromium:

```bash
npm run browser:install
```

Confirme também a instalação das dependências:

```bash
npm install
```

### O servidor inicia, mas a resposta não chega

Verifique:

1. se o provedor selecionado é o esperado;
2. se a URL carregou no log;
3. se o campo de mensagem foi encontrado;
4. se apareceu uma mensagem de confirmação, CAPTCHA ou login;
5. se a página manual funciona no mesmo computador;
6. se o tempo limite de 120 segundos foi atingido.

### O Gemini pede login

Verifique se:

```env
ANONYMOUS=true
```

Depois reinicie o servidor. Em algumas regiões ou situações, o Gemini pode exigir uma conta para determinados recursos.

### O log mostra perfil persistente

Verifique se o arquivo `.env` contém:

```env
ANONYMOUS=false
```

Para o modo anônimo, altere para:

```env
ANONYMOUS=true
```

Também é necessário reiniciar o processo Node.js, porque as variáveis são lidas durante a inicialização.

### O ChatGPT mostra `Just a moment...`

Isso indica bloqueio ou verificação do Cloudflare. O ChatGPT não é considerado disponível para o fluxo headless automático neste projeto.

### O Duck.ai mostra CAPTCHA

O CAPTCHA impede a execução automática confiável. O modo visível pode ser usado para inspeção manual, mas não há garantia de funcionamento em servidor headless.

### O endpoint retorna `428`

Esse status significa que o provedor não disponibilizou a interface necessária, geralmente por login, CAPTCHA, bloqueio regional ou alteração da página.

### O endpoint retorna `504`

O provedor não produziu uma resposta dentro do tempo de espera. Verifique a conexão e os logs do navegador.

## 17. Segurança

### Sessões persistentes

Nunca publique ou envie estes diretórios para um repositório:

```text
.browser-profile/
.chatgpt-profile/
```

Eles podem conter cookies de autenticação.

### Endpoint sem autenticação

O servidor atual é destinado a uso local e não possui autenticação própria. Se for exposto à rede, qualquer cliente que alcance a porta poderá enviar mensagens ao provedor.

Antes de publicar o serviço, adicione pelo menos:

- autenticação da sua própria API;
- limite de requisições;
- registro de uso;
- validação de origem;
- proxy reverso com HTTPS;
- limites de tamanho e tempo;
- controle de concorrência;
- proteção contra abuso.

### Conteúdo enviado

As mensagens são enviadas para o provedor web escolhido. Não envie senhas, tokens, dados pessoais ou informações confidenciais sem compreender as políticas do serviço.

### Conteúdo retornado

A resposta da IA deve ser tratada como conteúdo não confiável. O frontend atual a apresenta como texto dentro de `pre`, mas integrações futuras devem evitar inserir a resposta diretamente como HTML.

## 18. Web scraping futuro

O próximo passo possível é adicionar uma camada que:

1. receba uma URL autorizada;
2. faça o download ou abra a página;
3. extraia o conteúdo relevante;
4. remova menus, anúncios e elementos repetidos;
5. limite o tamanho do texto;
6. envie o conteúdo ao Gemini;
7. devolva resumo, classificação ou resposta estruturada.

Um desenho possível seria:

```text
POST /api/scrape-and-ask
          |
          +--> valida URL
          +--> acessa página permitida
          +--> extrai texto
          +--> cria prompt
          +--> Gemini Web
          +--> devolve resposta
```

O crawler deve respeitar:

- autorização do proprietário do site;
- `robots.txt` quando aplicável;
- termos de serviço;
- limites de requisição;
- direitos autorais;
- dados pessoais;
- páginas que exigem login;
- áreas privadas ou protegidas.

## 19. Próximas melhorias técnicas

### Prioridade alta

- adicionar autenticação ao endpoint local;
- adicionar rate limit;
- separar logs por requisição;
- incluir um identificador de requisição;
- impedir chamadas simultâneas excessivas;
- adicionar testes de integração com uma página mock local;
- melhorar a identificação de respostas do Gemini.

### Prioridade média

- suportar histórico explícito de mensagens;
- criar botão para limpar conversa;
- permitir seleção de instrução de sistema quando o site suportar;
- criar respostas em streaming;
- adicionar persistência local de logs;
- adicionar configuração de timeout;
- criar painel de status dos provedores.

### Prioridade futura

- crawler autorizado;
- extração com Cheerio ou Playwright;
- fila com Redis ou banco de dados;
- múltiplos workers;
- implantação em servidor;
- observabilidade com métricas;
- fallback automático para outro provedor validado.

## 20. Validação realizada

Os arquivos JavaScript principais foram validados sintaticamente com:

```bash
node --check src/server.js
node --check src/gemini-browser.js
node --check src/chatgpt-browser.js
node --check src/duckai-browser.js
```

O fluxo Gemini foi validado com:

- navegador headless;
- contexto anônimo;
- zero cookies pré-existentes;
- nenhum perfil persistente;
- ausência de indicador de conta;
- envio de mensagem;
- captura de resposta.

O ChatGPT foi testado em contexto anônimo, mas a página retornou `Just a moment...` por causa do Cloudflare.

O Duck.ai foi testado em contexto anônimo. A página carregou sem cookies persistentes, mas apresentou confirmação inicial e posteriormente CAPTCHA/Cloudflare.

## 21. Resumo operacional

Para uso normal:

```env
PORT=3000
HEADLESS=true
ANONYMOUS=true
PROVIDER=gemini
DUCKAI_HEADLESS=false
```

Depois:

```bash
npm install
npm run browser:install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

Selecione Gemini e envie a mensagem. O navegador será criado apenas quando a primeira mensagem for enviada, e o servidor usará uma sessão anônima sem conta persistente.
