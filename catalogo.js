// ESTADO GLOBAL
let BD_PRODUTOS         = [];
let PRODUTOS_FILTRADOS  = [];
let CARRINHO            = {};
let filtroFornecedorAtual = "TODOS";
let BD_CLIENTES         = [];
let CLIENTE_SELECIONADO = null;
let FILTRO_APENAS_COM_ESTOQUE = false;
// =========================================================================
// SUGESTÃO HIT — itens pendentes de positivação do cliente Dedicado selecionado
// =========================================================================
let HIT_DADOS_CLIENTE   = null; // resposta de carteiraHit para o cliente atual 
let HIT_ITENS_PENDENTES = [];   // [{ alavanca, grupo, item, produto }]

function carregarSugestaoHit() {
HIT_DADOS_CLIENTE   = null;
HIT_ITENS_PENDENTES = [];
atualizarBotaoSugestaoHit();

if (TIPO_USUARIO === 'VENDEDOR_FARMA') return;
if (!CLIENTE_SELECIONADO) return;
const equipe = String(CLIENTE_SELECIONADO.equipe || '').toUpperCase().trim();
if (equipe !== 'DEDICADO') return;

chamarApi('carteiraHit', { uf: UF_USUARIO, codCliente: CLIENTE_SELECIONADO.id })
.then(resp => {
if (!resp || resp.erro || !resp.clientes || resp.clientes.length === 0) return;
HIT_DADOS_CLIENTE = resp.clientes[0];
montarItensPendentesHit();
atualizarBotaoSugestaoHit();
})
.catch(e => console.error('Erro ao carregar sugestão HIT:', e));
}

function montarItensPendentesHit() {
HIT_ITENS_PENDENTES = [];
if (!HIT_DADOS_CLIENTE) return;

(HIT_DADOS_CLIENTE.alavancas || []).forEach(al => {
(al.grupos || []).forEach(g => {
if (g.positivado) return;

// Resolve TODOS os produtos das alternativas do grupo (não só o de maior estoque)
// — precisamos disso para detectar se o usuário já adicionou QUALQUER uma delas
// manualmente no catálogo, mesmo que não seja a que o sistema sugeriu.
let melhor = null;
const produtosDoGrupo = [];
(g.itens || []).forEach(item => {
const eanAlvo = normalizarSoDigitos(item.ean);
let p = BD_PRODUTOS.find(prod => normalizarSoDigitos(prod.ean) === eanAlvo && eanAlvo !== '');
if (!p && item.cod) p = BD_PRODUTOS.find(prod => String(prod.id).trim() === String(item.cod).trim());
if (p) produtosDoGrupo.push(p);
const estoque = p ? Number(p.estoque || 0) : 0;
if (!melhor || estoque > melhor.estoque) melhor = { item, produto: p, estoque };
});

if (melhor && melhor.produto) {
HIT_ITENS_PENDENTES.push({
alavanca: al.alavanca,
grupo: g.grupo,
item: melhor.item,
produto: melhor.produto,
produtosDoGrupo // todas as alternativas "OU" já resolvidas no catálogo atual
});
}
});
});
}
// Verifica se QUALQUER alternativa ("OU") do grupo já está no carrinho.
// Retorna o produto encontrado, ou null se nenhuma alternativa foi adicionada.
function _produtoDoGrupoNoCarrinho(itemHit) {
const lista = (itemHit.produtosDoGrupo && itemHit.produtosDoGrupo.length)
? itemHit.produtosDoGrupo
: [itemHit.produto];
return lista.find(p => p && (CARRINHO[p.id] || 0) > 0) || null;
}

function atualizarBotaoSugestaoHit() {
const btn   = document.getElementById('btnSugestaoHit');
const badge = document.getElementById('badgeSugestaoHit');
if (!btn) return;
const estaNaUnilever = filtroFornecedorAtual === 'UNILEVER';
// Conta só o que REALMENTE ainda falta — itens já satisfeitos por alguma
// alternativa do OU não entram no contador.
const qtdPendenteReal = HIT_ITENS_PENDENTES.filter(i => !_produtoDoGrupoNoCarrinho(i)).length;
btn.classList.toggle('hidden', !estaNaUnilever || HIT_ITENS_PENDENTES.length === 0);
if (badge) badge.innerText = qtdPendenteReal;
}

function abrirPainelSugestaoHit() {
if (HIT_ITENS_PENDENTES.length === 0) return;

document.getElementById('sugestaoHitClienteNome').innerText =
CLIENTE_SELECIONADO ? (CLIENTE_SELECIONADO.razao || '').toUpperCase() : '';

const corpo = document.getElementById('corpoSugestaoHit');
let acBruto = 0, acLiquido = 0;

corpo.innerHTML = HIT_ITENS_PENDENTES.map((itemHit) => {
const { alavanca, item, produto } = itemHit;
const produtoNoCarrinho = _produtoDoGrupoNoCarrinho(itemHit);

// Alguma alternativa do OU já está no carrinho — mostra como concluído,
// usando o produto REALMENTE adicionado (pode não ser o "melhor" sugerido)
if (produtoNoCarrinho) {
return `
       <div class="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
         <img src="${produtoNoCarrinho.imagens}" class="w-12 h-12 object-contain bg-white rounded-lg p-1 border border-emerald-100 shrink-0 mix-blend-multiply">
         <div class="min-w-0 flex-grow">
           <span class="text-[8px] font-black text-purple-600 uppercase tracking-wider">${alavanca}</span>
           <p class="text-xs font-bold text-slate-800 truncate">${produtoNoCarrinho.descricao || produtoNoCarrinho.id}</p>
           <p class="text-[10px] text-emerald-600 font-bold">✅ Já no pedido (${CARRINHO[produtoNoCarrinho.id]} un)</p>
         </div>
       </div>`;
}

const { precoFinal, precoOriginal } = calcularPrecos(produto);
acBruto   += precoOriginal;
acLiquido += precoFinal;
return `
     <div class="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-2.5">
       <img src="${produto.imagens}" class="w-12 h-12 object-contain bg-slate-50 rounded-lg p-1 border border-slate-100 shrink-0 mix-blend-multiply">
       <div class="min-w-0 flex-grow">
         <span class="text-[8px] font-black text-purple-600 uppercase tracking-wider">${alavanca}</span>
         <p class="text-xs font-bold text-slate-800 truncate">${produto.descricao || item.descricao || item.cod}</p>
         <p class="text-[10px] text-slate-400 font-mono">Cód ${item.cod} • EAN ${item.ean}</p>
       </div>
       <div class="text-right shrink-0">
         <p class="text-[11px] font-black text-slate-800">${formatarParaReal(precoFinal)}</p>
       </div>
     </div>`;
}).join('');

document.getElementById('sugestaoHitTotalBruto').innerText   = formatarParaReal(acBruto);
document.getElementById('sugestaoHitTotalLiquido').innerText = formatarParaReal(acLiquido);

document.getElementById('overlaySugestaoHit').classList.remove('hidden');
document.getElementById('painelSugestaoHit').classList.remove('translate-x-full');
}

function fecharPainelSugestaoHit() {
document.getElementById('overlaySugestaoHit').classList.add('hidden');
document.getElementById('painelSugestaoHit').classList.add('translate-x-full');
}

function adicionarItensSugestaoHit() {
if (HIT_ITENS_PENDENTES.length === 0) return;

let adicionados = 0;
HIT_ITENS_PENDENTES.forEach((itemHit) => {
if (_produtoDoGrupoNoCarrinho(itemHit)) return; // já satisfeito por alguma alternativa do OU

const { produto } = itemHit;
const estoqueMax = Number(produto.estoque || 0);
if (estoqueMax <= 0) return;
const qtdAtual = CARRINHO[produto.id] || 0;
if (qtdAtual >= estoqueMax) return;

CARRINHO[produto.id] = qtdAtual + 1;
adicionados++;
const c = document.getElementById(`card-btn-${produto.id}`);
if (c) c.innerHTML = obterHtmlBotaoAcao(produto.id, CARRINHO[produto.id], estoqueMax, false);
_atualizarEstadoVisualCard(produto.id);
});

atualizarIndicadoresFinanceirosGlobais();
atualizarIndicadorMinimosBarra();
fecharPainelSugestaoHit();

if (adicionados > 0) {
mostrarToast('success', `${adicionados} item(ns) da sugestão HIT adicionados ao pedido.`);
} else {
mostrarToast('warning', 'Nenhum item pôde ser adicionado (sem estoque disponível ou já no pedido).');
}
}


// -----------------------------------------------------------------------
// DARK MODE — aplicado antes de qualquer render
// -----------------------------------------------------------------------
function toggleDarkMode() {
const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
const novoTema = isDark ? 'light' : 'dark';
document.documentElement.setAttribute('data-theme', novoTema);
const icon = document.getElementById('iconDarkMode');
if (icon) icon.innerText = novoTema === 'dark' ? '☀️' : '🌙';
localStorage.setItem('hbn1_tema', novoTema);
}
function encerrarSessao() {
mostrarConfirm(
'Sair do sistema?',
'Você precisará informar usuário e senha novamente para acessar o catálogo.',
() => {
localStorage.removeItem('hbn1_usuario');
localStorage.removeItem('hbn1_uf');
localStorage.removeItem('hbn1_nome');
localStorage.removeItem('hbn1_login_ts');
window.location.href = 'index.html';
}
);
}

// Aplica tema salvo imediatamente (antes do DOMContentLoaded)
(function() {
const t = localStorage.getItem('hbn1_tema') || 'light';
document.documentElement.setAttribute('data-theme', t);
})();

// UF do usuário logado: vem da URL (?uf=...) ou do localStorage (login feito em index.html)
const params = new URLSearchParams(window.location.search);
const UF_USUARIO = (params.get('uf') || localStorage.getItem('hbn1_uf') || 'PI').toUpperCase();

// Sem usuário logado? manda de volta para o login
if (!localStorage.getItem('hbn1_usuario')) {
window.location.href = 'index.html';
}
document.getElementById('ufBadgeTitulo').innerText = '(' + UF_USUARIO + ')';

// Tipo do usuário logado (PROMOTOR / VENDEDOR_FARMA / VENDEDOR_DEDICADO / ADMIN).
// Compatibilidade: cadastros antigos com "VENDEDOR" puro contam como Farma.
let TIPO_USUARIO = (localStorage.getItem('hbn1_tipo') || 'VENDEDOR_FARMA').toUpperCase();
if (TIPO_USUARIO === 'VENDEDOR') TIPO_USUARIO = 'VENDEDOR_FARMA';

// Controle de OL Danone: 0 = sem OL, 250 | 500 | 1000
let OL_ATIVO = 0;
// Controle de OL OMRON: 0 = sem OL, 500 | 1000
let OMRON_OL_ATIVO = 0;
// Valores mínimos por grupo de desconto
let BD_VALORES_MINIMOS = {}; // { chave: { minimo, label } }
let BD_CHAVES_VENCIDAS = new Set(); // chaves de desconto cuja validade (coluna D) já passou

