export const revalidate = 3600

import { getPipelines } from '@/lib/ghl'

export async function GET() {
  try {
    const data = await getPipelines()
    return Response.json(data)
  } catch (err) {
    console.error('[GHL pipelines]', err)
    return Response.json({ error: 'Failed to fetch pipelines' }, { status: 500 })
  }
}
