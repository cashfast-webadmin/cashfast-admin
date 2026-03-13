import type { ReactNode } from "react"

export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="relative order-2 flex h-full">{children}</div>
        <div className="relative order-1 hidden h-full rounded-3xl bg-primary lg:flex"></div>
      </div>
    </main>
  )
}
