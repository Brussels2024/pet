'use client';

import { useRef, useState } from 'react';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível abrir essa imagem.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível preparar a imagem.'));
    }, 'image/webp', quality);
  });
}

export default function ImagePicker({ name, initialValue = '', label = 'Imagem' }) {
  const [value, setValue] = useState(initialValue || '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const image = await loadImage(file);
      const maxWidth = 1400;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a imagem.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      let optimized = await canvasToBlob(canvas, 0.74);
      if (optimized.size > 650000) optimized = await canvasToBlob(canvas, 0.62);
      if (optimized.size > 650000) optimized = await canvasToBlob(canvas, 0.5);
      if (optimized.size > 650000) {
        throw new Error('Essa foto ficou muito pesada. Escolha uma imagem menor ou com menos resolução.');
      }

      const body = new FormData();
      body.append('file', optimized, 'imagem.webp');
      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Não foi possível enviar a imagem.');
      }

      setValue(result.url);
    } catch (error) {
      window.alert(error?.message || 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setBusy(false);
      if (event.target) event.target.value = '';
    }
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
          {busy ? 'Enviando imagem...' : 'Escolher da galeria'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={chooseFile} hidden />
        {value && (
          <button type="button" className="btn danger small" onClick={() => setValue('')} disabled={busy}>Remover imagem</button>
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
      <p className="muted">As fotos são convertidas para WebP e compactadas automaticamente (limite de 650 KB por foto).</p>
    </div>
  );
}
