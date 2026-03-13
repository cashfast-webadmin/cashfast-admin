import packageJson from "../package.json"

const currentYear = new Date().getFullYear()

export const APP_CONFIG = {
  name: "Cashfast",
  version: packageJson.version,
  copyright: `© ${currentYear}, Cashfast Admin.`,
  meta: {
    title: "Cashfast Admin",
    description: "Cashfast Admin",
  },
}
