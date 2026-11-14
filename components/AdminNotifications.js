'use client';

import { useEffect, useRef, useState } from 'react';

const messages = {
  checkout_pending: { title: 'Aguardando finalização da compra', label: 'Cliente iniciou a finalização do pagamento.' },
  purchase_paid: { title: 'Compra finalizada', label: 'Pagamento confirmado pelo Asaas.' },
};

function decodeKey(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function AdminNotifications() {
  const [permission, setPermission] = useState('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState(null);
  const lastId = useRef(null);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    let active = true;
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.getRegistration('/').then(async (registration) => {
        const subscription = await registration?.pushManager.getSubscription();
        if (active && subscription) setPushEnabled(true);
      }).catch(() => {});
    }
    const poll = async () => {
      try {
        const suffix = lastId.current === null ? '?initial=1' : `?after=${lastId.current}`;
        const response = await fetch(`/api/admin/notificacoes${suffix}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        if (lastId.current === null) {
          lastId.current = Number(data.latestId || 0);
          const recent = data.notifications || [];
          if (recent.length) {
            setUnread(recent.length);
            setLatest(recent[recent.length - 1]);
          }
          return;
        }
        const events = data.notifications || [];
        if (events.length) {
          lastId.current = Math.max(lastId.current, ...events.map((event) => Number(event.id)));
          setUnread((count) => count + events.length);
          setLatest(events[events.length - 1]);
        }
      } catch {}
    };
    poll();
    const timer = window.setInterval(poll, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function enableNotifications() {
    setPushBusy(true);
    setPushMessage('');
    try {
      const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (isAppleMobile && !isInstalled) {
        setPushMessage('No iPhone: toque em Compartilhar no Safari e escolha “Adicionar à Tela de Início”. Depois abra o ícone Brussels Pet e toque neste botão novamente.');
        return;
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPushMessage('Este navegador não oferece suporte a notificações push. Abra a Brussels Pet no Safari (iPhone) ou Chrome (Android).');
        return;
      }
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        setPushMessage('A permissão foi negada. Ative as notificações da Brussels Pet nos Ajustes do navegador/celular.');
        return;
      }
      const keyResponse = await fetch('/api/admin/push', { cache: 'no-store' });
      const keyData = await keyResponse.json();
      if (!keyResponse.ok || !keyData.publicKey) throw new Error(keyData.error || 'Não foi possível configurar as notificações.');
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(keyData.publicKey),
        });
      }
      const saved = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      const savedData = await saved.json();
      if (!saved.ok) throw new Error(savedData.error || 'Não foi possível salvar este celular.');
      setPushEnabled(true);
      setPushMessage('Notificações ativadas neste celular. Você receberá avisos mesmo fora da Brussels Pet.');
    } catch (error) {
      setPushMessage(error.message || 'Não foi possível ativar as notificações neste aparelho.');
    } finally {
      setPushBusy(false);
    }
  }

  const message = latest ? messages[latest.event_type] : null;
  return (
    <div className="admin-order-notifications" aria-live="polite">
      <button type="button" className="link-btn" onClick={() => { setUnread(0); setLatest(null); }}>
        🔔 Avisos{unread > 0 ? ` (${unread})` : ''}
      </button>
      <button type="button" className="link-btn" onClick={enableNotifications} disabled={pushBusy}>
        {pushBusy ? 'Ativando...' : pushEnabled ? '✓ Notificações ativadas' : 'Ativar notificações no celular'}
      </button>
      {pushMessage && <span role="status" style={{ display: 'block', maxWidth: 340, fontSize: 12, marginTop: 6 }}>{pushMessage}</span>}
      {latest && message && (
        <div className="admin-order-toast">
          <strong>{message.title} · Pedido #{latest.order_id}</strong>
          <span>{message.label} · R$ {Number(latest.total).toFixed(2).replace('.', ',')}</span>
          {latest.items?.length > 0 && <div className="admin-toast-items">{latest.items.map((item, index) => <div key={index}>{item.name} — {item.color_name ? item.color_name + ' (SKU ' + (item.color_sku || '—') + ')' : 'Sem variação'} — {item.qty} un.</div>)}</div>}
          <a href="/admin/pedidos">Ver pedidos</a>
          <button type="button" aria-label="Fechar aviso" onClick={() => setLatest(null)}>×</button>
        </div>
      )}
    </div>
  );
}
