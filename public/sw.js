// As notificações push administrativas foram desativadas.
// Mantemos este arquivo para atualizar instalações antigas do service worker
// sem exibir avisos pendentes recebidos pelo navegador.
self.addEventListener('push', (event) => {
  event.waitUntil(Promise.resolve());
});
