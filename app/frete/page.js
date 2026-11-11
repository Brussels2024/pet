import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { query, getSetting } from '@/lib/db';
import ShippingClient from '@/components/ShippingClient';
export const dynamic='force-dynamic';
export default async function FretePage(){
 const user=await getUser();if(!user)redirect('/entrar?next=/frete');
 const cities=await query('SELECT city, uf FROM shipping_cities WHERE free_shipping=true ORDER BY city');
 const whatsapp=await getSetting('whatsapp','5519995888333');
 return <div className="wrap page"><ShippingClient user={user} freeCities={cities} whatsapp={whatsapp}/></div>;
}