import { redirect } from 'next/navigation'

export default function OnboardingPage() {
  // Onboarding is now handled by the OnboardingProvider overlay in the main layout.
  // This page just redirects to dashboard where the provider will show the onboarding if needed.
  redirect('/dashboard')
}
