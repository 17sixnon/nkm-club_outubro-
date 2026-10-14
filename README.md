# 🎃 HALLOWEEN NKM — Sistema de Ingressos

Site + sistema de ingressos com checkout, Pix (QR e Pix Copia e Cola), painel do ADM e QR de entrada validado uma única vez.

## Como rodar

```bash
npm install
npm start
```

Abra **http://localhost:3000** (site do evento) e **http://localhost:3000/admin.html** (painel do ADM).

## Fluxo

1. **Comprador** escolhe o gênero (**👨 Homem R$ 40,00** / **👩 Mulher R$ 25,00**), informa **nome completo** e **CPF** (validado com módulo 11, um ingresso por CPF) → o sistema gera o ingresso (status *pendente*) + o Pix do valor correto.
2. **Comprador** paga o Pix e envia o comprovante ao ADM pelo WhatsApp **(41) 99175-6327**.
3. **ADM** confirma o pagamento em *Pagamentos* → status *pago* e o QR de entrada é liberado em "Meu Ingresso".
4. **Na portaria**: o ADM abre *Entrada*, escaneia o QR (ou digita o código) e:
   - **Conferência de CPF**: digita o CPF do documento (RG/CPF com foto) do cliente → o sistema só libera a entrada se o CPF conferir com o ingresso;
   - **Câmera**: captura a foto do cliente (registrada no ingresso) e, opcionalmente, faz uma **análise de gênero por IA** (sugestão com nível de confiança — **não é 100% precisa**; a confirmação oficial é a conferência do documento e a decisão final é do ADM);
   - **RG**: número opcional, registrado no ingresso;
   - **Validar entrada**: o QR é **invalidado após o primeiro uso** (não permite reentrada).

Qualquer câmera de celular pode abrir o link `.../t/NKM-XXXX-XXXX` e mostrar o status do ingresso.

## Painel do ADM

- Token padrão: `NKM-ADM-2026-CHANGE-ME` → **troque antes de usar** (variável `ADMIN_TOKEN`).
- Abas:
  - **Entrada**: busca de cliente por **nome, código ou CPF** (barra de pesquisa com resultados instantâneos), conferência de CPF, câmera com foto e análise de gênero, validação;
  - **Clientes**: lista completa com filtro por nome/código/CPF e validação direta;
  - **Pagamentos**: confirmar PIX manualmente + botão **"Sincronizar pagamentos (Mercado Pago)"** — consulta a API e confirma automaticamente os Pixs pagos. Com o gateway configurado, a sincronização roda **a cada 30s sozinha** enquanto a aba está aberta;
  - **Todos os ingressos**: visão geral completa.
- Estatísticas com total de homens e mulheres. Atualização automática a cada 15 s.

## Site do evento

- Hero com contagem regressiva, informações do evento e CTAs;
- Sobre, line-up, experiência, **preços por gênero**, **como funciona**;
- **Local** (endereço e orientações), **O que levar** (checklist), **Dúvidas frequentes** (FAQ);
- Checkout com seleção de gênero (Homem R$ 40 / Mulher R$ 25), CPF com máscara e validação;
- **"Meu Ingresso"**: consulta por código com QR, lembra do último ingresso comprado (botão de acesso rápido) e botão para copiar o código;
- Regras do evento e LGPD.

## Preços e variáveis de ambiente

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `ADMIN_TOKEN` | `NKM-ADM-2026-CHANGE-ME` | Senha do painel |
| `TICKET_PRICE_MALE` | `40.00` | Preço do ingresso masculino (R$) |
| `TICKET_PRICE_FEMALE` | `25.00` | Preço do ingresso feminino (R$) |
| `MP_ACCESS_TOKEN` | vazio | Access token do Mercado Pago (ativa pagamento automático) |
| `PUBLIC_URL` | auto | URL pública do site (para o IPN) |
| `PIX_EXPIRES_IN` | `3600` | Validade do Pix em segundos |
| `PIX_KEY` | `+5541991756327` | Chave Pix (modo manual) |
| `PIX_NAME` | `NKM EVENTS` | Nome no Pix (máx. 25 chars) |
| `PIX_CITY` | `CURITIBA` | Cidade no Pix |
| `MAX_TICKETS` | ilimitado | Capacidade máxima de ingressos |
| `ADM_PHONE` | `(41) 99175-6327` | WhatsApp do ADM exibido no site |

Exemplo completo:

```powershell
$env:TICKET_PRICE_MALE="40.00"
$env:TICKET_PRICE_FEMALE="25.00"
$env:MAX_TICKETS="150"
$env:ADMIN_TOKEN="senha-segura-123"
$env:MP_ACCESS_TOKEN="SEU_ACCESS_TOKEN"
$env:PUBLIC_URL="https://halloween-nkm.com"
npm start
```

