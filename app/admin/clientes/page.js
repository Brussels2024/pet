import { query } from '@/lib/db';
import { formatCnpj } from '@/lib/cnpj';
import { dateBr } from '@/lib/format';
import { setUserStatus } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const users = await query(
    `SELECT id, email, status, razao_social, nome_fantasia, cnpj, telefone, cidade, uf, situacao_cnpj, created_at
       FROM users WHERE role = 'cliente'
       ORDER BY (status = 'pendente') DESC, id DESC`
  );

  return (
    <>
      <h1>Clientes</h1>
      {users.length === 0 ? (
        <p className="muted">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Contato</th>
                <th>Cidade</th>
                <th>Cadastro</th>
                <th>Conta</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.razao_social}</b>
                    {u.nome_fantasia && <div className="muted">{u.nome_fantasia}</div>}
                  </td>
                  <td>
                    {formatCnpj(u.cnpj)}
                    <div className="muted">{u.situacao_cnpj}</div>
                  </td>
                  <td>
                    {u.email}
                    <div className="muted">{u.telefone}</div>
                  </td>
                  <td>{[u.cidade, u.uf].filter(Boolean).join(' / ')}</td>
                  <td>{dateBr(u.created_at)}</td>
                  <td><span className={`tag ${u.status}`}>{u.status}</span></td>
                  <td>
                    <div className="row-actions">
                      {u.status !== 'ativo' && (
                        <form action={setUserStatus}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="status" value="ativo" />
                          <button className="btn small" type="submit">Ativar</button>
                        </form>
                      )}
                      {u.status !== 'bloqueado' && (
                        <form action={setUserStatus}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="status" value="bloqueado" />
                          <button className="btn small danger" type="submit">Bloquear</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
