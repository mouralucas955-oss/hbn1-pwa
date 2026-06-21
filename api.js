// ==========================================================================
// CONFIGURAÇÃO DA API — HBN1 PWA
// Troque a URL abaixo pela URL do seu Web App do Apps Script
// (Implantar > Nova implantação > Aplicativo da Web > Executar como: Eu
//  > Quem pode acessar: Qualquer pessoa).
// A URL termina em /exec
// ==========================================================================
const API_URL = "COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT/exec";

// --------------------------------------------------------------------------
// chamarApi(action, params)
// Substitui google.script.run.<funcao>(args) por uma chamada fetch().
// Usamos POST com texto puro (não 'application/json') de propósito:
// isso faz o navegador tratar a requisição como "simples" e evita o
// preflight CORS (OPTIONS), que o Apps Script não responde corretamente.
// --------------------------------------------------------------------------
async function chamarApi(action, params) {
  const corpo = Object.assign({ action: action }, params || {});
  const resposta = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(corpo)
  });
  if (!resposta.ok) {
    throw new Error("Falha na API (" + resposta.status + ")");
  }
  return resposta.json();
}