// ST (Substituição Tributária): mapa { id_produto -> valor_st_em_reais }
let BD_ST = {};        // carregado da API
let ST_ATIVO = false;  // controlado pelos botões
// CONFIGURAÇÃO DE FORNECEDORES — cores, logos, gradientes
const CONFIG_FORNECEDORES = {
'DANONE'   : { cor1: '#3B82C4', cor2: '#1E5FA0', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/DANONE_LOGO_HORIZONTAL.png',  textoBg: '#EBF4FF' },
'UNILEVER' : { cor1: '#3D5A8A', cor2: '#253A5E', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Unilever_logo.png',             textoBg: '#EEF2FF' },
'KIMBERLY' : { cor1: '#C94040', cor2: '#9B2020', logo: 'https://embalagemmarca.com.br/wp-content/uploads/2025/11/Kimberly-Logo.jpg',         textoBg: '#FFF1F1' },
'KENVUE'   : { cor1: '#2D8B62', cor2: '#1A5C40', logo: 'https://www.celegence.com/wp-content/uploads/2025/06/Kenvue.webp',                   textoBg: '#ECFDF5' },
'OMRON'    : { cor1: '#C0392B', cor2: '#8E1F14', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/OMRON_Logo.svg/1280px-OMRON_Logo.svg.png', textoBg: '#FFF5F5' },
'NAZARIA'  : { cor1: '#E8620A', cor2: '#B84A00', logo: 'https://epedidos.nazaria.com.br/img/logo-nazaria-white.png', textoBg: '#FFF7ED' },
};

function getConfigFornecedor(nome) {
const chave = String(nome || '').toUpperCase().trim();
// Busca exata primeiro, depois parcial
if (CONFIG_FORNECEDORES[chave]) return CONFIG_FORNECEDORES[chave];
for (const k of Object.keys(CONFIG_FORNECEDORES)) {
if (chave.includes(k) || k.includes(chave)) return CONFIG_FORNECEDORES[k];
}
return { cor1: '#475569', cor2: '#1E293B', logo: '', textoBg: '#F8FAFC' };
}
// =========================================================================
// SPLASH DE ABERTURA (estilo Netflix) — nome + logos dos fornecedores
// =========================================================================
function iniciarSplashAbertura() {
const splash    = document.getElementById('splashAbertura');
const container = document.getElementById('splashLogosFornecedores');
if (!splash || !container) return;

const nomesFornecedores = Object.keys(CONFIG_FORNECEDORES).filter(n => n !== 'NAZARIA');

container.innerHTML = nomesFornecedores.map(nome => {
const cfg = CONFIG_FORNECEDORES[nome];
return `
         <div class="splash-logo-item opacity-0 bg-white/95 rounded-xl px-3 py-2 flex items-center justify-center h-10 min-w-[70px]">
           <img src="${cfg.logo}" alt="${nome}" class="h-5 max-w-[90px] object-contain" onerror="this.style.display='none'">
         </div>`;
}).join('');

// Entrada escalonada dos logos — começa logo após o nome aparecer
requestAnimationFrame(() => {
container.querySelectorAll('.splash-logo-item').forEach((el, i) => {
setTimeout(() => {
el.style.animation = 'splashFornecedorIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards';
}, 500 + i * 90);
});
});

// Fecha a splash e revela a tela de portais (que já está carregando por trás)
const duracaoTotal = 500 + nomesFornecedores.length * 90 + 550;
setTimeout(() => {
splash.style.animation = 'splashFadeOut 0.45s ease forwards';
setTimeout(() => splash.remove(), 460);
}, Math.max(duracaoTotal, 1400));
}

// =========================================================================
// SISTEMA DE TOAST / NOTIFICAÇÕES (substitui alert() nativo)
// =========================================================================
let _TOAST_ID = 0;

const _TOAST_CONFIG = {
success: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-500', text: 'text-emerald-900',
icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>' },
error:   { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-500', text: 'text-red-900',
icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>' },
warning: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-500', text: 'text-amber-900',
icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
info:    { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-500', text: 'text-blue-900',
icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' }
};

// tipo: 'success' | 'error' | 'warning' | 'info'
function mostrarToast(tipo, mensagem, duracaoMs = 4000) {
const container = document.getElementById('toastContainer');
if (!container) { console.warn('Toast container não encontrado:', mensagem); return; }

const id  = 'toast_' + (++_TOAST_ID);
const cfg = _TOAST_CONFIG[tipo] || _TOAST_CONFIG.info;

const el = document.createElement('div');
el.id = id;
el.className = `${cfg.bg} ${cfg.border} border rounded-2xl shadow-lg overflow-hidden flex items-start gap-3 p-3 pr-2 w-80 max-w-[90vw] pointer-events-auto`;
el.style.animation = 'toastIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards';
el.innerHTML = `
       <div class="${cfg.iconBg} w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5">
         <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">${cfg.icon}</svg>
       </div>
       <p class="${cfg.text} text-xs font-semibold leading-snug flex-grow pt-1">${mensagem}</p>
       <button onclick="fecharToast('${id}')" class="shrink-0 w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors">
         <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
         </svg>
       </button>`;
container.appendChild(el);

if (duracaoMs > 0) setTimeout(() => fecharToast(id), duracaoMs);
return id;
}

function fecharToast(id) {
const el = document.getElementById(id);
if (!el) return;
el.style.animation = 'toastOut 0.25s ease forwards';
setTimeout(() => el.remove(), 250);
}

// =========================================================================
// MODAL DE CONFIRMAÇÃO (substitui confirm() nativo)
// =========================================================================
let _CONFIRM_CALLBACK = null;

function mostrarConfirm(titulo, mensagem, aoConfirmar) {
_CONFIRM_CALLBACK = aoConfirmar;
document.getElementById('confirmTitulo').innerText    = titulo;
document.getElementById('confirmMensagem').innerText  = mensagem;
document.getElementById('modalConfirm').classList.remove('hidden');
}

function fecharModalConfirm() {
document.getElementById('modalConfirm').classList.add('hidden');
_CONFIRM_CALLBACK = null;
}

function fecharModalConfirmNoBackdrop(event) {
if (event.target.id === 'modalConfirm') fecharModalConfirm();
}

function confirmarAcaoModal() {
const cb = _CONFIRM_CALLBACK;
fecharModalConfirm();
if (typeof cb === 'function') cb();
}

// SISTEMA DE PORTAIS
function mostrarTelaPortais() {
document.getElementById('telaPortais').classList.remove('hidden');
document.getElementById('mainProdutos').classList.add('hidden');
document.getElementById('headerFornecedor').classList.add('hidden');

// Fundo já é branco fixo via CSS
// Nome do usuário
document.getElementById('portaisNomeUsuario').innerText =
localStorage.getItem('hbn1_nome') || localStorage.getItem('hbn1_usuario') || '';

renderizarGridPortais();
atualizarBadgesPortais();
}

function renderizarGridPortais() {
const grid = document.getElementById('gridPortais');
// Fornecedores com produtos válidos
const fornecedoresValidos = [...new Set(
BD_PRODUTOS
.filter(p => p.id && String(p.id).trim() !== '' && String(p.id).trim() !== 'Sem ID')
.map(p => (p.fornecedor || '').trim().toUpperCase())
.filter(Boolean)
)].sort();

if (fornecedoresValidos.length === 0) {
// Skeleton shimmer no formato exato dos cards finais — evita texto solto e layout shift
grid.innerHTML = Array.from({ length: 6 }).map((_, i) => `
         <div class="rounded-3xl bg-slate-100 overflow-hidden relative animate-pulse" style="min-height:188px; animation-delay:${i * 80}ms">
           <div class="h-full flex flex-col items-center justify-center gap-3 p-6">
             <div class="bg-white/60 rounded-2xl w-full max-w-[160px] h-14"></div>
             <div class="bg-white/50 rounded-full w-20 h-3"></div>
           </div>
         </div>`).join('');
return;
}

grid.innerHTML = fornecedoresValidos.map((forn, i) => {
const cfg = getConfigFornecedor(forn);
const qtd = BD_PRODUTOS.filter(p =>
p.id && String(p.id).trim() !== '' && String(p.id).trim() !== 'Sem ID' &&
(p.fornecedor || '').trim().toUpperCase() === forn
).length;
const logoHtml = cfg.logo
? `<img src="${cfg.logo}" alt="${forn}" class="h-12 max-w-[150px] object-contain" onerror="this.style.display='none'">`
: `<span class="text-slate-800 font-black text-lg">${forn}</span>`;
return `
         <button onclick="entrarFornecedor('${forn}')" data-portal-card
           class="opacity-0 translate-y-3 scale-95 transition-all duration-500 ease-out group relative overflow-hidden rounded-3xl p-6 flex flex-col items-center justify-center gap-3 shadow-md hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.03] cursor-pointer border border-white/10"
           style="background: linear-gradient(135deg, ${cfg.cor1} 0%, ${cfg.cor2} 100%); min-height: 188px;">
           <div class="relative bg-white/95 rounded-2xl px-5 py-3.5 flex items-center justify-center w-full max-w-[180px] min-h-[64px]">
             ${logoHtml}
             <span class="absolute -top-2.5 -right-2.5 bg-white text-[10px] font-black px-2 py-1 rounded-full shadow-md border-2 border-white" style="color:${cfg.cor2}">${qtd}</span>
           </div>
           <span class="text-white/85 text-[10px] font-bold uppercase tracking-wider">${qtd} produto${qtd !== 1 ? 's' : ''} disponíve${qtd !== 1 ? 'is' : 'l'}</span>
           <div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-3xl pointer-events-none"></div>
           <div class="absolute bottom-3 right-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-white/20 translate-x-1 group-hover:translate-x-0 transition-all duration-200">
             <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
           </div>
         </button>`;
}).join('');

// Entrada escalonada (stagger) — cada card surge ~60ms depois do anterior
requestAnimationFrame(() => {
grid.querySelectorAll('[data-portal-card]').forEach((btn, i) => {
setTimeout(() => {
btn.classList.remove('opacity-0', 'translate-y-3', 'scale-95');
btn.classList.add('opacity-100', 'translate-y-0', 'scale-100');
}, i * 60);
});
});
}

function entrarFornecedor(nomeFornecedor) {
filtroFornecedorAtual = nomeFornecedor.toUpperCase();
const cfg = getConfigFornecedor(nomeFornecedor);

// Esconde portais, mostra produtos
document.getElementById('telaPortais').classList.add('hidden');
document.getElementById('mainProdutos').classList.remove('hidden');

// Ambientação: header do fornecedor
const header = document.getElementById('headerFornecedor');
const headerBg = document.getElementById('headerFornecedorBg');
header.classList.remove('hidden');
headerBg.style.background = `linear-gradient(135deg, ${cfg.cor1} 0%, ${cfg.cor2} 100%)`;

if (cfg.logo) document.getElementById('logoFornecedorHeader').src = cfg.logo;
document.getElementById('nomeFornecedorHeader').innerText = nomeFornecedor;

// Atualiza painéis OL conforme o fornecedor
atualizarPaineisOLPorFornecedor(nomeFornecedor);

// Mini switcher: outros fornecedores
renderizarMiniSwitcher(nomeFornecedor);

// Filtra e renderiza produtos
executarFiltrosGerais();
atualizarBotaoSugestaoHit();

const qtd = PRODUTOS_FILTRADOS.length;
document.getElementById('qtdProdutosFornecedor').innerText = qtd + ' produto' + (qtd !== 1 ? 's' : '');

window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderizarMiniSwitcher(fornAtual) {
const container = document.getElementById('miniSwitcherFornecedores');
const fornecedoresValidos = [...new Set(
BD_PRODUTOS
.filter(p => p.id && String(p.id).trim() !== '' && String(p.id).trim() !== 'Sem ID')
.map(p => (p.fornecedor || '').trim().toUpperCase())
.filter(f => f && f !== fornAtual.toUpperCase())
)].sort();

container.innerHTML = fornecedoresValidos.map(forn => {
const cfg = getConfigFornecedor(forn);
const logoHtml = cfg.logo
? `<img src="${cfg.logo}" alt="${forn}" class="h-5 max-w-[60px] object-contain" onerror="this.parentElement.innerText='${forn}'">`
: forn;
return `
         <button onclick="entrarFornecedor('${forn}')"
           class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/40 transition-all border border-white/20"
           title="${forn}">
           <div class="bg-white rounded-md px-1.5 py-0.5 flex items-center">${logoHtml}</div>
         </button>`;
}).join('');
}

function voltarParaPortais() {
filtroFornecedorAtual = 'TODOS';
atualizarBotaoSugestaoHit();
mostrarTelaPortais();
}

function atualizarBadgesPortais() {
const qtdCarrinho = Object.keys(CARRINHO).reduce((s, k) => s + CARRINHO[k], 0);
const bc = document.getElementById('badgeMenuPedidoPortais');
if (bc) { bc.innerText = qtdCarrinho; bc.classList.toggle('hidden', qtdCarrinho === 0); }
}
// Substituição de renderizarFiltrosLaterais — agora atualiza os portais
function renderizarFiltrosLaterais() {
// Mantida para compatibilidade — agora só atualiza a tela de portais
if (!document.getElementById('telaPortais').classList.contains('hidden')) {
renderizarGridPortais();
}
}
// CÁLCULO DE PREÇO COM DESCONTO DINÂMICO (versão genérica)
// Aceita cliente e OL explícitos — usada tanto pelo catálogo (globais)
// quanto pela importação de pedidos (cliente identificado pelo CNPJ)
// Retorna { precoFinal, precoOriginal, percentualDesconto }
function calcularPrecosPara(p, cliente, olAtivo, omronOlAtivo) {
const precoBruto = converterPrecoValido(p.preco);
if (precoBruto === 0) return { precoFinal: 0, precoOriginal: 0, percentual: 0, colunaAtiva: null };

const forn       = String(p.fornecedor || '').toUpperCase().trim();
const isDanone   = forn.includes('DANONE');
const isUnilever = forn.includes('UNILEVER');
const isKenvue   = forn.includes('KENVUE');
const isOmron    = forn.includes('OMRON');
const isKimberly = forn.includes('KIMBERLY');

let percentual  = 0;
let colunaAtiva = null;

if (isDanone) {
if (cliente && olAtivo > 0) {
const perfil = String(cliente.perfilDanone || '').toUpperCase().trim();
if (perfil === 'ASSOCIATIVISMO') {
if      (olAtivo === 250)  { percentual = converterPercentual(p.olAssoc250);  colunaAtiva = 'olAssoc250'; }
else if (olAtivo === 500)  { percentual = converterPercentual(p.olAssoc500);  colunaAtiva = 'olAssoc500'; }
else if (olAtivo === 1000) { percentual = converterPercentual(p.olAssoc1000); colunaAtiva = 'olAssoc1000'; }
} else if (perfil === 'PNV') {
if      (olAtivo === 250)  { percentual = converterPercentual(p.olPnv250);  colunaAtiva = 'olPnv250'; }
else if (olAtivo === 500)  { percentual = converterPercentual(p.olPnv500);  colunaAtiva = 'olPnv500'; }
else if (olAtivo === 1000) { percentual = converterPercentual(p.olPnv1000); colunaAtiva = 'olPnv1000'; }
}
}
} else if (isUnilever) {
if (cliente) {
const grupo = String(cliente.grupoUnilever || '').toUpperCase().trim();
if      (grupo === 'GRUPO1' || grupo === '1') { percentual = converterPercentual(p.descUniG1); colunaAtiva = 'descUniG1'; }
else if (grupo === 'GRUPO2' || grupo === '2') { percentual = converterPercentual(p.descUniG2); colunaAtiva = 'descUniG2'; }
else if (grupo === 'GRUPO3' || grupo === '3') { percentual = converterPercentual(p.descUniG3); colunaAtiva = 'descUniG3'; }
}
} else if (isKenvue) {
if (cliente && String(cliente.painelTransfer || '').toUpperCase().trim() === 'TRANSFER KENVUE') {
percentual = converterPercentual(p.descTransfer);
colunaAtiva = 'descTransfer';
} else if (cliente) {
const equipe = String(cliente.equipe || '').toUpperCase().trim();
if (equipe === 'DEDICADO' && p.kenuveDedicado) {
percentual = converterPercentual(p.kenuveDedicado);
colunaAtiva = 'kenuveDedicado';
} else if (equipe === 'FARMA' && p.kenuveFarma) {
percentual = converterPercentual(p.kenuveFarma);
colunaAtiva = 'kenuveFarma';
}
}
} else if (isOmron) {
if (cliente) {
// OL OMRON tem prioridade sobre desconto de equipe
if (omronOlAtivo === 500 && p.omronOL500) {
percentual = converterPercentual(p.omronOL500);
colunaAtiva = 'omronOL500';
} else if (omronOlAtivo === 1000 && p.omronOL1000) {
percentual = converterPercentual(p.omronOL1000);
colunaAtiva = 'omronOL1000';
} else {
const equipe = String(cliente.equipe || '').toUpperCase().trim();
if (equipe === 'DEDICADO' && p.omronDedicado) {
percentual = converterPercentual(p.omronDedicado);
colunaAtiva = 'omronDedicado';
} else if (equipe === 'FARMA' && p.omronFarma) {
percentual = converterPercentual(p.omronFarma);
colunaAtiva = 'omronFarma';
}
}
}
} else if (isKimberly) {
if (cliente) {
const equipe = String(cliente.equipe || '').toUpperCase().trim();
if (equipe === 'DEDICADO' && p.kimberlyDedicado) {
percentual = converterPercentual(p.kimberlyDedicado);
colunaAtiva = 'kimberlyDedicado';
} else if (equipe === 'FARMA' && p.kimberlyFarma) {
percentual = converterPercentual(p.kimberlyFarma);
colunaAtiva = 'kimberlyFarma';
}
}
} else if (cliente) {
percentual = converterPercentual(p.descontoPadrao);
if (percentual > 0) colunaAtiva = 'descontoPadrao';
}

// NOVO — fallback: se a regra específica do fornecedor não gerou desconto
// (coluna vazia ou perfil/equipe do cliente não bate com nenhum critério),
// tenta o Desconto Padrão antes de zerar de vez. Só entra aqui se a coluna
// específica ficou em 0 — nunca sobrescreve um desconto específico já achado.
if (percentual === 0 && cliente) {
const padrao = converterPercentual(p.descontoPadrao);
if (padrao > 0) {
percentual = padrao;
colunaAtiva = 'descontoPadrao';
}
}

// Desconto vinculado a uma oferta vencida (coluna D da VALOR MINIMO) — zera
if (colunaAtiva && BD_CHAVES_VENCIDAS.has(colunaAtiva)) {
percentual = 0;
colunaAtiva = null;
}

const precoFinal = percentual > 0 ? precoBruto * (1 - percentual / 100) : precoBruto;
return { precoFinal, precoOriginal: precoBruto, percentual, colunaAtiva };
}

// Wrapper usado em todo o catálogo
function calcularPrecos(p) {
return calcularPrecosPara(p, CLIENTE_SELECIONADO, OL_ATIVO, OMRON_OL_ATIVO);
}

// Converte "15%", "15", 15, "15,5%" etc. → número float
function converterPercentual(texto) {
if (!texto && texto !== 0) return 0;
let s = String(texto).replace('%', '').replace(',', '.').trim();
const n = parseFloat(s);
return isNaN(n) ? 0 : n;
}

function converterPrecoValido(textoMoeda) {
if (!textoMoeda) return 0;
let str = String(textoMoeda).replace('R$', '').replace(/\s/g, '').trim();
if (str.includes(',') && str.includes('.')) {
str = str.replace(/\./g, '').replace(',', '.');
} else if (str.includes(',')) {
str = str.replace(',', '.');
}
const resultado = parseFloat(str);
return isNaN(resultado) ? 0 : resultado;
}

function formatarParaReal(numero) {
return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// TEXTO DE ÚLTIMA ATUALIZAÇÃO DOS DADOS (produtos/preços/estoque)
function atualizarTextoUltimaSincronizacao() {
const el = document.getElementById('textoUltimaAtualizacao');
if (!el) return;
const agora = new Date();
const dataFormatada = agora.toLocaleDateString('pt-BR');
const horaFormatada  = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
el.innerText = `🕐 Dados atualizados em ${dataFormatada} às ${horaFormatada}`;
}

// =========================================================================
// SELEÇÃO DE OL DANONE / OMRON (inline na barra de cliente)
// =========================================================================
function _resetBotoesOL() {
['btnOLNenhum', 'btnOL250', 'btnOL500', 'btnOL1000'].forEach(id => {
const b = document.getElementById(id);
if (b) { b.classList.remove('bg-purple-700', 'text-white'); b.classList.add('text-slate-400'); }
});
}

function selecionarOL(valor) {
OL_ATIVO = valor;
_resetBotoesOL();
const mapa = { 0: 'btnOLNenhum', 250: 'btnOL250', 500: 'btnOL500', 1000: 'btnOL1000' };
const btn  = document.getElementById(mapa[valor]);
if (btn) { btn.classList.remove('text-slate-400'); btn.classList.add('bg-purple-700', 'text-white'); }
executarFiltrosGerais();
atualizarIndicadoresFinanceirosGlobais();
atualizarResumoValoresMinimos();
}

function _resetBotoesOmron() {
['btnOmronSem', 'btnOmronOL500', 'btnOmronOL1000'].forEach(id => {
const b = document.getElementById(id);
if (b) { b.classList.remove('bg-red-700', 'text-white'); b.classList.add('text-slate-400'); }
});
}

function selecionarOmronOL(valor) {
OMRON_OL_ATIVO = valor;
_resetBotoesOmron();
const mapa = { 0: 'btnOmronSem', 500: 'btnOmronOL500', 1000: 'btnOmronOL1000' };
const btn  = document.getElementById(mapa[valor]);
if (btn) { btn.classList.remove('text-slate-400'); btn.classList.add('bg-red-700', 'text-white'); }
executarFiltrosGerais();
atualizarIndicadoresFinanceirosGlobais();
atualizarResumoValoresMinimos();
// Atualiza indicador de mínimos na barra
atualizarIndicadorMinimosBarra();
}


function atualizarPaineisOLPorFornecedor(fornecedor) {
const forn     = String(fornecedor || '').toUpperCase();
const isDanone = forn.includes('DANONE');
const isOmron  = forn.includes('OMRON');

// --- Painel Danone ---
const painelOL = document.getElementById('painelOL');
if (painelOL) {
if (isDanone && CLIENTE_SELECIONADO && CLIENTE_SELECIONADO.perfilDanone) {
atualizarBotoesOLDanone();
painelOL.classList.remove('hidden');
} else {
painelOL.classList.add('hidden');
OL_ATIVO = 0;
_resetBotoesOL();
const btnNenhum = document.getElementById('btnOLNenhum');
if (btnNenhum) { btnNenhum.classList.remove('text-slate-400'); btnNenhum.classList.add('bg-purple-700', 'text-white'); }
}
}

// --- Painel OMRON ---
const painelOmron = document.getElementById('painelOLOmron');
if (painelOmron) {
if (isOmron && CLIENTE_SELECIONADO) {
const temOL500  = BD_PRODUTOS.some(p => String(p.fornecedor||'').toUpperCase().includes('OMRON') && converterPercentual(p.omronOL500)  > 0);
const temOL1000 = BD_PRODUTOS.some(p => String(p.fornecedor||'').toUpperCase().includes('OMRON') && converterPercentual(p.omronOL1000) > 0);
const btn500  = document.getElementById('btnOmronOL500');
const btn1000 = document.getElementById('btnOmronOL1000');
if (btn500)  btn500.classList.toggle('hidden', !temOL500);
if (btn1000) btn1000.classList.toggle('hidden', !temOL1000);
if (temOL500 || temOL1000) painelOmron.classList.remove('hidden');
else { painelOmron.classList.add('hidden'); OMRON_OL_ATIVO = 0; }
} else {
painelOmron.classList.add('hidden');
OMRON_OL_ATIVO = 0;
}
}

// Separador: visível se cliente selecionado E pelo menos um painel de OL visível
const sep = document.getElementById('sepControles');
if (sep && CLIENTE_SELECIONADO) {
const algumOL = (painelOL && !painelOL.classList.contains('hidden')) ||
(painelOmron && !painelOmron.classList.contains('hidden'));
sep.classList.toggle('hidden', !algumOL);
}
}

function atualizarBotoesOLDanone() {
if (!CLIENTE_SELECIONADO) return;
const perfil = String(CLIENTE_SELECIONADO.perfilDanone || '').toUpperCase().trim();
const camposAssoc = { 250: 'olAssoc250', 500: 'olAssoc500', 1000: 'olAssoc1000' };
const camposPnv   = { 250: 'olPnv250',   500: 'olPnv500',   1000: 'olPnv1000' };
const campos = perfil === 'ASSOCIATIVISMO' ? camposAssoc : perfil === 'PNV' ? camposPnv : {};
[250, 500, 1000].forEach(ol => {
const campo = campos[ol];
const temDesc = campo
? BD_PRODUTOS.some(p => String(p.fornecedor||'').toUpperCase().includes('DANONE') && converterPercentual(p[campo]) > 0)
: false;
const id = { 250: 'btnOL250', 500: 'btnOL500', 1000: 'btnOL1000' }[ol];
const btn = document.getElementById(id);
if (btn) btn.classList.toggle('hidden', !temDesc);
});
}

// =========================================================================
// CLIENTES — busca, chip + popover
// =========================================================================
function filtrarClientesDropdown() {
const input    = document.getElementById('buscaClienteInput');
const dropdown = document.getElementById('dropdownClientes');
const termo    = input.value.trim().toLowerCase();
if (!termo) { dropdown.innerHTML = ''; dropdown.classList.add('hidden'); return; }

const filtrados = BD_CLIENTES.filter(c =>
String(c.id).toLowerCase().includes(termo) ||
String(c.cnpj).replace(/\D/g, '').includes(termo) ||
String(c.razao).toLowerCase().includes(termo)
);

if (filtrados.length === 0) {
dropdown.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">Nenhum cliente encontrado</div>';
dropdown.classList.remove('hidden');
return;
}

let html = '';
filtrados.slice(0, 10).forEach(c => {
html += `
         <div onclick="selecionarCliente('${c.id}')" class="p-2.5 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-none transition-colors">
           <div class="font-bold text-xs text-slate-900">${c.razao.toUpperCase()}</div>
           <div class="text-[10px] text-slate-500 flex justify-between mt-1 font-mono">
             <span>ID: ${c.id}</span>
             <span>CNPJ: ${c.cnpj}</span>
           </div>
         </div>`;
});
dropdown.innerHTML = html;
dropdown.classList.remove('hidden');
}

function togglePopoverCliente() {
const pop     = document.getElementById('popoverCliente');
const chevron = document.getElementById('chipChevron');
if (!pop) return;
const abrindo = pop.classList.contains('hidden');
pop.classList.toggle('hidden', !abrindo);
if (chevron) chevron.style.transform = abrindo ? 'rotate(180deg)' : '';
}

function selecionarCliente(id) {
const cliente = BD_CLIENTES.find(c => String(c.id) === String(id));
if (!cliente) return;
CLIENTE_SELECIONADO = cliente;

// Fecha busca, abre chip
document.getElementById('dropdownClientes').classList.add('hidden');
document.getElementById('buscaClienteInput').value = '';
document.getElementById('estadoSemCliente').classList.add('hidden');
document.getElementById('estadoComCliente').classList.remove('hidden');
const sep = document.getElementById('sepControles');
if (sep) sep.classList.remove('hidden');

// Chip
document.getElementById('chipClienteNome').innerText   = cliente.razao.toUpperCase();
document.getElementById('chipClienteAvatar').innerText = (cliente.razao || 'C')[0].toUpperCase();

// Popover — info principal
document.getElementById('popCliRazao').innerText = cliente.razao.toUpperCase();
document.getElementById('popCliCNPJ').innerText  = `CNPJ: ${cliente.cnpj}`;
document.getElementById('popCliID').innerText    = `ID: ${cliente.id}`;

// Popover — badges de perfil
const badgesEl = document.getElementById('popCliBadges');
const badges = [
cliente.grupoUnilever
? { txt: '🔵 UNI: ' + cliente.grupoUnilever,  cls: 'bg-blue-900/60 text-blue-200 border-blue-800' } : null,
cliente.perfilDanone
? { txt: '🟣 DAN: ' + cliente.perfilDanone,   cls: 'bg-purple-900/60 text-purple-200 border-purple-800' } : null,
String(cliente.painelTransfer || '').toUpperCase() === 'TRANSFER KENVUE'
? { txt: '🟠 KEN: TRANSFER', cls: 'bg-orange-900/60 text-orange-200 border-orange-800' } : null,
cliente.equipe
? { txt: '🟢 EQ: ' + cliente.equipe, cls: 'bg-emerald-900/60 text-emerald-200 border-emerald-800' } : null,
].filter(Boolean);

if (badgesEl) {
if (badges.length > 0) {
badgesEl.innerHTML = badges.map(b =>
`<span class="text-[9px] font-black px-2 py-0.5 rounded-full border ${b.cls}">${b.txt}</span>`
).join('');
badgesEl.classList.remove('hidden');
badgesEl.classList.add('flex');
} else {
badgesEl.classList.add('hidden');
badgesEl.classList.remove('flex');
}
}

// Recalcula preços com novo cliente e atualiza painéis OL
executarFiltrosGerais();
atualizarIndicadoresFinanceirosGlobais();
atualizarPaineisOLPorFornecedor(filtroFornecedorAtual);
atualizarResumoValoresMinimos();
carregarSugestaoHit();
}

function limparClienteSelecionado() {
fecharModalResumoCliente();
CLIENTE_SELECIONADO = null;
OL_ATIVO = 0;
OMRON_OL_ATIVO = 0;

// Volta para estado de busca
document.getElementById('estadoComCliente').classList.add('hidden');
document.getElementById('estadoSemCliente').classList.remove('hidden');
const pop = document.getElementById('popoverCliente');
if (pop) pop.classList.add('hidden');
const sep = document.getElementById('sepControles');
if (sep) sep.classList.add('hidden');

// Esconde painéis de OL
const painelOL = document.getElementById('painelOL');
if (painelOL) painelOL.classList.add('hidden');
const painelOmron = document.getElementById('painelOLOmron');
if (painelOmron) painelOmron.classList.add('hidden');

// Reset estados dos botões
_resetBotoesOL();
_resetBotoesOmron();
HIT_DADOS_CLIENTE = null;
HIT_ITENS_PENDENTES = [];
atualizarBotaoSugestaoHit();

executarFiltrosGerais();
atualizarIndicadoresFinanceirosGlobais();
atualizarResumoValoresMinimos();
}

document.addEventListener('click', function(e) {
// Fecha dropdown de busca de cliente
const dropdown = document.getElementById('dropdownClientes');
const input    = document.getElementById('buscaClienteInput');
if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
dropdown.classList.add('hidden');
// Fecha popover de mínimos ao clicar fora
const popMin  = document.getElementById('popoverMinimos');
const btnMin  = document.getElementById('indicadorMinimos');
if (popMin && btnMin && !btnMin.contains(e.target) && !popMin.contains(e.target)) {
popMin.classList.add('hidden');
}
}
// Fecha popover do chip de cliente
const estadoCom = document.getElementById('estadoComCliente');
const popover   = document.getElementById('popoverCliente');
if (popover && estadoCom && !estadoCom.contains(e.target)) {
popover.classList.add('hidden');
const chevron = document.getElementById('chipChevron');
if (chevron) chevron.style.transform = '';
}
});
// FILTROS
function toggleFiltroEstoque() {
FILTRO_APENAS_COM_ESTOQUE = !FILTRO_APENAS_COM_ESTOQUE;
const btn   = document.getElementById('btnFiltroEstoque');
const badge = document.getElementById('badgeFiltroEstoqueAtivo');

const ativoClass   = "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center gap-1.5";
const inativoClass = "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-slate-200 bg-white text-slate-500 hover:border-orange-400 hover:text-orange-500 flex items-center gap-1.5";

btn.className = FILTRO_APENAS_COM_ESTOQUE ? ativoClass : inativoClass;
badge.classList.toggle('hidden', !FILTRO_APENAS_COM_ESTOQUE);

executarFiltrosGerais();
}

function executarFiltrosGerais(comAnimacao = true) {
const busca = document.getElementById('barraPesquisa').value.toLowerCase().trim();
PRODUTOS_FILTRADOS = BD_PRODUTOS.filter(p => {
// Ignora linhas sem ID válido (linhas de controle/cabeçalho na planilha)
if (!p.id || String(p.id).trim() === '' || String(p.id).trim() === 'Sem ID') return false;
const condForn = filtroFornecedorAtual === "TODOS" || (p.fornecedor && String(p.fornecedor).trim().toUpperCase() === filtroFornecedorAtual);
if (FILTRO_APENAS_COM_ESTOQUE && (parseInt(p.estoque) || 0) <= 0) return false;
const condBusca = !busca ||
(p.id        && String(p.id).toLowerCase().includes(busca))        ||
(p.ean       && String(p.ean).toLowerCase().includes(busca))       ||
(p.descricao && String(p.descricao).toLowerCase().includes(busca)) ||
(p.marca     && String(p.marca).toLowerCase().includes(busca))     ||
(p.divisao   && String(p.divisao).toLowerCase().includes(busca))   ||
(p.franquia  && String(p.franquia).toLowerCase().includes(busca))  ||
(p.tag       && String(p.tag).toLowerCase().includes(busca));
return condForn && condBusca;
});
renderizarInterfaceGrafica(PRODUTOS_FILTRADOS, comAnimacao);
}

function renderizarInterfaceGrafica(lista, comAnimacao = true) {
const grid     = document.getElementById('gridProdutos');
const contador = document.getElementById('contadorProdutos');
grid.innerHTML = '';
contador.innerText = lista.length;
if (lista.length === 0) {
grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-400 font-medium bg-white rounded-2xl border border-dashed p-8">Nenhum produto localizado para os filtros informados.</div>`;
return;
}
lista.forEach((p, i) => {
const card = criarCardProduto(p);
if (comAnimacao) {
card.classList.add('card-anim-entrada');
card.style.animationDelay = `${Math.min(i * 20, 400)}ms`;
}
grid.appendChild(card);
});
}

// =========================================================================
// CARD DE PRODUTO
// =========================================================================
function criarCardProduto(p) {
const card = document.createElement('div');
card.id = `card-item-${p.id}`;

const qtdNoCarrinho = CARRINHO[p.id] || 0;
const estoque       = Number(p.estoque || 0);
const isEsgotado    = estoque <= 0;
const noCarrinho    = qtdNoCarrinho > 0;

card.className = "bg-white border rounded-2xl flex flex-col overflow-hidden relative group text-[11px] transition-all duration-200 " +
(isEsgotado
? "border-slate-100 opacity-70"
: noCarrinho
? "border-orange-300 shadow-md shadow-orange-100"
: "border-slate-100 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100/60 hover:-translate-y-1");

const { precoFinal, precoOriginal, percentual } = calcularPrecos(p);
const temDesconto = percentual > 0;

// ST: soma ANTES do desconto, depois aplica o percentual sobre (preço + ST)
const valorST = (ST_ATIVO && BD_ST[p.id]) ? Number(BD_ST[p.id]) : 0;
const temST   = ST_ATIVO && valorST > 0;

const precoOriginalComST = precoOriginal + valorST;
const precoFinalComST = temDesconto
? precoOriginalComST * (1 - percentual / 100)
: precoOriginalComST;

const precoExibidoFinal    = temST ? precoFinalComST    : precoFinal;
const precoExibidoOriginal = temST ? precoOriginalComST : precoOriginal;

const badgeTagHtml = p.tag && p.tag.trim() !== ''
? `<span class="absolute top-2 left-2 z-10 bg-[#FF6B00] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm tracking-wider">${p.tag}</span>`
: '';

// Indicadores no canto (carrinho + ST) — ficam num container com id próprio,
// para poder ser atualizado depois sem precisar recriar o card inteiro.
const badgeCantoHtml = `<div id="card-badges-${p.id}">${obterHtmlBadgesCanto(noCarrinho, temST)}</div>`;

const corPillEstoque = isEsgotado ? 'bg-red-100 text-red-600'
: estoque <= 5  ? 'bg-amber-100 text-amber-700'
: estoque <= 20 ? 'bg-yellow-100 text-yellow-700'
:                 'bg-emerald-100 text-emerald-700';

const corBarraEstoque = isEsgotado ? 'bg-red-500'
: estoque <= 5  ? 'bg-amber-400'
: estoque <= 20 ? 'bg-yellow-300'
:                 'bg-emerald-400';

const blocoPrecoHtml = temDesconto
? `<div>
            <p class="text-base font-black text-slate-900 leading-none">${formatarParaReal(precoExibidoFinal)}</p>
            <p class="text-[10px] text-slate-400 line-through leading-tight mt-0.5">${formatarParaReal(precoExibidoOriginal)}</p>
          </div>`
: `<div>
            <p class="text-base font-black text-slate-900 leading-none">${precoExibidoOriginal > 0 ? formatarParaReal(precoExibidoOriginal) : '—'}</p>
          </div>`;

card.innerHTML = `
       ${badgeTagHtml}
       ${badgeCantoHtml}

       <!-- Imagem -->
       <div class="relative bg-slate-50 flex items-center justify-center cursor-pointer overflow-hidden" style="height:140px" onclick="abrirModalDetalhes('${p.id}')">
         <img src="${p.imagens}" class="h-28 w-28 object-contain transition-transform duration-200 group-hover:scale-105 ${isEsgotado ? 'grayscale opacity-50' : 'mix-blend-multiply'}" loading="lazy">
         <span class="absolute bottom-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${corPillEstoque}">
           ${isEsgotado ? 'Esgotado' : (p.estoque || 0) + ' un'}
         </span>
       </div>
       <div class="h-[3px] w-full ${corBarraEstoque}"></div>

       <!-- Informações -->
       <div class="p-2.5 flex flex-col flex-grow gap-1.5">

         <!-- Nome e marca -->
         <div>
           <span class="text-[9px] font-black text-[#FF6B00] uppercase tracking-widest">${p.marca || ''}</span>
           <h2 class="text-[11px] font-semibold text-slate-800 line-clamp-2 leading-snug mt-0.5 min-h-[28px] cursor-pointer hover:text-orange-500 transition-colors" onclick="abrirModalDetalhes('${p.id}')">
             ${p.descricao || ''}
           </h2>
         </div>

         <!-- Embalagem + ID, em uma linha compacta -->
         <p class="text-[9px] text-slate-400 font-mono">
           Emb. <span class="text-slate-500 font-semibold">${p.embalagem ? p.embalagem + ' un' : '—'}</span>
           <span class="mx-1">·</span>
           ID <span class="text-slate-500 font-semibold">${p.id}</span>
         </p>

         <!-- Preço — hero do card -->
         <div class="mt-auto pt-2 border-t border-slate-100">
           <div class="flex items-end justify-between mb-2">
             ${blocoPrecoHtml}
            ${temDesconto ? `<span class="badge-desconto-forte text-white text-[10px] font-black px-2 py-0.5 rounded-lg">−${percentual}%</span>` : ''}
           </div>
           <div id="card-btn-${p.id}">
             ${obterHtmlBotaoAcao(p.id, qtdNoCarrinho, estoque, isEsgotado)}
           </div>
         </div>
       </div>`;
return card;
}

function obterHtmlBotaoAcao(idProd, qtd, estoque, isEsgotado) {
if (isEsgotado) return `<button disabled class="w-full py-1.5 bg-slate-100 text-slate-400 text-[10px] font-semibold rounded-xl cursor-not-allowed tracking-wide">Sem estoque</button>`;
if (qtd > 0) return `
       <div class="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl p-0.5 w-full">
         <button onclick="alterarQtd('${idProd}', -1)" class="w-7 h-7 bg-white hover:bg-orange-100 rounded-lg font-bold text-sm text-orange-500 flex items-center justify-center border border-orange-100 transition-colors shrink-0">−</button>
         <input type="number" value="${qtd}" min="1" max="${estoque}" onchange="atualizarQtdDigitada('${idProd}', this.value, ${estoque})" onkeydown="if(event.key==='Enter') this.blur();"
           class="w-full text-center font-black text-sm text-orange-600 bg-transparent focus:outline-none min-w-0 p-0 border-0">
         <button onclick="alterarQtd('${idProd}', 1)" class="w-7 h-7 bg-white hover:bg-orange-100 rounded-lg font-bold text-sm text-orange-500 flex items-center justify-center border border-orange-100 transition-colors shrink-0">+</button>
       </div>`;
return `<button onclick="alterarQtd('${idProd}', 1)" class="w-full py-1.5 bg-[#FF6B00] hover:bg-orange-600 active:scale-95 text-white text-[10px] font-bold rounded-xl transition-all tracking-wide flex items-center justify-center gap-1 shadow-sm shadow-orange-200">
       <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>Adicionar</button>`;
}
// Monta o HTML dos indicadores no canto do card (ícone de carrinho + bolinha de ST).
// Isolado numa função para poder ser chamado tanto na criação do card quanto
// na atualização de quantidade (sem precisar recriar o card inteiro).
function obterHtmlBadgesCanto(noCarrinho, temST) {
const iconeCarrinhoHtml = noCarrinho
? `<span class="absolute top-2 right-2 z-10 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow shadow-orange-300" title="No carrinho">
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"/>
            </svg>
          </span>`
: '';

const bolinhaSTHtml = temST
? `<span class="absolute top-2 ${noCarrinho ? 'right-8' : 'right-2'} z-10 w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-900/50" title="ST ativo"></span>`
: '';

return iconeCarrinhoHtml + bolinhaSTHtml;
}

function atualizarQtdDigitada(idProd, valor, estoqueMax) {
let novaQtd = parseInt(valor);
if (isNaN(novaQtd) || novaQtd <= 0) { delete CARRINHO[idProd]; novaQtd = 0; }
else {
if (novaQtd > estoqueMax) { mostrarToast('warning', `Quantidade máxima em estoque atingida (${estoqueMax} un).`); novaQtd = estoqueMax; }
CARRINHO[idProd] = novaQtd;
}
const c = document.getElementById(`card-btn-${idProd}`);
if (c) c.innerHTML = obterHtmlBotaoAcao(idProd, novaQtd, estoqueMax, false);
// Card inteiro precisa re-renderizar para refletir borda/badge "no carrinho"
_atualizarEstadoVisualCard(idProd);
atualizarIndicadoresFinanceirosGlobais();
atualizarIndicadorMinimosBarra();
atualizarBotaoSugestaoHit();  
}

function alterarQtd(idProd, mudanca) {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;
const estoqueMax = Number(p.estoque || 0);
let qtdAtual = CARRINHO[idProd] || 0;
let novaQtd  = qtdAtual + mudanca;
if (novaQtd > estoqueMax) { mostrarToast('warning', `Quantidade máxima em estoque atingida (${estoqueMax} un).`); novaQtd = estoqueMax; }
if (novaQtd <= 0) { delete CARRINHO[idProd]; novaQtd = 0; }
else CARRINHO[idProd] = novaQtd;
const c = document.getElementById(`card-btn-${idProd}`);
if (c) c.innerHTML = obterHtmlBotaoAcao(idProd, novaQtd, estoqueMax, false);
_atualizarEstadoVisualCard(idProd);
atualizarIndicadoresFinanceirosGlobais();
atualizarIndicadorMinimosBarra();
atualizarBotaoSugestaoHit();
}

// Atualiza borda/badge do card (estado "no carrinho") sem precisar re-renderizar o grid inteiro
function _atualizarEstadoVisualCard(idProd) {
const card = document.getElementById(`card-item-${idProd}`);
if (!card) return;
const noCarrinho = (CARRINHO[idProd] || 0) > 0;
const isEsgotado = card.classList.contains('opacity-70');
if (isEsgotado) return; // esgotado nunca entra no carrinho, mantém estilo
card.className = "bg-white border rounded-2xl flex flex-col overflow-hidden relative group text-[11px] transition-all duration-200 " +
(noCarrinho
? "border-orange-300 shadow-md shadow-orange-100"
: "border-slate-100 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100/60 hover:-translate-y-1");

// Recalcula o ícone de carrinho / bolinha de ST no canto, já que o card
// não é recriado do zero ao só mudar a quantidade.
const badgesEl = document.getElementById(`card-badges-${idProd}`);
if (badgesEl) {
const p = BD_PRODUTOS.find(item => item.id === idProd);
const valorST = (ST_ATIVO && p && BD_ST[idProd]) ? Number(BD_ST[idProd]) : 0;
const temST   = ST_ATIVO && valorST > 0;
badgesEl.innerHTML = obterHtmlBadgesCanto(noCarrinho, temST);
}
}
// TOTALIZADORES
function recalcularTotaisGerais() { atualizarIndicadoresFinanceirosGlobais(); }

function atualizarIndicadoresFinanceirosGlobais() {
let somaLiquida = 0;
let totalItens  = 0;
Object.keys(CARRINHO).forEach(idProd => {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;
const qtd = CARRINHO[idProd];
totalItens += qtd;
const { precoFinal } = calcularPrecos(p);
somaLiquida += precoFinal * qtd;
});
document.getElementById('totalLiquidoInferior').innerText = formatarParaReal(somaLiquida);
document.getElementById('badgeContadorInferior').innerText = totalItens;
const badge = document.getElementById('badgeContadorFlutuante');
if (badge) {
badge.innerText = totalItens;
totalItens > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
}
// Badges do menu lateral (catálogo + portais)
['badgeMenuPedido', 'badgeMenuCarrinho', 'badgeMenuPedidoPortais'].forEach(id => {
const el = document.getElementById(id);
if (!el) return;
el.innerText = totalItens;
totalItens > 0 ? el.classList.remove('hidden') : el.classList.add('hidden');
});
const btnFora   = document.getElementById('btnLimparPedidoFora');
const btnMobile = document.getElementById('btnLimparPedidoMobile');
if (totalItens > 0) {
if (btnFora)   btnFora.classList.remove('hidden');
if (btnMobile) btnMobile.classList.remove('hidden');
} else {
if (btnFora)   btnFora.classList.add('hidden');
if (btnMobile) btnMobile.classList.add('hidden');
}

// Botão flutuante "Salvar Pedido" — só aparece com itens no carrinho
const btnSalvarFlutuante = document.getElementById('btnSalvarPedidoFlutuante');
if (btnSalvarFlutuante) {
totalItens > 0 ? btnSalvarFlutuante.classList.remove('hidden') : btnSalvarFlutuante.classList.add('hidden');
}
}

function limparCarrinhoSemConfirmacao() {
CARRINHO = {};
BD_PRODUTOS.forEach(p => {
const c = document.getElementById(`card-btn-${p.id}`);
const est = Number(p.estoque || 0);
if (c) c.innerHTML = obterHtmlBotaoAcao(p.id, 0, est, est <= 0);
_atualizarEstadoVisualCard(p.id);
});
atualizarIndicadoresFinanceirosGlobais();
atualizarIndicadorMinimosBarra();
atualizarBotaoSugestaoHit();  
}

function limparPedidoCompleto() {
mostrarConfirm(
'Limpar pedido?',
'Tem certeza que deseja limpar todos os produtos selecionados do seu pedido? Esta ação não pode ser desfeita.',
() => {
limparCarrinhoSemConfirmacao();
if (!document.getElementById('modalCarrinho').classList.contains('hidden')) abrirModalCarrinho();
mostrarToast('success', 'Pedido limpo com sucesso.');
}
);
}
// MODAL CARRINHO
// MENU LATERAL DO PEDIDO
function abrirMenuPedido() {
document.getElementById('overlayMenuPedido').classList.remove('hidden');
document.getElementById('painelMenuPedido').classList.remove('translate-x-full');
}
function fecharMenuPedido() {
document.getElementById('overlayMenuPedido').classList.add('hidden');
document.getElementById('painelMenuPedido').classList.add('translate-x-full');
}
function abrirModalCarrinho() {
const boxCorpo    = document.getElementById('corpoCarrinho');
const blocoResumo = document.getElementById('blocoResumoFinanceiro');
boxCorpo.innerHTML = '';
const chaves = Object.keys(CARRINHO);
document.getElementById('totalVariedadesCarrinho').innerText = `${chaves.length} ${chaves.length === 1 ? 'produto' : 'produtos'}`;

if (chaves.length === 0) {
boxCorpo.innerHTML = `<div class="text-center py-12 text-slate-400 font-medium"><p class="text-base font-bold">Seu pedido está vazio.</p><p class="text-xs mt-1">Adicione quantidades nos itens do catálogo acima.</p></div>`;
document.getElementById('btnBaixarExcel').disabled = true;
document.getElementById('btnBaixarExcel').className = "w-full sm:w-auto px-6 py-2.5 bg-slate-300 text-slate-500 text-sm font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2";
blocoResumo.classList.add('hidden');
document.getElementById('modalCarrinho').classList.remove('hidden');
return;
}

document.getElementById('btnBaixarExcel').disabled = false;
document.getElementById('btnBaixarExcel').className = "w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider";

let acumuladorBruto   = 0;
let acumuladorLiquido = 0;
let acumuladorUnidades= 0;
let totaisPorFornecedor = {};

chaves.forEach(idProd => {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;
const qtd = CARRINHO[idProd];
acumuladorUnidades += qtd;
const { precoFinal, precoOriginal } = calcularPrecos(p);
acumuladorBruto   += precoOriginal * qtd;
acumuladorLiquido += precoFinal    * qtd;

const fornNome   = p.fornecedor ? String(p.fornecedor).trim().toUpperCase() : 'GERAL';
const divisaoNome= p.divisao    ? String(p.divisao).trim().toUpperCase()    : '';

if (fornNome.includes('UNILEVER')) {
const chT = 'UNILEVER TOTAL';
if (!totaisPorFornecedor[chT]) totaisPorFornecedor[chT] = { unidades: 0, bruto: 0, liquido: 0, destaque: true };
totaisPorFornecedor[chT].unidades += qtd;
totaisPorFornecedor[chT].bruto    += precoOriginal * qtd;
totaisPorFornecedor[chT].liquido  += precoFinal    * qtd;
const chD = divisaoNome ? `UNILEVER - ${divisaoNome}` : 'UNILEVER - OUTROS';
if (!totaisPorFornecedor[chD]) totaisPorFornecedor[chD] = { unidades: 0, bruto: 0, liquido: 0, subItem: true };
totaisPorFornecedor[chD].unidades += qtd;
totaisPorFornecedor[chD].bruto    += precoOriginal * qtd;
totaisPorFornecedor[chD].liquido  += precoFinal    * qtd;
} else {
if (!totaisPorFornecedor[fornNome]) totaisPorFornecedor[fornNome] = { unidades: 0, bruto: 0, liquido: 0 };
totaisPorFornecedor[fornNome].unidades += qtd;
totaisPorFornecedor[fornNome].bruto    += precoOriginal * qtd;
totaisPorFornecedor[fornNome].liquido  += precoFinal    * qtd;
}
});

// Resumo por fornecedor
const divFornecedores = document.createElement('div');
divFornecedores.className = "mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2";
const chavesOrdenadas = Object.keys(totaisPorFornecedor).sort((a, b) => {
if (a.includes('UNILEVER') && b.includes('UNILEVER')) {
if (a === 'UNILEVER TOTAL') return -1;
if (b === 'UNILEVER TOTAL') return 1;
return a.localeCompare(b);
}
if (a.includes('UNILEVER')) return -1;
if (b.includes('UNILEVER')) return 1;
return a.localeCompare(b);
});
let htmlForn = `
       <div class="flex justify-between items-center mb-2 border-b border-blue-200 pb-1">
         <h3 class="text-xs font-black text-blue-700 uppercase tracking-wider">Resumo por Fornecedor</h3>
         <div class="flex gap-4 text-[10px] font-bold text-blue-400 uppercase tracking-wider text-right pr-1">
           <span class="w-16">Qtd</span><span class="w-20">Bruto</span><span class="w-20">Líquido</span>
         </div>
       </div>`;
chavesOrdenadas.forEach(forn => {
const d = totaisPorFornecedor[forn];
const estiloLinha = "flex justify-between items-center text-xs border-b border-blue-100/50 pb-1.5 last:border-0 last:pb-0" + (d.subItem ? " pl-4 bg-slate-50/40" : "");
const estiloNome  = d.subItem ? "font-medium text-slate-500 italic text-[11px]" : d.destaque ? "font-black text-blue-900 tracking-tight" : "font-bold text-slate-700 truncate max-w-[180px] sm:max-w-[280px]";
htmlForn += `
         <div class="${estiloLinha}">
           <span class="${estiloNome}">${forn}</span>
           <div class="flex gap-4 text-right shrink-0 font-mono">
             <span class="text-slate-400 font-medium w-16">${d.unidades} un</span>
             <span class="text-slate-500 text-[11px] w-20">${formatarParaReal(d.bruto)}</span>
             <span class="${d.destaque ? 'font-black text-blue-600' : 'font-black text-slate-950'} w-20">${formatarParaReal(d.liquido)}</span>
           </div>
         </div>`;
});
divFornecedores.innerHTML = htmlForn;
boxCorpo.appendChild(divFornecedores);

// Lista de itens
const tituloItens = document.createElement('h3');
tituloItens.className = "text-xs font-black text-slate-400 uppercase tracking-wider mb-3";
tituloItens.innerText = "Itens do Pedido";
boxCorpo.appendChild(tituloItens);

chaves.forEach(idProd => {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;
const qtd = CARRINHO[idProd];
const estoqueMax = Number(p.estoque || 0);
const { precoFinal } = calcularPrecos(p);

const itemLinha = document.createElement('div');
itemLinha.className = "flex items-center justify-between border-b border-slate-100 pb-3 gap-4 last:border-0";
itemLinha.innerHTML = `
         <div class="flex items-center gap-3 min-w-0">
           <img src="${p.imagens}" class="w-12 h-12 object-contain bg-slate-50 rounded-lg p-1 border border-slate-100 shrink-0">
           <div class="min-w-0">
             <h4 class="text-sm font-bold text-slate-900 truncate">${p.id}</h4>
             <p class="text-xs text-slate-500 truncate">${p.descricao || 'Sem descrição'}</p>
             <div class="flex flex-wrap gap-2 text-[10px] text-slate-400 font-medium">
               <span class="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold text-[8px] uppercase">${p.fornecedor}</span>
               ${p.divisao ? `<span class="bg-blue-50 text-blue-600 px-1 rounded font-bold text-[8px] uppercase">${p.divisao}</span>` : ''}
               <span>${p.embalagem ? 'Emb: ' + p.embalagem + ' un' : ''}</span>
               <span>EAN: ${p.ean}</span>
               <span class="text-[9px] text-slate-400 font-bold">(${formatarParaReal(precoFinal)} und)</span>
             </div>
           </div>
         </div>
         <div class="flex items-center bg-slate-100 p-1 rounded-lg shrink-0">
           <button onclick="alterarQtdNoModal('${p.id}', -1)" class="w-6 h-6 bg-white hover:bg-slate-200 rounded font-bold text-xs flex items-center justify-center border shadow-sm">-</button>
           <input type="number" value="${qtd}" min="1" max="${estoqueMax}" onchange="atualizarQtdNoModalDigitada('${p.id}', this.value, ${estoqueMax})" onkeydown="if(event.key==='Enter') this.blur();" class="w-10 text-center font-black text-xs text-slate-800 bg-transparent focus:outline-none p-0 border-0 focus:ring-0">
           <button onclick="alterarQtdNoModal('${p.id}', 1)" class="w-6 h-6 bg-white hover:bg-slate-200 rounded font-bold text-xs flex items-center justify-center border shadow-sm">+</button>
         </div>`;
boxCorpo.appendChild(itemLinha);
});

document.getElementById('resumoTotalBruto').innerText   = formatarParaReal(acumuladorBruto);
document.getElementById('resumoTotalUnidades').innerText= `${acumuladorUnidades} un`;
document.getElementById('resumoTotalLiquido').innerText = formatarParaReal(acumuladorLiquido);
blocoResumo.classList.remove('hidden');
document.getElementById('modalCarrinho').classList.remove('hidden');
atualizarResumoValoresMinimos();
}

function alterarQtdNoModal(idProd, mudanca)               { alterarQtd(idProd, mudanca); abrirModalCarrinho(); }
function atualizarQtdNoModalDigitada(idProd, valor, max)  { atualizarQtdDigitada(idProd, valor, max); abrirModalCarrinho(); }
function fecharModalCarrinho()                            { document.getElementById('modalCarrinho').classList.add('hidden'); }
function fecharModalCarrinhoNoBackdrop(event)             { if (event.target.id === 'modalCarrinho') fecharModalCarrinho(); }
// MODAL DETALHES
function abrirModalDetalhes(idProd) {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;

document.getElementById('modalImagem').src      = p.imagens;
document.getElementById('modalMarca').innerText = p.marca || 'OUTROS';
document.getElementById('modalDescricao').innerText = p.descricao || 'Sem descrição cadastrada';
document.getElementById('modalId').innerText    = p.id;
document.getElementById('modalEan').innerText   = p.ean || 'N/A';
document.getElementById('modalFornecedor').innerText = p.fornecedor || 'GERAL';
document.getElementById('modalEmbalagem').innerText  = p.embalagem ? `${p.embalagem} un` : '-';

const divi = p.divisao && p.divisao !== '-'      ? p.divisao  : '';
const fran = p.franquia && p.franquia !== 'GERAL' ? p.franquia : '';
document.getElementById('modalDivisaoFranquia').innerText = (divi && fran) ? `${divi} / ${fran}` : (divi || fran || '-');

const badgeTag = document.getElementById('modalTagBadge');
if (p.tag && p.tag.trim() !== '') { badgeTag.innerText = p.tag; badgeTag.classList.remove('hidden'); }
else badgeTag.classList.add('hidden');

const { precoFinal, precoOriginal, percentual } = calcularPrecos(p);
const temDesconto = percentual > 0;

document.getElementById('modalPrecoFinal').innerText   = precoOriginal > 0 ? formatarParaReal(precoFinal) : '-';
document.getElementById('modalPrecoOriginal').innerText = temDesconto ? formatarParaReal(precoOriginal) : '';

// Bloco ST no modal — mesma lógica: desconto sobre (preço + ST)
const valorSTModal       = (ST_ATIVO && BD_ST[p.id]) ? Number(BD_ST[p.id]) : 0;
const blocoST = document.getElementById('modalBlocoST');
if (ST_ATIVO && valorSTModal > 0) {
const precoOrigComST = precoOriginal + valorSTModal;
const precoFimComST  = percentual > 0 ? precoOrigComST * (1 - percentual / 100) : precoOrigComST;
document.getElementById('modalValorST').innerText    = formatarParaReal(valorSTModal);
document.getElementById('modalPrecoComST').innerText = formatarParaReal(precoFimComST);
blocoST.classList.remove('hidden');
} else {
blocoST.classList.add('hidden');
}

const badgeDescCont = document.getElementById('modalBadgeDescontoCont');
if (temDesconto) {
document.getElementById('modalBadgeDesconto').innerText = `-${percentual}% OFF`;
badgeDescCont.classList.remove('hidden');
} else {
badgeDescCont.classList.add('hidden');
}

const estoque = Number(p.estoque || 0);
const badge = document.getElementById('modalEstoqueBadge');
if (estoque > 0) {
badge.innerText = `Disponível: ${estoque} un`;
badge.className = "absolute bottom-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm bg-emerald-100 text-emerald-800 border border-emerald-200";
} else {
badge.innerText = "Item Esgotado";
badge.className = "absolute bottom-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm bg-red-100 text-red-800 border border-red-200";
}
document.getElementById('modalDetalhes').classList.remove('hidden');
}

function fecharModalDetalhes()              { document.getElementById('modalDetalhes').classList.add('hidden'); }
function fecharModalDetalhesNoBackdrop(evt) { if (evt.target.id === 'modalDetalhes') fecharModalDetalhes(); }
// ZOOM DA IMAGEM DO PRODUTO (lightbox)
function abrirZoomImagem() {
const src = document.getElementById('modalImagem').src;
if (!src) return;
document.getElementById('modalZoomImg').src = src;
document.getElementById('modalZoomImagem').classList.remove('hidden');
}
function fecharZoomImagem()              { document.getElementById('modalZoomImagem').classList.add('hidden'); }
function fecharZoomImagemNoBackdrop(evt) { if (evt.target.id === 'modalZoomImagem') fecharZoomImagem(); }

document.addEventListener('keydown', function(e) {
if (e.key === 'Escape') {
const zoom = document.getElementById('modalZoomImagem');
if (zoom && !zoom.classList.contains('hidden')) fecharZoomImagem();
}
});
function abrirModalResumoCliente() {
if (!CLIENTE_SELECIONADO) return;
document.getElementById('resumoClienteNome').innerText = (CLIENTE_SELECIONADO.razao || '').toUpperCase();
document.getElementById('corpoResumoCliente').innerHTML = '<div class="text-center py-10 text-slate-400 text-sm font-medium">Carregando...</div>';
document.getElementById('modalResumoCliente').classList.remove('hidden');

chamarApi('resumoCliente', { uf: UF_USUARIO, codCliente: CLIENTE_SELECIONADO.id })
.then(resp => renderizarResumoCliente(resp))
.catch(() => {
document.getElementById('corpoResumoCliente').innerHTML = '<div class="text-center py-10 text-red-400 text-sm font-medium">Erro ao carregar o resumo.</div>';
});
}

function renderizarResumoCliente(resp) {
const corpo = document.getElementById('corpoResumoCliente');
if (!resp || resp.erro || !resp.fornecedores || resp.fornecedores.length === 0) {
corpo.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm font-medium">Nenhum histórico de faturamento encontrado para este cliente.</div>';
return;
}
corpo.innerHTML = resp.fornecedores.map(f => `
   <div class="bg-white border border-slate-200 rounded-xl p-3">
     <div class="flex items-center justify-between mb-2">
       <span class="text-xs font-black text-slate-700">${f.fornecedor}</span>
       ${f.positivado
         ? '<span class="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Positivado</span>'
         : '<span class="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">— Sem compra no mês</span>'}
     </div>
     <div class="grid grid-cols-3 gap-2 text-[11px]">
       <div><span class="block text-slate-400 text-[9px] uppercase font-bold">Ano Anterior</span><span class="font-bold text-slate-700">${formatarParaReal(f.faturadoAnoAnterior)}</span></div>
       <div><span class="block text-slate-400 text-[9px] uppercase font-bold">Trimestre</span><span class="font-bold text-slate-700">${formatarParaReal(f.faturadoTri)}</span></div>
       <div><span class="block text-slate-400 text-[9px] uppercase font-bold">Mês Atual</span><span class="font-bold text-orange-600">${formatarParaReal(f.faturadoMesAtual)}</span></div>
     </div>
   </div>`).join('');
}

function fecharModalResumoCliente() { document.getElementById('modalResumoCliente').classList.add('hidden'); }
function fecharModalResumoClienteNoBackdrop(event) { if (event.target.id === 'modalResumoCliente') fecharModalResumoCliente(); }
// DOWNLOAD CSV

// CONSTRÓI O WORKBOOK FORMATADO (compartilhado pelo carrinho normal
// e pela tela de importação de pedido por Excel/PDF)
// dados = { itensPorFornecedor, clienteInfo, ufExibicao, olAtivo,
//           acBruto, acLiquido, acUnidades, totalVariedades, subtitulo,
//           acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido } <- opcionais (só importação)
async function construirWorkbookPedido(dados) {
const { itensPorFornecedor, clienteInfo, ufExibicao, olAtivo,
acBruto, acLiquido, acUnidades, totalVariedades, subtitulo,
acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido } = dados;
const temResumoEstoque = acQtdNaoAtendida !== undefined;

const fornecedoresOrdenados = Object.keys(itensPorFornecedor).sort((a, b) => a.localeCompare(b));

const workbook = new ExcelJS.Workbook();
workbook.creator = 'HBN1 - Nazária Distribuidora Farmacêutica';
workbook.created = new Date();

const ws = workbook.addWorksheet('Pedido HBN1', { views: [{ showGridLines: false }] });

ws.columns = [
{ key: 'cod',   width: 11 },
{ key: 'ean',   width: 16 },
{ key: 'desc',  width: 42 },
{ key: 'preco', width: 12 },
{ key: 'desc%', width: 9  },
{ key: 'final', width: 12 },
{ key: 'qt',    width: 7  },
{ key: 'sub',   width: 13 },
{ key: 'status',width: 16 }
];

const LARANJA       = 'FFFF6B00';
const LARANJA_ESC   = 'FFE55300';
const CINZA_CLARO   = 'FFF4F4F4';
const VERDE_OK      = 'FF15803D';
const VERMELHO_SEM  = 'FFDC2626';
const BORDA_CINZA   = { style: 'thin', color: { argb: 'FFE2E2E2' } };

const mesclarEEstilizar = (linha, texto, opts = {}) => {
ws.mergeCells(`A${linha}:I${linha}`);
const cel = ws.getCell(`A${linha}`);
cel.value = texto;
cel.font = { bold: true, color: { argb: opts.corTexto || 'FFFFFFFF' }, size: opts.tamanho || 11, name: 'Calibri' };
cel.alignment = { horizontal: opts.alinhamento || 'center', vertical: 'middle' };
cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.corFundo || LARANJA } };
ws.getRow(linha).height = opts.altura || 20;
return cel;
};

// --- Cabeçalho principal (banner laranja) ---
ws.mergeCells('A1:I3');
const cabecalho = ws.getCell('A1');
const dataHoraAgora = new Date().toLocaleString('pt-BR');
cabecalho.value = {
richText: [
{ font: { bold: true, size: 18, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }, text: 'VENDAS HBN1\n' },
{ font: { bold: true, size: 10, color: { argb: 'FFFFE8D6' }, name: 'Calibri' }, text: (subtitulo || 'COMPROVANTE DE PEDIDO — CATÁLOGO HBN1') + '\n' },
{ font: { size: 9, color: { argb: 'FFFFE8D6' }, name: 'Calibri' }, text: `UF: ${ufExibicao} • ${dataHoraAgora} • ${totalVariedades} variedade(s)` }
]
};
cabecalho.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
cabecalho.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
ws.getRow(1).height = 18; ws.getRow(2).height = 16; ws.getRow(3).height = 16;

let linhaAtual = 5;

// --- Dados do cliente ---
mesclarEEstilizar(linhaAtual, 'DADOS DO CLIENTE', { corFundo: LARANJA });
linhaAtual++;

const adicionarLinhaInfo = (rotulo, valor) => {
if (!valor) return;
const lblCel = ws.getCell(`A${linhaAtual}`);
lblCel.value = rotulo;
lblCel.font = { bold: true, size: 10, color: { argb: 'FF555555' } };
ws.mergeCells(`B${linhaAtual}:I${linhaAtual}`);
const valCel = ws.getCell(`B${linhaAtual}`);
valCel.value = valor;
valCel.font = { bold: true, size: 10, color: { argb: 'FF1E1E1E' } };
ws.getRow(linhaAtual).height = 16;
linhaAtual++;
};

if (clienteInfo) {
adicionarLinhaInfo('Nome', clienteInfo.razao ? clienteInfo.razao.toUpperCase() : '');
adicionarLinhaInfo('CNPJ/CPF', clienteInfo.cnpj || '');
adicionarLinhaInfo('ID Cliente', clienteInfo.id || '');
adicionarLinhaInfo('UF', clienteInfo.uf || ufExibicao);
if (clienteInfo.grupoUnilever)  adicionarLinhaInfo('Grupo Unilever', clienteInfo.grupoUnilever);
if (clienteInfo.perfilDanone)   adicionarLinhaInfo('Perfil Danone', clienteInfo.perfilDanone);
if (clienteInfo.painelTransfer) adicionarLinhaInfo('Painel Transfer', clienteInfo.painelTransfer);
if (olAtivo > 0)                adicionarLinhaInfo('OL Danone Ativo', `${olAtivo} caixas`);
} else {
adicionarLinhaInfo('Cliente', 'NENHUM CLIENTE SELECIONADO / NÃO IDENTIFICADO');
}
linhaAtual++;

// --- Resumo geral ---
mesclarEEstilizar(linhaAtual, 'RESUMO GERAL DO PEDIDO', { corFundo: LARANJA });
linhaAtual++;
adicionarLinhaInfo('Total de Variedades', totalVariedades);
adicionarLinhaInfo('Volume Total de Unidades', acUnidades);
adicionarLinhaInfo('Valor Total Bruto', formatarParaReal(acBruto));
adicionarLinhaInfo('Valor Total Líquido', formatarParaReal(acLiquido));
linhaAtual++;

// --- Resumo de verificação de estoque (somente quando vindo da importação) ---
if (temResumoEstoque) {
mesclarEEstilizar(linhaAtual, 'VERIFICAÇÃO DE ESTOQUE', { corFundo: LARANJA });
linhaAtual++;
adicionarLinhaInfo('✅ Atendido (qtd / valor)', `${acQtdAtendida} un  —  ${formatarParaReal(acValorAtendido)}`);
if (acQtdNaoAtendida > 0) {
const lblCel = ws.getCell(`A${linhaAtual}`);
lblCel.value = '⚠️ Não Atendido (qtd / valor)';
lblCel.font = { bold: true, size: 10, color: { argb: VERMELHO_SEM } };
ws.mergeCells(`B${linhaAtual}:I${linhaAtual}`);
const valCel = ws.getCell(`B${linhaAtual}`);
valCel.value = `${acQtdNaoAtendida} un  —  ${formatarParaReal(acValorNaoAtendido)}`;
valCel.font = { bold: true, size: 10, color: { argb: VERMELHO_SEM } };
ws.getRow(linhaAtual).height = 16;
linhaAtual++;
}
linhaAtual++;
}

// --- Tabela de itens, agrupada por fornecedor ---
const cabecalhosColunas = ['COD.', 'EAN', 'DESCRIÇÃO', 'PREÇO', 'DESC%', 'PR.FINAL', 'QT', 'SUBTOTAL', 'STATUS'];

fornecedoresOrdenados.forEach(forn => {
mesclarEEstilizar(linhaAtual, `FABRICANTE: ${forn}`, { corFundo: LARANJA_ESC, tamanho: 10.5 });
linhaAtual++;

const linhaCab = ws.getRow(linhaAtual);
cabecalhosColunas.forEach((titulo, i) => {
const cel = linhaCab.getCell(i + 1);
cel.value = titulo;
cel.font = { bold: true, size: 9.5, color: { argb: 'FFFFFFFF' } };
cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
cel.alignment = { horizontal: 'center', vertical: 'middle' };
cel.border = { top: BORDA_CINZA, bottom: BORDA_CINZA, left: BORDA_CINZA, right: BORDA_CINZA };
});
linhaCab.height = 17;
linhaAtual++;

const itens = itensPorFornecedor[forn].sort((a, b) =>
String(a.p.descricao || '').localeCompare(String(b.p.descricao || ''))
);

itens.forEach((item, idx) => {
const { p, qtd, precoFinal, precoOriginal, percentual, qtdAtendida, qtdNaoAtendida } = item;
let status;
if (qtdNaoAtendida !== undefined) {
// Vem do fluxo de importação: status reflete o atendimento real (total, parcial ou nenhum)
status = qtdNaoAtendida === 0 ? 'OK' : (qtdAtendida > 0 ? `PARCIAL (${qtdAtendida}/${qtd})` : 'SEM ESTOQUE');
} else {
const estoqueDisponivel = Number(p.estoque) || 0;
status = qtd <= estoqueDisponivel ? 'OK' : 'Sem estoque';
}
const linha = ws.getRow(linhaAtual);
const corFundoLinha = (idx % 2 === 0) ? 'FFFFFFFF' : CINZA_CLARO;

const valores = [
p.id || '', p.ean || 'N/A', p.descricao || '',
precoOriginal, percentual / 100, precoFinal, qtd, precoFinal * qtd, status
];

valores.forEach((val, i) => {
const cel = linha.getCell(i + 1);
cel.value = val;
cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundoLinha } };
cel.border = { top: BORDA_CINZA, bottom: BORDA_CINZA, left: BORDA_CINZA, right: BORDA_CINZA };
cel.font = { size: 9.5, color: { argb: 'FF1E1E1E' } };
cel.alignment = { vertical: 'middle', horizontal: (i === 2) ? 'left' : 'center', wrapText: (i === 2) };

if (i === 3 || i === 5 || i === 7) cel.numFmt = '"R$" #,##0.00';
if (i === 4) cel.numFmt = '0%';
if (i === 8) cel.font = { bold: true, size: 9.5, color: { argb: status === 'OK' ? VERDE_OK : VERMELHO_SEM } };
});
linha.height = 16;
linhaAtual++;
});

linhaAtual++;
});

// --- Rodapé ---
const rodapeCel = ws.getCell(`A${linhaAtual}`);
ws.mergeCells(`A${linhaAtual}:I${linhaAtual}`);
rodapeCel.value = `HBN1 - Nazária Distribuidora Farmacêutica  •  Gerado em ${dataHoraAgora}`;
rodapeCel.font = { italic: true, size: 8, color: { argb: 'FF9CA3AF' } };
rodapeCel.alignment = { horizontal: 'center' };

return workbook;
}

// Aciona o download de um workbook já pronto
async function baixarWorkbook(workbook, nomeArquivo) {
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const url  = URL.createObjectURL(blob);
const link = document.createElement("a");
link.setAttribute("href", url);
link.setAttribute("download", nomeArquivo);
link.style.visibility = 'hidden';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
}

function limparNomeArquivo(txt) {
return String(txt || '')
.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
.replace(/[\/\\:*?"<>|]/g, '')
.trim();
}

// =========================================================================
// IMPORTAÇÃO DE PEDIDO POR ARQUIVO (EXCEL/PDF) — MÚLTIPLOS CNPJs NO MESMO ARQUIVO
// =========================================================================
if (typeof pdfjsLib !== 'undefined') {
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let IMPORT_RESULTADO = null; // { pedidos: [...], naoEncontrados: [...], codigosNaoEncontrados: [...] }
const CACHE_PRODUTOS_POR_UF = {}; // evita buscar 2x a mesma UF

function normalizarSoDigitos(v) {
return String(v || '').replace(/[^0-9]/g, '');
}

function abrirModalImportarPedido() {
document.getElementById('modalImportarPedido').classList.remove('hidden');
resetarModalImportacao();
}
function fecharModalImportarPedido() {
document.getElementById('modalImportarPedido').classList.add('hidden');
}
function fecharModalImportarPedidoNoBackdrop(event) {
if (event.target.id === 'modalImportarPedido') fecharModalImportarPedido();
}

function mostrarEstadoImportacao(estado) {
['Upload', 'Processando', 'Erro', 'Resultado'].forEach(s => {
const el = document.getElementById('importEstado' + s);
if (!el) return;
if (s.toLowerCase() === estado) {
el.classList.remove('hidden');
if (s === 'Processando') el.classList.add('flex');
} else {
el.classList.add('hidden');
if (s === 'Processando') el.classList.remove('flex');
}
});
document.getElementById('importRodapeAcoes').classList.toggle('hidden', estado !== 'resultado');
}

function resetarModalImportacao() {
IMPORT_RESULTADO = null;
document.getElementById('inputArquivoImportado').value = '';
mostrarEstadoImportacao('upload');
}

function mostrarErroImportacao(msg) {
document.getElementById('importTextoErro').innerText = msg;
mostrarEstadoImportacao('erro');
}

function atualizarTextoProcessando(msg) {
const el = document.getElementById('importTextoProcessando');
if (el) el.innerText = msg;
}
// 1) DISPARO AO SELECIONAR ARQUIVO
async function aoSelecionarArquivoImportado(event) {
const file = event.target.files[0];
if (!file) return;

mostrarEstadoImportacao('processando');
atualizarTextoProcessando('Lendo o arquivo...');

try {
const ext = file.name.split('.').pop().toLowerCase();
let linhas = [];

if (ext === 'xlsx' || ext === 'xls') {
linhas = await extrairLinhasDeExcel(file);
} else if (ext === 'pdf') {
linhas = await extrairLinhasDePdf(file);
} else {
throw new Error('Formato de arquivo não suportado. Envie um .xlsx, .xls ou .pdf.');
}

atualizarTextoProcessando('Identificando CNPJs e itens...');
const itensBrutos = extrairItensDeLinhas(linhas);

if (itensBrutos.length === 0) {
throw new Error('Não foi possível identificar produtos no arquivo. Verifique se o arquivo contém os códigos EAN e as quantidades dos produtos.');
}

await processarItensImportados(itensBrutos);
} catch (erro) {
console.error('Erro ao importar pedido:', erro);
mostrarErroImportacao(erro.message || 'Ocorreu um erro ao ler o arquivo. Tente novamente.');
}
}
// 2) LEITURA DE EXCEL (.xlsx/.xls) → array de linhas (cada linha = array de células)
function extrairLinhasDeExcel(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = (e) => {
try {
const dados = new Uint8Array(e.target.result);
const wb = XLSX.read(dados, { type: 'array' });
let todasLinhas = [];
wb.SheetNames.forEach(nomeAba => {
const ws = wb.Sheets[nomeAba];
const linhasAba = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
todasLinhas = todasLinhas.concat(linhasAba.map(l => l.map(c => String(c == null ? '' : c).trim())));
});
resolve(todasLinhas);
} catch (erro) { reject(new Error('Não foi possível ler o arquivo Excel. Ele pode estar corrompido.')); }
};
reader.onerror = () => reject(new Error('Falha ao carregar o arquivo Excel.'));
reader.readAsArrayBuffer(file);
});
}
// 3) LEITURA DE PDF → array de linhas de texto (agrupadas por posição vertical)
async function extrairLinhasDePdf(file) {
const buffer = await file.arrayBuffer();
const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
const todasLinhas = [];

for (let pagina = 1; pagina <= doc.numPages; pagina++) {
const page = await doc.getPage(pagina);
const conteudo = await page.getTextContent();
const itens = conteudo.items.map(it => ({ texto: it.str, x: it.transform[4], y: it.transform[5] }));
itens.sort((a, b) => (b.y - a.y) || (a.x - b.x));

let linhaAtualY = null;
let linhaAtualTokens = [];
itens.forEach(it => {
if (!it.texto || !it.texto.trim()) return;
if (linhaAtualY === null || Math.abs(it.y - linhaAtualY) > 3) {
if (linhaAtualTokens.length) todasLinhas.push(linhaAtualTokens);
linhaAtualTokens = [];
linhaAtualY = it.y;
}
it.texto.split(/\s+/).filter(Boolean).forEach(tok => linhaAtualTokens.push(tok));
});
if (linhaAtualTokens.length) todasLinhas.push(linhaAtualTokens);
}
return todasLinhas;
}
// 4) EXTRAÇÃO DE ITENS (CNPJ + CÓDIGO/EAN + QTD) A PARTIR DAS LINHAS
//    Funciona tanto para linhas do Excel (células) quanto do PDF (tokens)
// Normaliza CNPJ para 14 dígitos (padding de zeros à esquerda)
function normalizarCNPJ(digitos) {
return String(digitos).replace(/\D/g, '').padStart(14, '0');
}

// Normaliza EAN para 8 ou 13 dígitos (padding de zeros à esquerda)
function normalizarEAN(codigo) {
const s = String(codigo).trim();
const d = s.replace(/\D/g, '');
if (d.length === 0) return s;
if (d.length <= 8  && d.length >= 5)  return d.padStart(8,  '0');
if (d.length <= 13 && d.length >= 9)  return d.padStart(13, '0');
return d;
}

// Detecta se um token é um CNPJ válido.
// Aceita: formato pontuado (XX.XXX.XXX/XXXX-XX) com 13 ou 14 dígitos,
//         ou string de exatamente 14 dígitos numéricos.
// NÃO aceita strings de 13 dígitos puros (seriam EAN-13).
function isCNPJ(token) {
const s = String(token).trim();
const d = s.replace(/\D/g, '');
// Formato pontuado com / e - → CNPJ mesmo com zero cortado (13 dígitos)
if (/\//.test(s) && /-/.test(s) && (d.length === 13 || d.length === 14)) return true;
// String de exatamente 14 dígitos
if (/^\d{14}$/.test(s)) return true;
return false;
}

const CNPJ_SEM_CADASTRO = '__SEM_CNPJ__';

// CNPJ da própria Nazária (distribuidora) — nunca deve ser tratado como CNPJ
// do cliente, mesmo que apareça no meio do arquivo (ex: linha "Fornecedor ...").
const CNPJS_IGNORAR_COMO_CLIENTE = ['07224991002189'];
// Linhas de metadado do pedido (cabeçalho/rodapé entre um CNPJ e outro) nunca
// devem ser lidas como linha de produto — mesmo que por acaso contenham um
// número que pareça código/quantidade (ex: "Código: 1.749.801 Status: ...").
const MARCADORES_METADADO_PEDIDO = ['CÓDIGO:', 'STATUS:', 'USUÁRIO:', 'UNIDADE:', 'COTAÇÃO:', 'IMPRESSÃO:', 'COND.', 'DATA'];
function ehLinhaMetadadoPedido(tokensLinha) {
const up = tokensLinha.join(' ').toUpperCase();
return MARCADORES_METADADO_PEDIDO.some(m => up.includes(m));
}

// Identifica a quantidade correta de uma linha cruzando com os valores
// decimais (preço unitário x quantidade ≈ total). Mais confiável que pegar
// "o último número curto da linha", já que layouts de pedido costumam ter
// várias colunas numéricas curtas (código do fabricante, giro de estoque,
// qtd por caixa etc.) que não são a quantidade pedida.
//
// IMPORTANTE: não assume qual decimal vem primeiro/depois no texto extraído
// (a ordem dos tokens lidos do PDF pode não seguir a ordem visual da tabela).
// Em vez disso usa o MENOR decimal como preço e o MAIOR como total — isso é
// sempre verdade matematicamente (total = preço × qtd, e qtd ≥ 1), então
// funciona independente da ordem em que o PDF entregou os tokens.
function extrairQuantidadeConfiavel(tokens, candidatosQtd) {
// Coleta todos os valores decimais da linha (formato brasileiro: 9,40 / 13,523500 / 162,28).
// O valor "0,00" (desconto percentual nos pedidos Kenvue/A7) é excluído pois nunca é
// preço nem total — assim não "envenena" o cálculo min/max que determina a quantidade.
const decimais = tokens
.filter(t => /^\d{1,3}(\.\d{3})*,\d+$/.test(t))
.map(t => parseFloat(t.replace(/\./g, '').replace(',', '.')))
.filter(n => !isNaN(n) && n > 0.009); // exclui 0,00 (desconto) mas mantém valores reais

if (decimais.length >= 2) {
const preco = Math.min(...decimais);
const total = Math.max(...decimais);
if (preco > 0 && total >= preco) {   // >= cobre qtd=1, onde preço == total
const qtdCalculada = total / preco;
// Tenta achar um candidato curto (1-9999) que bata com o cálculo (tolerância ±0.6)
const candidatoValido = candidatosQtd.find(c => Math.abs(parseInt(c, 10) - qtdCalculada) < 0.6);
if (candidatoValido) return parseInt(candidatoValido, 10);
// Se nenhum candidato bateu mas o resultado é inteiro plausível, usa direto
if (Math.abs(qtdCalculada - Math.round(qtdCalculada)) < 0.05 && qtdCalculada >= 1 && qtdCalculada < 100000) {
return Math.round(qtdCalculada);
}
}
}
// Fallback: sem cruzamento confiável — usa o último número curto da linha.
// IMPORTANTE: exclui candidatos que parecem código interno NAZARIA (aparecem logo
// após o EAN, antes de qualquer decimal na linha) para não confundir com quantidade.
const idxPrimeiroDecimal = tokens.findIndex(t => /^\d{1,3}(\.\d{3})*,\d+$/.test(t));
const candidatosFiltrados = idxPrimeiroDecimal > 0
? candidatosQtd.filter((_, i) => {
// Remove candidatos que aparecem nos tokens ANTES do primeiro decimal —
// esses são tipicamente código interno ou giro de estoque, não quantidade pedida
const idxNoTokens = tokens.indexOf(candidatosQtd[i]);
return idxNoTokens < 0 || idxNoTokens >= idxPrimeiroDecimal;
})
: candidatosQtd;
return candidatosFiltrados.length
? parseInt(candidatosFiltrados[candidatosFiltrados.length - 1], 10)
: (candidatosQtd.length ? parseInt(candidatosQtd[candidatosQtd.length - 1], 10) : NaN);
}

// ===================================================================
// CONFIGURAÇÃO DE COLUNAS POR FORMATO DE PDF
// PDF_TIPO_1 → PDFs "bem estruturados" onde o pdf.js entrega cada
//   linha como um array de células já separadas (ex: planilha NAZARIA).
//   A quantidade é lida diretamente da coluna cujo cabeçalho bate com
//   PDF1_COL_QTD (busca por palavras, não sensível a maiúsculas).
//
// PDF_TIPO_2 → PDFs onde o pdf.js junta tudo numa mesma linha de texto
//   (ex: A7 Pharma / Kenvue). Nesses casos não há separação por coluna;
//   a quantidade é localizada como o primeiro número curto que aparece
//   APÓS o token marcador PDF2_TOKEN_APOS_QTD (que, no padrão Kenvue,
//   é o símbolo "%" do campo "Desc. (%)").
//
// ➜ Se receber um PDF de outro sistema, basta trocar:
//      PDF1_COL_QTD  → nome (ou parte do nome) do cabeçalho da coluna
//      PDF2_TOKEN_APOS_QTD → token que aparece IMEDIATAMENTE antes da
//                            quantidade na linha concatenada do pdf.js
// ===================================================================

// --- Formato 1 (NAZARIA / planilha estruturada) ---
// Palavras aceitas no cabeçalho da coluna de quantidade.
// A busca é por inclusão, não por igualdade exata.
const PDF1_COL_EAN     = ['Cód. Barras','CODBARRAS', 'EAN', 'BARRAS'];
const PDF1_COL_CODIGO  = ['CÓD.', 'COD.', 'CÓDIGO', 'CODIGO', 'COD'];
const PDF1_COL_QTD     = ['PEDIDA', 'QT PEDIDA', 'QTDE', 'QUANTIDADE', 'QUANT', 'QTD', 'QT'];
// Obs.: 'PEDIDA' captura "QT Pedida" sem precisar de match exato.

// --- Formato 2 (A7 Pharma / Kenvue — texto concatenado) ---
// Token que aparece LOGO ANTES da quantidade na linha.
// No padrão Kenvue a ordem é: ... PREÇO  0,00  %  QTD  TOTAL  FABRICANTE
// → o "%" separa o desconto da quantidade.
const PDF2_TOKEN_APOS_QTD = '%';
// Detecta se o PDF é do Tipo 1 (cabeçalho de tabela identificável).
// Retorna { linhaCab, idxCodigo, idxQtd } ou null.
//
// IMPORTANTE: NÃO exige que CNPJ esteja na mesma linha do cabeçalho.
// No NAZARIA o cabeçalho da tabela é:
//   "Cód.Fáb. | Codbarras | Código | Descrição | ... | QT Pedida | ..."
// e o CNPJ do cliente aparece em linhas separadas do cabeçalho do pedido.
// O CNPJ é lido linha a linha dentro de extrairItensTipo1.
//
// O pdf.js às vezes divide o cabeçalho em 2 linhas (ex: "QT" numa linha
// e "Pedida" na seguinte). Por isso a busca olha também a linha seguinte
// ao índice corrente ao procurar pela coluna de quantidade.
function detectarCabecalho(linhas) {
for (let i = 0; i < Math.min(linhas.length, 40); i++) {
const linha = linhas[i].map(c => String(c).toUpperCase().trim());

const idxEan = linha.findIndex(c => PDF1_COL_EAN.some(p => c === p || c.includes(p)) && !c.includes('CNPJ'));
const idxCodigo = linha.findIndex(c => PDF1_COL_CODIGO.some(p => c === p || c.includes(p)) && !c.includes('CNPJ'));
if (idxEan === -1 && idxCodigo === -1) continue; // precisa de pelo menos um identificador de produto

const linhasSeguintes = [linha];
if (linhas[i + 1]) linhasSeguintes.push(linhas[i + 1].map(c => String(c).toUpperCase().trim()));

for (const linhaBusca of linhasSeguintes) {
const idxQtd = linhaBusca.findIndex(c => PDF1_COL_QTD.some(p => c === p || c.includes(p)));
if (idxQtd !== -1) {
return { linhaCab: i, idxCodigo, idxEan, idxQtd };
}
}
}
return null;
}
// TIPO 1 — PDF estruturado (ex: NAZARIA)
// Lê a quantidade diretamente da célula na coluna PDF1_COL_QTD.
// O CNPJ do cliente aparece nas linhas de cabeçalho de cada pedido,
// ANTES da linha de itens. Por isso fazemos dois passes:
//   1) Pré-carrega o CNPJ do primeiro cliente varrendo as linhas
//      anteriores ao cabeçalho da tabela.
//   2) Loop principal: a cada nova linha atualiza o CNPJ se encontrar
//      um novo (troca de pedido / cliente dentro do mesmo arquivo).
function extrairItensTipo1(linhas, cabecalho) {
const itens = [];
let ultimoCnpjValido = '';

// Passo 1: pré-carrega CNPJ lendo as linhas ANTES do cabeçalho
for (let i = 0; i < cabecalho.linhaCab; i++) {
const linha = linhas[i];
if (!linha || linha.length === 0) continue;
const tokensLinha = linha.map(t => String(t).trim());
const linhaTextoUp = tokensLinha.join(' ').toUpperCase();
if (!linhaTextoUp.includes('FORNECEDOR')) {
const tokenCnpj = tokensLinha.find(t => {
const d = normalizarSoDigitos(t);
return isCNPJ(t) && !CNPJS_IGNORAR_COMO_CLIENTE.includes(normalizarCNPJ(t));
});
if (tokenCnpj) ultimoCnpjValido = normalizarCNPJ(normalizarSoDigitos(tokenCnpj));
}
}

// Passo 2: percorre as linhas de dados após o cabeçalho
// Passo 2: percorre as linhas de dados após o cabeçalho
for (let i = cabecalho.linhaCab + 1; i < linhas.length; i++) {
const linha = linhas[i];
if (!linha || linha.length === 0) continue;

const tokensLinha = linha.map(t => String(t).trim());
const linhaTextoUp = tokensLinha.join(' ').toUpperCase();
if (!linhaTextoUp.includes('FORNECEDOR')) {
const tokenCnpj = tokensLinha.find(t => {
const d = normalizarSoDigitos(t);
return isCNPJ(t) && !CNPJS_IGNORAR_COMO_CLIENTE.includes(normalizarCNPJ(t));
});
if (tokenCnpj) ultimoCnpjValido = normalizarCNPJ(normalizarSoDigitos(tokenCnpj));
}

// Nunca tenta extrair produto de linha de metadado (Código:/Status:/Usuário: etc.)
if (ehLinhaMetadadoPedido(tokensLinha)) continue;

const codigoInterno = cabecalho.idxCodigo >= 0 ? String(linha[cabecalho.idxCodigo] || '').trim().replace(/\.0$/, '') : '';
let eanBruto        = cabecalho.idxEan    >= 0 ? String(linha[cabecalho.idxEan]    || '').trim().replace(/\.0$/, '') : '';

// Valida se o valor posicional é mesmo um EAN puro (6-13 dígitos, sem pontuação).
// Se não for (coluna desalinhada por quebra de linha do Produto/Fabricante),
// busca qualquer token da linha que tenha esse formato.
if (!/^\d{6,13}$/.test(eanBruto)) {
const achado = tokensLinha.find(t => /^\d{6,13}$/.test(t));
if (achado) eanBruto = achado;
}

const eanValido    = /^\d{6,13}$/.test(eanBruto);
const codigoValido = /^\d{6,13}$/.test(normalizarSoDigitos(codigoInterno));
const ean = eanValido ? normalizarEAN(eanBruto) : '';

const candidatosQtd = tokensLinha.filter(t => /^\d{1,4}$/.test(t));
let qtd = extrairQuantidadeConfiavel(tokensLinha, candidatosQtd);
if (isNaN(qtd) || qtd <= 0) {
const qtdPosicional = parseInt(String(linha[cabecalho.idxQtd] || '').replace(/[^\d]/g, ''), 10);
qtd = (!isNaN(qtdPosicional) && qtdPosicional > 0 && qtdPosicional < 100000) ? qtdPosicional : NaN;
}

if ((codigoValido || eanValido) && qtd > 0) {
itens.push({ cnpjDigits: ultimoCnpjValido || CNPJ_SEM_CADASTRO, codigo: codigoInterno, ean, qtd });
}
}
return itens;
}
// TIPO 2 — PDF de texto concatenado (ex: A7 Pharma / Kenvue)
// O pdf.js junta vários campos numa só linha de tokens.
// Estratégia:
//   • CNPJ do cliente: primeiro CNPJ encontrado na linha (ignora
//     linhas com a palavra "FORNECEDOR")
//   • Código (EAN): primeiro token com 7-13 dígitos
//   • Quantidade: primeiro número curto (1-4 dígitos) que aparece
//     APÓS o token PDF2_TOKEN_APOS_QTD (padrão: "%")
function extrairItensTipo2(linhas) {
const itens = [];
let ultimoCnpjValido = '';

linhas.forEach(linha => {
if (!linha || linha.length === 0) return;
const tokens = linha.map(t => String(t).trim()).filter(Boolean);
const linhaTextoUpper = tokens.join(' ').toUpperCase();

// Atualiza CNPJ ativo (ignora linhas do fornecedor)
if (!linhaTextoUpper.includes('FORNECEDOR')) {
const tokenCnpj = tokens.find(t => {
const d = normalizarSoDigitos(t);
return isCNPJ(t) && !CNPJS_IGNORAR_COMO_CLIENTE.includes(normalizarCNPJ(t));
});
if (tokenCnpj) ultimoCnpjValido = normalizarCNPJ(normalizarSoDigitos(tokenCnpj));
}

// Precisa de EAN e do token marcador para tentar extrair item
const candidatosCodigo = tokens.filter(t => /^\d{7,13}$/.test(t));
const idxMarcador = tokens.indexOf(PDF2_TOKEN_APOS_QTD);

if (candidatosCodigo.length > 0 && idxMarcador !== -1) {
const codigo = normalizarEAN(candidatosCodigo[0]);
const tokensAposMarcador = tokens.slice(idxMarcador + 1);
const qtdToken = tokensAposMarcador.find(t => /^\d{1,4}$/.test(t));
if (qtdToken) {
const qtd = parseInt(qtdToken, 10);
if (qtd > 0 && qtd < 100000) {
itens.push({ cnpjDigits: ultimoCnpjValido || CNPJ_SEM_CADASTRO, codigo, qtd });
}
}
}
});

return itens;
}
// Ponto de entrada: decide automaticamente Tipo 1 ou Tipo 2
function extrairItensDeLinhas(linhas) {
const cabecalho = detectarCabecalho(linhas);
if (cabecalho) {
// PDF Tipo 1 — cabeçalho de tabela identificado
return extrairItensTipo1(linhas, cabecalho);
} else {
// PDF Tipo 2 — texto concatenado, usa token marcador
return extrairItensTipo2(linhas);
}
}
// 5) PROCESSAMENTO: identifica clientes por CNPJ (cross-UF), busca produtos
//    da UF de cada cliente, casa itens e calcula preços
function buscarClientePorCNPJAsync(cnpjDigits) {
return chamarApi('clientePorCnpj', { cnpj: cnpjDigits }).catch(() => null);
}

function buscarProdutosAsync(uf) {
if (CACHE_PRODUTOS_POR_UF[uf]) return Promise.resolve(CACHE_PRODUTOS_POR_UF[uf]);
return chamarApi('produtos', { uf: uf })
.then(produtos => {
CACHE_PRODUTOS_POR_UF[uf] = produtos;
return produtos;
})
.catch(() => []);
}

// Mapa de UFs disponíveis para o seletor manual
const MAPA_UFS_DISPONIVEIS = {
'PI': 'Piauí', 'MA': 'Maranhão/Timon', 'IMPTZ': 'Imperatriz',
'TO': 'Tocantins', 'PB': 'Paraíba', 'PE': 'Pernambuco',
'PA': 'Pará', 'AP': 'Amapá', 'RN': 'Rio Grande do Norte',
'CE': 'Ceará', 'BA': 'Bahia', 'SE': 'Sergipe', 'AL': 'Alagoas'
};

async function processarCnpjSemCadastro(cnpjDigits, uf) {
const naoEnc = IMPORT_RESULTADO.naoEncontrados.find(n => n.cnpjDigits === cnpjDigits);
if (!naoEnc || !naoEnc.itensOriginais || naoEnc.itensOriginais.length === 0) {
mostrarToast('error', 'Itens originais não disponíveis. Tente reimportar o arquivo.');
return;
}

const clienteAvulso = {
cnpj: cnpjDigits, razao: 'CNPJ ' + formatarCNPJ(cnpjDigits),
grupoUnilever: '', perfilDanone: '', painelTransfer: '', equipe: '',
uf: uf, _avulso: true
};

const produtosDaUF = await buscarProdutosAsync(uf);
const codigosNaoEncontradosSet = new Set(IMPORT_RESULTADO.codigosNaoEncontrados);
let totalDanoneQtd = 0;
const itensCasados = [];

naoEnc.itensOriginais.forEach(it => {
const eanDigits = normalizarSoDigitos(it.ean);
let p = null;
if (eanDigits) p = produtosDaUF.find(prod => normalizarSoDigitos(prod.ean) === eanDigits);
if (!p && it.codigo) p = produtosDaUF.find(prod => String(prod.id).trim() === String(it.codigo).trim());
if (!p && eanDigits) p = produtosDaUF.find(prod => String(prod.id).trim() === eanDigits); // fallback: às vezes o "EAN" do arquivo do cliente é na verdade o código interno
if (!p) { codigosNaoEncontradosSet.add(it.codigo || it.ean); return; }
itensCasados.push({ p, qtd: it.qtd });
if (String(p.fornecedor || '').toUpperCase().includes('DANONE')) totalDanoneQtd += it.qtd;
});

if (itensCasados.length === 0) {
mostrarToast('error', 'Nenhum produto encontrado para a UF ' + uf + '. Verifique os EANs do arquivo.');
return;
}

let olDetectado = 0;
if (totalDanoneQtd >= 1000) olDetectado = 1000;
else if (totalDanoneQtd >= 500) olDetectado = 500;
else if (totalDanoneQtd >= 250) olDetectado = 250;

let acBruto = 0, acLiquido = 0, acUnidades = 0;
let acQtdAtendida = 0, acValorAtendido = 0, acQtdNaoAtendida = 0, acValorNaoAtendido = 0;
const estoqueRest = {};
const itensPorFornecedor = {};

itensCasados.forEach(({ p, qtd }) => {
const { precoFinal, precoOriginal, percentual } = calcularPrecosPara(p, clienteAvulso, olDetectado, 0);
acBruto += precoOriginal * qtd; acLiquido += precoFinal * qtd; acUnidades += qtd;
if (estoqueRest[p.id] === undefined) estoqueRest[p.id] = Number(p.estoque || 0);
const qtdAt = Math.min(qtd, estoqueRest[p.id]);
const qtdNAt = qtd - qtdAt;
estoqueRest[p.id] -= qtdAt;
acQtdAtendida += qtdAt; acValorAtendido += precoFinal * qtdAt;
acQtdNaoAtendida += qtdNAt; acValorNaoAtendido += precoFinal * qtdNAt;
const forn = (p.fornecedor || 'GERAL').trim().toUpperCase();
if (!itensPorFornecedor[forn]) itensPorFornecedor[forn] = [];
itensPorFornecedor[forn].push({ p, qtd, precoFinal, precoOriginal, percentual, qtdAtendida: qtdAt, qtdNaoAtendida: qtdNAt });
});

IMPORT_RESULTADO.pedidos.push({
cliente: clienteAvulso, olDetectado, itensPorFornecedor,
acBruto, acLiquido, acUnidades, totalVariedades: itensCasados.length,
acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido
});
IMPORT_RESULTADO.naoEncontrados = IMPORT_RESULTADO.naoEncontrados.filter(n => n.cnpjDigits !== cnpjDigits);
IMPORT_RESULTADO.codigosNaoEncontrados = Array.from(codigosNaoEncontradosSet);
renderizarResultadoImportacao();
mostrarToast('success', `Pedido calculado para a UF ${uf}.`);
}

async function processarItensImportados(itensBrutos) {
atualizarTextoProcessando('Identificando clientes pelos CNPJs...');

const gruposPorCnpj = {};
itensBrutos.forEach(it => {
if (!gruposPorCnpj[it.cnpjDigits]) gruposPorCnpj[it.cnpjDigits] = [];
gruposPorCnpj[it.cnpjDigits].push(it);
});
const cnpjsUnicos = Object.keys(gruposPorCnpj);

const clientesEncontrados = await Promise.all(cnpjsUnicos.map(buscarClientePorCNPJAsync));

const pedidos = [];
const naoEncontrados = [];
const codigosNaoEncontradosSet = new Set();

for (let i = 0; i < cnpjsUnicos.length; i++) {
const cnpjDigits = cnpjsUnicos[i];
const cliente = clientesEncontrados[i];
const itensDoGrupo = gruposPorCnpj[cnpjDigits];

// Arquivo sem CNPJ: vai direto para seleção manual de UF
if (cnpjDigits === CNPJ_SEM_CADASTRO || !cliente) {
const totalQtd = itensDoGrupo.reduce((s, it) => s + it.qtd, 0);
naoEncontrados.push({
cnpjDigits,
cnpjFormatado: cnpjDigits === CNPJ_SEM_CADASTRO ? 'Arquivo sem CNPJ' : formatarCNPJ(cnpjDigits),
linhas: itensDoGrupo.length,
unidades: totalQtd,
itensOriginais: itensDoGrupo
});
continue;
}

atualizarTextoProcessando(`Calculando pedido de ${cliente.razao || cliente.cnpj}...`);
const produtosDaUF = await buscarProdutosAsync(cliente.uf || 'PI');

let totalDanoneQtd = 0;
const itensCasados = [];
itensDoGrupo.forEach(it => {
const eanDigits = normalizarSoDigitos(it.ean);
let p = null;
if (eanDigits) p = produtosDaUF.find(prod => normalizarSoDigitos(prod.ean) === eanDigits);
if (!p && it.codigo) p = produtosDaUF.find(prod => String(prod.id).trim() === String(it.codigo).trim());
if (!p && eanDigits) p = produtosDaUF.find(prod => String(prod.id).trim() === eanDigits); // fallback: às vezes o "EAN" do arquivo do cliente é na verdade o código interno
if (!p) { codigosNaoEncontradosSet.add(it.codigo || it.ean); return; }

itensCasados.push({ p, qtd: it.qtd });
if (String(p.fornecedor || '').toUpperCase().includes('DANONE')) totalDanoneQtd += it.qtd;
});

if (itensCasados.length === 0) continue;

let olDetectado = 0;
if (totalDanoneQtd >= 1000) olDetectado = 1000;
else if (totalDanoneQtd >= 500) olDetectado = 500;
else if (totalDanoneQtd >= 250) olDetectado = 250;

let acBruto = 0, acLiquido = 0, acUnidades = 0;
let acQtdAtendida = 0, acValorAtendido = 0, acQtdNaoAtendida = 0, acValorNaoAtendido = 0;
const estoqueRestantePorProduto = {}; // controla consumo de estoque entre linhas repetidas do mesmo cliente
const itensPorFornecedor = {};
itensCasados.forEach(({ p, qtd }) => {
const { precoFinal, precoOriginal, percentual } = calcularPrecosPara(p, cliente, olDetectado);
acBruto   += precoOriginal * qtd;
acLiquido += precoFinal * qtd;
acUnidades += qtd;

// Verificação de estoque: quanto desta linha o estoque atual do catálogo consegue atender
if (estoqueRestantePorProduto[p.id] === undefined) estoqueRestantePorProduto[p.id] = Number(p.estoque || 0);
const estoqueRestante = estoqueRestantePorProduto[p.id];
const qtdAtendida    = Math.max(0, Math.min(qtd, estoqueRestante));
const qtdNaoAtendida = qtd - qtdAtendida;
estoqueRestantePorProduto[p.id] = estoqueRestante - qtdAtendida;

acQtdAtendida      += qtdAtendida;
acValorAtendido    += precoFinal * qtdAtendida;
acQtdNaoAtendida   += qtdNaoAtendida;
acValorNaoAtendido += precoFinal * qtdNaoAtendida;

const forn = p.fornecedor ? String(p.fornecedor).trim().toUpperCase() : 'GERAL';
if (!itensPorFornecedor[forn]) itensPorFornecedor[forn] = [];
itensPorFornecedor[forn].push({ p, qtd, precoFinal, precoOriginal, percentual, qtdAtendida, qtdNaoAtendida });
});

pedidos.push({
cliente, olDetectado, itensPorFornecedor,
acBruto, acLiquido, acUnidades,
acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido,
totalVariedades: itensCasados.length
});
}

IMPORT_RESULTADO = {
pedidos,
naoEncontrados,
codigosNaoEncontrados: Array.from(codigosNaoEncontradosSet)
};

renderizarResultadoImportacao();
if (pedidos.length > 0) {
mostrarToast('success', `${pedidos.length} CNPJ${pedidos.length !== 1 ? 's' : ''} identificado${pedidos.length !== 1 ? 's' : ''} e calculado${pedidos.length !== 1 ? 's' : ''} com sucesso.`);
}
}

function formatarCNPJ(digits) {
if (digits.length !== 14) return digits;
return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
// 6) RENDERIZAÇÃO DO RESULTADO NA TELA
function renderizarResultadoImportacao() {
const { pedidos, naoEncontrados, codigosNaoEncontrados } = IMPORT_RESULTADO;

if (pedidos.length === 0 && naoEncontrados.length === 0) {
mostrarErroImportacao('Nenhum item pôde ser processado. Verifique o arquivo e tente novamente.');
return;
}

let acBrutoGeral = 0, acLiquidoGeral = 0, acUnidadesGeral = 0;
let acQtdAtendidaGeral = 0, acValorAtendidoGeral = 0, acQtdNaoAtendidaGeral = 0, acValorNaoAtendidoGeral = 0;

const blocosHtml = pedidos.map(pedido => {
const { cliente, olDetectado, itensPorFornecedor, acBruto, acLiquido, acUnidades, totalVariedades,
acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido } = pedido;
acBrutoGeral += acBruto; acLiquidoGeral += acLiquido; acUnidadesGeral += acUnidades;
acQtdAtendidaGeral += acQtdAtendida; acValorAtendidoGeral += acValorAtendido;
acQtdNaoAtendidaGeral += acQtdNaoAtendida; acValorNaoAtendidoGeral += acValorNaoAtendido;

const linhasItens = Object.keys(itensPorFornecedor).sort().map(forn =>
itensPorFornecedor[forn].map(({ p, qtd, precoFinal, qtdAtendida, qtdNaoAtendida }) => `
           <tr class="border-t border-slate-100">
             <td class="p-1.5 text-slate-500 font-mono text-[10px]">${p.ean || 'N/A'}</td>
             <td class="p-1.5 text-slate-700">${p.descricao || ''}</td>
             <td class="p-1.5 text-center font-bold ${qtdNaoAtendida > 0 ? 'text-red-600' : ''}">
               ${qtd}
               ${qtdNaoAtendida > 0 ? `<div class="text-[9px] font-normal text-red-500 leading-tight">(${qtdAtendida} disp.)</div>` : ''}
             </td>
             <td class="p-1.5 text-right font-bold text-emerald-700">${formatarParaReal(precoFinal * qtd)}</td>
           </tr>`).join('')
).join('');

const blocoEstoqueClienteHtml = acQtdNaoAtendida > 0 ? `
           <div class="bg-white px-3 py-2 border-t border-emerald-100 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
             <span class="font-bold text-emerald-700">✅ Atendido: ${acQtdAtendida} un • ${formatarParaReal(acValorAtendido)}</span>
             <span class="font-bold text-red-600">⚠️ Não atendido: ${acQtdNaoAtendida} un • ${formatarParaReal(acValorNaoAtendido)}</span>
           </div>` : '';

return `
         <div class="border border-emerald-200 rounded-2xl overflow-hidden">
           <div class="bg-emerald-50 p-3 flex flex-wrap items-center justify-between gap-2">
             <div>
               <p class="text-sm font-black text-emerald-900">${(cliente.razao || 'CLIENTE').toUpperCase()}</p>
               <p class="text-[11px] text-emerald-700 font-mono">${formatarCNPJ(cliente.cnpj ? normalizarSoDigitos(cliente.cnpj) : '')} • UF: ${cliente.uf || '-'}${olDetectado > 0 ? ' • OL Danone: ' + olDetectado : ''}</p>
             </div>
             <div class="text-right">
               <p class="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Total Líquido</p>
               <p class="text-sm font-black text-emerald-800">${formatarParaReal(acLiquido)}</p>
               <p class="text-[10px] text-emerald-600">${totalVariedades} itens • ${acUnidades} un</p>
             </div>
           </div>
           ${blocoEstoqueClienteHtml}
           <table class="w-full text-xs">
             <tbody>${linhasItens}</tbody>
           </table>
         </div>`;
}).join('');

document.getElementById('importBlocosClientes').innerHTML = blocosHtml || '<p class="text-xs text-slate-400 text-center py-4">Nenhum cliente identificado.</p>';
document.getElementById('importTotalCnpjsOk').innerText = pedidos.length;
document.getElementById('importTotalUnidades').innerText = acUnidadesGeral;
document.getElementById('importTotalBruto').innerText = formatarParaReal(acBrutoGeral);
document.getElementById('importTotalLiquido').innerText = formatarParaReal(acLiquidoGeral);

const blocoResumoEstoque = document.getElementById('importBlocoResumoEstoque');
if (acQtdNaoAtendidaGeral > 0) {
blocoResumoEstoque.innerHTML = `
         <div class="bg-emerald-50 rounded-xl p-3 border-2 border-emerald-200 text-center">
           <span class="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">✅ Valor Atendido</span>
           <span class="text-sm font-black text-emerald-800 block">${formatarParaReal(acValorAtendidoGeral)}</span>
           <span class="text-[10px] text-emerald-600">${acQtdAtendidaGeral} un</span>
         </div>
         <div class="bg-red-50 rounded-xl p-3 border-2 border-red-200 text-center">
           <span class="text-[9px] font-black text-red-600 uppercase tracking-wider block">⚠️ Valor Não Atendido</span>
           <span class="text-sm font-black text-red-700 block">${formatarParaReal(acValorNaoAtendidoGeral)}</span>
           <span class="text-[10px] text-red-600">${acQtdNaoAtendidaGeral} un</span>
         </div>`;
} else {
blocoResumoEstoque.innerHTML = `
         <div class="col-span-2 bg-emerald-50 rounded-xl p-3 border-2 border-emerald-200 text-center">
           <span class="text-xs font-black text-emerald-700">✅ Estoque suficiente para atender 100% do pedido (${acQtdAtendidaGeral} un)</span>
         </div>`;
}

const blocoCnpjNaoEnc = document.getElementById('importBlocoCnpjNaoEncontrados');
if (naoEncontrados.length > 0) {
const ufsDisponiveis = Object.keys(MAPA_UFS_DISPONIVEIS).sort();
document.getElementById('importTabelaCnpjNaoEncontrados').innerHTML = naoEncontrados.map(n => `
         <div class="bg-white rounded-xl border border-amber-200 p-3 flex flex-col gap-2">
           <div class="flex items-center justify-between flex-wrap gap-2">
             <div>
               <span class="font-mono font-bold text-amber-700 text-xs">${n.cnpjFormatado}</span>
               <span class="text-amber-500 text-[10px] ml-2">${n.linhas} linha(s) • ${n.unidades} un</span>
             </div>
             <span class="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">CNPJ não cadastrado</span>
           </div>
           <div class="flex items-center gap-2 flex-wrap">
             <span class="text-[10px] text-slate-500 font-medium shrink-0">Calcular pela UF:</span>
             <div class="flex flex-wrap gap-1.5">
               ${ufsDisponiveis.map(uf => `
                 <button onclick="processarCnpjSemCadastro('${n.cnpjDigits}', '${uf}')"
                   class="px-2.5 py-1 text-[9px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all">
                   ${uf}
                 </button>`).join('')}
             </div>
           </div>
         </div>`).join('');
blocoCnpjNaoEnc.classList.remove('hidden');
} else {
blocoCnpjNaoEnc.classList.add('hidden');
}

const blocoCodNaoEnc = document.getElementById('importBlocoCodigoNaoEncontrados');
if (codigosNaoEncontrados.length > 0) {
document.getElementById('importTextoCodigoNaoEncontrados').innerText = codigosNaoEncontrados.join(', ');
blocoCodNaoEnc.classList.remove('hidden');
} else {
blocoCodNaoEnc.classList.add('hidden');
}

mostrarEstadoImportacao('resultado');
}
// 7) EXPORTAÇÃO EM EXCEL DO PEDIDO IMPORTADO (todos os CNPJs no mesmo arquivo)

// O Excel não permite duas abas com o mesmo nome no mesmo arquivo. Como é comum
// que dois CNPJs diferentes pertençam à mesma razão social (filiais de uma rede,
// ou nomes que ficam iguais após o corte de caracteres), esta função garante que
// cada aba tenha um nome único, acrescentando " (2)", " (3)" etc. quando necessário.
function gerarNomeAbaUnico(nomeBase, nomesJaUsados) {
const limite = 31; // limite máximo de caracteres permitido pelo Excel para nomes de aba
let base = (nomeBase || 'CLIENTE').substring(0, limite) || 'CLIENTE';
let nomeFinal = base;
let contador = 2;
while (nomesJaUsados.has(nomeFinal.toUpperCase())) {
const sufixo = ` (${contador})`;
nomeFinal = base.substring(0, limite - sufixo.length) + sufixo;
contador++;
}
nomesJaUsados.add(nomeFinal.toUpperCase());
return nomeFinal;
}

async function baixarExcelPedidoImportado() {
if (!IMPORT_RESULTADO || IMPORT_RESULTADO.pedidos.length === 0) return;

const btn = document.getElementById('btnBaixarExcelImportado');
const textoOriginal = btn.innerHTML;
btn.disabled = true; btn.style.opacity = '0.6'; btn.style.cursor = 'wait';

try {
const workbook = new ExcelJS.Workbook();
workbook.creator = 'HBN1 - Nazária Distribuidora Farmacêutica';
workbook.created = new Date();

const nomesAbasUsados = new Set();

for (const pedido of IMPORT_RESULTADO.pedidos) {
const { cliente, olDetectado, itensPorFornecedor, acBruto, acLiquido, acUnidades, totalVariedades,
acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido } = pedido;

const wbTemp = await construirWorkbookPedido({
itensPorFornecedor,
clienteInfo: cliente,
ufExibicao: cliente.uf || 'PI',
olAtivo: olDetectado,
acBruto, acLiquido, acUnidades,
acQtdAtendida, acValorAtendido, acQtdNaoAtendida, acValorNaoAtendido,
totalVariedades,
subtitulo: 'PEDIDO IMPORTADO — ARQUIVO DO CLIENTE'
});

const wsOrigem = wbTemp.worksheets[0];
const nomeBaseAba = limparNomeArquivo(cliente.razao || cliente.cnpj || 'CLIENTE');
const nomeAba = gerarNomeAbaUnico(nomeBaseAba, nomesAbasUsados);
const wsDestino = workbook.addWorksheet(nomeAba, { views: [{ showGridLines: false }] });
wsDestino.columns = wsOrigem.columns;
wsOrigem.eachRow({ includeEmpty: true }, (row, rowNumber) => {
const novaLinha = wsDestino.getRow(rowNumber);
novaLinha.height = row.height;
row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
const novaCel = novaLinha.getCell(colNumber);
novaCel.value = cell.value;
novaCel.style = cell.style;
});
});
wsOrigem.model.merges.forEach(faixa => wsDestino.mergeCells(faixa));
}

if (IMPORT_RESULTADO.naoEncontrados.length > 0) {
const wsNaoEnc = workbook.addWorksheet('CNPJ Não Encontrados', { views: [{ showGridLines: false }] });
wsNaoEnc.columns = [{ width: 22 }, { width: 14 }, { width: 14 }];
wsNaoEnc.mergeCells('A1:C1');
const titulo = wsNaoEnc.getCell('A1');
titulo.value = 'CNPJs NÃO ENCONTRADOS NA BASE DE CLIENTES';
titulo.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
titulo.alignment = { horizontal: 'center', vertical: 'middle' };
wsNaoEnc.getRow(1).height = 22;

const cabecalho = wsNaoEnc.getRow(3);
['CNPJ', 'Linhas no Arquivo', 'Unidades'].forEach((t, i) => {
const c = cabecalho.getCell(i + 1);
c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
c.alignment = { horizontal: 'center' };
});

IMPORT_RESULTADO.naoEncontrados.forEach((n, idx) => {
const linha = wsNaoEnc.getRow(4 + idx);
linha.getCell(1).value = n.cnpjFormatado;
linha.getCell(2).value = n.linhas;
linha.getCell(3).value = n.unidades;
linha.eachCell(c => { c.alignment = { horizontal: 'center' }; c.font = { color: { argb: 'FFDC2626' }, bold: true }; });
});
}

const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
await baixarWorkbook(workbook, `Pedidos_Importados_HBN1_${dataHoje}.xlsx`);
mostrarToast('success', 'Excel dos pedidos importados baixado com sucesso.');
} catch (erro) {
console.error('Erro ao gerar Excel do pedido importado:', erro);
mostrarToast('error', 'Ocorreu um erro ao gerar o arquivo Excel: ' + (erro && erro.message ? erro.message : 'Tente novamente.'));
} finally {
btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.innerHTML = textoOriginal;
}
}
// EXPORTAÇÃO DO CARRINHO ATUAL (botão "Fechar & Baixar Pedido")
async function fazerDownloadExcel() {
const chaves = Object.keys(CARRINHO);
if (chaves.length === 0) return;

mostrarAlertaMinimos(async () => { await _executarDownloadExcel(); }, 'Baixar Mesmo Assim');
}


async function _executarDownloadExcel() {
const chaves = Object.keys(CARRINHO);
const btnExcel = document.getElementById('btnBaixarExcel');
const textoOriginalBtn = btnExcel ? btnExcel.innerHTML : null;
if (btnExcel) { btnExcel.disabled = true; btnExcel.style.opacity = '0.6'; btnExcel.style.cursor = 'wait'; }


try {
let acBruto = 0, acLiquido = 0, acUnidades = 0;
const itensPorFornecedor = {};

chaves.forEach(idProd => {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;
const qtd = CARRINHO[idProd];
acUnidades += qtd;
const { precoFinal, precoOriginal, percentual } = calcularPrecos(p);
acBruto   += precoOriginal * qtd;
acLiquido += precoFinal    * qtd;

const forn = p.fornecedor ? String(p.fornecedor).trim().toUpperCase() : 'GERAL';
if (!itensPorFornecedor[forn]) itensPorFornecedor[forn] = [];
itensPorFornecedor[forn].push({ p, qtd, precoFinal, precoOriginal, percentual });
});

const nomeUFExibicao = (typeof UF_USUARIO !== 'undefined' && UF_USUARIO) ? UF_USUARIO : 'PI';

const workbook = await construirWorkbookPedido({
itensPorFornecedor,
clienteInfo: CLIENTE_SELECIONADO,
ufExibicao: nomeUFExibicao,
olAtivo: OL_ATIVO,
acBruto, acLiquido, acUnidades,
totalVariedades: chaves.length,
subtitulo: 'COMPROVANTE DE PEDIDO — CATÁLOGO HBN1'
});

const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
let nomeArquivo;
if (CLIENTE_SELECIONADO && CLIENTE_SELECIONADO.razao) {
const razaoLimpa = limparNomeArquivo(CLIENTE_SELECIONADO.razao.toUpperCase());
const cnpjLimpo  = limparNomeArquivo(CLIENTE_SELECIONADO.cnpj);
const ufLimpa    = limparNomeArquivo((CLIENTE_SELECIONADO.uf || UF_USUARIO || '').toUpperCase());
nomeArquivo = `${razaoLimpa}${cnpjLimpo ? ' - ' + cnpjLimpo : ''}${ufLimpa ? ' - ' + ufLimpa : ''} - ${dataHoje}.xlsx`;
} else {
nomeArquivo = `Pedido_HBN1_${dataHoje}.xlsx`;
}

await baixarWorkbook(workbook, nomeArquivo);
mostrarToast('success', `${nomeArquivo} baixado com sucesso.`);
} catch (erro) {
console.error('Erro ao gerar o Excel do pedido:', erro);
mostrarToast('error', 'Ocorreu um erro ao gerar o arquivo Excel. Tente novamente.');
} finally {
if (btnExcel) { btnExcel.disabled = false; btnExcel.style.opacity = ''; btnExcel.style.cursor = ''; if (textoOriginalBtn !== null) btnExcel.innerHTML = textoOriginalBtn; }
}
}
// SCROLL
window.onscroll = function() {
const btn = document.getElementById("btnVoltarTopo");
if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) btn.classList.remove("hidden");
else btn.classList.add("hidden");
};
function voltarAoTopo() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
// =========================================================================
// ST — SUBSTITUIÇÃO TRIBUTÁRIA (inline na barra de cliente)
// =========================================================================
function ativarST(ativo) {
ST_ATIVO = ativo;
const btnSim = document.getElementById('btnSTSim');
const btnNao = document.getElementById('btnSTNao');
if (ativo) {
if (btnSim) { btnSim.classList.add('bg-amber-600', 'text-white'); btnSim.classList.remove('text-slate-400'); }
if (btnNao) { btnNao.classList.remove('bg-amber-600', 'text-white'); btnNao.classList.add('text-slate-400'); }
} else {
if (btnNao) { btnNao.classList.add('bg-amber-600', 'text-white'); btnNao.classList.remove('text-slate-400'); }
if (btnSim) { btnSim.classList.remove('bg-amber-600', 'text-white'); btnSim.classList.add('text-slate-400'); }
}
executarFiltrosGerais();
recalcularTotaisGerais();
}

function carregarST() {
chamarApi('st', { uf: UF_USUARIO })
.then(lista => {
BD_ST = {};
(lista || []).forEach(item => { if (item.id) BD_ST[item.id] = item.st || 0; });
const qtd = Object.keys(BD_ST).filter(id => BD_ST[id] > 0).length;
if (qtd === 0) {
// UF sem ST configurado: esconde o container todo
const container = document.getElementById('containerST');
if (container) container.classList.add('hidden');
}
})
.catch(e => {
const container = document.getElementById('containerST');
if (container) container.classList.add('hidden');
});
}
// VALORES MÍNIMOS POR GRUPO DE DESCONTO
function carregarValoresMinimos() {
chamarApi('valoresMinimos', { uf: UF_USUARIO })
.then(lista => {
BD_VALORES_MINIMOS = {};
BD_CHAVES_VENCIDAS = new Set();
(lista || []).forEach(item => {
if (!item.chave) return;
if (item.vencido) {
BD_CHAVES_VENCIDAS.add(item.chave);
} else if (item.minimo > 0) {
// Só vira exigência de faturamento mínimo se o valor for > 0.
// Linhas com mínimo zerado existem só pra controlar validade
// (ex: descontoPadrao com data de vencimento, sem meta de compra).
BD_VALORES_MINIMOS[item.chave] = { minimo: item.minimo, label: item.label };
}
});
executarFiltrosGerais();
})
.catch(e => console.error('Valores mínimos não disponíveis:', e));
}
// =========================================================================
// FATURAMENTOS MÍNIMOS — cálculo, indicador inline e modal de alerta
// =========================================================================

// Calcula o status de cada grupo de desconto com mínimo configurado.
// Retorna { pendentes, atingidos } onde cada item tem { chave, label, atual, minimo, faltam }
function calcularStatusMinimos() {
if (Object.keys(BD_VALORES_MINIMOS).length === 0 || Object.keys(CARRINHO).length === 0) {
return { pendentes: [], atingidos: [] };
}
const grupos = {};
Object.keys(CARRINHO).forEach(idProd => {
const p = BD_PRODUTOS.find(x => x.id === idProd);
if (!p) return;
const { precoFinal, colunaAtiva } = calcularPrecos(p);
if (!colunaAtiva || !BD_VALORES_MINIMOS[colunaAtiva]) return;
if (!grupos[colunaAtiva]) grupos[colunaAtiva] = 0;
grupos[colunaAtiva] += precoFinal * (CARRINHO[idProd] || 0);
});

const pendentes = [], atingidos = [];
Object.keys(grupos).forEach(chave => {
const { minimo, label } = BD_VALORES_MINIMOS[chave];
const atual  = grupos[chave];
const faltam = Math.max(0, minimo - atual);
const item   = { chave, label, atual, minimo, faltam };
(faltam > 0 ? pendentes : atingidos).push(item);
});
return { pendentes, atingidos };
}

// Atualiza o botão/pílula de mínimos na barra de controles
function atualizarIndicadorMinimosBarra() {
const btn = document.getElementById('indicadorMinimos');
const pop = document.getElementById('popoverMinimos');
if (!btn) return;

const { pendentes, atingidos } = calcularStatusMinimos();
const total = pendentes.length + atingidos.length;

if (total === 0) {
btn.classList.add('hidden');
if (pop) pop.classList.add('hidden');
return;
}

btn.classList.remove('hidden');

if (pendentes.length === 0) {
// Tudo atingido
btn.className = 'text-[10px] font-bold rounded-lg border px-3 py-1 transition-all flex items-center gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700';
btn.innerHTML = total === 1
? `✅ <span class="font-semibold">${atingidos[0].label}</span> <span class="font-medium opacity-75">• Mínimo atingido</span>`
: `✅ <span class="font-semibold">${total} mínimos atingidos</span>`;
} else if (pendentes.length === 1 && total === 1) {
// Um único pendente
const p = pendentes[0];
btn.className = 'text-[10px] font-bold rounded-lg border px-3 py-1 transition-all flex items-center gap-1.5 bg-amber-50 border-amber-200 text-amber-700';
btn.innerHTML = `⚠ <span class="font-semibold">${p.label}</span> <span class="font-medium opacity-75">• Mín: ${formatarParaReal(p.minimo)} • Faltam ${formatarParaReal(p.faltam)}</span>`;
} else {
// Múltiplos ou misturados — mostra resumo + seta para o popover
btn.className = 'text-[10px] font-bold rounded-lg border px-3 py-1 transition-all flex items-center gap-1.5 bg-amber-50 border-amber-200 text-amber-700 cursor-pointer';
const chevron = `<svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>`;
btn.innerHTML = pendentes.length === 1
? `⚠ <span class="font-semibold">${pendentes[0].label}</span> <span class="font-medium opacity-75">• Faltam ${formatarParaReal(pendentes[0].faltam)}</span> ${chevron}`
: `⚠ <span class="font-semibold">${pendentes.length} faturamentos mínimos pendentes</span> ${chevron}`;
}
}

// Abre/fecha o popover com o detalhamento de todos os mínimos
function togglePopoverMinimos() {
const pop = document.getElementById('popoverMinimos');
if (!pop) return;

const { pendentes, atingidos } = calcularStatusMinimos();
const todos = [...pendentes, ...atingidos];
if (todos.length === 0) return;

if (!pop.classList.contains('hidden')) {
pop.classList.add('hidden');
return;
}

pop.innerHTML = `
   <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
     <p class="text-xs font-black text-slate-700 uppercase tracking-wider">Faturamentos Mínimos</p>
     <button onclick="document.getElementById('popoverMinimos').classList.add('hidden')"
       class="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
       <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
     </button>
   </div>
   <div class="p-3 space-y-2">
     ${todos.map(item => {
       const ok = item.faltam === 0;
       return `
         <div class="rounded-xl p-3 border ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}">
           <div class="flex items-center justify-between gap-2 mb-1.5">
             <span class="text-xs font-black ${ok ? 'text-emerald-700' : 'text-amber-700'}">${ok ? '🟢' : '🟠'} ${item.label}</span>
             ${ok
               ? `<span class="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">✓ Atingido</span>`
               : `<span class="text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Faltam ${formatarParaReal(item.faltam)}</span>`}
           </div>
           <div class="flex gap-4 text-[10px] font-mono">
             <span class="${ok ? 'text-emerald-600' : 'text-amber-600'}">Atual: <strong>${formatarParaReal(item.atual)}</strong></span>
             <span class="text-slate-400">Mínimo: <strong>${formatarParaReal(item.minimo)}</strong></span>
           </div>
         </div>`;
     }).join('')}
   </div>`;

pop.classList.remove('hidden');
}

// ── Modal de alerta de mínimos (antes de baixar/salvar) ──────────────────
let _ALERTA_MINIMOS_CALLBACK = null;

function mostrarAlertaMinimos(onProceed, btnLabel = 'Exportar Mesmo Assim') {
const { pendentes } = calcularStatusMinimos();

if (pendentes.length === 0) {
// Sem pendências — executa direto
onProceed();
return;
}

_ALERTA_MINIMOS_CALLBACK = onProceed;

const titulo = pendentes.length === 1
? '⚠ Faturamento mínimo não atingido'
: `⚠ ${pendentes.length} faturamentos mínimos pendentes`;

const conteudo = pendentes.length === 1
? `<p class="text-slate-600 text-xs mb-3 font-semibold">${pendentes[0].label}</p>
      <div class="bg-amber-50 rounded-xl p-3 border border-amber-200 space-y-1.5 text-xs">
        <div class="flex justify-between"><span class="text-slate-500">Atual</span><span class="font-bold text-slate-700">${formatarParaReal(pendentes[0].atual)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Mínimo</span><span class="font-bold text-slate-700">${formatarParaReal(pendentes[0].minimo)}</span></div>
        <div class="flex justify-between border-t border-amber-200 pt-1.5"><span class="text-red-600 font-bold">Faltam</span><span class="font-black text-red-600">${formatarParaReal(pendentes[0].faltam)}</span></div>
      </div>`
: `<p class="text-slate-400 text-xs mb-2">Os seguintes mínimos ainda não foram atingidos:</p>
      <div class="space-y-1.5">
        ${pendentes.map(p => `
          <div class="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
            <span class="text-xs font-bold text-amber-700">🟠 ${p.label}</span>
            <span class="text-xs font-black text-red-600">Faltam ${formatarParaReal(p.faltam)}</span>
          </div>`).join('')}
      </div>`;

document.getElementById('alertaMinimosTitulo').innerText       = titulo;
document.getElementById('alertaMinimosConteudo').innerHTML     = conteudo;
document.getElementById('btnAlertaMinimosConfirmar').innerText = btnLabel;
document.getElementById('modalAlertaMinimos').classList.remove('hidden');
}

function fecharAlertaMinimos() {
document.getElementById('modalAlertaMinimos').classList.add('hidden');
_ALERTA_MINIMOS_CALLBACK = null;
}

function confirmarAlertaMinimos() {
const cb = _ALERTA_MINIMOS_CALLBACK;
fecharAlertaMinimos();
if (typeof cb === 'function') cb();
}

function atualizarResumoValoresMinimos() {
const secao = document.getElementById('resumoValoresMinimos');
const lista = document.getElementById('listaValoresMinimos');
if (!secao || !lista) return;
if (Object.keys(BD_VALORES_MINIMOS).length === 0 || Object.keys(CARRINHO).length === 0) {
secao.classList.add('hidden');
atualizarIndicadorMinimosBarra();
return;
}

// Agrupar itens do carrinho por colunaAtiva
const grupos = {};
Object.keys(CARRINHO).forEach(idProd => {
const p = BD_PRODUTOS.find(x => x.id === idProd);
if (!p) return;
const qtd = CARRINHO[idProd];
const { precoFinal, colunaAtiva } = calcularPrecos(p);
if (!colunaAtiva || !BD_VALORES_MINIMOS[colunaAtiva]) return;
if (!grupos[colunaAtiva]) grupos[colunaAtiva] = 0;
grupos[colunaAtiva] += precoFinal * qtd;
});

if (Object.keys(grupos).length === 0) {
secao.classList.add('hidden');
return;
}

lista.innerHTML = Object.keys(grupos).map(chave => {
const { minimo, label } = BD_VALORES_MINIMOS[chave];
const total    = grupos[chave];
const atingiu  = total >= minimo;
const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const minFmt   = minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
return `
         <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${atingiu ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}">
           <span class="text-[11px]">${atingiu ? '✅' : '❌'}</span>
           <span class="text-[10px] font-semibold ${atingiu ? 'text-emerald-700' : 'text-red-600'}">${label}</span>
           <span class="text-[10px] font-bold ${atingiu ? 'text-emerald-800' : 'text-red-700'}">${totalFmt}</span>
           ${!atingiu ? `<span class="text-[9px] text-red-400 font-medium">/ ${minFmt}</span>` : ''}
         </div>`;
}).join('');

secao.classList.remove('hidden');
atualizarIndicadorMinimosBarra();
}
// PEDIDOS SALVOS — localStorage
// Chave: 'hbn1_pedidos_salvos'
// Estrutura: Array de { id, data, timestamp, cliente, uf, itens[], totais{} }
const CHAVE_PEDIDOS_SALVOS = 'hbn1_pedidos_salvos';

function carregarPedidosSalvos() {
try { return JSON.parse(localStorage.getItem(CHAVE_PEDIDOS_SALVOS) || '[]'); }
catch { return []; }
}

function persistirPedidosSalvos(lista) {
  try {
    localStorage.setItem(CHAVE_PEDIDOS_SALVOS, JSON.stringify(lista));
    return true;
  } catch (e) {
    console.error('Falha ao salvar pedidos:', e);
    mostrarToast(
      'error',
      'Não foi possível salvar o pedido — armazenamento local cheio. Tente limpar o cache de imagens do catálogo e salve novamente.',
      6000
    );
    return false;
  }
}

function atualizarBadgesPedidosSalvos() {
const n = carregarPedidosSalvos().length;
const mostrar = n > 0;
['badgePedidosSalvos', 'badgePedidosSalvosMobile', 'badgeMenuPedidosSalvos'].forEach(id => {
const el = document.getElementById(id);
if (!el) return;
el.innerText = n;
el.classList.toggle('hidden', !mostrar);
});
}

function salvarPedidoAtual() {
const chaves = Object.keys(CARRINHO);
if (chaves.length === 0) { mostrarToast('warning', 'Seu carrinho está vazio. Adicione produtos antes de salvar.'); return; }
mostrarAlertaMinimos(() => _executarSalvarPedido(), 'Salvar Mesmo Assim');
}

function _executarSalvarPedido() {
const chaves = Object.keys(CARRINHO);

const itens = [];
let acBruto = 0, acLiquido = 0, acUnidades = 0;

chaves.forEach(idProd => {
const p = BD_PRODUTOS.find(x => x.id === idProd);
if (!p) return;
const qtd = CARRINHO[idProd];
const { precoFinal, precoOriginal, percentual } = calcularPrecos(p);
acBruto   += precoOriginal * qtd;
acLiquido += precoFinal    * qtd;
acUnidades += qtd;
itens.push({ id: p.id, ean: p.ean, descricao: p.descricao, marca: p.marca, fornecedor: p.fornecedor,
embalagem: p.embalagem, qtd, precoFinal, precoOriginal, percentual });
});

const agora = new Date();
const pedido = {
id: 'PED_' + agora.getTime(),
timestamp: agora.getTime(),
data: agora.toLocaleString('pt-BR'),
uf: UF_USUARIO,
cliente: CLIENTE_SELECIONADO ? { ...CLIENTE_SELECIONADO } : null,
olAtivo: OL_ATIVO,
itens,
totais: { bruto: acBruto, liquido: acLiquido, unidades: acUnidades, variedades: chaves.length }
};

const lista = carregarPedidosSalvos();
lista.unshift(pedido); // mais recente primeiro

// NOVO: checa se realmente salvou antes de seguir em frente.
// Se falhou, não limpa o carrinho — o usuário não perde o pedido montado.
const salvouComSucesso = persistirPedidosSalvos(lista);
if (!salvouComSucesso) return;

atualizarBadgesPedidosSalvos();

// Inicia automaticamente um novo pedido (limpa o carrinho atual)
limparCarrinhoSemConfirmacao();

// Mantém o botão flutuante visível durante o feedback, mesmo com carrinho já vazio
const btnFlutuante = document.getElementById('btnSalvarPedidoFlutuante');
if (btnFlutuante) btnFlutuante.classList.remove('hidden');

// Feedback visual nos botões de salvar (modal + flutuante)
['btnSalvarPedido', 'btnSalvarPedidoFlutuante'].forEach(id => {
const btn = document.getElementById(id);
if (!btn) return;
const htmlOriginal   = btn.innerHTML;
const classeOriginal = btn.className;
btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Salvo! Novo pedido iniciado';
btn.classList.replace('bg-blue-600', 'bg-blue-800');
setTimeout(() => {
btn.innerHTML = htmlOriginal;
btn.className = classeOriginal;
if (id === 'btnSalvarPedidoFlutuante') btn.classList.add('hidden');
}, 2000);
});

if (!document.getElementById('modalCarrinho').classList.contains('hidden')) abrirModalCarrinho();
}

function abrirModalPedidosSalvos() {
renderizarListaPedidosSalvos();
document.getElementById('modalPedidosSalvos').classList.remove('hidden');
}

function fecharModalPedidosSalvos() {
document.getElementById('modalPedidosSalvos').classList.add('hidden');
}

function renderizarListaPedidosSalvos() {
const lista = carregarPedidosSalvos();
const corpo = document.getElementById('corpoPedidosSalvos');
const label = document.getElementById('labelQtdPedidosSalvos');
const btnTodos   = document.getElementById('btnBaixarTodosSalvos');
const btnLimpar  = document.getElementById('btnLimparTodosSalvos');

label.innerText = lista.length + (lista.length === 1 ? ' pedido' : ' pedidos');
const temPedidos = lista.length > 0;
btnTodos.classList.toggle('hidden', !temPedidos);
btnLimpar.classList.toggle('hidden', !temPedidos);

if (!temPedidos) {
corpo.innerHTML = `
         <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
           <svg class="w-14 h-14 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
           </svg>
           <p class="text-slate-400 font-bold text-sm">Nenhum pedido salvo ainda.</p>
           <p class="text-slate-400 text-xs">Monte seu pedido e clique em <strong>"Salvar Pedido"</strong> no carrinho.</p>
         </div>`;
return;
}

corpo.innerHTML = lista.map(p => {
const cliente = p.cliente ? p.cliente.razao : 'Sem cliente selecionado';
const cnpj    = p.cliente ? p.cliente.cnpj  : '';
const liquido = p.totais.liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const bruto   = p.totais.bruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Monta linhas do preview (agrupadas por fornecedor)
const fornecedores = {};
p.itens.forEach(item => {
const forn = (item.fornecedor || 'GERAL').trim().toUpperCase();
if (!fornecedores[forn]) fornecedores[forn] = [];
fornecedores[forn].push(item);
});

const linhasPreview = Object.entries(fornecedores).map(([forn, itens]) => `
         <div class="mb-2">
           <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${forn}</p>
           ${itens.map(item => {
             const precoFmt  = item.precoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
             const totalFmt  = (item.precoFinal * item.qtd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
             const descTag   = item.percentual > 0 ? `<span class="text-red-500 font-bold">-${item.percentual.toFixed(0)}%</span>` : '';
             return `<div class="flex items-start justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
               <div class="flex-grow min-w-0">
                 <p class="text-[11px] font-semibold text-slate-700 leading-snug truncate">${item.descricao || item.id}</p>
                 <p class="text-[9px] text-slate-400 mt-0.5">${item.marca || ''} · ${item.embalagem || ''}</p>
               </div>
               <div class="text-right shrink-0">
                 <p class="text-[10px] font-black text-slate-800">${item.qtd} un × ${precoFmt} ${descTag}</p>
                 <p class="text-[10px] font-bold text-emerald-700">${totalFmt}</p>
               </div>
             </div>`;
           }).join('')}
         </div>`).join('');

return `
         <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
           <!-- Cabeçalho do card -->
           <div class="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
             <div class="flex-grow min-w-0">
               <div class="flex items-center gap-2 flex-wrap">
                 <span class="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">${p.uf}</span>
                 <span class="text-[9px] text-slate-400 font-medium">${p.data}</span>
               </div>
               <p class="font-bold text-slate-800 text-sm mt-1 truncate" title="${cliente}">${cliente}</p>
               ${cnpj ? `<p class="text-[10px] text-slate-400 font-mono">${cnpj}</p>` : ''}
               <div class="flex items-center gap-3 mt-1.5 flex-wrap">
                 <span class="text-[10px] text-slate-500">${p.totais.variedades} produto${p.totais.variedades !== 1 ? 's' : ''}</span>
                 <span class="text-[10px] text-slate-400">·</span>
                 <span class="text-[10px] text-slate-500">${p.totais.unidades} unid.</span>
                 <span class="text-[10px] text-slate-400">·</span>
                 <span class="text-xs font-black text-emerald-700">${liquido}</span>
               </div>
             </div>
             <div class="flex items-center gap-2 shrink-0">
               <button onclick="togglePreviewPedido('${p.id}')"
                 class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
                 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                 </svg>
                 Ver
               </button>
               <button onclick="enviarPedidoSalvoParaNegociacao('${p.id}')"
                 class="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
                 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6"/></svg>
                 Negociação
               </button>
               <button onclick="baixarPedidoSalvo('${p.id}')"
                 class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
                 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                 </svg>
                 Baixar
               </button>
               <button onclick="excluirPedidoSalvo('${p.id}')"
                 class="p-2 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded-xl border border-red-100 transition-all">
                 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                 </svg>
               </button>
             </div>
           </div>
           <!-- Preview expansível -->
           <div id="preview_${p.id}" class="hidden border-t border-slate-100 bg-slate-50/60 px-4 py-3 max-h-72 overflow-y-auto no-scrollbar">
             <div class="flex items-center justify-between mb-2">
               <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens do Pedido</span>
               <div class="flex gap-3 text-[10px] text-slate-400">
                 <span>Bruto: <strong class="text-slate-600">${bruto}</strong></span>
                 <span>Líquido: <strong class="text-emerald-700">${liquido}</strong></span>
               </div>
             </div>
             ${linhasPreview}
           </div>
         </div>`;
}).join('');
}

function togglePreviewPedido(pedidoId) {
const el = document.getElementById('preview_' + pedidoId);
if (!el) return;
el.classList.toggle('hidden');
}

function limparTodosPedidosSalvos() {
mostrarConfirm(
'Remover todos os pedidos salvos?',
'Esta ação não pode ser desfeita.',
() => {
persistirPedidosSalvos([]);
atualizarBadgesPedidosSalvos();
renderizarListaPedidosSalvos();
mostrarToast('success', 'Todos os pedidos salvos foram removidos.');
}
);
}

function excluirPedidoSalvo(pedidoId) {
mostrarConfirm(
'Remover este pedido?',
'O pedido será removido permanentemente da lista de salvos.',
() => {
const lista = carregarPedidosSalvos().filter(p => p.id !== pedidoId);
persistirPedidosSalvos(lista);
atualizarBadgesPedidosSalvos();
renderizarListaPedidosSalvos();
mostrarToast('success', 'Pedido removido dos salvos.');
}
);
}

async function baixarPedidoSalvo(pedidoId) {
const pedido = carregarPedidosSalvos().find(p => p.id === pedidoId);
if (!pedido) return;
await _gerarExcelDePedidoSalvo(pedido);
}

async function baixarTodosPedidosSalvos() {
const lista = carregarPedidosSalvos();
if (lista.length === 0) return;
const btn = document.getElementById('btnBaixarTodosSalvos');
btn.disabled = true; btn.style.opacity = '0.6';
try {
for (const pedido of lista) { await _gerarExcelDePedidoSalvo(pedido); }
mostrarToast('success', `${lista.length} pedido${lista.length !== 1 ? 's' : ''} baixado${lista.length !== 1 ? 's' : ''} com sucesso.`);
} finally {
btn.disabled = false; btn.style.opacity = '';
}
}

async function _gerarExcelDePedidoSalvo(pedido) {
try {
const itensPorFornecedor = {};
let acBruto = 0, acLiquido = 0, acUnidades = 0;

pedido.itens.forEach(item => {
acBruto    += item.precoOriginal * item.qtd;
acLiquido  += item.precoFinal    * item.qtd;
acUnidades += item.qtd;

// Busca o estoque ATUAL do produto no catálogo — o pedido salvo não guarda
// isso, então sem essa busca a coluna Status sempre saía "Sem estoque".
const produtoAtual = BD_PRODUTOS.find(x => x.id === item.id);
const pFake = {
id: item.id, ean: item.ean, descricao: item.descricao, marca: item.marca,
fornecedor: item.fornecedor, embalagem: item.embalagem,
// Se o produto não existir mais no catálogo (removido/renomeado), não dá
// pra confirmar falta de estoque — assume disponível em vez de acusar errado.
estoque: produtoAtual ? produtoAtual.estoque : 999999
};

const forn = (item.fornecedor || 'GERAL').trim().toUpperCase();
if (!itensPorFornecedor[forn]) itensPorFornecedor[forn] = [];
itensPorFornecedor[forn].push({
p: pFake, qtd: item.qtd,
precoFinal: item.precoFinal, precoOriginal: item.precoOriginal,
percentual: item.percentual
});
});

// ... resto da função continua igual (workbook, nome do arquivo, download)

const workbook = await construirWorkbookPedido({
itensPorFornecedor,
clienteInfo: pedido.cliente,
ufExibicao: pedido.uf,
olAtivo: pedido.olAtivo || 0,
acBruto, acLiquido, acUnidades,
totalVariedades: pedido.itens.length,
subtitulo: 'COMPROVANTE DE PEDIDO — CATÁLOGO HBN1'
});

const dataStr = new Date(pedido.timestamp).toLocaleDateString('pt-BR').replace(/\//g,'-');
let nome;
if (pedido.cliente && pedido.cliente.razao) {
const razaoLimpa = limparNomeArquivo(pedido.cliente.razao.toUpperCase());
const cnpjLimpo  = pedido.cliente.cnpj ? limparNomeArquivo(pedido.cliente.cnpj) : '';
nome = `${razaoLimpa}${cnpjLimpo ? ' - ' + cnpjLimpo : ''} - ${dataStr}.xlsx`;
} else {
nome = `Pedido_HBN1_${pedido.uf}_${dataStr}.xlsx`;
}

await baixarWorkbook(workbook, nome);
} catch(e) {
console.error('Erro ao gerar Excel do pedido salvo:', e);
mostrarToast('error', 'Erro ao gerar o arquivo. Tente novamente.');
}
}
// AVISO AO SAIR COM CARRINHO PREENCHIDO
window.addEventListener('beforeunload', function(e) {
if (Object.keys(CARRINHO).length > 0) {
e.preventDefault();
e.returnValue = 'Você tem itens no seu pedido. Se sair ou atualizar a página, seu progresso será perdido!';
return e.returnValue;
}
});
window.addEventListener('DOMContentLoaded', () => {
// Sincroniza ícone do dark mode
const icon = document.getElementById('iconDarkMode');
if (icon) icon.innerText = (localStorage.getItem('hbn1_tema') || 'light') === 'dark' ? '☀️' : '🌙';

// Farma não vê o HIT — Alavancas no menu
if (TIPO_USUARIO === 'VENDEDOR_FARMA') {
const linkHit = document.getElementById('linkHitAlavancas');
if (linkHit) linkHit.remove();
}

// Campanhas Mensais é exclusivo do Dedicado (e Admin)
if (TIPO_USUARIO !== 'VENDEDOR_DEDICADO' && TIPO_USUARIO !== 'ADMIN') {
const linkMetas = document.getElementById('linkCampanhasMetas');
if (linkMetas) linkMetas.remove();
}

iniciarSplashAbertura();

// ── MURAL COM FADE ──────────────────────────────────────────────────
let _AVISOS_LISTA    = [];
let _AVISOS_IDX      = 0;
let _AVISOS_TIMER    = null;
let _AVISOS_INICIADO = false;

function atualizarMuralInvisivel() {
chamarApi('avisos', { uf: UF_USUARIO })
.then(lista => {
const novaLista = (!lista || lista.length === 0)
? ['Nenhum aviso cadastrado para hoje. Boas compras!']
: lista;
const mudou = JSON.stringify(novaLista) !== JSON.stringify(_AVISOS_LISTA);
_AVISOS_LISTA = novaLista;
if (!_AVISOS_INICIADO || mudou) {
_AVISOS_IDX = 0;
if (_AVISOS_TIMER) clearInterval(_AVISOS_TIMER);
_exibirAvisoAtual();
if (_AVISOS_LISTA.length > 1) _AVISOS_TIMER = setInterval(_avancarAviso, 5000);
_AVISOS_INICIADO = true;
}
})
.catch(e => console.error('Erro nos avisos:', e));
}

function _exibirAvisoAtual() {
const el  = document.getElementById('containerAvisosLetreiro');
const pag = document.getElementById('paginacaoAvisos');
if (!el) return;
el.innerHTML     = _AVISOS_LISTA[_AVISOS_IDX];
el.style.opacity = '1';
if (pag && _AVISOS_LISTA.length > 1) {
pag.innerHTML = _AVISOS_LISTA.map((_, i) =>
`<button onclick="_irParaAviso(${i})"
             class="w-1.5 h-1.5 rounded-full transition-all ${i === _AVISOS_IDX ? 'bg-orange-300' : 'bg-orange-700'} hover:bg-orange-400"></button>`
).join('');
} else if (pag) {
pag.innerHTML = '';
}
}

function _avancarAviso() {
const el = document.getElementById('containerAvisosLetreiro');
if (!el) return;
el.style.opacity = '0';
setTimeout(() => {
_AVISOS_IDX = (_AVISOS_IDX + 1) % _AVISOS_LISTA.length;
_exibirAvisoAtual();
}, 300);
}

// Exposta globalmente para os botões de paginação inline (onclick="_irParaAviso(i)")
window._irParaAviso = function(idx) {
if (_AVISOS_TIMER) clearInterval(_AVISOS_TIMER);
const el = document.getElementById('containerAvisosLetreiro');
if (el) el.style.opacity = '0';
setTimeout(() => {
_AVISOS_IDX = idx;
_exibirAvisoAtual();
if (_AVISOS_LISTA.length > 1) _AVISOS_TIMER = setInterval(_avancarAviso, 5000);
}, 300);
};

function atualizarProdutosInvisivel(isPrimeiraCarga) {
chamarApi('produtos', { uf: UF_USUARIO })
.then(dados => {
dados.sort((a, b) => {
let fA = String(a.franquia || '').trim().toUpperCase();
let fB = String(b.franquia || '').trim().toUpperCase();
if (fA !== fB) return fA.localeCompare(fB);
return String(a.descricao || '').localeCompare(String(b.descricao || ''));
});
const qtdAnt = BD_PRODUTOS.length;
BD_PRODUTOS = dados;
if (isPrimeiraCarga) {
// Primeira carga: abre tela de portais
mostrarTelaPortais();
} else {
if (qtdAnt !== BD_PRODUTOS.length) renderizarFiltrosLaterais();
executarFiltrosGerais(false);
}
recalcularTotaisGerais();
atualizarTextoUltimaSincronizacao();
})
.catch(erro => {
console.error("Erro na busca de produtos:", erro);
const elAtualizacao = document.getElementById('textoUltimaAtualizacao');
if (elAtualizacao) elAtualizacao.innerHTML = `<span class="text-red-500">⚠ Falha ao sincronizar dados</span>`;
if (isPrimeiraCarga) {
document.getElementById('gridProdutos').innerHTML = `<div class="col-span-full text-center py-10 text-red-500 font-bold">Erro ao conectar com o Google Sheets. Tente atualizar a página.</div>`;
}
});
}

function atualizarClientesInvisivel() {
chamarApi('clientes', { uf: UF_USUARIO })
.then(lista => {
BD_CLIENTES = lista;
})
.catch(e => console.error("Erro nos clientes:", e));
}

atualizarMuralInvisivel();
atualizarProdutosInvisivel(true);
atualizarClientesInvisivel();
carregarST();
carregarValoresMinimos();
atualizarBadgesPedidosSalvos();
verificarEExibirAvisoCache();
setInterval(verificarEExibirAvisoCache, 300000); // reavalia a cada 5 min, igual aos outros polls
// Mostra portais imediatamente e já desenha o skeleton (grid atualiza quando produtos chegarem)
document.getElementById('telaPortais').classList.remove('hidden');
document.getElementById('portaisNomeUsuario').innerText =
localStorage.getItem('hbn1_nome') || localStorage.getItem('hbn1_usuario') || '';
renderizarGridPortais();

setInterval(atualizarMuralInvisivel,     60000);   // 1 min
setInterval(() => atualizarProdutosInvisivel(false), 180000); // 3 min
setInterval(atualizarClientesInvisivel, 300000);  // 5 min
});
// =========================================================================
// ENVIO PARA A CENTRAL DE INVESTIMENTO (negociacao.html)
// =========================================================================
function enviarParaCentralInvestimento(itens, clienteInfo) {
if (!itens || itens.length === 0) { mostrarToast('warning', 'Nenhum item para enviar.'); return; }
try {
localStorage.setItem('hbn1_negociacao_handoff', JSON.stringify({ itens, cliente: clienteInfo || null }));
} catch (e) {
mostrarToast('error', 'Não foi possível preparar os dados para a Central de Investimento.');
return;
}
window.location.href = 'negociacao.html';
}

// Origem 1: carrinho atual (modal "Ver Meu Pedido")
function enviarCarrinhoParaNegociacao() {
const chaves = Object.keys(CARRINHO);
const itens = chaves.map(idProd => {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return null;
const qtd = CARRINHO[idProd];
const { precoOriginal, percentual } = calcularPrecos(p);
return { produto: p.descricao || p.id, cod: p.id, ean: p.ean, preco: precoOriginal, qtd, descontoAtual: percentual };
}).filter(Boolean);
const clienteInfo = CLIENTE_SELECIONADO ? { razao: CLIENTE_SELECIONADO.razao, cnpj: CLIENTE_SELECIONADO.cnpj, uf: CLIENTE_SELECIONADO.uf } : null;
enviarParaCentralInvestimento(itens, clienteInfo);
}

// Origem 2: um pedido salvo específico (não leva os outros salvos)
function enviarPedidoSalvoParaNegociacao(pedidoId) {
const pedido = carregarPedidosSalvos().find(p => p.id === pedidoId);
if (!pedido) return;
const itens = pedido.itens.map(item => ({
produto: item.descricao || item.id, cod: item.id, ean: item.ean,
preco: item.precoOriginal, qtd: item.qtd, descontoAtual: item.percentual
}));
const clienteInfo = pedido.cliente ? { razao: pedido.cliente.razao, cnpj: pedido.cliente.cnpj, uf: pedido.cliente.uf } : null;
enviarParaCentralInvestimento(itens, clienteInfo);
}

// Origem 3: resultado da importação (Ver Meu Valor do Pedido) — soma entre CNPJs
// e separa qtd atendida / não atendida em linhas diferentes
function enviarImportacaoParaNegociacao() {
if (!IMPORT_RESULTADO || IMPORT_RESULTADO.pedidos.length === 0) return;

const mapa = {}; // chave = código interno do produto
IMPORT_RESULTADO.pedidos.forEach(pedido => {
Object.keys(pedido.itensPorFornecedor).forEach(forn => {
pedido.itensPorFornecedor[forn].forEach(({ p, precoOriginal, percentual, qtdAtendida, qtdNaoAtendida }) => {
if (!mapa[p.id]) {
mapa[p.id] = {
produto: p.descricao || p.id, cod: p.id, ean: p.ean,
preco: precoOriginal, descontoAtual: percentual,
qtdAtendida: 0, qtdNaoAtendida: 0
};
}
mapa[p.id].qtdAtendida    += (qtdAtendida    || 0);
mapa[p.id].qtdNaoAtendida += (qtdNaoAtendida || 0);
});
});
});

const itens = [];
Object.values(mapa).forEach(item => {
if (item.qtdAtendida > 0) {
itens.push({ produto: item.produto + ' (com estoque)', cod: item.cod, ean: item.ean, preco: item.preco, qtd: item.qtdAtendida, descontoAtual: item.descontoAtual });
}
if (item.qtdNaoAtendida > 0) {
itens.push({ produto: item.produto + ' (sem estoque)', cod: item.cod, ean: item.ean, preco: item.preco, qtd: item.qtdNaoAtendida, descontoAtual: item.descontoAtual });
}
});
enviarParaCentralInvestimento(itens);
}

if ('serviceWorker' in navigator) {
window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
// Substitua o bloco de funções de imagem do PDF por este.
// Resolve Amazon/Google Drive tentando direto, mantém weserv para CDNs compatíveis
// e deixa um ponto claro para proxy próprio nos domínios sem CORS, como RaiaDrogasil.

const PDF_IMG_CACHE_NAME = 'hbn1-img-cache-v1';
const PDF_IMG_LARGURA_PROXY = 480;
const PDF_CARDS_POR_PAGINA = 12;
let _PDF_GERANDO = false;

const PDF_IMG_PROXY_PROPRIO = 'https://dry-hall-0bba.mouralucas955.workers.dev/?url=';

function _normalizarUrlImagem(urlOriginal) {
  let url = String(urlOriginal || '').trim();
  if (!url) return '';
  url = url.replace(/\s+/g, '');
  url = url.replace(/(v=\d+)h=/, '$1&h=');
  return url;
}

function _obterUrlImagemProxy(urlOriginal) {
  const url = _normalizarUrlImagem(urlOriginal);
  if (!url) return '';
  const semProtocolo = url.replace(/^https?:\/\//, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(semProtocolo)}&w=${PDF_IMG_LARGURA_PROXY}&fit=contain`;
}

function _obterUrlImagemProxyProprio(urlOriginal) {
  if (!PDF_IMG_PROXY_PROPRIO) return '';
  return PDF_IMG_PROXY_PROPRIO + encodeURIComponent(_normalizarUrlImagem(urlOriginal));
}

async function _fetchComTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' }
    });
  } finally {
    clearTimeout(timer);
  }
}

function _blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function _obterImagemBase64ComCache(urlOriginal) {
  const url = _normalizarUrlImagem(urlOriginal);
  if (!url) return null;

  // 1) Tenta achar no Cache API (persiste entre sessões, sem custo de localStorage)
  let cache = null;
  try {
    cache = await caches.open(PDF_IMG_CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return await _blobParaBase64(blob);
    }
  } catch (e) {
    console.warn('Cache API indisponível, seguindo sem cache persistente:', e);
  }

  // 2) Não achou — tenta baixar (direto / weserv / proxy próprio)
  const tentativas = [
    ['direto', url, 9000],
    ['weserv', _obterUrlImagemProxy(url), 12000],
    ['proxy proprio', _obterUrlImagemProxyProprio(url), 15000],
  ].filter(([, u]) => !!u);

  for (const [rotulo, tentativaUrl, timeout] of tentativas) {
    try {
      const resp = await _fetchComTimeout(tentativaUrl, timeout);
      if (!resp.ok) continue;
      const tipo = (resp.headers.get('content-type') || '').toLowerCase();
      const blob = await resp.blob();
      if (blob.size < 100) continue;
      if (tipo && !tipo.startsWith('image/')) continue;

      // Salva no Cache API pra próxima vez — clone antes, porque o body só pode ser lido uma vez
      if (cache) {
        try {
          await cache.put(url, new Response(blob.slice(), { headers: { 'Content-Type': tipo || 'image/jpeg' } }));
        } catch (e) {
          console.warn('Não foi possível persistir no Cache API (seguindo sem cache):', e.message);
        }
      }

      return await _blobParaBase64(blob);
    } catch (e) {
      console.warn(`Imagem (${rotulo}) falhou:`, tentativaUrl, e.message);
    }
  }

  return null;
}

// ── Utilitários de cache: limpar e diagnosticar espaço ──────────────────
async function limparCacheImagensPdf() {
  try {
    await caches.delete(PDF_IMG_CACHE_NAME);
    mostrarToast('success', 'Cache de imagens do catálogo limpo.');
    await verificarEExibirAvisoCache(); // reavalia — deve sumir agora
  } catch (e) {
    mostrarToast('error', 'Não foi possível limpar o cache de imagens.');
  }
}

async function verificarEspacoDisponivel() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return {
    usadoMB: (usage / 1024 / 1024).toFixed(1),
    totalMB: (quota / 1024 / 1024).toFixed(1),
    percentUsado: quota ? ((usage / quota) * 100).toFixed(1) : null
  };
}

