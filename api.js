const API_URL = "https://script.google.com/macros/s/AKfycbzuDKL1ML4oQk1-qDVadToviO1nsEG47_KMhNco2ZL53n5_BvDKY2Udzj0qWnUxACNMEQ/exec";

async function chamarApi(action, params) {
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
    localStorage.removeItem('hbn1_session');
    localStorage.removeItem('hbn1_usuario');
    localStorage.removeItem('hbn1_uf');
    localStorage.removeItem('hbn1_login_ts');
    window.location.href = 'index.html';
  }

  return dados;
}
