/* ============================================================
   NAZÁRIA · PEDIDO ONLINE — SISTEMA DE TEMA
   ============================================================
   ESTRATÉGIA DE DARK MODE:
   ─ NÃO sobrescrevemos classes genéricas do Tailwind (.bg-white,
     .bg-slate-50, etc.) porque elas atingem também logos, imagens
     de produto, banners e o mural — que devem permanecer claros.
   ─ Usamos seletores ESTRUTURAIS e por ID, apontando apenas para
     superfícies de UI (cards, nav, painel lateral, inputs, modais).
   ─ Elementos de mídia (img, banners, logo) recebem proteção
     explícita para nunca serem afetados.
   ============================================================ */


/* ============================================================
   1. TOKENS DE TEMA
   ============================================================ */
:root {
  /* Superfícies */
  --bg-page:        #F8FAFC;
  --bg-card:        #FFFFFF;
  --bg-secondary:   #F1F5F9;
  --bg-tertiary:    #E2E8F0;
  --bg-header:      #0F172A;

  /* Bordas */
  --border-subtle:  #E2E8F0;
  --border-default: #CBD5E1;

  /* Textos */
  --text-primary:   #0F172A;
  --text-secondary: #475569;
  --text-muted:     #94A3B8;
  --text-inverse:   #FFFFFF;

  /* Marca */
  --accent:         #FF6B00;
  --accent-hover:   #E55300;
  --accent-soft:    #FFF7ED;
  --accent-muted:   #FDBA74;

  /* Sombras */
  --shadow-card:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-hover:   0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  --shadow-modal:   0 20px 60px rgba(0,0,0,0.15);

  /* Scrollbar */
  --scrollbar-track:#F1F5F9;
  --scrollbar-thumb:#CBD5E1;

  /* Velocidade de transição */
  --speed: 0.25s;
}

[data-theme="dark"] {
  /* Superfícies — Navy em camadas */
  --bg-page:        #0D1520;
  --bg-card:        #131F2E;
  --bg-secondary:   #1A2A3D;
  --bg-tertiary:    #213248;
  --bg-header:      #070E18;

  /* Bordas */
  --border-subtle:  #1E3047;
  --border-default: #283F59;

  /* Textos — claros e legíveis */
  --text-primary:   #F0F4FA;
  --text-secondary: #9DB4CE;
  --text-muted:     #4D6580;
  --text-inverse:   #F0F4FA;

  /* Marca */
  --accent:         #FF6B00;
  --accent-hover:   #FF8533;
  --accent-soft:    #1F0D00;
  --accent-muted:   #7C3300;

  /* Sombras */
  --shadow-card:    0 1px 4px rgba(0,0,0,0.40);
  --shadow-hover:   0 8px 32px rgba(0,0,0,0.60);
  --shadow-modal:   0 24px 80px rgba(0,0,0,0.80);

  /* Scrollbar */
  --scrollbar-track:#0D1520;
  --scrollbar-thumb:#213248;

  /* Semânticos para status */
  --status-ok-bg:   #0A2218;
  --status-ok-text: #4ADE80;
  --status-err-bg:  #200A0A;
  --status-err-text:#F87171;
}


/* ============================================================
   2. BASE
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; }

body {
  background-color: var(--bg-page) !important;
  color: var(--text-primary) !important;
  transition: background-color var(--speed) ease, color var(--speed) ease;
  -webkit-font-smoothing: antialiased;
}


/* ============================================================
   3. PROTEÇÃO DE MÍDIA
   Esses elementos NUNCA recebem escurecimento, independente
   de qualquer regra dark mode abaixo.
   ============================================================ */

/* Logos */
[data-theme="dark"] img[alt="Nazária Logo"],
[data-theme="dark"] img[alt="Nazária"],
[data-theme="dark"] img[alt="HBN1"] {
  filter: none !important;
  opacity: 1   !important;
}

/* Imagens de produto dentro dos cards */
[data-theme="dark"] .product-card img,
[data-theme="dark"] [data-card-produto] img,
[data-theme="dark"] .group img.object-contain {
  mix-blend-mode: normal !important;
  filter: none !important;
  background: transparent !important;
}

