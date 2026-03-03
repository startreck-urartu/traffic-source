import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '@/components/layout/DashboardLayout';

function highlightCode(code, highlightPatterns = []) {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const TOKEN_RE =
    /('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(\b(?:const|let|var|await|async|function|return|if|else|import|from|export|default|new)\b)|(&lt;\/?[\w-]+)|(\b(?:true|false|null|undefined)\b)/g;

  return html
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      const isHighlighted = highlightPatterns.some((p) => trimmed.includes(p));

      let tokenized;
      if (trimmed.startsWith('//') || trimmed.startsWith('&lt;!--')) {
        tokenized = '<span class="hl-comment">' + line + '</span>';
      } else {
        tokenized = line.replace(TOKEN_RE, (match, sq, dq, kw, tag, lit) => {
          if (sq || dq) return '<span class="hl-string">' + match + '</span>';
          if (kw) return '<span class="hl-keyword">' + match + '</span>';
          if (tag) return '<span class="hl-tag">' + match + '</span>';
          if (lit) return '<span class="hl-literal">' + match + '</span>';
          return match;
        });
      }

      if (isHighlighted) {
        return '<span class="hl-line">' + tokenized + '</span>';
      }
      return tokenized;
    })
    .join('\n');
}

function CodeBlock({ code, onCopy, highlightPatterns }) {
  const highlighted = useMemo(() => highlightCode(code, highlightPatterns), [code, highlightPatterns]);
  return (
    <div className="code-block">
      <button className="copy-btn" onClick={onCopy}>Copy</button>
      <pre><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
  );
}

export default function SiteSettings() {
  const router = useRouter();
  const { siteId } = router.query;

  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snippetData, setSnippetData] = useState(null);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeMessage, setStripeMessage] = useState('');
  const [stripeError, setStripeError] = useState('');

  useEffect(() => {
    if (!siteId) return;
    (async () => {
      try {
        const [siteRes, snippetRes] = await Promise.all([
          fetch(`/api/sites/${siteId}`),
          fetch(`/api/sites/${siteId}/snippet`),
        ]);
        if (siteRes.ok) {
          const data = await siteRes.json();
          setSite(data.site);
          setStripeSecretKey(data.site.stripe_secret_key || '');
        }
        if (snippetRes.ok) {
          setSnippetData(await snippetRes.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  const handleSaveStripe = async (e) => {
    e.preventDefault();
    setStripeSaving(true);
    setStripeMessage('');
    setStripeError('');
    try {
      const body = {};
      if (stripeSecretKey && !stripeSecretKey.startsWith('••••')) {
        body.stripe_secret_key = stripeSecretKey;
      }
      if (Object.keys(body).length === 0) {
        setStripeMessage('No changes to save');
        return;
      }
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStripeSecretKey(data.site.stripe_secret_key || '');
      setStripeMessage('Stripe key saved');
    } catch (err) {
      setStripeError(err.message);
    } finally {
      setStripeSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this site and all its data?')) return;
    await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    router.push('/sites');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (loading || !site) {
    return (
      <>
        <Head><title>Settings - Traffic Source</title></Head>
        <DashboardLayout siteId={siteId}>
          <div className="loading-inline"><div className="loading-spinner" /></div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Settings - {site.name} - Traffic Source</title>
      </Head>
      <DashboardLayout siteId={siteId} siteName={site.name} siteDomain={site.domain}>
        <h2 className="page-title">Site Settings</h2>

        {/* ── Tracking Snippet ── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-tabs">
              <button className="panel-tab active">Tracking Code</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 20 }}>
            {snippetData ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Add this snippet to your website&apos;s HTML, before the closing &lt;/head&gt; tag:
                </p>
                <CodeBlock
                  code={snippetData.trackingSnippet}
                  onCopy={() => copyToClipboard(snippetData.trackingSnippet)}
                />

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 16 }}>
                  For Stripe conversion tracking, pass the tracking cookies as metadata in your checkout:
                </p>
                <CodeBlock
                  code={snippetData.stripeSnippet}
                  onCopy={() => copyToClipboard(snippetData.stripeSnippet)}
                  highlightPatterns={['metadata', 'ts_visitor_id', 'ts_session_id']}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Traffic Source will automatically sync payments from Stripe. No webhook setup needed.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Could not load snippet data.</p>
            )}
          </div>
        </div>

        {/* ── Stripe Settings ── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-tabs">
              <button className="panel-tab active">Stripe</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 20 }}>
            {stripeMessage && (
              <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12 }}>
                {stripeMessage}
              </div>
            )}
            {stripeError && <div className="auth-error">{stripeError}</div>}
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Enter your Stripe Secret Key. You can find it in your Stripe Dashboard under Developers &gt; API keys.
              Traffic Source will automatically sync your payments &mdash; no webhook setup required.
            </p>
            <form onSubmit={handleSaveStripe} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Stripe Secret Key</label>
                <input
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_live_..."
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={stripeSaving} style={{ alignSelf: 'flex-start' }}>
                {stripeSaving ? 'Saving...' : 'Save Key'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="panel" style={{ borderColor: 'var(--danger, #e53e3e)' }}>
          <div className="panel-header">
            <div className="panel-tabs">
              <button className="panel-tab active" style={{ color: 'var(--danger, #e53e3e)' }}>Danger Zone</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Permanently delete <strong>{site.name}</strong> and all its analytics data. This action cannot be undone.
            </p>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete Site
            </button>
          </div>
        </div>

      </DashboardLayout>
    </>
  );
}
