import {
  HelpCircle,
  LayoutDashboard,
  NotebookPen,
  type LucideIcon,
  Zap,
  Notebook,
} from "lucide-react"

export interface NavSubItem {
  title: string
  url: string
  icon?: LucideIcon
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
}

export interface NavMainItem {
  title: string
  url: string
  icon?: LucideIcon
  subItems?: NavSubItem[]
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
}

export interface NavGroup {
  id: number
  label?: string
  items: NavMainItem[]
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        title: "Overview",
        url: "/dashboard/home",
        icon: LayoutDashboard,
      },
      {
        title: "Leads",
        url: "/dashboard/leads",
        icon: Zap,
      },
    ],
  },
  {
    id: 2,
    label: "Admin",
    items: [
      {
        title: "FAQ",
        url: "/dashboard/faq",
        icon: HelpCircle,
      },
      {
        title: "Blogs",
        url: "/dashboard/blog",
        icon: Notebook,
      },
    ],
  },
]
