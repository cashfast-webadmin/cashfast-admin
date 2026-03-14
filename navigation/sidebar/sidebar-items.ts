import {
  HelpCircle,
  LayoutDashboard,
  NotebookPen,
  type LucideIcon,
  Zap,
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
        title: "Home",
        url: "/dashboard/home",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 2,
    label: "Pages",
    items: [
      {
        title: "Leads",
        url: "/dashboard/leads",
        icon: Zap,
      },
      {
        title: "FAQ",
        url: "/dashboard/faq",
        icon: HelpCircle,
      },
      {
        title: "Blog",
        url: "/dashboard/blog",
        icon: NotebookPen,
      },
    ],
  },
]
