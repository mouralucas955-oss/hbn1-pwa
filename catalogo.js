// ESTADO GLOBAL
let BD_PRODUTOS         = [];
let PRODUTOS_FILTRADOS  = [];
let CARRINHO            = {};
let filtroFornecedorAtual = "TODOS";
let BD_CLIENTES         = [];
let CLIENTE_SELECIONADO = null;
let FILTRO_APENAS_COM_ESTOQUE = false;
let FILTRO_MARCA_ATIVA = null;
let FILTRO_DIVISAO_ATIVA = null;
let FILTRO_APENAS_COM_DESCONTO = false;
let ORDENACAO_ATIVA = 'padrao'; // padrao | desconto_desc | preco_asc | preco_desc | estoque_desc | alfabetica

const OPCOES_ORDENACAO = [
  { valor: 'padrao', label: 'Padrão' },
  { valor: 'desconto_desc', label: 'Maior desconto' },
  { valor: 'preco_asc', label: 'Menor preço' },
  { valor: 'preco_desc', label: 'Maior preço' },
  { valor: 'estoque_desc', label: 'Mais estoque' },
  { valor: 'alfabetica', label: 'Ordem alfabética' },
];
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
// =========================================================================
// ESCOLHA MANUAL HIT — vendedor define quantidades por produto, por grupo
// =========================================================================
let HIT_MANUAL_QTDS = {}; // { produtoId: qtd }

function abrirEscolhaManualHit() {
  if (TIPO_USUARIO === 'VENDEDOR_FARMA') { mostrarToast('warning', 'Função disponível apenas para equipe Dedicado.'); return; }
  if (!CLIENTE_SELECIONADO) { mostrarToast('warning', 'Selecione um cliente antes.'); return; }
  const equipe = String(CLIENTE_SELECIONADO.equipe || '').toUpperCase().trim();
  if (equipe !== 'DEDICADO') { mostrarToast('warning', 'Esta função é exclusiva para clientes com equipe Dedicado.'); return; }
  if (!HIT_DADOS_CLIENTE) {
    mostrarToast('info', 'Carregando dados HIT do cliente...');
    carregarSugestaoHit();
    setTimeout(() => {
      if (HIT_DADOS_CLIENTE) abrirEscolhaManualHit();
      else mostrarToast('error', 'Não há campanha HIT ativa para este cliente.');
    }, 900);
    return;
  }

  HIT_MANUAL_QTDS = {};
  document.getElementById('escolhaManualClienteNome').innerText = (CLIENTE_SELECIONADO.razao || '').toUpperCase();
  renderizarEscolhaManualHit();
  document.getElementById('modalEscolhaManualHit').classList.remove('hidden');
}

function fecharEscolhaManualHit() { document.getElementById('modalEscolhaManualHit').classList.add('hidden'); }
function fecharEscolhaManualHitNoBackdrop(evt) { if (evt.target.id === 'modalEscolhaManualHit') fecharEscolhaManualHit(); }

function renderizarEscolhaManualHit() {
  const corpo = document.getElementById('corpoEscolhaManualHit');
  if (!HIT_DADOS_CLIENTE || !HIT_DADOS_CLIENTE.alavancas || HIT_DADOS_CLIENTE.alavancas.length === 0) {
    corpo.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm font-medium">Nenhuma alavanca disponível para este cliente.</div>';
    return;
  }

  corpo.innerHTML = HIT_DADOS_CLIENTE.alavancas.map(al => {
    const totalGrupos = (al.grupos || []).length;
    const positivados = (al.grupos || []).filter(g => g.positivado).length;
    const pct = totalGrupos > 0 ? Math.round((positivados / totalGrupos) * 100) : 0;

    const gruposHtml = (al.grupos || []).map(g => {
      if (g.positivado) {
        const item = g.itens && g.itens[0] ? g.itens[0] : {};
        return `
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">${g.itens.length > 1 ? 'OU — Qualquer um destes' : 'SKU único'}</span>
              <span class="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">✅ Positivado</span>
            </div>
            <p class="text-[11px] font-bold text-slate-700">${item.descricao || item.cod || ''}</p>
          </div>`;
      }

      const itensResolvidos = (g.itens || []).map(item => {
        const eanAlvo = normalizarSoDigitos(item.ean);
        let p = BD_PRODUTOS.find(prod => normalizarSoDigitos(prod.ean) === eanAlvo && eanAlvo !== '');
        if (!p && item.cod) p = BD_PRODUTOS.find(prod => String(prod.id).trim() === String(item.cod).trim());
        return { item, produto: p };
      }).filter(x => x.produto);

      if (itensResolvidos.length === 0) {
        return `
          <div class="bg-slate-100 border border-slate-200 rounded-xl p-3">
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">${g.itens.length > 1 ? 'OU — Qualquer um destes' : 'SKU único'}</span>
            <p class="text-[11px] text-slate-400 italic">Nenhuma opção disponível no catálogo atual.</p>
          </div>`;
      }

      const linhasItens = itensResolvidos.map(({ item, produto }) => {
        const estoque = Number(produto.estoque || 0);
        const { precoFinal } = calcularPrecos(produto);
        const qtdAtual = HIT_MANUAL_QTDS[produto.id] || 0;
        const disabled = estoque <= 0;
        return `
          <div class="flex items-center gap-2.5 bg-white border border-slate-100 rounded-xl p-2">
            <img src="${produto.imagens}" class="w-10 h-10 object-contain bg-slate-50 rounded-lg p-1 border border-slate-100 shrink-0 mix-blend-multiply">
            <div class="min-w-0 flex-grow">
              <p class="text-[11px] font-bold text-slate-800 truncate">${produto.descricao || item.cod}</p>
              <p class="text-[9px] text-slate-400 font-mono">Cód ${item.cod} • Est: ${estoque} • ${formatarParaReal(precoFinal)}</p>
            </div>
            <div id="manualqtd-${produto.id}" class="shrink-0">
              ${_htmlStepperManualHit(produto.id, qtdAtual, estoque, disabled)}
            </div>
          </div>`;
      }).join('');

      return `
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">${g.itens.length > 1 ? 'OU — Qualquer um destes' : 'SKU único'}</span>
            <span class="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">— Pendente</span>
          </div>
          <div class="space-y-1.5">${linhasItens}</div>
        </div>`;
    }).join('');

    return `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-black text-purple-700 uppercase tracking-wider">${al.alavanca}</span>
          <span class="text-[10px] font-bold text-slate-400">${positivados}/${totalGrupos} positivados (${pct}%)</span>
        </div>
        <div class="space-y-2">${gruposHtml}</div>
      </div>`;
  }).join('<div class="border-t border-slate-200 my-1"></div>');

  _atualizarRodapeEscolhaManualHit();
}

