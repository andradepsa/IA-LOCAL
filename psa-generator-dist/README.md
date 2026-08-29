# 🎓 Gerador de Artigos Científicos com IA

Aplicação web que gera **artigos científicos completos em LaTeX** usando IA, compila pra PDF, e publica no Zenodo com DOI. Roda 24/7 no navegador.

## ✨ Recursos

- 🤖 **IA Local** (WebLLM + WebGPU) — funciona sem internet após 1º download
- 🔄 **Fallback** para Z.ai GLM-5.3 (se GPU não disponível)
- 🧠 **Cérebro da Mosca** — aprende com cada paper (dopamina, serotonina, plasticidade)
- 📚 **11 disciplinas** rotacionando (IA, Math, Bio, Chemistry, Physics, etc)
- 🗳️ **3 modelos** competindo (glm-5.3, glm-5.3-flash, glm-5.2)
- ☁️ **Publicação automática** no Zenodo com DOI
- ⏰ **Loop 24/7** — gera papers continuamente
- 📊 **Painel visual** do cérebro aprendendo

## 🚀 Deploy no Cloudflare Pages (GRÁTIS)

### Passo 1: Preparar o código

```bash
# Instalar dependências
npm install

# Testar localmente
npm run dev
# Abra http://localhost:3000
```

### Passo 2: Publicar no GitHub

1. Crie um repositório no GitHub (ex: `paper-generator`)
2. Faça upload de todos os arquivos:
   ```bash
   git init
   git add .
   git commit -m "Paper Generator with AI"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/paper-generator.git
   git push -u origin main
   ```

### Passo 3: Conectar ao Cloudflare Pages

1. Acesse https://dash.cloudflare.com → **Workers & Pages**
2. Clique em **Create application** → **Pages** → **Connect to Git**
3. Selecione seu repositório `paper-generator`
4. Configure:
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment variables**:
     - `ZAI_API_KEY` = sua key da Z.ai (grátis em z.ai/manage/apikey)
     - `ZAI_BASE_URL` = `https://api.z.ai/api/paas/v4`
5. Clique em **Save and Deploy**

Pronto! Seu app estará em `https://paper-generator.pages.dev`

### Passo 4: Configurar o app

