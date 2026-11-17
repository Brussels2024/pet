import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureEmailRecoverySchema } from '@/lib/account-recovery';
import { formatCnpj } from '@/lib/cnpj';
import { dateBr } from '@/lib/format';
import { approveEmailRecovery, rejectEmailRecovery } from '../actions';

export const dynamic = 'force-dynamic';

export default async function RecuperacoesPage({ searchParams }) {
  await ensureEmailRecoverySchema();
  const params = await searchParams;
  const requests = await query(
    "SELECT r.id, r.requested_email, r.created_at, " +
    "u.email AS current_email, u.razao_social, u.nome_fantasia, u.cnpj, u.telefone " +
    "FROM email_recovery_requests r " +
    "JOIN users u ON u.id = r.user_id " +
    "WHERE r.status = 'pendente' ORDER BY r.created_at ASC"
  );

  return (
    <>
      <p className="muted"><Link href="/admin">← Painel</Link></p>
      <h1>Recuperações de acesso</h1>
      <p className="muted">Revise os dados da empresa antes de aprovar a alteração. A aprovação atualiza o e-mail e a senha da conta; a senha é armazenada apenas como hash.</p>

      {params?.erro && (
        <div className="msg warn" role="alert">
          Não foi possível aprovar. A solicitação pode não existir mais ou o novo e-mail já pode estar vinculado a outra conta.
        </div>
      )}
      {params?.sucesso && <div className="msg warn" role="status">Solicitação aprovada. O cliente já pode entrar com os novos dados.</div>}

      {requests.length === 0 ? (
        <div className="card"><p className="muted">Não há solicitações aguardando análise.</p></div>
      ) : (
        <div className="grid-cards">
          {requests.map((item) => (
            <section className="card" key={item.id}>
              <h2>Solicitação #{item.id}</h2>
              <p><b>Empresa:</b> {item.razao_social || item.nome_fantasia || 'Não informado'}</p>
              {item.nome_fantasia && item.razao_social && <p><b>Nome fantasia:</b> {item.nome_fantasia}</p>}
              <p><b>CNPJ:</b> {formatCnpj(item.cnpj)}</p>
              <p><b>Telefone cadastrado:</b> {item.telefone || 'Não informado'}</p>
              <p><b>E-mail atual:</b> {item.current_email}</p>
              <p><b>Novo e-mail solicitado:</b> {item.requested_email}</p>
              <p><b>Solicitado em:</b> {dateBr(item.created_at)}</p>
              <div className="row-actions">
                <form action={approveEmailRecovery}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn" type="submit">Aprovar e atualizar conta</button>
                </form>
                <form action={rejectEmailRecovery}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn danger" type="submit">Recusar solicitação</button>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