function _htmlStepperManualHit(produtoId, qtd, estoqueMax, disabled) {
  if (disabled) return `<span class="text-[9px] font-bold text-red-400 px-2">Sem estoque</span>`;
  if (qtd > 0) return `
    <div class="flex items-center bg-purple-50 border border-purple-200 rounded-lg p-0.5">
      <button onclick="alterarQtdManualHit('${produtoId}', -1, ${estoqueMax})" class="w-6 h-6 bg-white hover:bg-purple-100 rounded font-bold text-xs text-purple-600 flex items-center justify-center border border-purple-100">−</button>
      <input type="number" value="${qtd}" min="1" max="${estoqueMax}" onchange="atualizarQtdManualHitDigitada('${produtoId}', this.value, ${estoqueMax})" onkeydown="if(event.key==='Enter') this.blur();"
        class="w-9 text-center font-black text-xs text-purple-700 bg-transparent focus:outline-none p-0 border-0">
      <button onclick="alterarQtdManualHit('${produtoId}', 1, ${estoqueMax})" class="w-6 h-6 bg-white hover:bg-purple-100 rounded font-bold text-xs text-purple-600 flex items-center justify-center border border-purple-100">+</button>
    </div>`;
  return `<button onclick="alterarQtdManualHit('${produtoId}', 1, ${estoqueMax})" class="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-all">+ Add</button>`;
}

function alterarQtdManualHit(produtoId, delta, estoqueMax) {
  let qtd = (HIT_MANUAL_QTDS[produtoId] || 0) + delta;
  if (qtd > estoqueMax) { mostrarToast('warning', `Máximo em estoque: ${estoqueMax} un.`); qtd = estoqueMax; }
  if (qtd <= 0) { delete HIT_MANUAL_QTDS[produtoId]; qtd = 0; }
  else HIT_MANUAL_QTDS[produtoId] = qtd;
  const el = document.getElementById(`manualqtd-${produtoId}`);
  if (el) el.innerHTML = _htmlStepperManualHit(produtoId, qtd, estoqueMax, false);
  _atualizarRodapeEscolhaManualHit();
}

function atualizarQtdManualHitDigitada(produtoId, valor, estoqueMax) {
  let qtd = parseInt(valor);
  if (isNaN(qtd) || qtd <= 0) { delete HIT_MANUAL_QTDS[produtoId]; qtd = 0; }
  else {
    if (qtd > estoqueMax) { mostrarToast('warning', `Máximo em estoque: ${estoqueMax} un.`); qtd = estoqueMax; }
    HIT_MANUAL_QTDS[produtoId] = qtd;
  }
  const el = document.getElementById(`manualqtd-${produtoId}`);
  if (el) el.innerHTML = _htmlStepperManualHit(produtoId, qtd, estoqueMax, false);
  _atualizarRodapeEscolhaManualHit();
}

function _atualizarRodapeEscolhaManualHit() {
  let totalItens = 0, totalLiquido = 0;
  Object.keys(HIT_MANUAL_QTDS).forEach(idProd => {
    const qtd = HIT_MANUAL_QTDS[idProd];
    if (qtd <= 0) return;
    const p = BD_PRODUTOS.find(prod => prod.id === idProd);
    if (!p) return;
    const { precoFinal } = calcularPrecos(p);
    totalItens += qtd;
    totalLiquido += precoFinal * qtd;
  });
  document.getElementById('escolhaManualTotalItens').innerText = `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`;
  document.getElementById('escolhaManualTotalLiquido').innerText = formatarParaReal(totalLiquido);
}

function adicionarSelecaoManualHit() {
  const chaves = Object.keys(HIT_MANUAL_QTDS).filter(id => HIT_MANUAL_QTDS[id] > 0);
  if (chaves.length === 0) { mostrarToast('warning', 'Escolha ao menos um item e defina a quantidade.'); return; }

  let adicionados = 0;
  chaves.forEach(idProd => {
    const p = BD_PRODUTOS.find(prod => prod.id === idProd);
    if (!p) return;
    const estoqueMax = Number(p.estoque || 0);
    const qtdEscolhida = Math.min(HIT_MANUAL_QTDS[idProd], estoqueMax);
    if (qtdEscolhida <= 0) return;

    CARRINHO[idProd] = (CARRINHO[idProd] || 0) + qtdEscolhida;
    adicionados++;

    const c = document.getElementById(`card-btn-${idProd}`);
    if (c) c.innerHTML = obterHtmlBotaoAcao(idProd, CARRINHO[idProd], estoqueMax, false);
    _atualizarEstadoVisualCard(idProd);
  });

  atualizarIndicadoresFinanceirosGlobais();
  atualizarIndicadorMinimosBarra();
  atualizarBotaoSugestaoHit();

  HIT_MANUAL_QTDS = {};
  fecharEscolhaManualHit();

  if (adicionados > 0) mostrarToast('success', `${adicionados} produto(s) HIT adicionados ao pedido.`);
  else mostrarToast('warning', 'Nenhum item pôde ser adicionado.');
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
localStorage.removeItem('hbn1_ufs');
localStorage.removeItem('hbn1_nome');
localStorage.removeItem('hbn1_login_ts');
localStorage.removeItem('hbn1_session');
localStorage.removeItem('hbn1_fornecedor_ativo');       
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
let UFS_PERMITIDAS_USUARIO = [];
try { UFS_PERMITIDAS_USUARIO = JSON.parse(localStorage.getItem('hbn1_ufs') || '[]'); } catch(e) {}
if (UFS_PERMITIDAS_USUARIO.length === 0) UFS_PERMITIDAS_USUARIO = [UF_USUARIO];
// =========================================================================
// CACHE DE PRODUTOS (stale-while-revalidate) — abre o catálogo já com os
// produtos da última visita, atualizando em segundo plano
// =========================================================================
const CHAVE_CACHE_PRODUTOS = 'hbn1_cache_produtos_' + UF_USUARIO;

function _salvarCacheProdutos(produtos) {
  try {
    localStorage.setItem(CHAVE_CACHE_PRODUTOS, JSON.stringify({
      timestamp: Date.now(),
      produtos: produtos
    }));
  } catch (e) {
    // Cache é só uma otimização — se não couber, o catálogo segue funcionando normalmente
    console.warn('Não foi possível cachear produtos:', e.message);
  }
}

function _carregarCacheProdutos() {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE_PRODUTOS);
    if (!bruto) return null;
    const obj = JSON.parse(bruto);
    if (!obj || !Array.isArray(obj.produtos) || obj.produtos.length === 0) return null;
    return obj.produtos;
  } catch (e) {
    return null;
  }
}