const LIMITE_AVISO_CACHE_PCT = 80; // a partir de quanto % de uso o aviso aparece

async function verificarEExibirAvisoCache() {
  const btn = document.getElementById('btnAvisoCacheCheio');
  if (!btn) return;

  const info = await verificarEspacoDisponivel();
  if (!info || info.percentUsado === null) {
    btn.classList.add('hidden');
    btn.classList.remove('flex');
    return;
  }

  const percentUsado = parseFloat(info.percentUsado);
  const estaCheio = percentUsado >= LIMITE_AVISO_CACHE_PCT;

  btn.classList.toggle('hidden', !estaCheio);
  btn.classList.toggle('flex', estaCheio);
}

async function _prefetchImagensComConcorrencia(lista, mapaImagens, concorrencia = 3, onProgresso) {
  let indice = 0, concluidas = 0;
  async function worker(numeroWorker) {
    await new Promise(r => setTimeout(r, numeroWorker * 150)); // escalona o início
    while (indice < lista.length) {
      const i = indice++;
      const p = lista[i];
      mapaImagens[p.id] = await _obterImagemBase64ComCache(p.imagens);
      concluidas++;
      if (onProgresso) onProgresso(concluidas, lista.length);
    }
  }
  await Promise.all(Array.from({ length: concorrencia }, (_, idx) => worker(idx)));
}

