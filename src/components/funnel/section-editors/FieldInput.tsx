/** FieldInput. Reusable form field for section config editors. No external deps. */
'use client';

interface FieldInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}

export function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  maxLength,
}: FieldInputProps) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className="w-full rounded border bg-background px-2 py-1 text-sm resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}
