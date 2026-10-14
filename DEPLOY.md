# 🚀 Deploy no Render (24/7, sem PC ligado)

O Render é um cloud hosting gratuito (sem cartão) que mantém o server rodando 24h. Em ~5 minutos o site fica no ar.

## Pré-requisitos
- Conta GitHub (grátis) — para conectar o código.
- Conta Render (grátis) em https://render.com.

## Passo a passo
1. No seu repositório GitHub, faça `git init`, `git add -A`, `git commit -m "init"` e `git push`.
   - O `render.yaml` já está no projeto.
   - Arquivos sensíveis como `data/tickets.json` estão no `.gitignore` (não committed).
2. Acesse https://render.com → **New +** → **Web Service**.
3. Conecte o repositório GitHub.
4. Render lê o `render.yaml` automaticamente:
   - **Name**: `halloween-nkm`
   - **Region**: `oregon` (ou nearest)
   - **Plan**: `Free`
   - **Build Command**: `npm install --production`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/api/config`
5. Clique **Create Web Service**.
6. Aguarde ~1 minuto o deploy.
7. Render gera uma URL pública (ex.: `https://halloween-nkm.onrender.com`). Abra.

## URLs
- Site: `https://<sua-url>.onrender.com`
- Admin: `https://<sua-url>.onrender.com/admin.html`
- Tokens ADM: `NKM-ADM-Andreas17` e `NKM-ADM-Gabriel18`

## Variáveis de ambiente
Todas estão em `render.yaml`. Para alterar (ex.: trocar token, preços), edite o `render.yaml` ou o painel do Render em **Settings → Environment**.

## Dados dos ingressos
Os ingressos ficam em `data/tickets.json` no disco do Render. O Render pode apagar o disco em reinícios (free tier). Para persistência:
- Use o **Render Dashboard → Storage** (pago) e mude `DATA_DIR` para apontar nele, ou
- Faça backup manual do `data/tickets.json` antes do evento e reapóse no dia.

## Limitações do free tier
- O site pode dormir após 15 min sem tráfego (cold start de ~5-10s).
- Sem cartão: limite de 750h de build/hora por mês (mais que suficiente para um evento).
- Sem garantia de uptime 24/7 (SLA só em planos pagos).

## Alternativas
- **Railway**: `railway.json` equivalente.
- **Fly.io**: `fly.toml` + `dockerfile`.
- **VPS**: Node + Nginx + Cloudflare Tunnel (como você já tem local).