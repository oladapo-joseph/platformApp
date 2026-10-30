/**
 * Admin console (US-7.1 – US-7.8): one page per job, a sub-nav with the counts that need a decision.
 * The route is behind RequireAdmin, and every call behind the API's admin check.
 */
import { NavLink, Outlet } from "react-router";

import { useAdminSummary } from "@/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { to: "requests", label: "Requests", badge: "access_requests" },
  { to: "invites", label: "Invites" },
  { to: "users", label: "Users" },
  { to: "audit", label: "Audit log", badge: "suspicious" },
  { to: "usage", label: "Usage" },
  { to: "data", label: "Data health" },
] as const;

export default function AdminPage() {
  const { data: summary } = useAdminSummary(true);
  return (
    <>
      <PageHeader title="Admin" description="Access, people, activity and data." />
      <nav aria-label="Admin" className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-line-subtle">
          {SECTIONS.map((s) => {
            const count = "badge" in s ? (summary?.[s.badge] ?? 0) : 0;
            return (
              <li key={s.to}>
                <NavLink
                  to={s.to}
                  className={({ isActive }) =>
                    cn(
                      "touch-target -mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap",
                      isActive ? "border-brand text-fg" : "border-transparent text-fg-2 hover:text-fg",
                    )
                  }
                >
                  {s.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "num rounded-full px-1.5 text-xs font-semibold",
                        s.to === "audit" ? "bg-danger-subtle text-danger" : "bg-brand-subtle text-brand",
                      )}
                    >
                      {count}
                      <span className="sr-only">{s.to === "audit" ? " suspicious this week" : " waiting"}</span>
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <Outlet />
    </>
  );
}
