import { useEffect } from 'react'

const SEEN_KEY = 'whoatemypaycheck:how-it-works-seen'

interface HowItWorksModalProps {
  open: boolean
  onClose: () => void
}

export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="hiw-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="How WhoAteMyPaycheck works">
      <div className="hiw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="hiw-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="hiw-title">We care about your privacy</h2>

        <section className="hiw-section">
          <h3 className="hiw-section-title">Your data never leaves your browser</h3>
          <p>
            This is a fully client-side app. Your CSV files are parsed locally in your browser — no
            upload, no server, no account. The only outbound request is to Anthropic's Claude API
            for categorization, and even then we only send merchant names and amounts (never account
            numbers, balances, or personal details).
          </p>
        </section>

        <section className="hiw-section">
          <h3 className="hiw-section-title">Getting an Anthropic API key</h3>
          <ol className="hiw-steps">
            <li>Go to <strong>console.anthropic.com</strong> and create a free account.</li>
            <li>In the sidebar, click <strong>API Keys</strong> → <strong>Create Key</strong>.</li>
            <li>Copy the key (it starts with <code>sk-ant-</code>) and paste it into the API key field at the top of this page.</li>
            <li>The key is stored only in your browser's session memory — it disappears when you close the tab.</li>
            <li>Save it somewhere you can find it later.</li>
          </ol>
          <p className="hiw-note">
            Categorizing a month of transactions typically costs a few cents. You only pay for what you use.
          </p>
        </section>

        <section className="hiw-section">
          <h3 className="hiw-section-title">How categorization works</h3>
          <p>
            When you click <em>Categorize with Claude</em>, the app sends batches of merchant names
            and amounts directly from your browser to Claude. Claude assigns each transaction a
            category and subcategory. Results are cached in your session so re-categorizing is
            instant for anything already seen.
          </p>
        </section>

        <section className="hiw-section">
          <h3 className="hiw-section-title">What we don't do</h3>
          <ul className="hiw-list">
            <li>No analytics or tracking — there is no telemetry.</li>
            <li>No login or account required.</li>
            <li>No data stored on any server we control.</li>
            <li>No bank credentials — you export CSVs yourself.</li>
          </ul>
        </section>

        <button className="hiw-cta" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}

export function getHowItWorksSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

export function markHowItWorksSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
}
