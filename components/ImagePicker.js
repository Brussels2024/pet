'use client';

import { useRef, useState } from 'react';

const MAX_IMAGE_CHARS = 500000;

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
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          window.alert('Não foi possível preparar essa imagem.');
          setBusy(false);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        let optimized = '';
        for (const quality of [0.84, 0.76, 0.68, 0.60, 0.52, 0.44, 0.36]) {
          optimized = canvas.toDataURL('image/webp', quality);
          if (optimized.length <= MAX_IMAGE_CHARS) break;
        }

        if (optimized.length > MAX_IMAGE_CHARS) {
          const smaller = document.createElement('canvas');
          const ratio = Math.min(1, 1200 / canvas.width);
          smaller.width = Math.max(1, Math.round(canvas.width * ratio));
          smaller.height = Math.max(1, Math.round(canvas.height * ratio));
          const smallerContext = smaller.getContext('2d');
          if (smallerContext) {
            smallerContext.drawImage(canvas, 0, 0, smaller.width, smaller.height);
            for (const quality of [0.68, 0.58, 0.48, 0.38]) {
              optimized = smaller.toDataURL('image/webp', quality);
              if (optimized.length <= MAX_IMAGE_CHARS) break;
            }
          }
        }

        if (optimized.length > MAX_IMAGE_CHARS) {
          window.alert('Não foi possível compactar essa foto o suficiente. Tente outra imagem.');
          setBusy(false);
          event.target.value = '';
          return;
        }
        setValue(optimized);
        setBusy(false);
        event.target.value = '';
      };
      image.onerror = () => {
        window.alert('Não foi possível abrir essa imagem.');
        setBusy(false);
        event.target.value = '';
      };
      image.src = String(reader.result || '');
    };
    reader.onerror = () => {
      window.alert('Não foi possível ler o arquivo.');
      setBusy(false);
      event.target.value = '';
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
      <p className="muted">As fotos são convertidas para WebP e compactadas automaticamente. Até 8 fotos por produto.</p>
    </div>
  );
}
