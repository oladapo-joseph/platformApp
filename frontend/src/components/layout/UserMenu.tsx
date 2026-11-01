import { Check, CircleHelp, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useNavigate } from "react-router";

import { useLogout, useMe, useThemeChoice } from "@/api/auth";
import { cn } from "@/lib/cn";
import type { ThemeChoice } from "@/lib/theme";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Automatic", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function initials(name: string | null | undefined): string {
  const words = (name ?? "")
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (
    words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : (words[0]?.slice(0, 2) ?? "?")
  ).toUpperCase();
}

const item =
  "flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg outline-none select-none data-highlighted:bg-hover";

/** Avatar menu: Account, Theme, Sign out (docs/06 §6). */
export function UserMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [theme, setTheme] = useThemeChoice();

  const signOut = () =>
    logout.mutate("this", { onSettled: () => void navigate("/login?reason=signed-out", { replace: true }) });

  // non-modal: the page isn't hidden from assistive tech while the menu is open
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="touch-target flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand"
      >
        {initials(me?.display_name)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-(--z-dropdown) min-w-56 rounded-lg border border-line bg-raised p-1 shadow-md"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-fg">{me?.display_name}</p>
            {me?.email && <p className="truncate text-xs text-fg-muted">{me.email}</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line-subtle" />
          <DropdownMenu.Item className={item} onSelect={() => void navigate("/app/account")}>
            <UserRound aria-hidden className="size-4 text-fg-muted" /> Account
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => void navigate("/app/help")}>
            <CircleHelp aria-hidden className="size-4 text-fg-muted" /> Help and glossary
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line-subtle" />
          <DropdownMenu.Label className="eyebrow px-3 py-1.5 text-fg-muted">Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={item}>
                <Icon aria-hidden className="size-4 text-fg-muted" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="size-4 text-brand" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-line-subtle" />
          <DropdownMenu.Item className={cn(item, "text-fg")} onSelect={signOut}>
            <LogOut aria-hidden className="size-4 text-fg-muted" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
