type ToggleSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  srLabel: string;
  offLabel?: string;
  onLabel?: string;
};

export function ToggleSwitch({ checked, onCheckedChange, disabled = false, srLabel, offLabel, onLabel }: ToggleSwitchProps) {
  return (
    <div className="inline-flex items-center gap-3">
      {offLabel ? <span className={`text-sm ${checked ? "text-slate-400" : "font-medium text-slate-800"}`}>{offLabel}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={srLabel}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={[
          "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8acfd8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          checked
            ? "border-[#68c5ba] bg-[linear-gradient(180deg,#50d1c0_0%,#34c4b2_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
            : "border-slate-300 bg-[linear-gradient(180deg,#f1f5f9_0%,#e2e8f0_100%)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.14)]"
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-6 w-6 rounded-full bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_1px_2px_rgba(15,23,42,0.2),0_0_0_0.5px_rgba(148,163,184,0.35)] transition-transform duration-200 ease-out",
            checked ? "translate-x-7" : "translate-x-1"
          ].join(" ")}
        />
      </button>
      {onLabel ? <span className={`text-sm ${checked ? "font-medium text-slate-800" : "text-slate-400"}`}>{onLabel}</span> : null}
    </div>
  );
}