function _truncarTexto(texto, maxCaracteres) {
  const t = String(texto || '').trim();
  if (t.length <= maxCaracteres) return t;
  return t.slice(0, maxCaracteres - 1).trim() + '…';
}

function _formatarPercentualBadge(percentual) {
  if (!percentual || percentual <= 0) return '';
  const arred = Math.round(percentual * 10) / 10;
  const texto = (arred % 1 === 0) ? arred.toFixed(0) : arred.toFixed(1).replace('.', ',');
  return `-${texto}%`;
}

function _gerarHtmlCardPdf(p, imgBase64) {
  const { precoFinal, precoOriginal, percentual } = calcularPrecos(p);
  const temDesconto = percentual > 0 && precoOriginal > 0;
  const economia = temDesconto ? (precoOriginal - precoFinal) : 0;
  const estoque = Number(p.estoque || 0);
  const badgePct = _formatarPercentualBadge(percentual);

  return `
    <div style="display:flex;border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;background:#fff;height:160px;box-sizing:border-box;">

      <!-- LATERAL ESQUERDA: imagem -->
      <div style="width:130px;flex-shrink:0;position:relative;background:#fafafa;display:flex;align-items:center;justify-content:center;">
       ${badgePct ? `<span style="position:absolute;top:6px;left:6px;background:#e74c3c;color:#fff;font-size:9px;font-weight:800;height:20px;min-width:38px;padding:0 7px;border-radius:6px;z-index:2;display:inline-flex;align-items:center;justify-content:center;line-height:20px;box-sizing:border-box;">
  <span style="display:block;transform:translateY(-2px);">${badgePct}</span>
</span>` : ''}
        ${imgBase64
          ? `<img src="${imgBase64}" style="max-height:120px;max-width:118px;object-fit:contain;">`
          : `<span style="font-size:8px;color:#c2c2c2;">sem imagem</span>`}
      </div>

      <!-- LATERAL DIREITA: informações -->
      <div style="flex:1;min-width:0;padding:9px 10px;display:flex;flex-direction:column;">
        <span style="font-size:8px;font-weight:800;color:#e8620a;text-transform:uppercase;flex-shrink:0;">${p.fornecedor || 'GERAL'}</span>

        <p style="font-size:10px;font-weight:700;color:#1e293b;line-height:1.3;margin:2px 0 5px;flex-shrink:0;">
  ${_truncarTexto(p.descricao, 140)}
</p>

        <div style="display:flex;gap:5px;font-size:7.5px;flex-shrink:0;margin-bottom:6px;flex-wrap:wrap;">
          <span style="background:#eef2ff;color:#3b5aa8;font-weight:700;height:16px;padding:0 6px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;line-height:16px;box-sizing:border-box;">
  <span style="display:block;transform:translateY(-2px);">ID:${p.id}</span>
</span>

<span style="background:#eef2ff;color:#3b5aa8;font-weight:700;height:16px;padding:0 6px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;line-height:16px;box-sizing:border-box;">
  <span style="display:block;transform:translateY(-2px);">EAN:${p.ean || 'N/A'}</span>
</span>
        </div>

        <div style="margin-top:auto;flex-shrink:0;">
  ${temDesconto ? `<div style="font-size:8px;color:#94a3b8;text-decoration:line-through;">De: ${formatarParaReal(precoOriginal)}</div>` : ''}

  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <div style="font-size:15px;font-weight:800;color:#e8620a;line-height:1.2;white-space:nowrap;">
      ${precoOriginal > 0 ? formatarParaReal(precoFinal) : '—'}
    </div>

    ${economia > 0 ? `<span style="background:#22c55e;color:#fff;font-size:7px;font-weight:700;height:17px;padding:0 7px;border-radius:5px;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;line-height:17px;box-sizing:border-box;">
  <span style="display:block;transform:translateY(-2px);">ECON. ${formatarParaReal(economia)}</span>
</span>` : ''}
  </div>

  <div style="text-align:right;margin-top:3px;">
    <span style="font-size:7.5px;color:#94a3b8;">Est: ${estoque}</span>
  </div>
</div>
      </div>
    </div>`;
}

