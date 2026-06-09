import { Search } from "lucide-react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
};

export function SearchBar({ value, onChange, placeholder, label }: SearchBarProps) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-4 text-sm text-foreground shadow-sm shadow-slate-950/5 outline-none transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
          type="search"
        />
      </span>
    </label>
  );
}