/* Banner superior de produto / hero da página */
[data-theme="dark"] [data-banner-produto],
[data-theme="dark"] #bannerProduto,
[data-theme="dark"] .banner-produto {
  filter: none !important;
  background: transparent !important;
}

/* Imagem dentro do modal de produto */
[data-theme="dark"] #modalProduto img,
[data-theme="dark"] [data-modal-produto] img {
  filter: none !important;
  background: transparent !important;
}


/* ============================================================
   4. HEADER / NAVEGAÇÃO
   Alvo: a tag <header> ou <nav> com sticky — não .bg-white geral.
   ============================================================ */
[data-theme="dark"] header,
[data-theme="dark"] nav.sticky,
[data-theme="dark"] header.sticky {
  background-color: var(--bg-header) !important;
  border-bottom: 1px solid var(--border-subtle) !important;
  color: var(--text-primary) !important;
}

/* Painel do cliente (barra escura inline) */
[data-theme="dark"] #painelCliente,
[data-theme="dark"] .bg-\[\#0F172A\],
[data-theme="dark"] [style*="background-color: rgb(15, 23, 42)"] {
  background-color: var(--bg-header) !important;
  color: var(--text-inverse) !important;
}


/* ============================================================
   5. MURAL DE AVISOS (letreiro)
   Alvo: IDs e classe .letreiro-container — não .bg-white geral.
   ============================================================ */
[data-theme="dark"] #containerAvisosLetreiro,
[data-theme="dark"] #muraldeavisos,
[data-theme="dark"] .letreiro-container {
  background-color: var(--bg-header) !important;
  border-top:    1px solid var(--border-subtle) !important;
  border-bottom: 1px solid var(--border-subtle) !important;
  color: var(--text-secondary) !important;
}

/* Texto e separador dentro do letreiro */
[data-theme="dark"] .letreiro-container span,
[data-theme="dark"] .letreiro-conteudo span,
[data-theme="dark"] .aviso-item {
  color: var(--text-secondary) !important;
}


/* ============================================================
   6. ÁREA DE CONTEÚDO PRINCIPAL — fundo da página
   Alvo: main, #conteudo, #app — não .bg-white de imagens.
   ============================================================ */
[data-theme="dark"] main,
[data-theme="dark"] #conteudo,
[data-theme="dark"] #app,
[data-theme="dark"] #telaApp {
  background-color: var(--bg-page) !important;
}


/* ============================================================
   7. CARDS DE PRODUTO
   Alvo: o wrapper do card — NÃO a área interna da imagem.
   ============================================================ */

/* Container do card */
[data-theme="dark"] .product-card,
[data-theme="dark"] [data-card-produto],
/* Fallback estrutural: li ou div que seja pai direto de imagem+conteúdo */
[data-theme="dark"] #gridProdutos > div,
[data-theme="dark"] #listaProdutos > div {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;
  color: var(--text-primary) !important;
}

[data-theme="dark"] .product-card:hover,
[data-theme="dark"] [data-card-produto]:hover,
[data-theme="dark"] #gridProdutos > div:hover,
[data-theme="dark"] #listaProdutos > div:hover {
  border-color: var(--border-default) !important;
  box-shadow: var(--shadow-hover) !important;
}

/* Área da imagem dentro do card — fica levemente mais escura que o card,
   mas NÃO aplica .bg-white, para não vazar para logos */
[data-theme="dark"] .product-card .img-area,
[data-theme="dark"] [data-card-produto] .img-area,
[data-theme="dark"] #gridProdutos > div > .relative:first-child,
[data-theme="dark"] #listaProdutos > div > .relative:first-child {
  background-color: #1A2535 !important;
}

/* Área de texto/preço dentro do card */
[data-theme="dark"] .product-card .card-body,
[data-theme="dark"] [data-card-produto] .card-body,
[data-theme="dark"] #gridProdutos > div > div:not(.relative):not(.img-area),
[data-theme="dark"] #listaProdutos > div > div:not(.relative):not(.img-area) {
  color: var(--text-primary) !important;
}

/* Nome do produto */
[data-theme="dark"] .product-card .product-name,
[data-theme="dark"] [data-card-produto] .product-name {
  color: var(--text-primary) !important;
}

