// LOGO TRAVADA — identidade visual da Brussels Pet.
// Não remover, trocar nem alterar este componente nem o arquivo public/logo.jpg.
export default function Logo({ size = 84 }) {
  return (
    <img
      src="/logo.jpg"
      alt="Brussels — Since 2024"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
}
