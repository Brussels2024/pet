'use client';

export default function LogoutButton() {
  function clearCartBeforeLogout() {
    try {
      localStorage.removeItem('bp_cart');
      sessionStorage.removeItem('bp_checkout_notes');
      window.dispatchEvent(new Event('cart-changed'));
    } catch {
      // A saída da conta continua mesmo se o armazenamento do navegador estiver indisponível.
    }
  }

  return (
    <form action="/api/logout" method="post" onSubmit={clearCartBeforeLogout}>
      <button type="submit" className="link-btn">Sair</button>
    </form>
  );
}
