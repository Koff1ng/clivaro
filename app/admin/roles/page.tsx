import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Legacy route — redirects to the centralized Admin panel.
 * Roles were removed from the isolated Super Admin sidebar.
 */
export default function LegacyRolesPage() {
  redirect('/admin/dashboard')
}
