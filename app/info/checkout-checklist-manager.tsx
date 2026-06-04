"use client";

import { useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

const defaultItems: ChecklistItem[] = [];

export function CheckoutChecklistManager({ initialItems = defaultItems }: { initialItems?: ChecklistItem[] }) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function addItem() {
    const text = draft.trim();
    if (!text) return;

    setSaving(true);
    setMessage("");

    const response = await fetch("/api/info/checkout-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const payload = (await response.json()) as { item?: ChecklistItem; error?: string };
    setSaving(false);

    if (!response.ok || !payload.item) {
      setMessage(payload.error ?? "Failed to add checklist item.");
      return;
    }

    const createdItem = payload.item;
    if (!createdItem) {
      setMessage("Failed to add checklist item.");
      return;
    }

    setItems((current) => [createdItem, ...current]);
    setDraft("");
  }

  async function toggleItem(itemId: string, done: boolean) {
    const previous = items;
    setItems((current) => current.map((entry) => (entry.id === itemId ? { ...entry, done } : entry)));

    const response = await fetch("/api/info/checkout-items", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: itemId, done })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setItems(previous);
      setMessage(payload.error ?? "Failed to update checklist item.");
    }
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
        <button type="button" disabled={saving} onClick={() => void addItem()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          <Plus className="h-4 w-4" />
          {saving ? "Adding..." : "Add item"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          No checklist items yet.
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) => {
                  void toggleItem(item.id, event.target.checked);
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
