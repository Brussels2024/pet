'use client';

import { useEffect, useRef, useState } from 'react';

const messages = {
  checkout_pending: { title: 'Aguardando finalização da compra', label: 'Cliente foi encaminhado ao pagamento do Asaas.' },
  purchase_paid: { title: 'Compra finalizada', label: 'Pagamento confirmado pelo Asaas.' },
};

export default function AdminNotifications() {
  const [permission, setPermission] = useState('default');
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState(null);
  const lastId = useRef(null);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    let active = true;
    const poll = async () => {
      try {
        const suffix = lastId.current === null ? '?initial=1' : `?after=${lastId.current}`;
        const response = await fetch(`/api/admin/notificacoes${suffix}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        if (lastId.current === null) {
          lastId.current = Number(data.latestId || 0);
          return;
        }
        const events = data.notifications || [];
        if (events.length) {
          lastId.current = Math.max(lastId.current, ...events.map((event) => Number(event.id)));
          setUnread((count) => count + events.length);
          const event = events[events.length - 1];
          setLatest(event);
          const message = messages[event.event_type] || messages.checkout_pending;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(message.title, {
              body: `Pedido #${event.order_id} · ${message.label}`,
              tag: `brussels-order-${event.order_id}-${event.event_type}`,
            });
          }
        }
      } catch {}
    };
    poll();
    const timer = window.setInterval(poll, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  const message = latest ? messages[latest.event_type] : null;
  return (
    <div className="admin-order-notifications" aria-live="polite">
      <button type="button" className="link-btn" onClick={() => { setUnread(0); setLatest(null); }}>
        🔔 Avisos{unread > 0 ? ` (${unread})` : ''}
      </button>
      {permission !== 'granted' && (
        <button type="button" className="link-btn" onClick={enableNotifications}>Ativar notificações</button>
      )}
      {latest && message && (
        <div className="admin-order-toast">
          <strong>{message.title} · Pedido #{latest.order_id}</strong>
          <span>{message.label} · R$ {Number(latest.total).toFixed(2).replace('.', ',')}</span>
          <a href="/admin/pedidos">Ver pedidos</a>
          <button type="button" aria-label="Fechar aviso" onClick={() => setLatest(null)}>×</button>
        </div>
      )}
    </div>
  );
}
