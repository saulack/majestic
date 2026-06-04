"use client";

import { useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export function CheckoutChecklistManager() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [draft, setDraft] = useState("");

  function addItem() {
    const text = draft.trim();
    if (!text) return;

    setItems((current) => [{ id: crypto.randomUUID(), text, done: false }, ...current]);
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
        <ClipboardCheck className="h-3.5 w-3.5" />
        Checkout Checklist
      </div>

      <h3 className="mt-3 text-lg font-semibold">Before You Leave</h3>
      <p className="mt-2 text-sm text-slate-500">Create checklist items now and fill this out whenever you are ready.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add checklist item"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          No checklist items yet.
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#fbf8f2] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) => {
                  setItems((current) =>
                    current.map((entry) => (entry.id === item.id ? { ...entry, done: event.target.checked } : entry))
                  );
                }}
              />
              <span className={item.done ? "line-through text-slate-400" : "text-slate-700"}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
