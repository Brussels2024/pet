import { NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';
import { enforceRequestLimit } from '@/lib/security';
import { sendAdminPush } from '@/lib/admin-push';
export const dynamic = 'force-dynamic';
function fail(message,status=400) { return NextResponse.json({error:message},{status}); }
function asaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.ASAAS_API_URL || (process.env.ASAAS_ENV==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3');
  return {apiKey,baseUrl};
}
async function asaasRequest(config,path,payload) {
  const response = await fetch(config.baseUrl+path,{method:payload?'POST':'GET',
    headers:{'Content-Type':'application/json',access_token:config.apiKey,'User-Agent':'BrusselsPet/1.0'},
    ...(payload?{body:JSON.stringify(payload)}:{}),cache:'no-store'});
  const result = await response.json().catch(()=>({}));
  if (!response.ok) { console.error('Asaas API error:',response.status,result); throw new Error('Não foi possível consultar ou gerar a cobrança no Asaas.'); }
  return result;
}
async function findPayment(config,orderId) {
  const reference='brussels-pet-order-'+orderId;
  const result=await asaasRequest(config,'/payments?externalReference='+encodeURIComponent(reference));
  return result.data?.find((payment)=>payment.externalReference===reference)||null;
}
async function checkoutResponse(orderId,payment) {
  const invoiceUrl=payment.invoiceUrl||payment.bankSlipUrl;
  if (!payment.id||!invoiceUrl) return null;
  await query('UPDATE orders SET asaas_payment_id=$1, asaas_invoice_url=$2, payment_status=$3 WHERE id=$4',[payment.id,invoiceUrl,payment.status||'PENDING',orderId]);
  return NextResponse.json({ok:true,orderId,invoiceUrl});
}
export async function POST(request) {
  const user=await getUser();
  if (!user) return fail('Entre na sua conta para finalizar o pedido.',401);
  if (!canSeePrices(user)) return fail('Sua conta ainda não foi aprovada para compras.',403);
  if (!(await enforceRequestLimit(request,'orders',10,10*60,String(user.id)))) return fail('Muitos pedidos em pouco tempo. Aguarde e tente novamente.',429);
  const config=asaasConfig();
  if (!config) return fail('O pagamento ainda não está configurado. Tente novamente mais tarde.',503);
  let body;
  try { if (Number(request.headers.get('content-length')||0)>30000) return fail('Dados inválidos.',413); body=await request.json(); }
  catch { return fail('Dados inválidos.'); }
  const checkoutKey=String(body?.checkoutKey||'');
  if (!/^[0-9a-f-]{36}$/i.test(checkoutKey)) return fail('Identificador do checkout inválido.');
  const existing=await query('SELECT id,asaas_invoice_url FROM orders WHERE checkout_key=$1 AND user_id=$2 LIMIT 1',[checkoutKey,user.id]);
  if (existing.length) {
    const order=existing[0];
    if (order.asaas_invoice_url) return NextResponse.json({ok:true,orderId:order.id,invoiceUrl:order.asaas_invoice_url});
    try { const payment=await findPayment(config,order.id); if(payment){const recovered=await checkoutResponse(order.id,payment);if(recovered)return recovered;} }
    catch(error){console.error('Falha ao recuperar cobrança existente:',error);}
    return fail('Este pedido já foi iniciado e está em conferência do pagamento. Não refaça o pedido; entre em contato com a Brussels Pet informando o pedido #'+order.id+'.',409);
  }
  const wanted=Array.isArray(body.items)?body.items:[];
  if (!wanted.length||wanted.length>50) return fail('O carrinho está vazio ou excede o limite de itens.');
  const requestedLines=[],qtyById=new Map();
  for (const item of wanted) {
    const id=Number(item.id),qty=Math.floor(Number(item.qty)),color=String(item.color||'').trim().slice(0,60);
    if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(qty)||qty<1||qty>100)return fail('Quantidade de produto inválida.');
    const nextQty=(qtyById.get(id)||0)+qty;
    if(nextQty>500)return fail('Quantidade máxima por produto: 500 unidades.');
    qtyById.set(id,nextQty);requestedLines.push({id,qty,color});
  }
  const ids=[...qtyById.keys()];
  const products=await query('SELECT id,name,sku,price,stock,active,min_quantity,colors FROM products WHERE id=ANY($1::int[])',[ids]);
  if(products.length!==ids.length||products.some((product)=>!product.active))return fail('Um dos produtos do carrinho não está mais disponível.');
  for(const [id,qty] of qtyById){const product=products.find((row)=>Number(row.id)===id),minimum=Math.max(1,Number(product.min_quantity)||1);if(qty<minimum)return fail('A quantidade mínima de "'+product.name+'" é de '+minimum+' unidades no total, somando todas as cores.');}
  let total=0;const orderLines=[];
  for(const requested of requestedLines){
    const product=products.find((row)=>Number(row.id)===requested.id),minimum=Math.max(1,Number(product.min_quantity)||1);
    const availableColors=Array.isArray(product.colors)?product.colors:[];
    const selectedColor=availableColors.find((item)=>(typeof item==='string'?item:item?.name)===requested.color);
    if(availableColors.length&&!selectedColor)return fail('Escolha uma cor válida para "'+product.name+'".');
    if(!availableColors.length&&requested.color)return fail('A cor informada para "'+product.name+'" não é válida.');
    const colorName=typeof selectedColor==='string'?selectedColor:selectedColor?.name||'';
    const abbreviation=typeof selectedColor==='object'&&selectedColor?selectedColor.abbreviation||'':colorName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
    const variantSku=typeof selectedColor==='object'&&selectedColor?.sku?selectedColor.sku:(product.sku&&abbreviation?product.sku+'-'+abbreviation:product.sku||'');
    const price=Number(product.price);total+=price*requested.qty;
    orderLines.push({id:requested.id,name:requested.color?product.name+' — '+colorName:product.name,price,qty:requested.qty,sku:variantSku});
  }
  for(const [id,qty] of qtyById){const product=products.find((row)=>Number(row.id)===id);if(qty>Number(product.stock))return fail('Estoque insuficiente para "'+product.name+'" (disponível: '+product.stock+').');}
  const minOrder=Number(await getSetting('min_order','0'))||0;
  if(total<minOrder)return fail('O pedido mínimo é de '+brl(minOrder)+'. Seu carrinho está em '+brl(total)+'.',422);
  let customerId=user.asaas_customer_id;
  try {
    if(!customerId){
      const externalReference='brussels-pet-user-'+user.id;
      const existingCustomers=await asaasRequest(config,'/customers?externalReference='+encodeURIComponent(externalReference));
      let customer=existingCustomers.data?.find((item)=>item.externalReference===externalReference);
      if(!customer)customer=await asaasRequest(config,'/customers',{
        name:user.razao_social||user.nome_fantasia||user.email,cpfCnpj:String(user.cnpj||'').replace(/\D/g,''),
        email:user.email,mobilePhone:String(user.telefone||'').replace(/\D/g,'')||undefined,externalReference,notificationDisabled:false
      });
      if(!customer?.id)throw new Error('O Asaas não retornou o cadastro do cliente.');
      customerId=customer.id;await query('UPDATE users SET asaas_customer_id=$1 WHERE id=$2',[customerId,user.id]);
    }
    const reserved=[];
    for(const [id,qty] of qtyById){
      const result=await query('UPDATE products SET stock=stock-$1 WHERE id=$2 AND active=true AND stock>=$1 RETURNING id',[qty,id]);
      if(!result.length){for(const previous of reserved)await query('UPDATE products SET stock=stock+$1 WHERE id=$2',[previous.qty,previous.id]);return fail('O estoque mudou enquanto o pedido era finalizado. Atualize o carrinho e tente novamente.',409);}
      reserved.push({id,qty});
    }
    let orderId;
    try{
      const orderRows=await query("INSERT INTO orders (user_id,status,payment_method,total,shipping,notes,payment_status,checkout_key) VALUES ($1,'novo','asaas',$2,0,$3,'PENDING',$4) RETURNING id",
        [user.id,total.toFixed(2),String(body.notes||'').slice(0,500),checkoutKey]);
      orderId=orderRows[0].id;
      for(const line of orderLines)await query('INSERT INTO order_items (order_id,product_id,name,price,qty) VALUES ($1,$2,$3,$4,$5)',[orderId,line.id,line.name,line.price.toFixed(2),line.qty]);
    }catch(error){
      if(orderId)await query('DELETE FROM orders WHERE id=$1',[orderId]);
      for(const line of reserved)await query('UPDATE products SET stock=stock+$1 WHERE id=$2',[line.qty,line.id]);
      throw error;
    }
    await query("INSERT INTO admin_notifications (order_id,event_type) VALUES ($1,'checkout_pending') ON CONFLICT (order_id,event_type) DO NOTHING",[orderId]);
    await sendAdminPush({type:'checkout_pending',orderId}).catch((error)=>console.error('Falha ao notificar novo pedido:',error));
    let payment=await findPayment(config,orderId);
    if(!payment){
      const dueDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
      payment=await asaasRequest(config,'/payments',{customer:customerId,billingType:'UNDEFINED',value:Number(total.toFixed(2)),dueDate,
        description:'Pedido #'+orderId+' - Brussels Pet',externalReference:'brussels-pet-order-'+orderId});
    }
    const response=await checkoutResponse(orderId,payment);
    if(response)return response;
    throw new Error('O Asaas não retornou o link de pagamento.');
  }catch(error){console.error('Erro ao iniciar checkout Brussels Pet:',error);return fail(error.message||'Não foi possível iniciar o pagamento. Tente novamente.',502);}
}
