const API_URL = 'https://script.google.com/macros/s/AKfycbzuDKL1ML4oQk1-qDVadToviO1nsEG47_KMhNco2ZL53n5_BvDKY2Udzj0qWnUxACNMEQ/exec';

const ACOES_SEM_SESSAO = new Set(['login', 'ping', 'abrirOferta']);
const JANELA_SESSAO_RECENTE_MS = 15000;
const MAX_TENTATIVAS_SESSAO_RECENTE = 4;
let redirecionamentoDeSessaoEmAndamento = false;

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function limparDadosDaSessao(preservarTokenOferta = false) {
  [
    'hbn1_session', 'hbn1_usuario', 'hbn1_uf', 'hbn1_ufs',
    'hbn1_nome', 'hbn1_tipo', 'hbn1_login_ts'
  ].forEach(chave => localStorage.removeItem(chave));

  if (!preservarTokenOferta) {
    localStorage.removeItem('hbn1_oferta_token');
  }
}

function redirecionarPorSessaoExpirada() {
  if (redirecionamentoDeSessaoEmAndamento) return;
  redirecionamentoDeSessaoEmAndamento = true;

  // Capture antes de limpar: a oferta ainda pode estar válida e será reaberta.
  const tokenOferta = localStorage.getItem('hbn1_oferta_token');
  limparDadosDaSessao(true);

  if (tokenOferta) {
    window.location.replace('catalogo.html?oferta=' + encodeURIComponent(tokenOferta));
  } else {
    window.location.replace('index.html');
  }
}

async function chamarApi(action, params = {}, tentativa = 0) {
  const corpo = Object.assign({ action }, params);
  if (!ACOES_SEM_SESSAO.has(action)) {
    corpo._session = localStorage.getItem('hbn1_session');
  }

  const resposta = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(corpo)
  });

  if (!resposta.ok) {
    throw new Error('Falha na API (' + resposta.status + ')');
  }

  const dados = await resposta.json();

  if (dados && dados.sessaoExpirada) {
    const criadaEm = Number(localStorage.getItem('hbn1_login_ts') || 0);
    const sessaoRecente = criadaEm > 0 &&
      (Date.now() - criadaEm) < JANELA_SESSAO_RECENTE_MS;

    if (sessaoRecente && tentativa < MAX_TENTATIVAS_SESSAO_RECENTE) {
      // 250, 500, 1000 e 2000 ms: só protege a abertura de sessão.
      await esperar(250 * Math.pow(2, tentativa));
      return chamarApi(action, params, tentativa + 1);
    }

    redirecionarPorSessaoExpirada();
    throw new Error('Sessão expirada. Redirecionando...');
  }

  return dados;
}
