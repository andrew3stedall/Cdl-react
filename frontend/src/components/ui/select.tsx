import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string }[];
}

export function Select({ label, options, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replaceAll(' ', '-');

  return (
    <label className={`ui-select ${className}`.trim()} htmlFor={selectId}>
      <span>{label}</span>
      <select id={selectId} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
