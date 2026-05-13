export const revalidate = 3600

import { getOpportunities } from '@/lib/ghl'

export async function GET() {
  try {
    const data = await getOpportunities()
    return Response.json(data)
  } catch (err) {
    console.error('[GHL opportunities]', err)
    return Response.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }
}
