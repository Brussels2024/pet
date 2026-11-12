import Link from 'next/link';
import { query } from '@/lib/db';
import { brl } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const [clientes] = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes FROM users WHERE role = 'cliente'`);
  const [produtos] = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE stock <= 0)::int AS sem_estoque FROM products`);
  const [pedidos] = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'novo')::int AS novos, COALESCE(SUM(total) FILTER (WHERE status <> 'cancelado'), 0) AS faturamento FROM orders`);
  const [banners] = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active = true)::int AS ativos FROM banners`);
  return <>
    <h1>Painel</h1>
    <div className="stats">
      <div className="stat"><b>{clientes.total}</b>Clientes ({clientes.pendentes} pendentes)</div>
      <div className="stat"><b>{produtos.total}</b>Produtos ({produtos.sem_estoque} sem estoque)</div>
      <div className="stat"><b>{pedidos.total}</b>Pedidos ({pedidos.novos} novos)</div>
      <div className="stat"><b>{brl(pedidos.faturamento)}</b>Total em pedidos</div>
      <div className="stat"><b>{banners.ativos}/3</b>Banners ativos</div>
    </div>
    <div className="row-actions">
      <Link className="btn" href="/admin/produtos/novo">Cadastrar produto</Link>
      <Link className="btn secondary" href="/admin/clientes">Ver clientes</Link>
      <Link className="btn secondary" href="/admin/pedidos">Ver pedidos</Link>
      <Link className="btn secondary" href="/admin/configuracoes/categorias">Gerenciar categorias</Link>
      <Link className="btn secondary" href="/admin/banners">Gerenciar banners</Link>
      <Link className="btn secondary" href="/admin/recuperacoes">Recuperações de acesso</Link>
    </div>
  </>;
}
