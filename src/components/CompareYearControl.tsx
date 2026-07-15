import { useEffect, useState, type FormEvent } from 'react'
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
  useEffect(() => setValue(formatYear(year)), [year])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseYear(value)
    if (parsed === null) return setInvalid(true)
    setInvalid(false)
    onChange(findNearestYearIndex(years, parsed))
  }
  return (
    <form className={`compare-year-control ${invalid ? 'invalid' : ''}`} onSubmit={submit}>
      <label htmlFor="compare-year">Comparison year</label>
      <div><input id="compare-year" value={value} onChange={(event) => setValue(event.target.value)} /><button type="submit">Go</button><button type="button" onClick={onSwap} title="Swap comparison years" aria-label="Swap comparison years"><ArrowLeftRight size={14} /></button></div>
    </form>
  )
}
