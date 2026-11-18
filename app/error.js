'use client';

export default function Error({ reset }) {
  return (
    <main className="wrap" role="alert">
      <h2>Não foi possível carregar esta página.</h2>
      <p>Ocorreu um erro inesperado. Tente novamente.</p>
      <button type="button" className="btn" onClick={() => reset()}>
        Tentar novamente
      </button>
    </main>
  );
}
