import webpush from 'web-push';
import { query } from '@/lib/db';

function configure() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT || 'mailto:contato.brussels@gmail.com', publicKey, privateKey);
  return true;
}

export async function sendAdminPush(event) {
  try {
    if (!configure()) return;
    const rows = await query('SELECT endpoint, subscription FROM admin_push_subscriptions');
    const messages = {
      checkout_pending: {
        title: 'Aguardando finalização da compra',
        body: `Pedido #${event.orderId}: ${(event.items || []).map(i => [i.name, i.color_name ? i.color_name + ' (SKU ' + (i.color_sku || '—') + ')' : '', i.qty + ' un.'].filter(Boolean).join(' — ')).join('; ')}. Aguardando pagamento.`,
      },
      purchase_paid: {
        title: 'Compra finalizada',
        body: `Pedido #${event.orderId}: ${(event.items || []).map(i => [i.name, i.color_name ? i.color_name + ' (SKU ' + (i.color_sku || '—') + ')' : '', i.qty + ' un.'].filter(Boolean).join(' — ')).join('; ')}. Pagamento confirmado.`,
      },
    };
    const message = messages[event.type];
    if (!message || !rows.length) return;
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: '/admin/pedidos',
      tag: `brussels-pet-${event.orderId}-${event.type}`,
    });
    await Promise.all(rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload, { TTL: 60 * 60 * 24 });
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await query('DELETE FROM admin_push_subscriptions WHERE endpoint = $1', [row.endpoint]).catch(() => {});
        } else {
          console.error('Falha ao enviar push da Brussels Pet:', error.statusCode || error.message);
        }
      }
    }));
  } catch (error) {
    console.error('Erro ao disparar push administrativo:', error.message);
  }
}
