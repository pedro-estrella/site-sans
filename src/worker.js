// Worker do site da Sans: serve os arquivos estáticos e recebe as inscrições da newsletter.
// Inscrições ficam no D1 "sans-newsletter", tabela "inscricoes".
const CONSENT = 'Aceito receber a newsletter diária da Sans por e-mail e sei que posso cancelar a qualquer momento.';

function page(title, msg, ok) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Sans</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&family=Manrope:wght@400;600&display=swap">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F3EDE2;color:#1B2A41;font-family:Manrope,Arial,sans-serif;padding:24px}main{max-width:520px}h1{font-family:Fraunces,Georgia,serif;font-weight:400;font-size:36px;margin:0 0 12px}h1 span{color:#7A5638}p{font-size:17px;line-height:1.6;color:#3D4A5C}a{color:#7A5638;font-weight:600}</style></head>
<body><main><h1>${title}<span>.</span></h1><p>${msg}</p><p><a href="/newsletter/">Voltar para a newsletter</a></p></main></body></html>`,
    { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function inscrever(request, env) {
  const form = await request.formData();
  if ((form.get('site') || '').toString().trim() !== '') return page('Inscrição recebida', 'Obrigado.', true); // armadilha para robôs
  const email = (form.get('email') || '').toString().trim().toLowerCase();
  const nome = (form.get('nome') || '').toString().trim().slice(0, 120);
  const aceite = form.get('consentimento') === 'sim';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return page('Confira o e-mail', 'O endereço informado parece incompleto. Volte e digite de novo.', false);
  }
  if (!aceite) return page('Falta o consentimento', 'Para receber a newsletter, marque a caixa de consentimento.', false);
  const agora = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO inscricoes (email, nome, consentimento_texto, consentimento_em, origem, ativo, cancelado_em)
     VALUES (?1, ?2, ?3, ?4, 'site', 1, NULL)
     ON CONFLICT(email) DO UPDATE SET ativo = 1, cancelado_em = NULL, consentimento_texto = ?3, consentimento_em = ?4, nome = COALESCE(NULLIF(?2, ''), nome)`
  ).bind(email, nome, CONSENT, agora).run();
  return page('Inscrição confirmada', 'Pronto. Você vai receber a newsletter diária da Sans neste e-mail. Para cancelar, escreva para contato@sansfinancas.com.br.', true);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/newsletter/inscricao') {
      if (request.method !== 'POST') return new Response('Método não permitido', { status: 405, headers: { allow: 'POST' } });
      try { return await inscrever(request, env); }
      catch (e) { return page('Não deu certo', 'Tivemos um problema ao registrar sua inscrição. Tente de novo em alguns minutos.', false); }
    }
    return env.ASSETS.fetch(request);
  }
};
