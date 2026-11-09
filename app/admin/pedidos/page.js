import { query } from '@/lib/db';
import { brl, dateTimeBr } from '@/lib/format';
import { formatCnpj } from '@/lib/cnpj';
import { setOrderStatus } from '../actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['novo', 'confirmado', 'pago', 'enviado', 'entregue', 'cancelado'];

export default async function PedidosPage() {
  const orders = await query(
    `SELECT o.id, o.status, o.payment_method, o.total, o.notes, o.created_at,
            u.razao_social, u.cnpj, u.telefone, u.email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC
       LIMIT 100`
  );
  const items = orders.length
    ? await query(
        'SELECT order_id, name, price, qty FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id',
        [orders.map((o) => o.id)]
      )
    : [];

  return (
    <>
      <h1>Pedidos</h1>
      {orders.length === 0 ? (
        <p className="muted">Nenhum pedido ainda.</p>
      ) : (
        orders.map((o) => (
          <div className="card" key={o.id} style={{ marginBottom: 14 }}>
            <div className="inline-form" style={{ justifyContent: 'space-between' }}>
              <div>
                <b>Pedido #{o.id}</b> · {dateTimeBr(o.created_at)}
                <div className="muted">
                  {o.razao_social} · CNPJ {formatCnpj(o.cnpj)} · {o.email} · {o.telefone}
                </div>
              </div>
              <form action={setOrderStatus} className="inline-form">
                <input type="hidden" name="id" value={o.id} />
                <select name="status" defaultValue={o.status}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button className="btn small" type="submit">Atualizar</button>
              </form>
            </div>

            <table style={{ marginTop: 10 }}>
              <tbody>
                {items
                  .filter((i) => i.order_id === o.id)
                  .map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.name}</td>
                      <td>{i.qty} × {brl(i.price)}</td>
                      <td>{brl(Number(i.price) * i.qty)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p style={{ margin: '10px 0 0' }}>
              <b>Total: {brl(o.total)}</b> · Pagamento: <span style={{ textTransform: 'capitalize' }}>{o.payment_method}</span>
            </p>
            {o.notes && <p className="muted">Obs.: {o.notes}</p>}
          </div>
        ))
      )}
    </>
  );
}
