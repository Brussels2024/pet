import { getSetting } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import CartClient from '@/components/CartClient';

export const dynamic = 'force-dynamic';

export default async function CarrinhoPage() {
  const user = await getUser();
  const minOrder = Number(await getSetting('min_order', '0')) || 0;

  let status = 'guest';
  if (user) {
    if (canSeePrices(user)) status = 'ok';
    else if (user.status === 'bloqueado') status = 'bloqueado';
    else status = 'pendente';
  }

  return (
    <div className="wrap page">
      <h1>Carrinho</h1>
      <CartClient minOrder={minOrder} status={status} />
    </div>
  );
}
