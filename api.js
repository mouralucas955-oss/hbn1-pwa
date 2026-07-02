const API_URL = "https://script.google.com/macros/s/AKfycbzuDKL1ML4oQk1-qDVadToviO1nsEG47_KMhNco2ZL53n5_BvDKY2Udzj0qWnUxACNMEQ/exec";

// Precisa ser IDÊNTICO ao valor salvo em:
// Apps Script → Configurações do projeto (⚙️) → Propriedades do script → TOKEN_SECRETO
const TOKEN_SECRETO = "00405408647815279629 47396929449716966710 28071328409341326921 89094013339108198932 36315707431664398265 68265321431884220364 37717140943478753042 15154780607664268267 01483285493975248845 02240633660543587755 78189157994410229839 58021214207759830861 33563582288548822904 31574150986765250159 09907252429572476808 26286624486485568136 41449879080649131551 45115667492920436944 80865158960157672860 07208365393900157650"; // <-- troque pelo valor real que você configurou

async function chamarApi(action, params) {
  const corpo = Object.assign({ action: action, _token: TOKEN_SECRETO }, params || {});
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
