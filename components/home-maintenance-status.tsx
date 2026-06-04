"use client";

import { useEffect, useState } from "react";
import type { MaintenanceSummary } from "@/lib/types";

type Props = {
  summaries: MaintenanceSummary[];
};

export function HomeMaintenanceStatus({ summaries }: Props) {
  const [activeSummary, setActiveSummary] = useState<MaintenanceSummary | null>(null);
  const [modalEntered, setModalEntered] = useState(false);

  useEffect(() => {
    if (!activeSummary) {
      return;
    }

    const raf = window.requestAnimationFrame(() => setModalEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [activeSummary]);

  useEffect(() => {
    if (!activeSummary) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeSummary]);

  function openModal(summary: MaintenanceSummary) {
    setActiveSummary(summary);
  }

  function closeModal() {
    setModalEntered(false);
    window.setTimeout(() => {
      setActiveSummary(null);
    }, 180);
  }

  function getDetailText(summary: MaintenanceSummary) {
    if (summary.snapshotState === "booked" && summary.bookedForDate) {
      return `Booked for ${summary.bookedForDate}. Day count restarts the day after this date.`;
    }

    if (summary.snapshotState === "in_progress_today") {
      return "Maintenance is in progress today. Day count will restart tomorrow at 1.";
    }

    return `${summary.daysSinceLastMaintenance} days since last cycle baseline`;
  }

  return (
    <>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary) => {
          const isOverdue =
            summary.snapshotState === "counting" && summary.daysSinceLastMaintenance !== null && summary.daysSinceLastMaintenance >= summary.thresholdDays;
          const detailLine =
            summary.snapshotState === "booked" && summary.bookedForDate
              ? `booked: ${summary.bookedForDate}`
              : summary.snapshotState === "in_progress_today"
                ? "status: in progress today"
                : `days: ${summary.daysSinceLastMaintenance}`;

          return (
            <article
              key={summary.typeId}
              className={`rounded-xl border ${summary.needsAttention ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
            >
              <button
                type="button"
                onClick={() => openModal(summary)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{summary.typeName}</p>
                  <p className="text-xs font-normal text-slate-500">{detailLine}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isOverdue ? (
                    <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                      Overdue
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-500">Details</span>
                </div>
              </button>
            </article>
          );
        })}
      </div>

      {activeSummary ? (
        <div
          className={[
            "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm transition-opacity duration-200",
            modalEntered ? "opacity-100" : "opacity-0"
          ].join(" ")}
          onClick={closeModal}
        >
          <div
            className={[
              "w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-all duration-200 sm:p-6",
              modalEntered ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
            ].join(" ")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-semibold text-slate-900">{activeSummary.typeName}</h4>
                <p className="mt-1 text-sm text-slate-600">{getDetailText(activeSummary)}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-medium">Threshold:</span> {activeSummary.thresholdDays} days
              </p>
              <p>
                <span className="font-medium">Last maintenance date:</span> {activeSummary.lastMaintenanceDate ?? "Not logged yet"}
              </p>
              <p>
                <span className="font-medium">Last booked by:</span> {activeSummary.lastBookedByName ?? "Not logged yet"}
              </p>
              <p>
                <span className="font-medium">Next due date:</span> {activeSummary.nextMaintenanceDueDate}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
