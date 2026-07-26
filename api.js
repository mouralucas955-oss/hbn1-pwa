/*
 * HBN1 — cliente seguro da API.
 *
 * O navegador conversa somente com /api no mesmo domínio.
 * O gateway guarda o token real em cookie HttpOnly criptografado e injeta
 * a credencial do Apps Script. Nenhum segredo deve ser colocado neste arquivo.
 */
const API_URL = (
  window.HBN1_CONFIG &&
  typeof window.HBN1_CONFIG.apiUrl === 'string' &&
  window.HBN1_CONFIG.apiUrl.trim()
) || '/api';

const ACOES_SEM_SESSAO = new Set(['login', 'ping', 'abrirOferta']);
const CHAVES_CONTEXTO_SESSAO = [
  'hbn1_usuario', 'hbn1_uf', 'hbn1_ufs', 'hbn1_nome',
  'hbn1_tipo', 'hbn1_login_ts', 'hbn1_oferta_fornecedor',
  'hbn1_fornecedor_ativo'
];
const CHAVES_LEGADAS_SENSIVEIS = [
  'hbn1_session', 'hbn1_oferta_token', 'hbn1_pedidos_salvos',
  'hbn1_negociacao_handoff', 'hbn1_historico_registrado'
];
let redirecionamentoDeSessaoEmAndamento = false;

function salvarContextoSessao(dados) {
  if (!dados || !dados.sucesso) return;
  const agora = String(Date.now());
  const contexto = {
    hbn1_usuario: dados.usuario || '',
    hbn1_nome: dados.nome || dados.usuario || '',
    hbn1_uf: dados.uf || '',
    hbn1_ufs: JSON.stringify(dados.ufs || (dados.uf ? [dados.uf] : [])),
    hbn1_tipo: dados.tipo || '',
    hbn1_login_ts: agora
  };
  Object.keys(contexto).forEach(chave => {
    sessionStorage.setItem(chave, String(contexto[chave]));
  });
}

function lerDadoSessao(chave, padrao = '') {
  return sessionStorage.getItem(chave) ?? padrao;
}

function salvarDadoSessao(chave, valor) {
  if (!CHAVES_CONTEXTO_SESSAO.includes(chave)) {
    throw new Error('Chave de sessão não permitida.');
  }
  sessionStorage.setItem(chave, String(valor));
}

function removerDadoSessao(chave) {
  sessionStorage.removeItem(chave);
  localStorage.removeItem(chave);
}

function limparDadosDaSessao() {
  CHAVES_CONTEXTO_SESSAO.forEach(chave => sessionStorage.removeItem(chave));
  CHAVES_LEGADAS_SENSIVEIS.forEach(chave => {
    sessionStorage.removeItem(chave);
    localStorage.removeItem(chave);
  });
  localStorage.removeItem('hbn1_session');
}

function limparArmazenamentoLegado() {
  CHAVES_LEGADAS_SENSIVEIS.forEach(chave => localStorage.removeItem(chave));

  // Migra apenas contexto visual legado; o token real nunca é migrado.
  CHAVES_CONTEXTO_SESSAO.forEach(chave => {
    const legado = localStorage.getItem(chave);
    if (legado !== null && sessionStorage.getItem(chave) === null) {
      sessionStorage.setItem(chave, legado);
    }
    localStorage.removeItem(chave);
  });
}

function redirecionarPorSessaoExpirada() {
  if (redirecionamentoDeSessaoEmAndamento) return;
  redirecionamentoDeSessaoEmAndamento = true;
  limparDadosDaSessao();
  window.location.replace('index.html');
}

function obterTimeoutDaAcao(action) {
  return action === 'extrairPedidoPdfComIA' ? 120000 : 30000;
}

async function chamarApi(action, params = {}) {
  if (typeof action !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,79}$/.test(action)) {
    throw new Error('Ação inválida.');
  }

  const corpo = Object.assign({}, params, { action });
  delete corpo._session;
  delete corpo._gateway;

  const controlador = new AbortController();
  const timer = window.setTimeout(
    () => controlador.abort(),
    obterTimeoutDaAcao(action)
  );

  let resposta;
  try {
    resposta = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'HBN1'
      },
      body: JSON.stringify(corpo),
      signal: controlador.signal
    });
  } catch (erro) {
    if (erro && erro.name === 'AbortError') {
      throw new Error('A operação demorou mais que o esperado.');
    }
    throw new Error('Não foi possível conectar ao serviço.');
  } finally {
    window.clearTimeout(timer);
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (erro) {
    throw new Error('O serviço retornou uma resposta inválida.');
  }

  if (dados && dados.sessaoExpirada) {
    redirecionarPorSessaoExpirada();
    throw new Error('Sessão expirada. Redirecionando...');
  }

  if (!resposta.ok) {
    throw new Error((dados && dados.mensagem) || 'Não foi possível concluir a operação.');
  }

  if ((action === 'login' || action === 'abrirOferta') && dados && dados.sucesso) {
    salvarContextoSessao(dados);
    delete dados.sessionToken;
  }

  if (action === 'logout') {
    limparDadosDaSessao();
  }

  return dados;
}

limparArmazenamentoLegado();