/* Preço */
[data-theme="dark"] .product-card .product-price,
[data-theme="dark"] [data-card-produto] .product-price {
  color: var(--text-primary) !important;
}

/* Código / referência */
[data-theme="dark"] .product-card .product-ref,
[data-theme="dark"] [data-card-produto] .product-ref {
  color: var(--text-muted) !important;
}

/* Badges de estoque */
[data-theme="dark"] .badge-estoque-ok  { background-color: var(--status-ok-bg)  !important; color: var(--status-ok-text)  !important; }
[data-theme="dark"] .badge-estoque-err { background-color: var(--status-err-bg) !important; color: var(--status-err-text) !important; }

/* Separador interno do card */
[data-theme="dark"] .product-card hr,
[data-theme="dark"] .product-card .divider,
[data-theme="dark"] [data-card-produto] hr {
  border-color: var(--border-subtle) !important;
}


/* ============================================================
   8. BOTÕES DO CARD — ADICIONAR / QUANTIDADE
   ============================================================ */

/* Botão "Adicionar ao pedido" */
[data-theme="dark"] .btn-adicionar,
[data-theme="dark"] button.btn-adicionar {
  background-color: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-default) !important;
  transition: background-color var(--speed), color var(--speed), border-color var(--speed);
}
[data-theme="dark"] .btn-adicionar:hover,
[data-theme="dark"] button.btn-adicionar:hover {
  background-color: var(--accent) !important;
  color: #fff !important;
  border-color: var(--accent) !important;
}

/* Controles de quantidade +/- */
[data-theme="dark"] .qty-wrapper {
  background-color: #1A0D00 !important;
  border: 1px solid var(--accent-muted) !important;
}
[data-theme="dark"] .qty-wrapper button {
  background-color: var(--bg-tertiary) !important;
  border-color: var(--border-default) !important;
  color: var(--accent) !important;
}
[data-theme="dark"] .qty-wrapper input,
[data-theme="dark"] .qty-wrapper span {
  color: var(--text-primary) !important;
  background-color: transparent !important;
}

/* Botão desabilitado */
[data-theme="dark"] .btn-adicionar:disabled,
[data-theme="dark"] button:disabled {
  background-color: var(--bg-secondary) !important;
  color: var(--text-muted) !important;
  border-color: var(--border-subtle) !important;
}


/* ============================================================
   9. INPUTS E BARRA DE PESQUISA
   Alvo: inputs, selects, textareas — não imagens ou logos.
   ============================================================ */
[data-theme="dark"] input[type="text"],
[data-theme="dark"] input[type="search"],
[data-theme="dark"] input[type="number"],
[data-theme="dark"] input[type="email"],
[data-theme="dark"] select,
[data-theme="dark"] textarea {
  background-color: var(--bg-secondary) !important;
  border: 1px solid var(--border-default) !important;
  color: var(--text-primary) !important;
  transition: border-color var(--speed), box-shadow var(--speed);
}
[data-theme="dark"] input:focus,
[data-theme="dark"] select:focus,
[data-theme="dark"] textarea:focus {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px rgba(255,107,0,0.15) !important;
  outline: none;
}
[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
  color: var(--text-muted) !important;
}

/* Dropdown de autocomplete de clientes */
[data-theme="dark"] #dropdownClientes {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-default) !important;
  box-shadow: var(--shadow-hover) !important;
}
[data-theme="dark"] #dropdownClientes > div:hover {
  background-color: var(--bg-secondary) !important;
}


/* ============================================================
   10. PAINÉIS LATERAIS E CONTAINERS DE SEÇÃO
   Alvo: IDs específicos de painéis — não .bg-white genérico.
   ============================================================ */
[data-theme="dark"] #painelFiltros,
[data-theme="dark"] #painelLateral,
[data-theme="dark"] #sidebarFiltros {
  background-color: var(--bg-card) !important;
  border-right: 1px solid var(--border-subtle) !important;
  color: var(--text-primary) !important;
}

[data-theme="dark"] #painelFiltros h3,
[data-theme="dark"] #painelLateral h3,
[data-theme="dark"] #sidebarFiltros h3 {
  color: var(--text-primary) !important;
}

[data-theme="dark"] #painelFiltros label,
[data-theme="dark"] #painelLateral label {
  color: var(--text-secondary) !important;
}


