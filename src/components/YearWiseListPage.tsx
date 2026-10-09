import { useEffect, useMemo, useRef, useState } from "react"

import { useSearchParams } from "react-router-dom"

import type { ManagedMember } from "../data/memberManagement"

import { formatCurrency } from "../data/memberManagement"

import {
  parseRegisterDate,
  type MemberPayment,
} from "../services/registerService"

import {
  loadCloudBatwaaraEntries,
  loadCloudBatwaaraYearAmounts,
  saveCloudBatwaaraYearAmount,
} from "../services/cloudRegister"

import {
  loadLocalBatwaaraEntries,
  loadLocalBatwaaraYearAmounts,
  saveLocalBatwaaraYearAmount,
  type BatwaaraEntry,
  type BatwaaraYearAmounts,
} from "../services/batwaaraService"

interface YearWiseListPageProps {
  members: ManagedMember[]

  payments: MemberPayment[]

  cloudMode: boolean

  onSave: (entry: BatwaaraEntry) => Promise<void>
}

interface EntryDraft {
  id: string

  name: string

  amount: string
}

function createDraft(): EntryDraft {
  return { id: crypto.randomUUID(), name: "", amount: "" }
}

function calendarYear(value: string) {
  return parseRegisterDate(value)?.getFullYear() ?? null
}

function entryErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Batwaara entry could not be saved. Your input is still here; please retry."
}

function sameEntry(first: BatwaaraEntry, second: BatwaaraEntry) {
  return (
    first.id === second.id &&
    first.year === second.year &&
    first.memberId === second.memberId &&
    first.name === second.name &&
    first.amount === second.amount &&
    first.given === second.given
  )
}