function renderizarSeletorUF() {
  const badge = document.getElementById('ufBadgeTitulo');
  if (!badge) return;
  if (UFS_PERMITIDAS_USUARIO.length <= 1) {
    badge.innerText = '(' + UF_USUARIO + ')';
    return;
  }
  badge.innerHTML = `
    <span class="relative inline-block">
      <button onclick="toggleSeletorUF()" class="flex items-center gap-1 cursor-pointer hover:opacity-80">
        (${UF_USUARIO})
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div id="dropdownSeletorUF" class="hidden absolute mt-2 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[80px]">
        ${UFS_PERMITIDAS_USUARIO.map(uf => `
          <button onclick="trocarUfAtiva('${uf}')" class="block w-full text-left px-4 py-2 text-xs font-bold ${uf === UF_USUARIO ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'}">${uf}</button>
        `).join('')}
      </div>
    </span>`;
}

function toggleSeletorUF() {
  const dd = document.getElementById('dropdownSeletorUF');
  if (dd) dd.classList.toggle('hidden');
}

function trocarUfAtiva(novaUf) {
  if (novaUf === UF_USUARIO) return;
  const trocar = () => {
    chamarApi('trocarUf', { uf: novaUf }).then(resp => {
      if (resp && resp.sucesso) {
        localStorage.setItem('hbn1_uf', novaUf);
        window.location.href = 'catalogo.html?uf=' + novaUf;
      } else {
        mostrarToast('error', (resp && resp.mensagem) || 'Não foi possível trocar de UF.');
      }
    }).catch(() => mostrarToast('error', 'Erro ao trocar de UF.'));
  };
  if (Object.keys(CARRINHO).length > 0) {
    mostrarConfirm('Trocar de UF?', 'Você tem itens no pedido atual. Ao trocar de UF o carrinho será limpo. Deseja continuar?', trocar);
  } else {
    trocar();
  }
}

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
// Logo HBN/Nazária (fundo transparente) usada no cabeçalho do PDF do catálogo (baixarCatalogoPdf).
// Embutida em base64 para nunca depender de link externo (Drive, CDN, etc).
// Logo HBN/Nazária (fundo transparente) usada no cabeçalho do PDF do catálogo (baixarCatalogoPdf).
// Embutida em base64 para nunca depender de link externo (Drive, CDN, etc).
const LOGO_HBN_PDF_BASE64 = "data:image/png;base64,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";
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
FILTRO_MARCA_ATIVA = null;
FILTRO_DIVISAO_ATIVA = null;
atualizarEstiloBotaoFiltro('btnFiltroMarca', false, 'Marca');
atualizarEstiloBotaoFiltro('btnFiltroDivisao', false, 'Divisão');       
localStorage.setItem('hbn1_fornecedor_ativo', filtroFornecedorAtual);
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
localStorage.removeItem('hbn1_fornecedor_ativo');
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

const termoSoDigitos = termo.replace(/\D/g, '');

const filtrados = BD_CLIENTES.filter(c =>
String(c.id).toLowerCase().includes(termo) ||
String(c.razao).toLowerCase().includes(termo) ||
(termoSoDigitos !== '' && String(c.cnpj).replace(/\D/g, '').includes(termoSoDigitos))
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
 const ddUf = document.getElementById('dropdownSeletorUF');
if (ddUf && !ddUf.classList.contains('hidden') && !ddUf.parentElement.contains(e.target)) {
  ddUf.classList.add('hidden');
}
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
['dropdownFiltroMarca', 'dropdownFiltroDivisao', 'dropdownOrdenar'].forEach(id => {
    const dd = document.getElementById(id);
    if (dd && !dd.classList.contains('hidden') && !dd.parentElement.contains(e.target)) {
      dd.classList.add('hidden');
    }
  });
});

// FILTROS
function toggleBotaoLimparPesquisa() {
const input = document.getElementById('barraPesquisa');
const btn = document.getElementById('btnLimparPesquisa');
if (!input || !btn) return;
if (input.value.length > 0) {
btn.classList.remove('hidden');
btn.classList.add('flex');
} else {
btn.classList.add('hidden');
btn.classList.remove('flex');
}
}

function limparBarraPesquisa() {
const input = document.getElementById('barraPesquisa');
input.value = '';
input.focus();
toggleBotaoLimparPesquisa();
executarFiltrosGerais();
}

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
function toggleDropdownFiltro(tipo) {
  const mapaIds = { marca: 'dropdownFiltroMarca', divisao: 'dropdownFiltroDivisao', ordenar: 'dropdownOrdenar' };
  const idAlvo = mapaIds[tipo];
  Object.values(mapaIds).forEach(id => {
    if (id !== idAlvo) document.getElementById(id).classList.add('hidden');
  });
  const dd = document.getElementById(idAlvo);
  const abrindo = dd.classList.contains('hidden');
  dd.classList.toggle('hidden');
  if (!abrindo) return;

  if (tipo === 'marca')    renderizarDropdownMarca();
  if (tipo === 'divisao')  renderizarDropdownDivisao();
  if (tipo === 'ordenar')  renderizarDropdownOrdenar();
}

// Base sempre pelo fornecedor ativo (não pelos outros filtros), pra lista
// de opções não sumir conforme o usuário vai filtrando
function _produtosBaseParaOpcoes() {
  return BD_PRODUTOS.filter(p => {
    if (!p.id || String(p.id).trim() === '' || String(p.id).trim() === 'Sem ID') return false;
    return filtroFornecedorAtual === "TODOS" || (p.fornecedor && String(p.fornecedor).trim().toUpperCase() === filtroFornecedorAtual);
  });
}

function renderizarDropdownMarca() {
  const base = _produtosBaseParaOpcoes();
  const marcas = [...new Set(base.map(p => String(p.marca || '').trim().toUpperCase()).filter(Boolean))].sort();
  const dd = document.getElementById('dropdownFiltroMarca');
  let html = `<button onclick="selecionarFiltroMarca(null)" class="w-full text-left px-3 py-2 text-[11px] font-bold ${!FILTRO_MARCA_ATIVA ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'}">Todas as marcas</button>`;
  html += marcas.map(m => `
    <button onclick="selecionarFiltroMarca('${m.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2 text-[11px] font-semibold border-t border-slate-50 ${FILTRO_MARCA_ATIVA === m ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'}">${m}</button>`).join('');
  dd.innerHTML = html;
}

function renderizarDropdownDivisao() {
  const base = _produtosBaseParaOpcoes();
  const divisoes = [...new Set(base.map(p => String(p.divisao || '').trim().toUpperCase()).filter(v => v && v !== '-'))].sort();
  const dd = document.getElementById('dropdownFiltroDivisao');
  if (divisoes.length === 0) {
    dd.innerHTML = `<div class="px-3 py-2 text-[11px] text-slate-400 italic">Sem divisões cadastradas</div>`;
    return;
  }
  let html = `<button onclick="selecionarFiltroDivisao(null)" class="w-full text-left px-3 py-2 text-[11px] font-bold ${!FILTRO_DIVISAO_ATIVA ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'}">Todas as divisões</button>`;
  html += divisoes.map(d => `
    <button onclick="selecionarFiltroDivisao('${d.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2 text-[11px] font-semibold border-t border-slate-50 ${FILTRO_DIVISAO_ATIVA === d ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'}">${d}</button>`).join('');
  dd.innerHTML = html;
}

