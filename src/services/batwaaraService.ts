export interface BatwaaraEntry {
  id: string

  year: number

  memberId: string | null

  name: string

  amount: number | null

  given: boolean

  createdAt: string
}

const STORAGE_KEY = "e-register.batwaara.v1"
const YEAR_AMOUNTS_STORAGE_KEY = "e-register.batwaara-year-amounts.v1"

export type BatwaaraYearAmounts = Record<number, number>

function isBatwaaraEntry(value: unknown): value is BatwaaraEntry {
  if (typeof value !== "object" || value === null) return false

  const entry = value as Record<string, unknown>

  return (
    typeof entry.id === "string" &&
    Number.isInteger(entry.year) &&
    (typeof entry.memberId === "string" || entry.memberId === null) &&
    typeof entry.name === "string" &&
    (entry.amount === null ||
      (typeof entry.amount === "number" &&
        Number.isFinite(entry.amount) &&
        entry.amount >= 0)) &&
    typeof entry.given === "boolean" &&
    typeof entry.createdAt === "string"
  )
}

export function loadLocalBatwaaraEntries(): BatwaaraEntry[] {
  const saved = window.localStorage.getItem(STORAGE_KEY)

  if (saved === null) return []

  let parsed: unknown

  try {
    parsed = JSON.parse(saved)
  } catch (error) {
    console.error("Saved Batwaara data could not be read.", error)

    throw new Error(
      "Saved Batwaara data could not be read. Clear Batwaara data in local storage to continue.",
    )
  }

  if (!Array.isArray(parsed) || !parsed.every(isBatwaaraEntry)) {
    throw new Error(
      "Saved Batwaara data is invalid. Clear Batwaara data in local storage to continue.",
    )
  }

  return parsed
}

export function saveLocalBatwaaraEntry(entry: BatwaaraEntry): void {
  const entries = loadLocalBatwaaraEntries()

  const nextEntries = entries.some((existing) => existing.id === entry.id)
    ? entries.map((existing) => (existing.id === entry.id ? entry : existing))
    : [...entries, entry]

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries))
}

export function loadLocalBatwaaraYearAmounts(): BatwaaraYearAmounts {
  const saved = window.localStorage.getItem(YEAR_AMOUNTS_STORAGE_KEY)

  if (saved === null) return {}

  let parsed: unknown

  try {
    parsed = JSON.parse(saved)
  } catch (error) {
    console.error("Saved Batwaara yearly amounts could not be read.", error)
    throw new Error("Saved Batwaara yearly amounts could not be read. Clear Batwaara yearly amounts in local storage to continue.")
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Saved Batwaara yearly amounts are invalid. Clear Batwaara yearly amounts in local storage to continue.")
  }

  const amounts: BatwaaraYearAmounts = {}
  for (const [year, amount] of Object.entries(parsed)) {
    const numericYear = Number(year)
    if (!Number.isInteger(numericYear) || !Number.isFinite(amount) || amount < 0) {
      throw new Error("Saved Batwaara yearly amounts are invalid. Clear Batwaara yearly amounts in local storage to continue.")
    }
    amounts[numericYear] = amount
  }

  return amounts
}

export function saveLocalBatwaaraYearAmount(year: number, amount: number): void {
  if (!Number.isInteger(year) || !Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid Batwaara amount of zero or more.")
  }

  const amounts = loadLocalBatwaaraYearAmounts()
  amounts[year] = amount
  window.localStorage.setItem(YEAR_AMOUNTS_STORAGE_KEY, JSON.stringify(amounts))
}