function _montarDivPaginaPdf(produtosDaPagina, mapaImagens, info) {
  const div = document.createElement('div');
  div.style.width = '850px';
  div.style.height = '1200px';
  div.style.background = '#fff';
  div.style.fontFamily = "'Plus Jakarta Sans', Arial, sans-serif";
  div.style.position = 'relative';
  div.style.boxSizing = 'border-box';

  const clienteTxt = info.cliente ? `Cliente: ${(info.cliente.razao || '').toUpperCase()}` : '';
const subLinha = [clienteTxt, info.data].filter(Boolean).join(' | ');

  const cardsHtml = produtosDaPagina.map(p => _gerarHtmlCardPdf(p, mapaImagens[p.id])).join('');

  div.innerHTML = `
    <div style="background:#FF6B00;padding:26px 34px 20px;position:relative;">
      <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.5px;">CATÁLOGO DE PRODUTOS NAZARIA - ${info.fornecedor}</h1>
      <p style="color:#ffe8d6;font-size:11px;margin:6px 0 0;">${subLinha}</p>
      <span style="position:absolute;top:26px;right:34px;color:#ffe8d6;font-size:10px;">Página ${info.numPagina}/${info.totalPaginas}</span>
    </div>
    <div style="padding:20px 24px;display:grid;grid-template-columns:repeat(2, 1fr);gap:14px;">
      ${cardsHtml}
    </div>`;
  return div;
}

