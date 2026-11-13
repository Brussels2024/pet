import { getSetting } from '@/lib/db';

// A logo original permanece em public/logo.jpg e funciona como padrão.
export default async function Logo({ size = 84 }) {
  let src = '/logo.jpg';
  try {
    src = await getSetting('store_logo', '/logo.jpg') || '/logo.jpg';
  } catch {
    src = '/logo.jpg';
  }

  return (
    <img
      src={src}
      alt="Brussels Pet"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
}