1. Abra seu site no Cloudflare
2. Clique no ⚙️ no topo
3. Cole seu **Token Zenodo** (obtenha em https://zenodo.org/account/settings/applications/)
4. Clique em **Salvar**

### Passo 5: Ativar loop 24/7

1. Marque **"🔄 Modo Contínuo (loop 24/7)"**
2. Marque **"⏰ Agendador (1 paper/min)"**
3. Clique em **🚀 Iniciar Automação Contínua**
4. **Deixe a aba aberta** — o loop roda enquanto a aba estiver aberta

## 🤖 IA Local (opcional, sem internet)

Para usar IA 100% local (sem Z.ai):

1. Use **Chrome 113+** ou **Edge** (precisa de WebGPU)
2. Abra o app
3. No painel **"🤖 IA Local (WebLLM)"**, clique em **"📥 Baixar IA Local"**
4. Aguarde o download (1.5GB, só 1x — cache no navegador)
5. A IA agora roda **sem internet**!

### Requisitos para IA Local
- Chrome 113+ / Edge / Brave
- GPU (integrada ou dedicada)
- 4GB RAM livre
- 1.5GB espaço em disco (cache do modelo)

## 📋 Estrutura do Projeto

```
.
├── App.tsx                    # Componente principal
├── index.tsx                  # Entry point
├── index.html                 # HTML base
├── index.css                  # Estilos
├── types.ts                   # Tipos TypeScript
├── constants/                 # Configurações
│   ├── config.ts              # TOTAL_ITERATIONS = 2
│   ├── topics.ts              # 11 disciplinas + autores
│   └── ui.ts                  # Modelos, idiomas
├── services/
│   ├── geminiService.ts       # Geração de papers (Z.ai)
│   ├── webLLMService.ts       # IA local (WebLLM)
│   ├── localPaperGenerator.ts # Geração com IA local
│   ├── flyBrain.ts            # Cérebro que aprende
│   ├── learningBrain.ts       # Memória de longo prazo
│   ├── llmHub.ts              # HUB multi-provider
│   └── articleTemplate.ts     # Template LaTeX fixo
├── functions/                 # Cloudflare Pages Functions
│   ├── llm-proxy.js           # Proxy pra Z.ai API
│   ├── compile-latex.js       # Compilação LaTeX → PDF
│   ├── zenodo-proxy.js        # CORS bypass Zenodo
│   └── semantic-proxy.js      # CORS bypass Semantic Scholar
├── components/                # Componentes React
├── vite.config.ts             # Config Vite (com plugins de proxy)
├── tsconfig.json              # Config TypeScript
└── package.json               # Dependências
```

## 🔑 APIs Necessárias

| API | Onde obter | Custo |
|-----|-----------|-------|
| **Z.ai** (opcional) | https://z.ai/manage/apikey | Grátis (~$10 crédito) |
| **Zenodo** (obrigatório) | https://zenodo.org/account/settings/applications/ | Grátis |
| **IA Local** (opcional) | Não precisa — roda no browser | Grátis |

## 🎯 Como Usar

### Modo Automático (loop 24/7)
1. Configure token Zenodo no ⚙️
2. Ative "Modo Contínuo" + "Agendador"
3. Clique em "Iniciar Automação Contínua"
4. Deixe a aba aberta — papers são publicados automaticamente

### Modo Manual
1. Escolha disciplina e quantidade
2. Clique em "Gerar Artigo"
3. Edite o LaTeX se quiser
4. Clique em "Compilar PDF"
5. Clique em "Publicar no Zenodo"

## 🧠 Cérebro da Mosca

O sistema tem um "cérebro" inspirado no connectoma da Drosophila que:

- **5 regiões especializadas**: antena, corpo cogumelar, corpo central, etc
- **Aprendizado por recompensa**: dopamina sobe quando paper é publicado
- **Significância humana**: busca tópicos de alto impacto (climate, health, AI safety)
- **Evolução de pesos**: ajusta quais modelos funcionam melhor ao longo do tempo
- **Plasticidade**: diminui com a idade (aprende mais rápido no início)

## 📊 Painel do Cérebro

Acompanhe em tempo real:
- **Gerações**: quantos papers já processou
- **Dopamina**: nível de recompensa (0-100%)
- **Serotonina**: satisfação (0-100%)
- **Idade**: gerações processadas
- **Plasticidade**: capacidade de aprendizado
- **Melhor modelo**: qual GLM está funcionando melhor

## ⚠️ Limitações

- **Cloudflare Pages**: 100.000 function calls/dia (grátis)
- **Z.ai**: ~$10 crédito grátis (depois precisa pagar)
- **Zenodo**: 50 depósitos/dia por token
- **IA Local**: precisa de GPU e Chrome 113+
- **Loop 24/7**: precisa de aba aberta no navegador

## 🐛 Solução de Problemas

### "WebGPU não disponível"
- Use Chrome 113+ ou Edge
- Ative WebGPU em `chrome://flags/#enable-unsafe-webgpu`

### "Erro 429 (Too Many Requests)"
- Rate limit da Z.ai — aguarde 5-10 min
- Ou use IA Local (WebLLM)

### "Compilação falhou"
- Normal — a IA às vezes gera LaTeX com erros
- O sistema tenta corrigir automaticamente 3x
- Se falhar, tenta próximo modelo

### "Upload falhou"
- Verifique token Zenodo no ⚙️
- Para testes, ative modo sandbox

## 📄 Licença

MIT — use livremente.

## 🆘 Suporte

- **Z.ai API**: https://docs.z.ai
- **Zenodo API**: https://developers.zenodo.org
- **WebLLM**: https://github.com/mlc-ai/web-llm
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/

## 🎉 Pronto pra rodar!

Após o deploy, seu app vai:
1. Gerar papers científicos automaticamente
2. Publicar no Zenodo com DOI real
3. Aprender com cada paper (cérebro evolui)
4. Rodar 24/7 enquanto a aba estiver aberta

Boa pesquisa! 🎓
