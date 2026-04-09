import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Legacy route — redirects to the centralized Audit panel.
 * Legal-logs are now part of the unified Audit & Support module.
 */
export default function LegacyLegalLogsPage() {
  redirect('/admin/audit')
}
