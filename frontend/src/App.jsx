import { useEffect, useState } from 'react'
import {
  Cloud,
  ExternalLink,
  RefreshCw,
  Rocket,
  RotateCw,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import {
  createDeployment,
  deleteDeployment,
  getDeployments,
  getLogs,
  restartDeployment,
} from './api'

const statusStyles = {
  running: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  building: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  stopped: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status] || statusStyles.stopped}`}
    >
      {status === 'building' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
      )}
      {status}
    </span>
  )
}

function App() {
  const [deployments, setDeployments] = useState([])
  const [name, setName] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [error, setError] = useState('')
  const [logsDeployment, setLogsDeployment] = useState(null)
  const [logs, setLogs] = useState('')
  const [loadingLogs, setLoadingLogs] = useState(false)

  const loadDeployments = async () => {
    try {
      const data = await getDeployments()
      setDeployments(data)
      setError('')
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Unable to reach the CampusCloud API.')
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadDeployments, 0)
    const interval = window.setInterval(loadDeployments, 5000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [])

  const handleDeploy = async (event) => {
    event.preventDefault()
    if (!name.trim() || !repoUrl.trim()) return

    setDeploying(true)
    setError('')
    try {
      await createDeployment(name.trim(), repoUrl.trim())
      setName('')
      setRepoUrl('')
      await loadDeployments()
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Failed to start deployment.')
    } finally {
      setDeploying(false)
    }
  }

  const refreshLogs = async (deployment) => {
    setLoadingLogs(true)
    try {
      const data = await getLogs(deployment.id)
      setLogs(data.logs ?? '')
    } catch (requestError) {
      setLogs(requestError?.response?.data?.detail || 'Unable to load logs.')
    } finally {
      setLoadingLogs(false)
    }
  }

  const openLogs = async (deployment) => {
    setLogsDeployment(deployment)
    setLogs('')
    await refreshLogs(deployment)
  }

  const handleRestart = async (deployment) => {
    setActionId(deployment.id)
    setError('')
    try {
      await restartDeployment(deployment.id)
      await loadDeployments()
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Failed to restart container.')
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (deployment) => {
    setActionId(deployment.id)
    setError('')
    try {
      await deleteDeployment(deployment.id)
      await loadDeployments()
      if (logsDeployment?.id === deployment.id) setLogsDeployment(null)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Failed to delete deployment.')
    } finally {
      setActionId(null)
    }
  }

  const runningCount = deployments.filter((deployment) => deployment.status === 'running').length

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#090d14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-400">
              <Cloud size={20} />
            </div>
            <span className="text-lg font-bold tracking-tight">CampusCloud</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {runningCount} active
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-white/8 bg-[#111722] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
              <Rocket size={18} />
            </div>
            <h1 className="text-lg font-semibold">Deploy New Project</h1>
          </div>
          <form onSubmit={handleDeploy} className="grid gap-3 lg:grid-cols-[1fr_1.4fr_auto]">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="App Name"
              required
              className="h-11 rounded-lg border border-white/10 bg-[#090d14] px-4 text-sm outline-none placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10"
            />
            <input
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="GitHub Repo URL"
              type="url"
              required
              className="h-11 rounded-lg border border-white/10 bg-[#090d14] px-4 text-sm outline-none placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10"
            />
            <button
              type="submit"
              disabled={deploying}
              className="h-11 min-w-32 rounded-lg bg-sky-500 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-500/10 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deploying ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin" /> Deploying
                </span>
              ) : (
                'Deploy'
              )}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Deployments</h2>
            <span className="text-xs text-slate-500">{deployments.length} total</span>
          </div>

          {deployments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <Cloud className="mx-auto mb-3 text-slate-600" size={32} />
              <p className="text-sm text-slate-400">No deployments yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {deployments.map((deployment) => (
                <article
                  key={deployment.id}
                  className="rounded-2xl border border-white/8 bg-[#111722] p-5 shadow-xl shadow-black/10"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="truncate text-base font-semibold">{deployment.name}</h3>
                    <StatusBadge status={deployment.status} />
                  </div>

                  <div className="mb-5 space-y-3">
                    <p className="truncate text-xs text-slate-500" title={deployment.repo_url}>
                      {deployment.repo_url}
                    </p>
                    {deployment.status === 'running' && (
                      <a
                        href={`http://localhost:${deployment.port}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 hover:text-sky-300"
                      >
                        http://localhost:{deployment.port}
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <p className="font-mono text-xs text-slate-500">
                      Container: {deployment.container_id ? deployment.container_id.slice(0, 12) : '—'}
                    </p>
                  </div>

                  {deployment.status === 'failed' && deployment.error_message && (
                    <p className="mb-4 line-clamp-2 text-xs text-red-400">
                      {deployment.error_message}
                    </p>
                  )}

                  <div className="flex gap-2 border-t border-white/6 pt-4">
                    <button
                      type="button"
                      onClick={() => openLogs(deployment)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5"
                    >
                      <Terminal size={14} /> Logs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestart(deployment)}
                      disabled={!deployment.container_id || actionId === deployment.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCw size={14} /> Restart
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(deployment)}
                      disabled={actionId === deployment.id}
                      className="flex items-center justify-center rounded-lg border border-red-500/15 px-3 py-2 text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                      aria-label={`Delete ${deployment.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {logsDeployment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex h-[70vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f16] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-sm font-semibold">{logsDeployment.name} Logs</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">
                  {logsDeployment.container_id?.slice(0, 12) || 'build logs'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogsDeployment(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close logs"
              >
                <X size={18} />
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-slate-300">
              {loadingLogs ? 'Loading logs...' : logs || 'No logs available.'}
            </pre>
            <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-3">
              <button
                type="button"
                onClick={() => refreshLogs(logsDeployment)}
                disabled={loadingLogs}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setLogsDeployment(null)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
