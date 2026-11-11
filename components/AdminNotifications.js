'use client';

import { useEffect, useRef, useState } from 'react';

export default function AdminNotifications() {
  const [permission, setPermission] = useState('default');
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState(null);
  const lastId = useRef(null);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    let active = true;
    const poll = async (initial = false) => {
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
        if (data.orders?.length) {
          lastId.current = Math.max(lastId.current, ...data.orders.map((o) => Number(o.id)));
          setUnread((n) => n + data.orders.length);
          const order = data.orders[0];
          setLatest(order);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Novo pedido na Brussels Pet', {
              body: `Pedido #${order.id} recebido · R$ ${Number(order.total).toFixed(2).replace('.', ',')}`,
              tag: `brussels-order-${order.id}`,
            });
          }
        } else if (data.latestId) {
          lastId.current = Math.max(lastId.current || 0, Number(data.latestId));
        }
      } catch {}
    };
    poll(true);
    const timer = window.setInterval(() => poll(false), 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <div className="admin-order-notifications" aria-live="polite">
      <button type="button" className="link-btn" onClick={() => { setUnread(0); setLatest(null); }}>
        🔔 Avisos{unread > 0 ? ` (${unread})` : ''}
      </button>
      {permission !== 'granted' && (
        <button type="button" className="link-btn" onClick={enableNotifications}>Ativar notificações</button>
      )}
      {latest && (
        <div className="admin-order-toast">
          <strong>Novo pedido #{latest.id}</strong>
          <span>Compra recebida · R$ {Number(latest.total).toFixed(2).replace('.', ',')}</span>
          <a href="/admin/pedidos">Ver pedidos</a>
          <button type="button" aria-label="Fechar aviso" onClick={() => setLatest(null)}>×</button>
        </div>
      )}
    </div>
  );
}