export default function YearWiseListPage({
  members,
  payments,
  cloudMode,
  onSave,
}: YearWiseListPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const [entries, setEntries] = useState<BatwaaraEntry[]>([])

  const entriesRef = useRef(entries)

  const [yearAmounts, setYearAmounts] = useState<BatwaaraYearAmounts>({})

  const [yearAmountDraft, setYearAmountDraft] = useState("")

  const [savingYearAmount, setSavingYearAmount] = useState(false)

  const [yearAmountError, setYearAmountError] = useState("")

  const [yearAmountNotice, setYearAmountNotice] = useState("")

  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState("")

  const [loadRevision, setLoadRevision] = useState(0)

  const [drafts, setDrafts] = useState<Record<number, EntryDraft>>(() => ({
    [new Date().getFullYear()]: createDraft(),
  }))

  const [newEntryError, setNewEntryError] = useState("")

  const [newEntryNotice, setNewEntryNotice] = useState("")

  const [savingNewEntry, setSavingNewEntry] = useState(false)

  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set())

  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({})

  const [amountEdits, setAmountEdits] = useState<Record<string, string>>({})

  const [search, setSearch] = useState("")

  const nameInput = useRef<HTMLInputElement>(null)

  const submitLock = useRef(false)

  const dirtyIds = useRef(new Set<string>())

  const saveQueues = useRef(new Map<string, Promise<boolean>>())

  const legacyEntries = useMemo(() => {
    if (cloudMode) return []

    return members.flatMap((member) => {
      const year = calendarYear(member.joinDate)

      if (year === null) return []

      const paidAmount = payments

        .filter(
          (payment) =>
            payment.memberId === member.id &&
            calendarYear(payment.date) === year &&
            payment.status === "Paid",
        )

        .reduce((total, payment) => total + payment.amount, 0)

      const entryDate = parseRegisterDate(member.joinDate)

      return [
        {
          id: `LEGACY-${member.id}-${year}`,

          year,

          memberId: member.id,

          name: member.name,

          amount: member.entryAmount ?? (paidAmount || null),

          given: paidAmount > 0,

          createdAt: entryDate?.toISOString() ?? `${year}-01-01T00:00:00.000Z`,
        },
      ]
    })
  }, [cloudMode, members, payments])

  useEffect(() => {
    let active = true

    setLoading(true)

    setLoadError("")

    const loadData = Promise.all([
      cloudMode
        ? loadCloudBatwaaraEntries()
        : Promise.resolve().then(() => loadLocalBatwaaraEntries()),
      cloudMode
        ? loadCloudBatwaaraYearAmounts()
        : Promise.resolve().then(() => loadLocalBatwaaraYearAmounts()),
    ])

    loadData

      .then(([loaded, amounts]) => {
        if (!active) return

        setYearAmounts(amounts)

        const byId = new Map<string, BatwaaraEntry>(
          legacyEntries.map((entry) => [entry.id, entry]),
        )

        loaded.forEach((entry) => byId.set(entry.id, entry))

        const nextEntries = [...byId.values()]

        entriesRef.current = nextEntries

        setEntries(nextEntries)

        setLoading(false)
      })

      .catch((error: unknown) => {
        if (!active) return

        setLoadError(entryErrorMessage(error))

        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [cloudMode, legacyEntries, loadRevision])

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = new Set<number>(
      Array.from({ length: 6 }, (_, index) => currentYear + index),
    )

    members.forEach((member) => {
      const year = calendarYear(member.joinDate)

      if (year !== null) years.add(year)
    })

    entries.forEach((entry) => years.add(entry.year))

    return [...years].sort((first, second) => second - first)
  }, [entries, members])

  const requestedYear = Number(searchParams.get("year"))

  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : new Date().getFullYear()

  const yearEntries = useMemo(
    () =>
      entries

        .filter((entry) => entry.year === selectedYear)

        .sort(
          (first, second) =>
            first.createdAt.localeCompare(second.createdAt) ||
            first.id.localeCompare(second.id),
        ),
    [entries, selectedYear],
  )

  const filteredYearEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query
      ? yearEntries.filter((entry) => entry.name.toLocaleLowerCase().includes(query))
      : yearEntries
  }, [search, yearEntries])

  const currentDraft = drafts[selectedYear] ?? { id: "", name: "", amount: "" }

  const yearAmount = yearAmounts[selectedYear]

  const effectiveDraftAmount = yearAmount === undefined
    ? currentDraft.amount
    : String(yearAmount)

  const draftAmount = effectiveDraftAmount === "" ? null : Number(effectiveDraftAmount)

  const draftIsCounted = currentDraft.name.trim().length > 0

  const totals = useMemo(() => {
    const people = yearEntries.length + Number(draftIsCounted)

    const given = yearEntries.filter((entry) => entry.given).length

    const expected = yearEntries.reduce(
      (total, entry) => total + (yearAmount ?? entry.amount ?? 0),
      draftIsCounted ? draftAmount ?? 0 : 0,
    )

    const collected = yearEntries.reduce((total, entry) => {
      const editedAmount = amountEdits[entry.id]

      const amount =
        yearAmount !== undefined
          ? yearAmount
          : editedAmount === undefined
          ? entry.amount
          : editedAmount.trim() === ""
            ? null
            : Number(editedAmount)

      return (
        total +
        (entry.given &&
        amount !== null &&
        Number.isFinite(amount) &&
        amount >= 0
          ? amount
          : 0)
      )
    }, 0)

    return {
      people,

      given,

      pending: people - given,

      collected,
      expected,
      outstanding: Math.max(0, expected - collected),
    }
  }, [amountEdits, draftAmount, draftIsCounted, yearAmount, yearEntries])

  useEffect(() => {
    setYearAmountDraft(yearAmount === undefined ? "" : String(yearAmount))
    setYearAmountError("")
    setYearAmountNotice("")
  }, [selectedYear, yearAmount])

  async function saveYearAmount() {
    const trimmed = yearAmountDraft.trim()
    const amount = Number(trimmed)

    if (!trimmed || !Number.isFinite(amount) || amount < 0) {
      setYearAmountError("Enter a valid yearly amount of zero or more.")
      return
    }

    setSavingYearAmount(true)
    setYearAmountError("")
    setYearAmountNotice("")

    try {
      if (cloudMode) await saveCloudBatwaaraYearAmount(selectedYear, amount)
      else saveLocalBatwaaraYearAmount(selectedYear, amount)

      setYearAmounts((current) => ({ ...current, [selectedYear]: amount }))
      setAmountEdits({})
      setYearAmountNotice(`The Batwaara amount for ${selectedYear} is now ${formatCurrency(amount)} for everyone.`)
    } catch (error) {
      setYearAmountError(entryErrorMessage(error))
    } finally {
      setSavingYearAmount(false)
    }
  }

  function updateDraft(field: keyof Omit<EntryDraft, "id">, value: string) {
    setDrafts((current) => {
      const draft = current[selectedYear] ?? createDraft()

      return { ...current, [selectedYear]: { ...draft, [field]: value } }
    })

    setNewEntryError("")

    setNewEntryNotice("")
  }

  function setUpdatedEntry(entry: BatwaaraEntry) {
    const nextEntries = entriesRef.current.map((existing) =>
      existing.id === entry.id ? entry : existing,
    )

    entriesRef.current = nextEntries

    setEntries(nextEntries)

    dirtyIds.current.add(entry.id)

    setEntryErrors((current) => ({ ...current, [entry.id]: "" }))
  }

  async function saveEntry(entry: BatwaaraEntry): Promise<boolean> {
    const pending = saveQueues.current.get(entry.id)

    if (pending) {
      await pending

      const latest = entriesRef.current.find(
        (current) => current.id === entry.id,
      )

      if (latest && dirtyIds.current.has(entry.id)) return saveEntry(latest)

      return true
    }

    setSavingIds((current) => new Set(current).add(entry.id))

    setEntryErrors((current) => ({ ...current, [entry.id]: "" }))

    const operation = (async () => {
      try {
        await onSave(entry)

        return true
      } catch (error) {
        setEntryErrors((current) => ({
          ...current,
          [entry.id]: entryErrorMessage(error),
        }))

        return false
      } finally {
        setSavingIds((current) => {
          const next = new Set(current)

          next.delete(entry.id)

          return next
        })

        saveQueues.current.delete(entry.id)
      }
    })()

    saveQueues.current.set(entry.id, operation)

    const saved = await operation

    if (!saved) return false

    const latest = entriesRef.current.find((current) => current.id === entry.id)

    if (latest && !sameEntry(latest, entry)) return saveEntry(latest)

    dirtyIds.current.delete(entry.id)

    setEntryErrors((current) => ({ ...current, [entry.id]: "" }))

    return true
  }

  async function saveNewEntry() {
    if (submitLock.current) return

    const name = currentDraft.name.trim()

    if (!name) {
      setNewEntryError("Enter a name before saving this row.")

      nameInput.current?.focus()

      return
    }

    if (
      currentDraft.amount.trim() &&
      (!Number.isFinite(draftAmount) || draftAmount === null || draftAmount < 0)
    ) {
      setNewEntryError("Enter a valid amount of zero or more.")

      return
    }

    submitLock.current = true

    setSavingNewEntry(true)

    setNewEntryError("")

    setNewEntryNotice("")

    const member = members.find(
      (candidate) =>
        candidate.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
    )

    const entry: BatwaaraEntry = {
      id: currentDraft.id || crypto.randomUUID(),

      year: selectedYear,

      memberId: member?.id ?? null,

      name,

      amount: draftAmount,

      given: false,

      createdAt: new Date().toISOString(),
    }

    try {
      await onSave(entry)

      const nextEntries = [...entriesRef.current, entry]

      entriesRef.current = nextEntries

      setEntries(nextEntries)

      setDrafts((current) => ({ ...current, [selectedYear]: createDraft() }))

      setNewEntryNotice("Entry saved. The next row is ready.")

      requestAnimationFrame(() => nameInput.current?.focus())
    } catch (error) {
      setNewEntryError(entryErrorMessage(error))
    } finally {
      submitLock.current = false

      setSavingNewEntry(false)
    }
  }

  async function toggleGiven(entry: BatwaaraEntry) {
    const updated = { ...entry, given: !entry.given }

    setUpdatedEntry(updated)

    await saveEntry(updated)
  }

  function saveAmount(entry: BatwaaraEntry) {
    const rawAmount = amountEdits[entry.id]

    if (rawAmount === undefined) return

    if (
      rawAmount.trim() !== "" &&
      (!Number.isFinite(Number(rawAmount)) || Number(rawAmount) < 0)
    ) {
      setEntryErrors((current) => ({
        ...current,
        [entry.id]: "Enter a valid amount of zero or more.",
      }))

      return
    }

    const updated = {
      ...entry,
      amount: rawAmount.trim() === "" ? null : Number(rawAmount),
    }

    setUpdatedEntry(updated)

    setAmountEdits((current) => {
      const next = { ...current }

      delete next[entry.id]

      return next
    })

    void saveEntry(updated)
  }

  function changeYear(value: string) {
    const year = Number(value)

    setDrafts((current) =>
      current[year] ? current : { ...current, [year]: createDraft() },
    )

    setSearchParams({ year: value })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Register</span>
            <span>/</span>
            <span className="text-blue-600">Batwaara</span>
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Batwaara {selectedYear}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Set one Batwaara amount for the selected year, then track each
            person’s collection status.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <span>Year</span>
          <select
            aria-label="Select Batwaara year"
            value={selectedYear}
            onChange={(event) => changeYear(event.target.value)}
            className="form-control min-w-[120px] font-semibold text-slate-800"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section aria-labelledby="yearly-amount-title" className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <h3 id="yearly-amount-title" className="font-display text-base font-semibold text-slate-900">Batwaara amount for {selectedYear}</h3>
          <p className="mt-1 max-w-xl text-sm text-slate-500">This amount will be used for everyone in this year, including existing and new entries.</p>
          {yearAmountError && <p role="alert" className="mt-2 text-xs font-medium text-rose-700">{yearAmountError}</p>}
          {yearAmountNotice && <p role="status" className="mt-2 text-xs font-medium text-emerald-700">{yearAmountNotice}</p>}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px] sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Amount per person</span>
            <div className="relative">
              <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
              <input
                aria-label={`Batwaara amount for ${selectedYear}`}
                type="number"
                min="0"
                step="0.01"
                value={yearAmountDraft}
                onChange={(event) => {
                  setYearAmountDraft(event.target.value)
                  setYearAmountError("")
                  setYearAmountNotice("")
                }}
                placeholder="Enter yearly amount"
                className="form-control"
                style={{ paddingLeft: "2rem" }}
              />
            </div>
          </label>
          <button type="button" disabled={savingYearAmount} onClick={() => void saveYearAmount()} className="action-button border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {savingYearAmount ? "Saving…" : "Save amount"}
          </button>
        </div>
      </section>

      <section
        aria-label={`Batwaara ${selectedYear} totals`}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {[
          { label: "People", value: totals.people.toLocaleString("en-IN") },

          { label: "Given", value: totals.given.toLocaleString("en-IN") },

          { label: "Pending", value: totals.pending.toLocaleString("en-IN") },

          { label: "Expected total", value: formatCurrency(totals.expected) },

          { label: "Total collected", value: formatCurrency(totals.collected) },

          { label: "Amount outstanding", value: formatCurrency(totals.outstanding) },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:px-5"
          >
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 font-display text-lg font-semibold tabular-nums text-slate-900">
              {item.value}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(62,39,35,0.055)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-amber-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Collection register
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Collection status saves automatically. Each person uses the same
              yearly Batwaara amount.
            </p>
          </div>
          <div className="flex items-center gap-3 sm:min-w-[320px]">
            <span role="status" className="text-xs font-medium text-slate-500">
              {savingNewEntry ? "Saving…" : ""}
            </span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search Batwaara entries by name</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name..."
                className="form-control min-h-10 bg-white"
              />
            </label>
          </div>
        </div>
        {loadError ? (
          <div className="px-6 py-12 text-center">
            <p role="alert" className="mx-auto max-w-2xl text-sm text-rose-700">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => setLoadRevision((revision) => revision + 1)}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Retry loading register
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                  <th scope="col" className="w-16 px-4 py-3 text-right">
                    No.
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Name
                  </th>
                  <th scope="col" className="w-44 px-3 py-3 text-right">
                    Amount
                  </th>
                  <th scope="col" className="w-36 px-5 py-3 text-center">
                    Collection
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      Loading Batwaara {selectedYear}…
                    </td>
                  </tr>
                ) : (
                  filteredYearEntries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className="border-t border-slate-100 transition-colors hover:bg-amber-50/40"
                    >
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-400">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm font-medium text-slate-800">
                          {entry.name}
                        </span>
                        {entry.memberId && (
                          <span className="ml-2 text-[10px] text-slate-400">
                            Member
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          aria-label={`Amount for ${entry.name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={yearAmount !== undefined
                            ? String(yearAmount)
                            : amountEdits[entry.id] ??
                              (entry.amount === null ? "" : String(entry.amount))}
                          disabled={yearAmount !== undefined}
                          onChange={(event) =>
                            setAmountEdits((current) => ({
                              ...current,
                              [entry.id]: event.target.value,
                            }))
                          }
                          onBlur={() => saveAmount(entry)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()

                              saveAmount(entry)

                              requestAnimationFrame(() =>
                                nameInput.current?.focus(),
                              )
                            }
                          }}
                          placeholder="—"
                          className="h-10 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-sm tabular-nums text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:text-slate-500"
                        />
                      </td>
                      <td className="px-5 py-2 text-center">
                        <button
                          type="button"
                          aria-pressed={entry.given}
                          aria-label={`${entry.name}: ${
                            entry.given ? "Given" : "Not given"
                          }. Toggle status`}
                          disabled={savingIds.has(entry.id)}
                          onClick={() => void toggleGiven(entry)}
                          className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 ${
                            entry.given
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-800"
                          }`}
                        >
                          <span aria-hidden="true">
                            {entry.given ? "✓" : "○"}
                          </span>
                          {entry.given ? "Given" : "Not given"}
                        </button>
                        {savingIds.has(entry.id) && (
                          <span className="ml-2 text-[10px] text-slate-400">
                            Saving
                          </span>
                        )}
                        {entryErrors[entry.id] && (
                          <div className="mt-1 text-left">
                            <p
                              role="alert"
                              className="text-[11px] text-rose-700"
                            >
                              {entryErrors[entry.id]}
                            </p>
                            <button
                              type="button"
                              onClick={() => void saveEntry(entry)}
                              className="text-[11px] font-semibold text-blue-700 underline"
                            >
                              Retry save
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                {!loading && search.trim() && filteredYearEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                      No Batwaara entries match “{search.trim()}”.
                    </td>
                  </tr>
                )}
                {!loading && (
                  <tr className="border-t-2 border-amber-200 bg-amber-50/40">
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-400">
                      {String(yearEntries.length + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        ref={nameInput}
                        autoFocus
                        aria-label="Next person name"
                        value={currentDraft.name}
                        onChange={(event) =>
                          updateDraft("name", event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()

                            void saveNewEntry()
                          }
                        }}
                        placeholder="Type the next person’s name"
                        className="h-10 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label="Next person amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={yearAmount !== undefined ? String(yearAmount) : currentDraft.amount}
                        disabled={yearAmount !== undefined}
                        onChange={(event) =>
                          updateDraft("amount", event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()

                            void saveNewEntry()
                          }
                        }}
                        placeholder="Amount"
                        className="h-10 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-sm tabular-nums text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:text-slate-500"
                      />
                    </td>
                    <td className="px-5 py-2 text-center">
                      <span className="inline-flex min-w-28 items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                        <span aria-hidden="true">○</span>Not given
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loadError && (
          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p
              role={newEntryError ? "alert" : "status"}
              className={`min-h-5 text-xs ${newEntryError ? "text-rose-700" : "text-emerald-700"}`}
            >
              {newEntryError || newEntryNotice}
            </p>
            <div className="flex items-center gap-3">
              {savingNewEntry && (
                <span className="text-xs font-medium text-slate-500">
                  Saving entry…
                </span>
              )}
              {newEntryError && (
                <button
                  type="button"
                  onClick={() => void saveNewEntry()}
                  className="text-xs font-semibold text-blue-700 underline"
                >
                  Retry save
                </button>
              )}
              {newEntryError && (
                <button
                  type="button"
                  onClick={() => {
                    setDrafts((current) => ({
                      ...current,
                      [selectedYear]: createDraft(),
                    }))
                    setNewEntryError("")
                    setNewEntryNotice("")
                  }}
                  className="text-xs font-semibold text-slate-500 underline"
                >
                  Clear row
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
