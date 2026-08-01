import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(undefined)
    setLoading(true)
    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (authError) {
      setError(authError.message)
      return
    }
    if (mode === 'signup') toast.success('Account created', { description: 'Check your inbox to confirm your email.' })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary shadow-sm">
            <img src="/mydesk-fire.png" alt="" className="size-5.5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">MyDesk</span>
        </div>
        <div className="rounded-xl border bg-surface p-6 shadow-sm">
          <h1 className="text-base font-semibold">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mode === 'signin' ? 'Sign in to your workspace.' : 'Start managing clients and projects.'}
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Email" required error={error ? ' ' : undefined}>
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
              />
            </Field>
            <Field
              label="Password"
              required
              error={error}
              hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            >
              <Input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          {mode === 'signin' ? 'No account yet?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(undefined)
            }}
            className="font-medium text-primary hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  )
}