Com o access token do Mercado Pago, o checkout gera **automaticamente** o QR do Pix (e o "Pix copia e cola") no site e, **assim que o pagamento é aprovado**, o ingresso vira **pago sozinho** (via IPN ou consulta de status) e o QR de entrada é liberado em "Meu Ingresso".

**Como configurar:**

1. Crie sua conta em [mercadopago.com.br](https://www.mercadopago.com.br) → **Desenvolvedores** → gere um **Access Token** (teste ou produção).
2. Defina `MP_ACCESS_TOKEN` (e `TICKET_PRICE_MALE` / `TICKET_PRICE_FEMALE` com os valores do evento).

3. No painel do Mercado Pago, cadastre a URL de notificação (IPN):
   `https://seu-dominio.com/webhooks/mercadopago`

**Fluxo:**
- O site chama `POST /v1/payments` (`payment_method_id: "pix"`) → recebe `qr_code` (copia e cola) + `qr_code_base64` (imagem do QR) e exibe tudo na hora.
- O Pix é pago → o Mercado Pago dispara o IPN → o sistema consulta `GET /v1/payments/{id}`, confirma o ingresso e libera o QR de entrada.
- **Fallback automático:** se o IPN não alcançar o servidor (ex.: ambiente local), a própria consulta de status do ingresso ("Meu Ingresso" / botão "Verificar pagamento") também confirma. O ADM pode confirmar manualmente como último recurso.

**Teste antes do evento:** use o **modo sandbox** do Mercado Pago (access token de teste + conta de comprador de teste) para simular pagamentos reais sem gastar dinheiro.

> Sem `MP_ACCESS_TOKEN`, o sistema usa o modo manual: Pix estático EMV + confirmação pelo ADM.

## Variáveis de ambiente (opcional)

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `ADMIN_TOKEN` | `NKM-ADM-2026-CHANGE-ME` | Senha do painel |
| `MP_ACCESS_TOKEN` | vazio | Access token do Mercado Pago (ativa pagamento automático) |
| `PUBLIC_URL` | auto | URL pública do site (para o IPN) |
| `PIX_EXPIRES_IN` | `3600` | Validade do Pix em segundos |
| `PIX_KEY` | `+5541991756327` | Chave Pix (modo manual) |
| `PIX_NAME` | `NKM EVENTS` | Nome no Pix (máx. 25 chars) |
| `PIX_CITY` | `CURITIBA` | Cidade no Pix |
| `TICKET_PRICE` | vazio | Valor fixo (ex.: `20.00`). Obrigatório com Mercado Pago |
| `MAX_TICKETS` | ilimitado | Capacidade máxima de ingressos |
| `ADM_PHONE` | `(41) 99175-6327` | WhatsApp do ADM exibido no site |

Exemplo completo:

```powershell
$env:TICKET_PRICE="20.00"
$env:MAX_TICKETS="150"
$env:ADMIN_TOKEN="senha-segura-123"
$env:MP_ACCESS_TOKEN="SEU_ACCESS_TOKEN"
$env:PUBLIC_URL="https://halloween-nkm.com"
npm start
```

## Pix: demonstração vs. produção

**Modo gateway (recomendado):** com `MP_ACCESS_TOKEN` configurado, o QR do Pix é gerado pelo Mercado Pago na hora e a confirmação é automática via IPN/webhook (veja a seção acima).

**Modo manual (sem gateway):** o QR gerado é um **Pix estático EMV (cópia e cola)** com a chave do organizador. Funciona para pagamento manual, mas a confirmação é feita pelo ADM no painel.

## Segurança e dados (LGPD)

- Nunca deixe o `ADMIN_TOKEN` padrão em produção.
- Use HTTPS em produção (Nginx/Render/Railway/VPS) para o QR de entrada funcionar em qualquer celular.
- Os dados (CPF, nome, fotos da entrada) ficam em `data/tickets.json` — mantenha local, faça backup antes do evento e **apague após o evento** (LGPD).
- O painel deve ser protegido por senha extra (ex.: autenticação HTTP do Nginx) se exposto à internet.
- A análise de gênero por câmera roda **no navegador do ADM** (modelo do face-api.js carregado do CDN) e é apenas **sugestão** — a validação oficial é a conferência do documento com foto.

## Arquivos

- `server.js` — API + servidor (Node/Express)
- `public/index.html` — site do evento (checkout, "Meu Ingresso")
- `public/admin.html` — painel do ADM (entrada, pagamentos, câmera)
- `data/tickets.json` — base de ingressos (criado automaticamente)
