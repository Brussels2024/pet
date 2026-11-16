'use client';

import { useState } from 'react';
import { deleteAllProducts } from '../actions';

export default function DeleteAllProductsButton() {
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <form action={deleteAllProducts} className="inline-form">
        <input type="hidden" name="confirmation" value="EXCLUIR" />
        <button className="btn" type="submit" style={{ background: '#b42318', borderColor: '#b42318' }}>
          Confirmar exclusão de todos os produtos
        </button>
        <button className="btn outline" type="button" onClick={() => setConfirmed(false)}>
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <button
      className="btn outline"
      type="button"
      style={{ color: '#b42318', borderColor: '#b42318' }}
      onClick={() => {
        const answer = window.prompt(
          'ATENÇÃO: isso apagará TODOS os produtos, fotos, SKUs, variações e estoques. Pedidos e clientes serão preservados. Para continuar, digite EXCLUIR.'
        );
        if (answer === 'EXCLUIR') setConfirmed(true);
      }}
    >
      Excluir todos os produtos
    </button>
  );
}
