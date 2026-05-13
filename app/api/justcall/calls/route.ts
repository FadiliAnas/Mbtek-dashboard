export const revalidate = 3600

import { getCalls } from '@/lib/justcall'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days') ?? '90')

  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)

  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  try {
    const data = await getCalls(fromStr, toStr)
    return Response.json(data)
  } catch (err) {
    console.error('[JustCall calls]', err)
    return Response.json({ error: 'Failed to fetch calls' }, { status: 500 })
  }
}
