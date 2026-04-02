"use client";

import { useRef, useState, useId, useEffect } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Option = { id: string; full_name: string };

export default function MemberSelect({
  options,
  name,
  defaultValue,
  placeholder,
  className = ""
}: {
  options: Option[];
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Option | null>(() => {
    if (!defaultValue) return null;
    const o = options.find((op) => op.id === defaultValue);
    return o ? { id: o.id, full_name: String(o.full_name ?? "").trim() || t("resources.no_name", locale) } : null;
  });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const inputId = useId();

  const safeOptions = options.map((o) => ({
    id: o.id,
    full_name: String(o.full_name ?? "").trim() || t("resources.no_name", locale)
  }));
  const filtered =
    query.trim() === ""
      ? safeOptions
      : safeOptions.filter((o) =>
          o.full_name.toLowerCase().includes(query.toLowerCase().trim())
        );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const displayValue = selected ? selected.full_name : query;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <label htmlFor={inputId} className="sr-only">
        {t("tasks.owner_label", locale)}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder ?? t("members.search_or_select", locale)}
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") setSelected(null);
          if (!open) setOpen(true);
          if (selected) setSelected(null);
          setQuery(selected ? "" : v);
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded border border-border-default bg-bg-primary p-2 text-xs dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-border-subtle bg-bg-primary py-1 text-xs shadow-lg dark:border-border-default dark:bg-bg-primary"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-text-secondary">
              {options.length === 0 ? t("members.no_people_loaded", locale) : t("common.no_matches", locale)}
            </li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={selected?.id === opt.id}
                className="cursor-pointer px-3 py-2 text-text-primary hover:bg-bg-secondary"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelected(opt);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {opt.full_name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
