import { useState } from 'react'
import { Bell, BellOff, BellRing, CheckCircle, Loader, Send } from 'lucide-react'
import { useNotifications, type PushState } from '../hooks/useNotifications'
import { sendTestPush } from '../api/push'

const label: Record<PushState, string> = {
  loading:     'Checking notification status…',
  subscribed:  'Push notifications enabled',
  prompt:      'Push notifications not enabled',
  denied:      'Notifications blocked',
  unsupported: 'Notifications not supported',
}

const desc: Record<PushState, string> = {
  loading:     '',
  subscribed:  'You will receive background reminders even when the app is closed.',
  prompt:      'Tap the button below to receive reminders for recurring tasks.',
  denied:      'Enable notifications in your device settings, then revisit this page.',
  unsupported: 'Your browser does not support push notifications.',
}

function StatusIcon({ state }: { state: PushState }) {
  if (state === 'loading')    return <Loader size={20} className="text-muted animate-spin" />
  if (state === 'subscribed') return <BellRing size={20} className="text-purple" />
  if (state === 'denied')     return <BellOff size={20} className="text-pink" />
  return <Bell size={20} className="text-muted" />
}

export default function SettingsView() {
  const { state, subscribe, unsubscribe } = useNotifications()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'err' | null>(null)

  async function handleTestPush() {
    setTesting(true)
    setTestResult(null)
    try {
      await sendTestPush()
      setTestResult('ok')
    } catch {
      setTestResult('err')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="px-5 flex flex-col gap-6">
      <div className="bg-card rounded-2xl p-5 flex flex-col gap-4">

        {/* Status row */}
        <div className="flex items-center gap-3">
          <StatusIcon state={state} />
          <div>
            <p className="text-white text-sm font-semibold">{label[state]}</p>
            {desc[state] && (
              <p className="text-muted text-xs mt-0.5">{desc[state]}</p>
            )}
          </div>
        </div>

        {/* Enable button */}
        {state === 'prompt' && (
          <button
            onClick={subscribe}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
              text-sm font-semibold bg-purple text-white active:bg-purple/80 transition-colors"
          >
            <Bell size={16} />
            Enable push notifications
          </button>
        )}

        {/* Already subscribed: test + disable */}
        {state === 'subscribed' && (
          <>
            <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
              text-sm font-semibold bg-purple/10 text-purple">
              <CheckCircle size={16} />
              Notifications active
            </div>

            <button
              onClick={handleTestPush}
              disabled={testing}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                text-sm font-semibold bg-card2 text-white active:bg-card2/80 transition-colors
                disabled:opacity-50"
            >
              {testing
                ? <Loader size={16} className="animate-spin" />
                : <Send size={16} />}
              {testing ? 'Sending…' : 'Send test notification'}
            </button>

            {testResult === 'ok' && (
              <p className="text-center text-xs text-purple">
                Test sent — you should receive it shortly.
              </p>
            )}
            {testResult === 'err' && (
              <p className="text-center text-xs text-pink">
                Failed to send. Check that the server has valid VAPID keys.
              </p>
            )}

            <button
              onClick={unsubscribe}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl
                text-xs font-medium text-muted hover:text-pink transition-colors"
            >
              Disable notifications
            </button>
          </>
        )}

      </div>
    </div>
  )
}
