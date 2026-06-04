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
      className="fixed bottom-5 right-5 z-50 rounded-full border border-[#6ba3b0]/40 bg-white/95 px-5 py-3 text-sm font-medium text-[#23545c] shadow-[0_16px_36px_rgba(90,154,175,0.22)] backdrop-blur transition hover:bg-[#effbf9]"
    >
      Restore superadmin
    </button>
  );
}
