import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Legacy route — redirects to the centralized Admin panel.
 * Users were removed from the isolated Super Admin sidebar.
 */
export default function LegacyUsersPage() {
  redirect('/admin/dashboard')
}
