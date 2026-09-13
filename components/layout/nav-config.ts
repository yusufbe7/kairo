import { CalendarDays, ChartColumn, Image as ImageIcon, Inbox, LayoutGrid, Link2, Sparkles, SquarePen, FileText, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon }

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutGrid },
      { href: "/create", label: "Create", icon: SquarePen },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/posts", label: "Posts", icon: FileText },
      { href: "/analytics", label: "Analytics", icon: ChartColumn },
      { href: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/accounts", label: "Accounts", icon: Link2 },
      { href: "/media", label: "Media Library", icon: ImageIcon },
      { href: "/ai", label: "AI Studio", icon: Sparkles },
    ],
  },
];
