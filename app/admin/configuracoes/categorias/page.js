import Link from 'next/link';
import { query } from '@/lib/db';
import ConfirmButton from '@/components/ConfirmButton';
import {
  createCategory,
  renameCategory,
  toggleCategory,
  moveCategory,
  deleteCategory,
} from '../../actions';

export const dynamic = 'force-dynamic';

function Row({ cat, isChild }) {
  return (
    <div className="cat-item">
      <form action={renameCategory} className="inline-form">
        <input type="hidden" name="id" value={cat.id} />
        <input name="name" defaultValue={cat.name} aria-label="Nome da categoria" style={{ minWidth: 180 }} />
        <button className="btn small outline" type="submit">Renomear</button>
        {!cat.active && <span className="tag">Desativada</span>}
      </form>
      <div className="row-actions">
        <form action={moveCategory}>
          <input type="hidden" name="id" value={cat.id} />
          <input type="hidden" name="dir" value="up" />
          <button className="btn small outline" type="submit" aria-label="Mover para cima">↑</button>
        </form>
        <form action={moveCategory}>
          <input type="hidden" name="id" value={cat.id} />
          <input type="hidden" name="dir" value="down" />
          <button className="btn small outline" type="submit" aria-label="Mover para baixo">↓</button>
        </form>
        <form action={toggleCategory}>
          <input type="hidden" name="id" value={cat.id} />
          <button className="btn small secondary" type="submit">{cat.active ? 'Desativar' : 'Ativar'}</button>
        </form>
        <form action={deleteCategory}>
          <input type="hidden" name="id" value={cat.id} />
          <ConfirmButton
            message={
              isChild
                ? 'Apagar esta subcategoria? Os produtos dela não serão apagados, só ficarão sem categoria.'
                : 'Apagar esta categoria e todas as subcategorias dela? Os produtos não serão apagados, só ficarão sem categoria.'
            }
          >
            Apagar
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}

export default async function CategoriasPage() {
  const cats = await query('SELECT id, name, parent_id, active FROM categories ORDER BY position, name, id');
  const parents = cats.filter((c) => !c.parent_id);

  return (
    <>
      <p className="muted"><Link href="/admin/configuracoes">← Configurações</Link></p>
      <h1>Gerenciar categorias</h1>

      <form action={createCategory} className="card inline-form" style={{ marginBottom: 20 }}>
        <input name="name" placeholder="Nome da nova categoria ou subcategoria" required style={{ minWidth: 260 }} />
        <select name="parent_id" defaultValue="" aria-label="Categoria principal">
          <option value="">Categoria principal</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>Subcategoria de: {p.name}</option>
          ))}
        </select>
        <button className="btn" type="submit">Adicionar</button>
      </form>

      {parents.length === 0 ? (
        <p className="muted">Nenhuma categoria criada ainda.</p>
      ) : (
        <div className="cat-admin">
          <ul>
            {parents.map((parent) => (
              <li key={parent.id}>
                <Row cat={parent} isChild={false} />
                <ul>
                  {cats
                    .filter((c) => c.parent_id === parent.id)
                    .map((sub) => (
                      <li key={sub.id}>
                        <Row cat={sub} isChild />
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
