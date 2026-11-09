export function brl(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dateBr(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function dateTimeBr(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
