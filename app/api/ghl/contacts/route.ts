export const revalidate = 3600

import { getContacts } from '@/lib/ghl'

export async function GET() {
  try {
    const data = await getContacts()
    return Response.json(data)
  } catch (err) {
    console.error('[GHL contacts]', err)
    return Response.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}
