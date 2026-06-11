"use client";

import { useRouter } from "next/navigation";
import { clearRolePreviewInBrowser } from "@/lib/role-preview";
import type { AppRole } from "@/lib/types";

export function RolePreviewRestore({ previewRole }: { previewRole: Extract<AppRole, "admin" | "user"> | null }) {
  const router = useRouter();

  if (!previewRole) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        clearRolePreviewInBrowser();
        router.refresh();
      }}
      className="fixed bottom-3 right-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-full border border-[#6ba3b0]/40 bg-white/95 px-4 py-2 text-xs font-medium text-[#23545c] shadow-[0_16px_36px_rgba(90,154,175,0.22)] backdrop-blur transition hover:bg-[#effbf9] sm:bottom-5 sm:right-5 sm:px-5 sm:py-3 sm:text-sm"
    >
      Restore superadmin
    </button>
  );
}
