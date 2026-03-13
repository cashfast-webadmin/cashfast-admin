import packageJson from "../package.json"

const currentYear = new Date().getFullYear()

export const APP_CONFIG = {
  name: "Homy Admin",
  version: packageJson.version,
  copyright: `© ${currentYear}, Homy Admin.`,
  meta: {
    title: "Homy Admin",
    description: "Homy Admin",
  },
}