function renderizarDropdownOrdenar() {
  const dd = document.getElementById('dropdownOrdenar');
  dd.innerHTML = OPCOES_ORDENACAO.map(o => `
    <button onclick="selecionarOrdenacao('${o.valor}')" class="w-full text-left px-3 py-2 text-[11px] font-semibold border-t border-slate-50 first:border-t-0 ${ORDENACAO_ATIVA === o.valor ? 'text-orange-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'}">${o.label}</button>`).join('');
}

function selecionarFiltroMarca(marca) {
  FILTRO_MARCA_ATIVA = marca;
  document.getElementById('dropdownFiltroMarca').classList.add('hidden');
  atualizarEstiloBotaoFiltro('btnFiltroMarca', !!marca, marca || 'Marca');
  executarFiltrosGerais();
}

function selecionarFiltroDivisao(divisao) {
  FILTRO_DIVISAO_ATIVA = divisao;
  document.getElementById('dropdownFiltroDivisao').classList.add('hidden');
  atualizarEstiloBotaoFiltro('btnFiltroDivisao', !!divisao, divisao || 'Divisão');
  executarFiltrosGerais();
}

function selecionarOrdenacao(valor) {
  ORDENACAO_ATIVA = valor;
  document.getElementById('dropdownOrdenar').classList.add('hidden');
  const opt = OPCOES_ORDENACAO.find(o => o.valor === valor);
  document.getElementById('labelOrdenacaoAtual').innerText = valor === 'padrao' ? 'Ordenar' : opt.label;
  executarFiltrosGerais();
}

function toggleFiltroDesconto() {
  FILTRO_APENAS_COM_DESCONTO = !FILTRO_APENAS_COM_DESCONTO;
  const btn = document.getElementById('btnFiltroDesconto');
  const badge = document.getElementById('badgeFiltroDescontoAtivo');
  btn.className = FILTRO_APENAS_COM_DESCONTO
    ? "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center gap-1.5"
    : "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-slate-200 bg-white text-slate-500 hover:border-orange-400 hover:text-orange-500 flex items-center gap-1.5";
  badge.classList.toggle('hidden', !FILTRO_APENAS_COM_DESCONTO);
  executarFiltrosGerais();
}

function atualizarEstiloBotaoFiltro(idBtn, ativo, label) {
  const btn = document.getElementById(idBtn);
  if (!btn) return;
  btn.className = ativo
    ? "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center gap-1.5"
    : "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-slate-200 bg-white text-slate-500 hover:border-orange-400 hover:text-orange-500 flex items-center gap-1.5";
  btn.innerHTML = `${label}<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>`;
}

function limparFiltrosExtras() {
  FILTRO_MARCA_ATIVA = null;
  FILTRO_DIVISAO_ATIVA = null;
  FILTRO_APENAS_COM_DESCONTO = false;
  ORDENACAO_ATIVA = 'padrao';
  atualizarEstiloBotaoFiltro('btnFiltroMarca', false, 'Marca');
  atualizarEstiloBotaoFiltro('btnFiltroDivisao', false, 'Divisão');
  document.getElementById('labelOrdenacaoAtual').innerText = 'Ordenar';
  const btnDesc = document.getElementById('btnFiltroDesconto');
  btnDesc.className = "px-3 py-1 text-[10px] font-black rounded-lg border transition-all border-slate-200 bg-white text-slate-500 hover:border-orange-400 hover:text-orange-500 flex items-center gap-1.5";
  document.getElementById('badgeFiltroDescontoAtivo').classList.add('hidden');
  executarFiltrosGerais();
}

function atualizarBadgesFiltrosExtras() {
  const algumAtivo = FILTRO_MARCA_ATIVA || FILTRO_DIVISAO_ATIVA || FILTRO_APENAS_COM_DESCONTO || ORDENACAO_ATIVA !== 'padrao';
  const btn = document.getElementById('btnLimparFiltrosExtras');
  if (btn) btn.classList.toggle('hidden', !algumAtivo);
}


