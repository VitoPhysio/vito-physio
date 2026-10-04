import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "datetime-local" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  full?: boolean;
};

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function SimpleForm({
  fields,
  submitLabel,
  onSubmit,
  initial,
}: {
  fields: Field[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  initial?: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(values);
      setValues(initial ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const v = values[f.name] ?? "";
        const set = (val: string) => setValues((s) => ({ ...s, [f.name]: val }));
        const wide = f.full || f.type === "textarea";
        return (
          <div key={f.name} className={wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
            <Label htmlFor={f.name}>
              {f.label}
              {f.required && <span className="text-accent"> *</span>}
            </Label>
            {f.type === "textarea" ? (
              <Textarea id={f.name} required={f.required} value={v} onChange={(e) => set(e.target.value)} rows={2} />
            ) : f.type === "select" ? (
              <select id={f.name} required={f.required} value={v} onChange={(e) => set(e.target.value)} className={selectClass}>
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <Input id={f.name} type={f.type ?? "text"} required={f.required} value={v} onChange={(e) => set(e.target.value)}
                {...(f.type === "number" ? { min: 0, max: 10 } : {})} />
            )}
          </div>
        );
      })}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

/** Turn form strings into DB values: blanks become null, numeric fields become numbers. */
export function clean(values: Record<string, string>, numeric: string[] = []) {
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(values)) {
    const t = v.trim();
    out[k] = t === "" ? null : numeric.includes(k) ? Number(t) : t;
  }
  return out;
}
