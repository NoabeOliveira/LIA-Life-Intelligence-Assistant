# LIA

Assistente pessoal para organizar tarefas, compromissos e objetivos, com recursos de conversa e voz.

## Funcionalidades

- Cadastro, login e sessão de usuário.
- Organização de tarefas, agenda e objetivos com etapas.
- Conversa com a LIA usando a API da OpenAI.
- Respostas em voz neural e entrada por reconhecimento de voz quando disponível no navegador.
- Persistência local em SQLite e arquivos JSON.
- Limites por conta e tetos diários globais para chamadas de conversa e voz.

## Requisitos

- Node.js 22 ou superior.
- npm.
- Uma chave de API da OpenAI para usar os recursos de conversa e voz.

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo local de configuração a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

3. Gere um segredo para as sessões:

   ```bash
   node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"
   ```

4. Edite `.env` e defina:

   ```dotenv
   OPENAI_API_KEY=sua_chave_da_openai
   SESSION_SECRET=seu_segredo_aleatorio
   PORT=3000
   ```

   Nunca publique `.env` nem compartilhe sua chave da OpenAI ou o segredo de sessão.

## Executar

Inicie o servidor:

```bash
npm start
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Testes

```bash
npm test
```

## Limites de uso da IA

Para cada conta, são permitidas até 20 chamadas de conversa e 30 chamadas de voz em uma janela de 15 minutos. Além disso, a instância inteira permite até 100 chamadas de conversa e 100 chamadas de voz por dia, somando todos os usuários. Os tetos globais reiniciam à meia-noite UTC; as chamadas bloqueadas informam quando será possível tentar novamente.

Esses tetos contam chamadas, não representam um orçamento monetário exato. O custo ainda varia conforme a quantidade de texto enviada e gerada. Configure também alertas e controles de orçamento no provedor da API e monitore o uso da instância. Os limites globais são compartilhados no banco SQLite; em produção, mantenha o banco em armazenamento persistente e compartilhado entre instâncias.

## Dados e publicação

Os dados locais, incluindo o banco SQLite e arquivos de usuários, ficam em `data/`. Essa pasta, `.env` e `node_modules/` são excluídos pelo `.gitignore`; não os force para o repositório. Faça backup do banco de forma segura se precisar preservar os dados.

Este projeto precisa de um servidor Node.js e armazenamento persistente para SQLite; o GitHub Pages, sozinho, não executa a aplicação. Para publicar uma instância, use um serviço que execute Node.js, configure as variáveis de ambiente no serviço e proteja o armazenamento persistente.

Antes da primeira publicação:

- confirme que os direitos da imagem em `assets/lia-login-bg.jpg` permitem sua redistribuição;
- o projeto usa a licença ISC; consulte o arquivo [LICENSE](./LICENSE).

## Tecnologias

- Node.js e Express
- SQLite (`better-sqlite3`)
- JavaScript, HTML e CSS
- API da OpenAI
