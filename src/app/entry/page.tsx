'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import EntryDetailClient from './EntryDetailClient'

function EntryPageInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  if (!id) return <div className="p-8 text-center" style={{ color: '#6b7280' }}>No entry ID provided.</div>
  return <EntryDetailClient id={id} />
}

export default function EntryPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse"><div className="h-8 w-48 rounded-lg" style={{ background: '#161618' }} /></div>}>
      <EntryPageInner />
    </Suspense>
  )
}