async function baixarCatalogoPdf() {
  if (_PDF_GERANDO) return;
  const lista = PRODUTOS_FILTRADOS.slice(); // respeita busca + fornecedor + filtro de estoque atuais
  if (lista.length === 0) { mostrarToast('warning', 'Nenhum produto para exportar com os filtros atuais.'); return; }

  _PDF_GERANDO = true;
  const btn = document.getElementById('btnBaixarCatalogoPdf');
  const htmlOriginal = btn ? btn.innerHTML : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Gerando PDF...`;
  }

  try {
    mostrarToast('info', `Preparando catálogo com ${lista.length} produto(s)... isso pode levar alguns segundos.`, 5000);

    // DEPOIS:
const mapaImagens = {};
await _prefetchImagensComConcorrencia(lista, mapaImagens, 3, (feitas, total) => {
  if (feitas % 15 === 0 || feitas === total) {
    mostrarToast('info', `Carregando imagens... ${feitas}/${total}`, 1500);
  }
});
         const idsSemImagem = lista.filter(p => !mapaImagens[p.id]);
if (idsSemImagem.length > 0) {
  console.warn('Produtos que ficaram SEM IMAGEM no PDF:');
  idsSemImagem.forEach(p => {
    console.warn(`  ID ${p.id} — URL cadastrada: ${p.imagens || '(CAMPO VAZIO NA PLANILHA)'}`);
  });
}

    const paginas = [];
    for (let i = 0; i < lista.length; i += PDF_CARDS_POR_PAGINA) {
      paginas.push(lista.slice(i, i + PDF_CARDS_POR_PAGINA));
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

    const containerOffscreen = document.createElement('div');
    containerOffscreen.style.position = 'fixed';
    containerOffscreen.style.left = '-99999px';
    containerOffscreen.style.top = '0';
    document.body.appendChild(containerOffscreen);

    const nomeVendedor = localStorage.getItem('hbn1_nome') || localStorage.getItem('hbn1_usuario') || '';
    const nomeFornecedorTitulo = filtroFornecedorAtual === 'TODOS' ? 'TODOS OS FORNECEDORES' : filtroFornecedorAtual;
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    for (let pg = 0; pg < paginas.length; pg++) {
      const divPagina = _montarDivPaginaPdf(paginas[pg], mapaImagens, {
        fornecedor: nomeFornecedorTitulo,
        cliente: CLIENTE_SELECIONADO,
        vendedor: nomeVendedor,
        data: dataHoje,
        numPagina: pg + 1,
        totalPaginas: paginas.length
      });
      containerOffscreen.innerHTML = '';
      containerOffscreen.appendChild(divPagina);

      const canvas = await html2canvas(divPagina, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (pg > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89);
    }

    document.body.removeChild(containerOffscreen);

    const nomeArquivo = `Catalogo_${limparNomeArquivo(nomeFornecedorTitulo)}_${dataHoje.replace(/\//g, '-')}.pdf`;
    pdf.save(nomeArquivo);
    mostrarToast('success', 'Catálogo em PDF gerado com sucesso.');
  } catch (erro) {
    console.error('Erro ao gerar catálogo em PDF:', erro);
    mostrarToast('error', 'Ocorreu um erro ao gerar o PDF. Tente novamente.');
  } finally {
  _PDF_GERANDO = false;
  if (btn) { btn.disabled = false; if (htmlOriginal !== null) btn.innerHTML = htmlOriginal; }
  verificarEExibirAvisoCache(); // NOVO — reflete o uso imediatamente após gerar o PDF
}
}