function executarFiltrosGerais(comAnimacao = true) {
  const busca = document.getElementById('barraPesquisa').value.toLowerCase().trim();
  PRODUTOS_FILTRADOS = BD_PRODUTOS.filter(p => {
    if (!p.id || String(p.id).trim() === '' || String(p.id).trim() === 'Sem ID') return false;
    const condForn = filtroFornecedorAtual === "TODOS" || (p.fornecedor && String(p.fornecedor).trim().toUpperCase() === filtroFornecedorAtual);
    if (FILTRO_APENAS_COM_ESTOQUE && (parseInt(p.estoque) || 0) <= 0) return false;
    if (FILTRO_MARCA_ATIVA && String(p.marca || '').trim().toUpperCase() !== FILTRO_MARCA_ATIVA) return false;
    if (FILTRO_DIVISAO_ATIVA && String(p.divisao || '').trim().toUpperCase() !== FILTRO_DIVISAO_ATIVA) return false;
    if (FILTRO_APENAS_COM_DESCONTO) {
      const { percentual } = calcularPrecos(p);
      if (!(percentual > 0)) return false;
    }
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

  aplicarOrdenacaoAtual();
  renderizarInterfaceGrafica(PRODUTOS_FILTRADOS, comAnimacao);
  atualizarBadgesFiltrosExtras();
}

function aplicarOrdenacaoAtual() {
  switch (ORDENACAO_ATIVA) {
    case 'desconto_desc':
      PRODUTOS_FILTRADOS.sort((a, b) => calcularPrecos(b).percentual - calcularPrecos(a).percentual);
      break;
    case 'preco_asc':
      PRODUTOS_FILTRADOS.sort((a, b) => calcularPrecos(a).precoFinal - calcularPrecos(b).precoFinal);
      break;
    case 'preco_desc':
      PRODUTOS_FILTRADOS.sort((a, b) => calcularPrecos(b).precoFinal - calcularPrecos(a).precoFinal);
      break;
    case 'estoque_desc':
      PRODUTOS_FILTRADOS.sort((a, b) => (Number(b.estoque) || 0) - (Number(a.estoque) || 0));
      break;
    case 'alfabetica':
      PRODUTOS_FILTRADOS.sort((a, b) => String(a.descricao || '').localeCompare(String(b.descricao || '')));
      break;
    default:
      break; // mantém a ordem original (a que já vem de BD_PRODUTOS)
  }
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
// =========================================================================
// CARROSSEL DE IMAGENS DO PRODUTO (foto principal + fotos extras da coluna AF)
// =========================================================================
let GALERIA_IMAGENS = [];
let GALERIA_INDEX = 0;

function _montarGaleriaImagens(p) {
  const extras = String(p.imagemInfo || '')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
  const principal = p.imagens ? [p.imagens] : [];
  return [...new Set([...principal, ...extras])]; // remove duplicadas, mantém ordem
}

function _renderizarGaleria() {
  const total = GALERIA_IMAGENS.length;
  const urlAtual = GALERIA_IMAGENS[GALERIA_INDEX] || '';
  document.getElementById('modalImagem').src = urlAtual;

  const btnAnt    = document.getElementById('galeriaBtnAnterior');
  const btnProx   = document.getElementById('galeriaBtnProxima');
  const contador  = document.getElementById('galeriaContador');
  const temVarias = total > 1;

  btnAnt.classList.toggle('hidden', !temVarias);
  btnProx.classList.toggle('hidden', !temVarias);
  contador.classList.toggle('hidden', !temVarias);
  if (temVarias) contador.innerText = `${GALERIA_INDEX + 1} / ${total}`;

  // Se o zoom estiver aberto, mantém a imagem ampliada sincronizada
  const modalZoom = document.getElementById('modalZoomImagem');
  if (modalZoom && !modalZoom.classList.contains('hidden')) {
    document.getElementById('modalZoomImg').src = urlAtual;
    _atualizarSetasZoom();
  }
}

function _atualizarSetasZoom() {
  const total = GALERIA_IMAGENS.length;
  const temVarias = total > 1;
  const btnAntZoom  = document.getElementById('zoomBtnAnterior');
  const btnProxZoom = document.getElementById('zoomBtnProxima');
  const contadorZoom = document.getElementById('zoomContador');
  if (btnAntZoom)   btnAntZoom.classList.toggle('hidden', !temVarias);
  if (btnProxZoom)  btnProxZoom.classList.toggle('hidden', !temVarias);
  if (contadorZoom) {
    contadorZoom.classList.toggle('hidden', !temVarias);
    if (temVarias) contadorZoom.innerText = `${GALERIA_INDEX + 1} / ${total}`;
  }
}

function galeriaAnterior() {
  if (GALERIA_IMAGENS.length <= 1) return;
  GALERIA_INDEX = (GALERIA_INDEX - 1 + GALERIA_IMAGENS.length) % GALERIA_IMAGENS.length;
  _renderizarGaleria();
}

function galeriaProxima() {
  if (GALERIA_IMAGENS.length <= 1) return;
  GALERIA_INDEX = (GALERIA_INDEX + 1) % GALERIA_IMAGENS.length;
  _renderizarGaleria();
}

// MODAL DETALHES
function abrirModalDetalhes(idProd) {
const p = BD_PRODUTOS.find(item => item.id === idProd);
if (!p) return;

GALERIA_IMAGENS = _montarGaleriaImagens(p);
GALERIA_INDEX = 0;
_renderizarGaleria();
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
  _atualizarSetasZoom();
}
function fecharZoomImagem()              { document.getElementById('modalZoomImagem').classList.add('hidden'); }
function fecharZoomImagemNoBackdrop(evt) { if (evt.target.id === 'modalZoomImagem') fecharZoomImagem(); }

document.addEventListener('keydown', function(e) {
  const zoom = document.getElementById('modalZoomImagem');
  if (zoom && !zoom.classList.contains('hidden')) {
    if (e.key === 'Escape') fecharZoomImagem();
    if (e.key === 'ArrowLeft') galeriaAnterior();
    if (e.key === 'ArrowRight') galeriaProxima();
  }
});
function abrirZoomImagemDireto(url) {
  if (!url) return;
  document.getElementById('modalZoomImg').src = url;
  document.getElementById('modalZoomImagem').classList.remove('hidden');
}
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
let PDF_EXTRACAO_MODO = 'heuristica'; // 'heuristica' | 'ia' — só ADMIN pode trocar pra 'ia'

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
  PDF_EXTRACAO_MODO = 'heuristica';
  const checkbox = document.getElementById('checkboxUsarIA');
  if (checkbox) checkbox.checked = false;
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
    let itensBrutos = [];

    if (ext === 'xlsx' || ext === 'xls') {
      const linhas = await extrairLinhasDeExcel(file);
      atualizarTextoProcessando('Identificando CNPJs e itens...');
      itensBrutos = extrairItensDeLinhas(linhas);

   } else if (ext === 'pdf') {
  const usarIA = PDF_EXTRACAO_MODO === 'ia' && TIPO_USUARIO === 'ADMIN';

  if (usarIA) {
    atualizarTextoProcessando('Extraindo pedido com IA...');
    itensBrutos = await extrairItensArquivoViaIA(file, 'application/pdf');
  } else {
    const linhas = await extrairLinhasDePdf(file);

const textoPdf = linhas
  .flat()
  .map(v => String(v).toUpperCase())
  .join(' ');

const ehPedidoUnilever =
  textoPdf.includes('EMITIR PEDIDO DE COMPRA') &&
  textoPdf.includes('CODBARRAS');

atualizarTextoProcessando('Identificando CNPJs e itens...');

if (ehPedidoUnilever) {
  itensBrutos = await extrairItensPedidoUnileverPorPagina(file);
} else {
  itensBrutos = extrairItensDeLinhas(linhas);
}
}

           
} else if (['jpg', 'jpeg', 'png'].includes(ext)) {
  if (TIPO_USUARIO !== 'ADMIN') {
    throw new Error('Envio de imagem disponível apenas para administradores.');
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 8 MB.');
  }

  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  atualizarTextoProcessando('Extraindo pedido da imagem com IA...');
  itensBrutos = await extrairItensArquivoViaIA(file, mimeType);

} else {
  throw new Error(
    'Formato não suportado. Envie .xlsx, .xls, .pdf, .jpg ou .png.'
  );
}

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
todasLinhas.push(['__PAGINA__', String(pagina)]);
       
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
function arquivoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // remove "data:...;base64,"
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extrairItensArquivoViaIA(file, mimeType) {
  if (TIPO_USUARIO !== 'ADMIN') {
    throw new Error('Extração por IA disponível apenas para administradores.');
  }

  const base64Arquivo = await arquivoParaBase64(file);

  const resposta = await chamarApi('extrairPedidoPdfComIA', {
    base64: base64Arquivo,
    mimeType: mimeType
  });

  if (!resposta || resposta.erro) {
    throw new Error(
      (resposta && resposta.mensagem) ||
      'A IA não conseguiu processar o arquivo.'
    );
  }

  const itensBrutos = [];

  (resposta.pedidos || []).forEach(pedido => {
    const cnpjDigits = pedido.cnpj
      ? normalizarCNPJ(normalizarSoDigitos(pedido.cnpj))
      : CNPJ_SEM_CADASTRO;

    (pedido.itens || []).forEach(item => {
      if (!item.quantidade || item.quantidade <= 0) return;

      itensBrutos.push({
        cnpjDigits: cnpjDigits,
        codigo: item.codigo || '',
        ean: item.ean ? normalizarEAN(item.ean) : '',
        qtd: parseInt(item.quantidade, 10)
      });
    });
  });

  return itensBrutos;
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
// Identifica os índices de tokens que são percentual de desconto — ou seja,
// o valor decimal que aparece IMEDIATAMENTE ANTES de um token "%" (ex: "10,00 %").
// Isso nunca pode ser preço nem total, e é excluído independente do valor
// (antes só excluía "0,00", o que deixava passar descontos como "10,00%", "5,00%" etc.
// e contaminava o cálculo min/max, gerando quantidades erradas).
const indicesPercentual = new Set();
tokens.forEach((t, i) => {
  if (t === '%' && i > 0) indicesPercentual.add(i - 1);
});

// Coleta todos os valores decimais da linha (formato brasileiro: 9,40 / 13,523500 / 162,28),
// exceto os que forem percentual de desconto (identificados acima).
const decimais = tokens
  .map((t, i) => ({ t, i }))
  .filter(({ t, i }) => /^\d{1,3}(\.\d{3})*,\d+$/.test(t) && !indicesPercentual.has(i))
  .map(({ t }) => parseFloat(t.replace(/\./g, '').replace(',', '.')))
  .filter(n => !isNaN(n) && n > 0.009);

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
async function extrairItensPedidoUnileverPorPagina(file) {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const itens = [];

  for (let pagina = 1; pagina <= doc.numPages; pagina++) {
    const page = await doc.getPage(pagina);
    const conteudo = await page.getTextContent();

    // Mantém a ordem natural em que o PDF gravou os textos.
    const texto = conteudo.items
      .map(item => String(item.str || ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Captura o CNPJ que aparece no bloco "Empresa ... CNPJ".
    const matchCnpj = texto.match(
      /Empresa[\s\S]{0,260}?CNPJ\s*:?\s*([0-9.\-/]{14,18})/i
    );

    let cnpjDigits = CNPJ_SEM_CADASTRO;

    if (matchCnpj) {
      const cnpj = normalizarCNPJ(normalizarSoDigitos(matchCnpj[1]));

      if (!CNPJS_IGNORAR_COMO_CLIENTE.includes(cnpj)) {
        cnpjDigits = cnpj;
      }
    }

    // Padrão do pedido:
    // ... descrição + EAN + quantidade pedida + preço unitário
    //
    // Exemplos:
    // 7896007550043 8 37,520000
    // 7896007550036 4 71,460000
    const regexItem =
      /(\d{8,13})\s+(\d{1,4})\s+\d+(?:\.\d{3})*,\d{6}/g;

    let match;
    let itensDaPagina = 0;

    while ((match = regexItem.exec(texto)) !== null) {
      const ean = normalizarEAN(match[1]);
      const qtd = parseInt(match[2], 10);

      if (!ean || !qtd || qtd <= 0) continue;

      itens.push({
        cnpjDigits: cnpjDigits,
        codigo: '',
        ean: ean,
        qtd: qtd
      });

      itensDaPagina++;
    }

    console.log(
      `Unilever — página ${pagina}:`,
      `CNPJ ${cnpjDigits},`,
      `${itensDaPagina} item(ns)`
    );
  }

  return itens;
}

function extrairItensDeLinhas(linhas) {
  const textoCompleto = linhas
    .flat()
    .map(v => String(v).toUpperCase())
    .join(' ');

  const ehPedidoUnilever =
    textoCompleto.includes('EMITIR PEDIDO DE COMPRA') &&
    textoCompleto.includes('CODBARRAS');

  const cabecalho = detectarCabecalho(linhas);

  if (cabecalho) {
    return extrairItensTipo1(linhas, cabecalho);
  }

  return extrairItensTipo2(linhas);
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
const pedidosSemProdutoNoCatalogo = [];
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

if (itensCasados.length === 0) {
  pedidosSemProdutoNoCatalogo.push({
    cliente,
    cnpjFormatado: formatarCNPJ(cnpjDigits),
    totalItensDoArquivo: itensDoGrupo.length,
    unidades: itensDoGrupo.reduce((s, it) => s + it.qtd, 0)
  });
  continue;
}

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
pedidosSemProdutoNoCatalogo,
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
const { pedidosSemProdutoNoCatalogo } = IMPORT_RESULTADO;
const temPedidosDescartados = pedidosSemProdutoNoCatalogo && pedidosSemProdutoNoCatalogo.length > 0;

if (codigosNaoEncontrados.length > 0 || temPedidosDescartados) {
  let textoFinal = '';
  if (temPedidosDescartados) {
    textoFinal += `⚠ ${pedidosSemProdutoNoCatalogo.length} pedido(s) descartado(s) — nenhum item pertence ao seu catálogo:\n`;
    textoFinal += pedidosSemProdutoNoCatalogo.map(p =>
      `  • ${(p.cliente.razao || '').toUpperCase()} (${p.cnpjFormatado}) — ${p.totalItensDoArquivo} item(ns), ${p.unidades} un`
    ).join('\n');
    textoFinal += codigosNaoEncontrados.length > 0 ? '\n\n' : '';
  }
  if (codigosNaoEncontrados.length > 0) {
    textoFinal += 'Códigos/EANs não localizados: ' + codigosNaoEncontrados.join(', ');
  }
  document.getElementById('importTextoCodigoNaoEncontrados').innerText = textoFinal;
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

function registrarPedidoNoHistoricoAtual() {
  const chaves = Object.keys(CARRINHO);
  if (chaves.length === 0) return;

  const itensPorFornecedor = {};

  chaves.forEach(idProd => {
    const p = BD_PRODUTOS.find(item => item.id === idProd);
    if (!p) return;
    const qtd = CARRINHO[idProd];
    const { precoFinal, percentual } = calcularPrecos(p);
    const forn = p.fornecedor ? String(p.fornecedor).trim().toUpperCase() : 'GERAL';
    if (!itensPorFornecedor[forn]) itensPorFornecedor[forn] = [];
    itensPorFornecedor[forn].push({
      nome: p.descricao || p.id,
      ean: p.ean,
      quantidade: qtd,
      precoUnitario: precoFinal,
      total: precoFinal * qtd,
      desconto: percentual
    });
  });

  // Uma linha de histórico por fornecedor (o backend guarda 1 fornecedor por linha)
  Object.keys(itensPorFornecedor).forEach(forn => {
    const itens = itensPorFornecedor[forn];
    const valorForn = itens.reduce((s, i) => s + i.total, 0);
    chamarApi('registrarHistoricoPedido', {
      dados: {
        cnpj: CLIENTE_SELECIONADO ? CLIENTE_SELECIONADO.cnpj : '',
        clienteNome: CLIENTE_SELECIONADO ? CLIENTE_SELECIONADO.razao : '',
        fornecedor: forn,
        itens: itens,
        valorTotal: valorForn,
        descontoAplicado: OL_ATIVO ? ('OL ' + OL_ATIVO) : '',
        observacoes: ''
      }
    }).catch(e => console.error('Erro ao registrar histórico (' + forn + '):', e));
  });
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
registrarPedidoNoHistoricoAtual()       
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
registrarPedidoNoHistoricoAtual();       

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
renderizarSeletorUF();
if (icon) icon.innerText = (localStorage.getItem('hbn1_tema') || 'light') === 'dark' ? '☀️' : '🌙';

// Cliente (Independente ou Rede) só vê o próprio pedido — nada de gestão/vendas
if (TIPO_USUARIO === 'CLIENTE_INDEPENDENTE' || TIPO_USUARIO === 'CLIENTE_REDE') {
  ['itemMenuVerValorPedido', 'itemMenuCentralInvestimento', 'itemMenuCarteira',
   'linkHitAlavancas', 'itemMenuEscolhaManualHit', 'linkCampanhasMetas', 'linkAdminAcessos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
} else {
  if (TIPO_USUARIO === 'VENDEDOR_FARMA') {
    ['linkHitAlavancas', 'itemMenuEscolhaManualHit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  // Campanhas Mensais é exclusivo do Dedicado (e Admin)
  if (TIPO_USUARIO !== 'VENDEDOR_DEDICADO' && TIPO_USUARIO !== 'ADMIN') {
    const linkMetas = document.getElementById('linkCampanhasMetas');
    if (linkMetas) linkMetas.remove();
  }

  if (TIPO_USUARIO !== 'ADMIN') {
    const linkAdmin = document.getElementById('linkAdminAcessos');
    if (linkAdmin) linkAdmin.remove();
  }
}

if (TIPO_USUARIO !== 'ADMIN') {
const linkAdmin = document.getElementById('linkAdminAcessos');
if (linkAdmin) linkAdmin.remove();
}
if (TIPO_USUARIO === 'ADMIN') {
  const blocoIA = document.getElementById('blocoOpcaoIA');
  if (blocoIA) blocoIA.classList.remove('hidden');
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
if (isPrimeiraCarga) {
const cache = _carregarCacheProdutos();
if (cache && cache.length > 0) {
// STALE: já mostra os produtos da última visita, sem esperar a rede
BD_PRODUTOS = cache;
const fornecedorSalvo = localStorage.getItem('hbn1_fornecedor_ativo');
const fornecedorAindaExiste = fornecedorSalvo && BD_PRODUTOS.some(p =>
p.id && String(p.id).trim() !== '' && String(p.id).trim() !== 'Sem ID' &&
(p.fornecedor || '').trim().toUpperCase() === fornecedorSalvo
);
if (fornecedorAindaExiste) {
entrarFornecedor(fornecedorSalvo);
} else {
mostrarTelaPortais();
}
recalcularTotaisGerais();
} else {
// Sem cache ainda (primeiro acesso): mostra os portais com skeleton, como antes
document.getElementById('telaPortais').classList.remove('hidden');
document.getElementById('portaisNomeUsuario').innerText =
localStorage.getItem('hbn1_nome') || localStorage.getItem('hbn1_usuario') || '';
renderizarGridPortais();
}
}

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
_salvarCacheProdutos(dados);

if (isPrimeiraCarga) {
// REVALIDATE: atualiza silenciosamente a tela em que o vendedor já está
if (!document.getElementById('mainProdutos').classList.contains('hidden')) {
executarFiltrosGerais(false);
document.getElementById('qtdProdutosFornecedor').innerText =
PRODUTOS_FILTRADOS.length + ' produto' + (PRODUTOS_FILTRADOS.length !== 1 ? 's' : '');
} else {
renderizarGridPortais();
}
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
if (isPrimeiraCarga && BD_PRODUTOS.length === 0) {
document.getElementById('gridProdutos').innerHTML = `<div class="col-span-full text-center py-10 text-red-500 font-bold">Erro ao conectar com o Google Sheets. Tente atualizar a página.</div>`;
}
});
}

function atualizarClientesInvisivel() {
chamarApi('clientes', { uf: UF_USUARIO })
.then(lista => {
BD_CLIENTES = lista;
aplicarRestricoesClienteLogado();
})
.catch(e => console.error("Erro nos clientes:", e));
}

// Ajusta a barra de cliente do topo conforme o tipo de sessão logada.
// CLIENTE_INDEPENDENTE: já entra com o próprio cliente selecionado, sem
// poder buscar/trocar (BD_CLIENTES sempre tem só ele mesmo, pelo backend).
// CLIENTE_REDE: mantém a busca, mas BD_CLIENTES já vem restrita à rede dele.
function aplicarRestricoesClienteLogado() {
  if (TIPO_USUARIO === 'CLIENTE_INDEPENDENTE') {
    if (BD_CLIENTES.length > 0 && !CLIENTE_SELECIONADO) {
      selecionarCliente(BD_CLIENTES[0].id);
    }
    const buscaWrap = document.getElementById('estadoSemCliente');
    if (buscaWrap) buscaWrap.classList.add('hidden');
    // Remove o botão "✖" do popover — cliente independente não pode "limpar"
    // a si mesmo e ficar sem cliente selecionado.
    const botaoLimparCliente = document.querySelector('#popoverCliente button[onclick="limparClienteSelecionado()"]');
    if (botaoLimparCliente) botaoLimparCliente.remove();
  } else if (TIPO_USUARIO === 'CLIENTE_REDE') {
    const inputBusca = document.getElementById('buscaClienteInput');
    if (inputBusca) inputBusca.placeholder = '🔍 Buscar CNPJ da sua rede...';
  }
}

atualizarMuralInvisivel();
atualizarProdutosInvisivel(true);
atualizarClientesInvisivel();
carregarST();
carregarValoresMinimos();
atualizarBadgesPedidosSalvos();
verificarEExibirAvisoCache();
setInterval(verificarEExibirAvisoCache, 300000); // reavalia a cada 5 min, igual aos outros polls
       
setInterval(atualizarMuralInvisivel,     60000);   // 1 min
setInterval(() => atualizarProdutosInvisivel(false), 180000); // 3 min
setInterval(atualizarClientesInvisivel, 300000);  // 5 min

// Heartbeat — avisa o backend que a sessão ainda está ativa e detecta
// bloqueio no meio de uma sessão já aberta.
enviarHeartbeat();
setInterval(enviarHeartbeat, 120000); // 2 min
});

function enviarHeartbeat() {
  chamarApi('heartbeat', {})
    .then(resp => {
      if (resp && resp.bloqueado) {
        mostrarToast('error', 'Seu acesso foi bloqueado pelo administrador.', 6000);
        setTimeout(() => {
          localStorage.removeItem('hbn1_usuario');
          localStorage.removeItem('hbn1_uf');
          localStorage.removeItem('hbn1_nome');
          localStorage.removeItem('hbn1_login_ts');
          localStorage.removeItem('hbn1_session');
          window.location.href = 'index.html';
        }, 2500);
      }
    })
    .catch(() => {}); // silencioso — heartbeat não deve incomodar o usuário
}
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

function _gerarHtmlCardPdf(p, imgBase64, incluirPreco = true) {
  const { precoFinal, precoOriginal, percentual } = calcularPrecos(p);
  const temDesconto = percentual > 0 && precoOriginal > 0;
  const economia = temDesconto ? (precoOriginal - precoFinal) : 0;
  const estoque = Number(p.estoque || 0);
  const badgePct = _formatarPercentualBadge(percentual);

  return `
    <div style="display:flex;border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;background:#fff;height:160px;box-sizing:border-box;">

      <!-- LATERAL ESQUERDA: imagem -->
      <div style="width:130px;flex-shrink:0;position:relative;background:#fafafa;display:flex;align-items:center;justify-content:center;">
       ${(incluirPreco && badgePct) ? `<span style="position:absolute;top:6px;left:6px;background:#e74c3c;color:#fff;font-size:9px;font-weight:800;height:20px;min-width:38px;padding:0 7px;border-radius:6px;z-index:2;display:inline-flex;align-items:center;justify-content:center;line-height:20px;box-sizing:border-box;">
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
  ${incluirPreco ? `
  ${temDesconto ? `<div style="font-size:8px;color:#94a3b8;text-decoration:line-through;">De: ${formatarParaReal(precoOriginal)}</div>` : ''}

  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <div style="font-size:15px;font-weight:800;color:#e8620a;line-height:1.2;white-space:nowrap;">
      ${precoOriginal > 0 ? formatarParaReal(precoFinal) : '—'}
    </div>

    ${economia > 0 ? `<span style="background:#22c55e;color:#fff;font-size:7px;font-weight:700;height:17px;padding:0 7px;border-radius:5px;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;line-height:17px;box-sizing:border-box;">
  <span style="display:block;transform:translateY(-2px);">ECON. ${formatarParaReal(economia)}</span>
</span>` : ''}
  </div>
  ` : ''}

  <div style="text-align:right;margin-top:3px;">
    <span style="font-size:7.5px;color:#94a3b8;">Est: ${estoque}</span>
  </div>
</div>
      </div>
    </div>`;
}

function _montarDivPaginaPdf(produtosDaPagina, mapaImagens, info, incluirPreco = true) {
  const div = document.createElement('div');
  div.style.width = '850px';
  div.style.height = '1200px';
  div.style.background = '#fff';
  div.style.fontFamily = "'Plus Jakarta Sans', Arial, sans-serif";
  div.style.position = 'relative';
  div.style.boxSizing = 'border-box';

  // Nome do cliente NÃO aparece mais no conteúdo do PDF — só no nome do arquivo.
  const subLinha = info.data;

 const cardsHtml = produtosDaPagina.map(p => _gerarHtmlCardPdf(p, mapaImagens[p.id], incluirPreco)).join('');

 div.innerHTML = `
    <div style="background:#FF6B00;padding:16px 34px;position:relative;">
      <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0;letter-spacing:-0.5px;">CATÁLOGO DE PRODUTOS - ${info.fornecedor}</h1>
      <p style="color:#ffe8d6;font-size:11px;margin:6px 0 0;">${subLinha}</p>
      <span style="position:absolute;top:16px;right:34px;color:#ffe8d6;font-size:10px;">Página ${info.numPagina}/${info.totalPaginas}</span>
    </div>
    <div style="position:absolute;top:280px;left:50%;transform:translateX(-50%);width:480px;opacity:0.05;z-index:0;pointer-events:none;">
      <img src="${LOGO_HBN_PDF_BASE64}" style="width:100%;">
    </div>
    <div style="padding:20px 24px;display:grid;grid-template-columns:repeat(2, 1fr);gap:14px;position:relative;z-index:1;">
      ${cardsHtml}
    </div>`;
  return div;
}
// Modal para perguntar se o PDF deve sair com ou sem preços — criado via JS,
// não depende de HTML pré-existente na página. Retorna Promise<true|false|null>
// (null = cancelado)
function _perguntarComPrecoPdf() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'overlayPerguntaPrecoPdf';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:'Plus Jakarta Sans', Arial, sans-serif;">
        <h3 style="font-size:15px;font-weight:800;color:#1e293b;margin:0 0 6px;">Exportar catálogo em PDF</h3>
        <p style="font-size:12px;color:#64748b;margin:0 0 18px;">Deseja incluir os preços dos produtos no PDF?</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="btnPdfComPreco" style="background:#FF6B00;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border:none;border-radius:10px;cursor:pointer;">Com preço</button>
          <button id="btnPdfSemPreco" style="background:#f1f5f9;color:#334155;font-weight:700;font-size:13px;padding:10px 14px;border:none;border-radius:10px;cursor:pointer;">Sem preço</button>
          <button id="btnPdfCancelar" style="background:transparent;color:#94a3b8;font-weight:600;font-size:12px;padding:6px;border:none;cursor:pointer;">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const fechar = (resultado) => { overlay.remove(); resolve(resultado); };
    overlay.querySelector('#btnPdfComPreco').addEventListener('click', () => fechar(true));
    overlay.querySelector('#btnPdfSemPreco').addEventListener('click', () => fechar(false));
    overlay.querySelector('#btnPdfCancelar').addEventListener('click', () => fechar(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(null); });
  });
}
async function baixarCatalogoPdf() {
  if (_PDF_GERANDO) return;
  const lista = PRODUTOS_FILTRADOS.slice(); // respeita busca + fornecedor + filtro de estoque atuais
 if (lista.length === 0) { mostrarToast('warning', 'Nenhum produto para exportar com os filtros atuais.'); return; }

  const incluirPreco = await _perguntarComPrecoPdf();
  if (incluirPreco === null) return; // usuário cancelou

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
      }, incluirPreco);
      containerOffscreen.innerHTML = '';
      containerOffscreen.appendChild(divPagina);

      const canvas = await html2canvas(divPagina, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (pg > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89);
    }

    document.body.removeChild(containerOffscreen);

   const sufixoCliente = (CLIENTE_SELECIONADO && CLIENTE_SELECIONADO.razao)
      ? '_' + limparNomeArquivo(CLIENTE_SELECIONADO.razao.toUpperCase())
      : '';
    const nomeArquivo = `Catalogo_${limparNomeArquivo(nomeFornecedorTitulo)}${sufixoCliente}${incluirPreco ? '' : '_SemPreco'}_${dataHoje.replace(/\//g, '-')}.pdf`;
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
