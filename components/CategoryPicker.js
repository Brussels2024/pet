'use client';

import { useState } from 'react';

export default function CategoryPicker({ options = [], initialSelected = [] }) {
  const [selected, setSelected] = useState(initialSelected.slice(0, 2).map(Number));

  function toggle(id) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  }

  return (
    <div className="field category-picker">
      <span className="field-label">Categorias (até 2)</span>
      <div className="category-picker-options">
        {options.map((option) => {
          const checked = selected.includes(Number(option.id));
          return (
            <label key={option.id} className="category-picker-option">
              <input type="checkbox" checked={checked} onChange={() => toggle(Number(option.id))}
                disabled={!checked && selected.length >= 2} />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {selected.map((id) => <input key={id} type="hidden" name="category_ids" value={id} />)}
      <small className="muted">Selecione uma ou duas categorias para este produto.</small>
    </div>
  );
}
