import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { findNearestYearIndex, formatYear, parseYear } from '../lib/time'

interface CompareYearControlProps {
  years: number[]
  year: number
  onChange: (index: number) => void
  onSwap: () => void
}

export function CompareYearControl({ years, year, onChange, onSwap }: CompareYearControlProps) {
  const [value, setValue] = useState(formatYear(year))
  const [invalid, setInvalid] = useState(false)
  const [adjustment, setAdjustment] = useState<string | null>(null)
  const submittedYearRef = useRef<number | null>(null)
  useEffect(() => {
    setValue(formatYear(year))
    setInvalid(false)
    if (submittedYearRef.current !== year) setAdjustment(null)
    submittedYearRef.current = null
  }, [year])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseYear(value)
    if (parsed === null) {
      setAdjustment(null)
      setInvalid(true)
      return
    }
    const nextIndex = findNearestYearIndex(years, parsed)
    const resolvedYear = years[nextIndex]
    if (resolvedYear === undefined) {
      setAdjustment(null)
      setInvalid(true)
      return
    }
    setInvalid(false)
    setValue(formatYear(resolvedYear))
    setAdjustment(resolvedYear === parsed ? null : `Nearest timeline step: ${formatYear(resolvedYear)}.`)
    submittedYearRef.current = resolvedYear
    onChange(nextIndex)
  }
  const describedBy = invalid ? 'compare-year-error' : adjustment ? 'compare-year-status' : undefined
  return (
    <form className={`compare-year-control ${invalid ? 'invalid' : ''}`} onSubmit={submit}>
      <label htmlFor="compare-year">Comparison year</label>
      <div><input id="compare-year" value={value} placeholder="323 BCE" autoComplete="off" spellCheck={false} enterKeyHint="go" aria-invalid={invalid} aria-describedby={describedBy} onChange={(event) => { setValue(event.target.value); setInvalid(false); setAdjustment(null) }} /><button type="submit">Go</button><button type="button" onClick={onSwap} title="Swap comparison years" aria-label="Swap comparison years"><ArrowLeftRight size={14} /></button></div>
      {invalid && <small id="compare-year-error" className="field-error" role="alert">Try 323 BCE or 1492 CE.</small>}
      {adjustment && <small id="compare-year-status" className="field-status" role="status" aria-live="polite">{adjustment}</small>}
    </form>
  )
}
