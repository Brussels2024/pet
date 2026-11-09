export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatCnpj(value) {
  const c = onlyDigits(value);
  if (c.length !== 14) return value || '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

// Valida os dígitos verificadores do CNPJ.
export function isValidCnpj(value) {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digit = (base) => {
    let sum = 0;
    let pos = base.length - 7;
    for (let i = base.length; i >= 1; i--) {
      sum += Number(base[base.length - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digit(c.slice(0, 12));
  if (d1 !== Number(c[12])) return false;
  const d2 = digit(c.slice(0, 13));
  return d2 === Number(c[13]);
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'brussels-pet', Accept: 'application/json' },
    });
    let body = null;
    if (res.ok) body = await res.json();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function fromBrasilApi(b) {
  return {
    razao_social: b.razao_social || '',
    nome_fantasia: b.nome_fantasia || '',
    situacao: String(b.descricao_situacao_cadastral || '').toUpperCase(),
    cep: onlyDigits(b.cep),
    logradouro: b.logradouro || '',
    numero: b.numero || '',
    complemento: b.complemento || '',
    bairro: b.bairro || '',
    cidade: b.municipio || '',
    uf: b.uf || '',
    telefone: b.ddd_telefone_1 || '',
  };
}

function fromCnpjWs(b) {
  const e = b.estabelecimento || {};
  return {
    razao_social: b.razao_social || '',
    nome_fantasia: e.nome_fantasia || '',
    situacao: String(e.situacao_cadastral || '').toUpperCase(),
    cep: onlyDigits(e.cep),
    logradouro: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' '),
    numero: e.numero || '',
    complemento: e.complemento || '',
    bairro: e.bairro || '',
    cidade: e.cidade?.nome || '',
    uf: e.estado?.sigla || '',
    telefone: e.ddd1 && e.telefone1 ? `${e.ddd1}${e.telefone1}` : '',
  };
}

/**
 * Consulta o CNPJ em duas fontes, com nova tentativa.
 * Retorna:
 *  - { ok: true, data }                       empresa encontrada
 *  - { ok: false, error: 'nao_encontrado' }   a fonte respondeu 404 (CNPJ não existe)
 *  - { ok: false, error: 'indisponivel' }     erro 5xx, limite ou timeout (NÃO significa que a empresa não existe)
 */
export async function lookupCnpj(value) {
  const cnpj = onlyDigits(value);
  const sources = [
    { url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, parse: fromBrasilApi },
    { url: `https://publica.cnpj.ws/cnpj/${cnpj}`, parse: fromCnpjWs },
  ];
  let notFound = false;

  for (const source of sources) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchJson(source.url);
        if (res.status === 200 && res.body) {
          return { ok: true, data: source.parse(res.body) };
        }
        if (res.status === 404) {
          notFound = true;
          break;
        }
      } catch {
        // tenta de novo / próxima fonte
      }
    }
  }
  return { ok: false, error: notFound ? 'nao_encontrado' : 'indisponivel' };
}
