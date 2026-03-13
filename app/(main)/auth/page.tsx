import Link from "next/link"

import { Globe } from "lucide-react"

import { APP_CONFIG } from "@/config/app-config"

import { LoginForm } from "./components/login-form"

export default function Login() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">Login to your account</h1>
          <p className="text-sm text-muted-foreground">
            Please enter your details to login.
          </p>
        </div>
        <div className="space-y-4">
          <LoginForm />
        </div>
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">{APP_CONFIG.copyright}</div>
        <div className="flex items-center gap-1 text-sm">
          <Globe className="size-4 text-muted-foreground" />
          ENG
        </div>
      </div>
    </>
  )
}
