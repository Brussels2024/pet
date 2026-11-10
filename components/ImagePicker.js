'use client';

import { useRef, useState } from 'react';

export default function ImagePicker({ name, initialValue = '', label = 'Imagem' }) {
  const [value, setValue] = useState(initialValue || '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Escolha um arquivo de imagem.');
      event.target.value = '';
      return;
    }

    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const maxWidth = 1500;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setValue(canvas.toDataURL('image/webp', 0.76));
        setBusy(false);
      };
      image.onerror = () => {
        window.alert('Não foi possível abrir essa imagem.');
        setBusy(false);
      };
      image.src = String(reader.result || '');
    };
    reader.onerror = () => {
      window.alert('Não foi possível ler o arquivo.');
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="image-picker">
      <label>{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="image-picker-preview">
        {value ? <img src={value} alt="Pré-visualização" /> : <span>Pré-visualização da imagem</span>}
      </div>
      <div className="image-picker-actions">
        <button type="button" className="btn outline small" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Preparando imagem...' : 'Escolher da galeria'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={chooseFile} hidden />
        {value && (
          <button type="button" className="btn danger small" onClick={() => setValue('')}>Remover imagem</button>
        )}
      </div>
      <details className="image-url-details">
        <summary>Ou informar endereço de imagem</summary>
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://..."
          aria-label="Endereço da imagem"
        />
      </details>
      <p className="muted">A imagem escolhida é otimizada antes de ser salva.</p>
    </div>
  );
}
