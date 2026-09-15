import type { CSSProperties } from 'react';

import './colour-palette-selector.css';

export interface ColourPaletteSelectorOption {
  ariaLabel?: string;
  colour: string;
  disabled?: boolean;
  foregroundColor?: string;
  id: string;
  label: string;
  secondaryLabel?: string;
}

interface ColourPaletteSelectorProps {
  ariaLabel: string;
  columns?: number;
  onSelect: (id: string) => void;
  options: readonly ColourPaletteSelectorOption[];
  selectedId: string;
}

/** A compact, reusable row of colour choices for custom palette editors. */
export function ColourPaletteSelector({
  ariaLabel,
  columns = 5,
  onSelect,
  options,
  selectedId,
}: ColourPaletteSelectorProps) {
  return (
    <div
      aria-label={ariaLabel}
      className="colour-palette-selector"
      role="group"
      style={{ '--colour-palette-columns': columns } as CSSProperties}
    >
      {options.map((option) => (
        <button
          aria-label={option.ariaLabel ?? option.label}
          aria-pressed={option.id === selectedId}
          className={`colour-palette-selector__option${option.id === selectedId ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
          disabled={option.disabled}
          key={option.id}
          onClick={() => onSelect(option.id)}
          style={{
            '--colour-palette-colour': option.colour,
            '--colour-palette-foreground': option.foregroundColor ?? 'var(--foreground)',
          } as CSSProperties}
          type="button"
        >
          <span>{option.label}</span>
          {option.secondaryLabel ? <small>{option.secondaryLabel}</small> : null}
        </button>
      ))}
    </div>
  );
}
