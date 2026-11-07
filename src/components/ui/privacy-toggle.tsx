import { Eye, EyeOff } from 'lucide-react'
import { setPrivacy, usePrivacy } from '@/lib/privacy'

/** Eye button that hides earnings and project counts (for screen sharing). */
export function PrivacyToggle() {
  const hidden = usePrivacy()
  const label = hidden ? 'Show amounts' : 'Hide amounts'
  return (
    <button type="button" className={`btn btn-icon${hidden ? ' on' : ''}`} aria-pressed={hidden} aria-label={label} title={label} onClick={() => setPrivacy(!hidden)}>
      {hidden ? <EyeOff className="i" /> : <Eye className="i" />}
    </button>
  )
}