/* ============================================================
   11. MODAIS
   Alvo: #modalProduto, #modalCarrinho — não .bg-white de imagens.
   ============================================================ */
[data-theme="dark"] #modalProduto .modal-content,
[data-theme="dark"] #modalCarrinho .modal-content,
[data-theme="dark"] #modalConfirmacao .modal-content,
[data-theme="dark"] [data-modal] .modal-content {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;
  box-shadow: var(--shadow-modal) !important;
  color: var(--text-primary) !important;
}

/* Cabeçalho do modal */
[data-theme="dark"] #modalProduto .modal-header,
[data-theme="dark"] #modalCarrinho .modal-header {
  border-bottom: 1px solid var(--border-subtle) !important;
  color: var(--text-primary) !important;
}

/* Rodapé do modal */
[data-theme="dark"] #modalProduto .modal-footer,
[data-theme="dark"] #modalCarrinho .modal-footer {
  border-top: 1px solid var(--border-subtle) !important;
  background-color: var(--bg-secondary) !important;
}

/* Backdrop */
[data-theme="dark"] .modal-backdrop,
[data-theme="dark"] .bg-overlay {
  background-color: rgba(7,14,24,0.85) !important;
  backdrop-filter: blur(4px);
}

/* Área da imagem DENTRO do modal — preservada clara */
[data-theme="dark"] #modalProduto .modal-img-area,
[data-theme="dark"] [data-modal-produto] .img-area {
  background-color: #F8FAFC !important; /* mantém claro para a foto do produto */
}


/* ============================================================
   12. TELA DE PORTAIS (seleção de fornecedor)
   ============================================================ */
[data-theme="dark"] #telaPortais {
  background-color: var(--bg-page) !important;
}
[data-theme="dark"] #telaPortais .portal-info {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;
}
[data-theme="dark"] #telaPortais h1,
[data-theme="dark"] #telaPortais h2 { color: var(--text-primary)   !important; }
[data-theme="dark"] #telaPortais p  { color: var(--text-secondary) !important; }

/* Cards dos portais — gradiente de marca é mantido */
[data-theme="dark"] #gridPortais button { opacity: 0.90; }


/* ============================================================
   13. BOTÃO TOGGLE DARK MODE
   ============================================================ */
#btnDarkMode {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid transparent;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  transition: background var(--speed), color var(--speed);
}
#btnDarkMode:hover          { background: rgba(148,163,184,0.15); }
[data-theme="dark"] #btnDarkMode       { color: #FFD700; }
[data-theme="dark"] #btnDarkMode:hover { background: rgba(255,215,0,0.12); }


/* ============================================================
   14. ESTADO ATIVO (filtros / ordenação)
   ============================================================ */
.ol-btn-ativo {
  background: var(--accent) !important;
  color: #fff !important;
  border-color: var(--accent-hover) !important;
  box-shadow: 0 2px 8px rgba(255,107,0,0.35);
}


/* ============================================================
   15. ANIMAÇÃO DO LETREIRO
   ============================================================ */
.letreiro-container { overflow: hidden; white-space: nowrap; display: flex; align-items: center; }
.letreiro-conteudo  { display: inline-block; padding-left: 100%; animation: marqueeInfinita 30s linear infinite; }
.letreiro-conteudo:hover { animation-play-state: paused; }

@keyframes marqueeInfinita {
  0%   { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-100%, 0, 0); }
}

.aviso-item::after {
  content: "•";
  margin-left: 2.5rem;
  margin-right: 2.5rem;
  color: var(--accent-muted);
  font-weight: bold;
}
[data-theme="dark"] .aviso-item::after { color: var(--accent) !important; }


/* ============================================================
   16. CARDS MODERNOS — elevação e hover (ambos os temas)
   ============================================================ */
.product-card,
[data-card-produto] {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition:
    box-shadow var(--speed) ease,
    border-color var(--speed) ease,
    transform var(--speed) ease;
}
.product-card:hover,
[data-card-produto]:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}


/* ============================================================
   17. SCROLLBAR
   ============================================================ */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--scrollbar-track); }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }


/* ============================================================
   18. INPUTS NUMÉRICOS — remove setas nativas
   ============================================================ */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }
