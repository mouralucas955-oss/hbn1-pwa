const API_URL = "https://script.google.com/macros/s/AKfycbzuDKL1ML4oQk1-qDVadToviO1nsEG47_KMhNco2ZL53n5_BvDKY2Udzj0qWnUxACNMEQ/exec";

async function chamarApi(action, params, _numeroTentativa) {
  _numeroTentativa = _numeroTentativa || 0;
  const corpo = Object.assign({ action: action }, params || {});
  if (action !== 'login' && action !== 'ping') {
    corpo._session = localStorage.getItem('hbn1_session');
  }
  const resposta = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(corpo)
  });
  if (!resposta.ok) {
    throw new Error("Falha na API (" + resposta.status + ")");
  }
  const dados = await resposta.json();

  // Sessão expirada em qualquer chamada → limpa e volta pro login
  if (dados && dados.sessaoExpirada) {
    // O CacheService do Apps Script não garante consistência instantânea
    // entre chamadas concorrentes. Nos primeiros segundos de uma sessão
    // nova (login normal ou abertura de oferta compartilhada), várias
    // chamadas em paralelo (mural, produtos, clientes, ST, valores
    // mínimos, heartbeat) podem chegar ao backend antes da sessão
    // recém-criada "propagar" no cache — um sessaoExpirada aqui costuma
    // ser falso positivo dessa corrida, não uma sessão de verdade
    // vencida. Por isso, se a sessão tem menos de 8s de vida, tenta de
    // novo com espera crescente (até 3 tentativas) antes de desistir.
    // Numa sessão realmente expirada (horas depois), isso nunca dispara.
    const loginTs = parseInt(localStorage.getItem('hbn1_login_ts') || '0', 10);
    const sessaoRecente = (Date.now() - loginTs) < 8000;
    const MAX_TENTATIVAS_RACE = 3;

    if (sessaoRecente && _numeroTentativa < MAX_TENTATIVAS_RACE) {
      const espera = 600 * (_numeroTentativa + 1); // 600ms, 1200ms, 1800ms
      await new Promise(r => setTimeout(r, espera));
      return chamarApi(action, params, _numeroTentativa + 1);
    }

    localStorage.removeItem('hbn1_session');
    localStorage.removeItem('hbn1_usuario');
    localStorage.removeItem('hbn1_uf');
    localStorage.removeItem('hbn1_login_ts');
    const tokenOferta = localStorage.getItem('hbn1_oferta_token');
    if (tokenOferta) {
      // Sessão de link compartilhado expirada em pleno uso — volta pro
      // mesmo link, que renova a sessão automaticamente (ver oferta-bootstrap).
      window.location.href = 'catalogo.html?oferta=' + encodeURIComponent(tokenOferta);
    } else {
      window.location.href = 'index.html';
    }
  }
  return dados;
}
