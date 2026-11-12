import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { brl, dateTimeBr } from '@/lib/format';
import { formatCnpj } from '@/lib/cnpj';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  ativo: 'Ativa',
  pendente: 'Em análise',
  bloqueado: 'Bloqueada',
};

export default async function ContaPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/entrar?next=/conta');

  const sp = await searchParams;
  const novoPedido = sp?.pedido ? Number(sp.pedido) : null;

  const orders = await query(
    'SELECT id, status, payment_method, total, shipping_address, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 50',
    [user.id]
  );

  const orderItems = orders.length ? await query('SELECT order_id, name, qty, color_name, color_sku FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id', [orders.map(o => o.id)]) : [];

  return (
    <div className="wrap page">
      <h1>Minha conta</h1>

      {novoPedido && (
        <div className="msg ok">
          Pedido #{novoPedido} enviado! Entraremos em contato para combinar o pagamento e o frete.
        </div>
      )}

      <div className="card">
        <p style={{ margin: 0 }}>
          <b>{user.razao_social || user.email}</b>
          {user.cnpj && <> · CNPJ {formatCnpj(user.cnpj)}</>}
        </p>
        <p style={{ margin: '6px 0 0' }}>
          Conta: <span className={`tag ${user.status}`}>{STATUS_LABEL[user.status] || user.status}</span>
        </p>
        {user.status === 'pendente' && (
          <p className="muted">Estamos analisando seu cadastro. Assim que for aprovado, os preços serão liberados.</p>
        )}
      </div>

      <h2>Meus pedidos</h2>
      {orders.length === 0 ? (
        <p className="muted">Você ainda não fez pedidos.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}<div className="muted">{orderItems.filter(i => i.order_id === o.id).map((i, index) => <div key={index}>{i.name}{i.color_name ? ' — '+i.color_name+' (SKU '+(i.color_sku||'—')+')' : ''} · {i.qty} un.</div>)}</div></td>
                  <td>{dateTimeBr(o.created_at)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{o.payment_method}</td>
                  <td>{brl(o.total)}</td>
                  <td>{o.status}{o.shipping_address && <details style={{marginTop:6}}><summary>Endereço de entrega</summary><small>{o.shipping_address.logradouro}, nº {o.shipping_address.numero}{o.shipping_address.complemento ? ' - '+o.shipping_address.complemento : ''}<br/>{o.shipping_address.bairro} · {o.shipping_address.cidade}/{o.shipping_address.uf}<br/>CEP: {o.shipping_address.cep}<br/>Telefone: {o.shipping_address.telefone || user.telefone || 'Não informado'}</small></details>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
