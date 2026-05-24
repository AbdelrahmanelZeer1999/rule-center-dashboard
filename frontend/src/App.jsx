import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  CheckCircle2, Activity, Terminal, FileJson, BookOpen, Trash2,
  Upload, Plus, AlertCircle, ChevronRight, Search, Wifi, WifiOff,
  Sun, Moon,
} from 'lucide-react';

// ─── Supabase connection ────────────────────────────────────────
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://hakuokjtqygenmczrmdr.supabase.co';

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3Vva2p0cXlnZW5tY3pybWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDAxMDQsImV4cCI6MjA5NTIxNjEwNH0.lCyVwbdk9nuWzEEhvbld8y2htdO3TjWY2AUBc5ZPjak';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function handleRes(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const body = await res.text(); if (body) msg += ` — ${body}`; } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const api = {
  async list() {
    const url = `${SUPABASE_URL}/rest/v1/test_runs?select=*,test_results(*)&order=timestamp.desc`;
    const data = await handleRes(await fetch(url, { headers }));
    return (data || []).map(run => ({
      runId: run.run_id,
      timestamp: run.timestamp,
      suite: run.suite,
      environment: run.environment,
      tests: (run.test_results || []).map(t => ({
        name: t.name,
        endpoint: t.endpoint,
        status: t.status,
        duration: t.duration,
        statusCode: t.status_code,
        errorMessage: t.error_message,
      })),
    }));
  },

  async submit(run) {
    const runId = run.runId || `run_${Date.now()}`;
    const timestamp = run.timestamp || new Date().toISOString();

    // 1. Insert the run row
    await handleRes(await fetch(`${SUPABASE_URL}/rest/v1/test_runs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        run_id: runId,
        suite: run.suite || 'Unnamed Suite',
        environment: run.environment || 'unknown',
        timestamp,
      }),
    }));

    // 2. Insert the result rows (if any)
    if (run.tests && run.tests.length > 0) {
      const results = run.tests.map(t => ({
        run_id: runId,
        name: t.name,
        endpoint: t.endpoint || null,
        status: t.status,
        duration: t.duration ?? 0,
        status_code: t.statusCode ?? 0,
        error_message: t.errorMessage || null,
      }));
      try {
        await handleRes(await fetch(`${SUPABASE_URL}/rest/v1/test_results`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(results),
        }));
      } catch (e) {
        // Clean up orphan run
        await fetch(`${SUPABASE_URL}/rest/v1/test_runs?run_id=eq.${encodeURIComponent(runId)}`, {
          method: 'DELETE',
          headers,
        });
        throw e;
      }
    }

    return { runId, tests: run.tests || [] };
  },

  async delete(runId) {
    await handleRes(await fetch(
      `${SUPABASE_URL}/rest/v1/test_runs?run_id=eq.${encodeURIComponent(runId)}`,
      { method: 'DELETE', headers }
    ));
  },

  async clear() {
    await handleRes(await fetch(
      `${SUPABASE_URL}/rest/v1/test_runs?run_id=neq.__no_match__`,
      { method: 'DELETE', headers }
    ));
  },
};

// ─── Sample seed data ───────────────────────────────────────────
const SEED_RUNS = [
  {
    runId: `seed_${Date.now()}_1`,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    suite: 'RuleEvaluationTests',
    environment: 'staging',
    tests: [
      { name: 'shouldCreateNewRule', endpoint: 'POST /api/rules', status: 'PASS', duration: 142, statusCode: 201 },
      { name: 'shouldFetchRuleById', endpoint: 'GET /api/rules/{id}', status: 'PASS', duration: 78, statusCode: 200 },
      { name: 'shouldEvaluateRuleAgainstPayload', endpoint: 'POST /api/rules/evaluate', status: 'PASS', duration: 234, statusCode: 200 },
      { name: 'shouldRejectInvalidRuleSyntax', endpoint: 'POST /api/rules', status: 'FAIL', duration: 156, statusCode: 500, errorMessage: 'Expected 400 but got 500 — server error not validation error' },
      { name: 'shouldListAllActiveRules', endpoint: 'GET /api/rules', status: 'PASS', duration: 89, statusCode: 200 },
      { name: 'shouldDeleteRuleById', endpoint: 'DELETE /api/rules/{id}', status: 'PASS', duration: 102, statusCode: 204 },
    ],
  },
  {
    runId: `seed_${Date.now()}_2`,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    suite: 'RuleEvaluationTests',
    environment: 'staging',
    tests: [
      { name: 'shouldCreateNewRule', endpoint: 'POST /api/rules', status: 'PASS', duration: 138, statusCode: 201 },
      { name: 'shouldFetchRuleById', endpoint: 'GET /api/rules/{id}', status: 'PASS', duration: 71, statusCode: 200 },
      { name: 'shouldEvaluateRuleAgainstPayload', endpoint: 'POST /api/rules/evaluate', status: 'PASS', duration: 219, statusCode: 200 },
      { name: 'shouldRejectInvalidRuleSyntax', endpoint: 'POST /api/rules', status: 'PASS', duration: 144, statusCode: 400 },
      { name: 'shouldListAllActiveRules', endpoint: 'GET /api/rules', status: 'PASS', duration: 92, statusCode: 200 },
      { name: 'shouldDeleteRuleById', endpoint: 'DELETE /api/rules/{id}', status: 'PASS', duration: 98, statusCode: 204 },
      { name: 'shouldHandleConcurrentRuleUpdates', endpoint: 'PUT /api/rules/{id}', status: 'SKIP', duration: 0, statusCode: 0 },
    ],
  },
];

const SCHEMA_EXAMPLE = `{
  "runId": "run_2026_05_24_001",
  "timestamp": "2026-05-24T14:32:11Z",
  "suite": "RuleEvaluationTests",
  "environment": "staging",
  "tests": [
    {
      "name": "shouldCreateNewRule",
      "endpoint": "POST /api/rules",
      "status": "PASS",
      "duration": 142,
      "statusCode": 201,
      "errorMessage": null
    }
  ]
}`;

const REST_ASSURED_SNIPPET = `// TestNG listener registered in testng.xml posts to Supabase
// Configure via system properties:
//   -Ddashboard.url=https://hakuokjtqygenmczrmdr.supabase.co
//   -Ddashboard.key=<anon-key>
//   -Ddashboard.env=staging`;

// ─── Helpers ────────────────────────────────────────────────────
const formatTime = (iso) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const getChartColors = (theme) => theme === 'light' ? {
  pass: '#059669', fail: '#dc2626', skip: '#d97706',
  gridStroke: '#e7e5e4', axisStroke: '#a8a29e',
  tooltipBg: '#ffffff', tooltipBorder: '#d6d3d1', tooltipText: '#1c1917',
  hoverBar: 'rgba(0, 0, 0, 0.04)', pieStroke: '#ffffff',
} : {
  pass: '#00ff9d', fail: '#ff4868', skip: '#ffb648',
  gridStroke: '#1a1a1a', axisStroke: '#525252',
  tooltipBg: '#0a0a0a', tooltipBorder: '#262626', tooltipText: '#e8e8e3',
  hoverBar: 'rgba(255, 255, 255, 0.03)', pieStroke: '#0a0a0a',
};

// ─── Sub-components ─────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styleMap = {
    PASS: { color: 'var(--accent)', background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' },
    FAIL: { color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'var(--danger-border)' },
    SKIP: { color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning-border)' },
  };
  const s = styleMap[status] || styleMap.SKIP;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-[0.15em] font-mono border" style={s}>
      <span className="inline-block w-1.5 h-1.5" style={{ backgroundColor: s.color }} />
      {status}
    </span>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div className="p-5 relative overflow-hidden border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
    <div className="absolute top-0 left-0 w-8 h-px" style={{ backgroundColor: accent || 'var(--text-primary)' }} />
    <div className="text-[10px] tracking-[0.2em] font-mono mb-3" style={{ color: 'var(--text-muted)' }}>{label}</div>
    <div className="text-4xl font-mono tabular-nums" style={{ color: accent || 'var(--text-primary)' }}>{value}</div>
    {sub && <div className="text-xs font-mono mt-2" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
);

// ─── Main App ───────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('rc-theme') || 'light'; } catch (e) { return 'light'; }
  });
  const [runs, setRuns] = useState([]);
  const [connected, setConnected] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [jsonInput, setJsonInput] = useState(SCHEMA_EXAMPLE);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalError, setGlobalError] = useState(null);

  const chartColors = useMemo(() => getChartColors(theme), [theme]);

  useEffect(() => {
    try { localStorage.setItem('rc-theme', theme); } catch (e) {}
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const refreshRuns = useCallback(async () => {
    try {
      const data = await api.list();
      setRuns(Array.isArray(data) ? data : []);
      setConnected(true);
      setGlobalError(null);
    } catch (e) {
      setConnected(false);
      setGlobalError(`Cannot connect to Supabase — ${e.message}`);
    }
  }, []);

  useEffect(() => {
    refreshRuns();
    const interval = setInterval(refreshRuns, 10000);
    return () => clearInterval(interval);
  }, [refreshRuns]);

  const loadSeed = async () => {
    try {
      for (const run of SEED_RUNS) await api.submit(run);
      await refreshRuns();
    } catch (e) { setGlobalError(e.message); }
  };

  const clearAll = async () => {
    if (!confirm('Clear all runs? This cannot be undone.')) return;
    try {
      await api.clear();
      setSelectedRunId(null);
      await refreshRuns();
    } catch (e) { setGlobalError(e.message); }
  };

  const deleteRun = async (id) => {
    try {
      await api.delete(id);
      if (selectedRunId === id) setSelectedRunId(null);
      await refreshRuns();
    } catch (e) { setGlobalError(e.message); }
  };

  const handleSubmit = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.tests || !Array.isArray(parsed.tests)) {
        throw new Error('"tests" array is required');
      }
      const saved = await api.submit(parsed);
      setSubmitMessage({ type: 'success', text: `Run added: ${saved.runId} — ${saved.tests.length} tests` });
      await refreshRuns();
      setTimeout(() => setSubmitMessage(null), 4000);
    } catch (e) {
      setSubmitMessage({ type: 'error', text: e.message });
    }
  };

  const stats = useMemo(() => {
    const allTests = runs.flatMap(r => r.tests || []);
    const pass = allTests.filter(t => t.status === 'PASS').length;
    const fail = allTests.filter(t => t.status === 'FAIL').length;
    const skip = allTests.filter(t => t.status === 'SKIP').length;
    const total = allTests.length;
    const rate = total ? ((pass / total) * 100).toFixed(1) : '0.0';
    return { pass, fail, skip, total, rate, totalRuns: runs.length };
  }, [runs]);

  const pieData = useMemo(() => [
    { name: 'PASS', value: stats.pass, color: chartColors.pass },
    { name: 'FAIL', value: stats.fail, color: chartColors.fail },
    { name: 'SKIP', value: stats.skip, color: chartColors.skip },
  ].filter(d => d.value > 0), [stats, chartColors]);

  const trendData = useMemo(() => {
    return runs.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((r, i) => ({
      run: `#${i + 1}`,
      runId: r.runId,
      PASS: (r.tests || []).filter(t => t.status === 'PASS').length,
      FAIL: (r.tests || []).filter(t => t.status === 'FAIL').length,
      SKIP: (r.tests || []).filter(t => t.status === 'SKIP').length,
    }));
  }, [runs]);

  const allTestsFlat = useMemo(() => {
    const out = [];
    runs.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(run => {
      (run.tests || []).forEach(test => {
        out.push({ ...test, runId: run.runId, suite: run.suite, timestamp: run.timestamp, environment: run.environment });
      });
    });
    return out;
  }, [runs]);

  const filteredTests = useMemo(() => {
    return allTestsFlat.filter(t => {
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(t.endpoint || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allTestsFlat, filterStatus, searchQuery]);

  const passRateColor = stats.rate >= 95 ? 'var(--accent)' : stats.rate >= 80 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div dir="ltr" data-theme={theme} className="min-h-screen" style={{
      color: 'var(--text-primary)',
      backgroundImage: 'var(--bg-gradient)',
    }}>
      <header className="sticky top-0 z-20 border-b backdrop-blur" style={{
        borderColor: 'var(--border)',
        background: theme === 'light' ? 'rgba(250, 250, 249, 0.85)' : 'rgba(10, 10, 10, 0.8)',
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2" style={{ background: 'var(--accent)', boxShadow: `0 0 8px var(--accent)` }} />
              <span className="font-mono text-sm tracking-[0.2em]" style={{ color: 'var(--text-primary)' }}>RULE_CENTER</span>
            </div>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span className="font-mono text-xs tracking-wider" style={{ color: 'var(--text-muted)' }}>test_results</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono tracking-wider" style={{ color: 'var(--text-muted)' }}>
            <ConnectionPill connected={connected} />
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span>{stats.totalRuns} RUNS</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span>{stats.total} TESTS</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span style={{ color: passRateColor }}>{stats.rate}% PASS</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <button
              onClick={toggleTheme}
              className="p-1.5 border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={12} /> : <Sun size={12} />}
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 flex gap-1 border-t" style={{ borderColor: 'var(--border)' }}>
          {[
            { id: 'dashboard', label: 'DASHBOARD', icon: Activity },
            { id: 'tests', label: 'TEST_CASES', icon: Terminal },
            { id: 'submit', label: 'SUBMIT_RUN', icon: Upload },
            { id: 'schema', label: 'SCHEMA', icon: BookOpen },
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="flex items-center gap-2 px-4 py-3 text-[10px] tracking-[0.2em] font-mono transition-colors border-b-2"
                style={{
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  borderColor: active ? 'var(--accent)' : 'transparent',
                }}
              >
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {globalError && (
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="px-4 py-3 flex items-center gap-3 text-xs font-mono border"
            style={{ color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'var(--danger-border)' }}>
            <AlertCircle size={14} />
            <span className="flex-1">{globalError}</span>
            <button onClick={refreshRuns} className="text-[10px] tracking-wider hover:underline">RETRY</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        {connected === null ? (
          <div className="text-center py-20 font-mono text-sm" style={{ color: 'var(--text-muted)' }}>connecting to Supabase...</div>
        ) : runs.length === 0 && activeTab !== 'submit' && activeTab !== 'schema' ? (
          <EmptyState onLoadSeed={loadSeed} onSubmit={() => setActiveTab('submit')} connected={connected} />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="TOTAL_TESTS" value={stats.total} sub={`across ${stats.totalRuns} runs`} />
                  <StatCard label="PASSED" value={stats.pass} sub={`${stats.rate}% success rate`} accent="var(--accent)" />
                  <StatCard label="FAILED" value={stats.fail} sub={stats.fail > 0 ? 'needs attention' : 'all green'} accent="var(--danger)" />
                  <StatCard label="SKIPPED" value={stats.skip} sub={stats.skip > 0 ? 'unexecuted' : 'none skipped'} accent="var(--warning)" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="p-5 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                    <div className="text-[10px] tracking-[0.2em] font-mono mb-4" style={{ color: 'var(--text-muted)' }}>DISTRIBUTION</div>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} stroke={chartColors.pieStroke} strokeWidth={2}>
                            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, fontFamily: 'JetBrains Mono', fontSize: '11px' }}
                            itemStyle={{ color: chartColors.tooltipText }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="text-xs text-center py-12 font-mono" style={{ color: 'var(--text-faint)' }}>no data</div>}
                    <div className="flex justify-center gap-4 mt-2">
                      {pieData.map(d => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="w-2 h-2" style={{ background: d.color }} />
                          <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--text-muted)' }}>{d.name} {d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 lg:col-span-2 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                    <div className="text-[10px] tracking-[0.2em] font-mono mb-4" style={{ color: 'var(--text-muted)' }}>RUN_HISTORY</div>
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={trendData}>
                          <CartesianGrid stroke={chartColors.gridStroke} vertical={false} />
                          <XAxis dataKey="run" stroke={chartColors.axisStroke} style={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} />
                          <YAxis stroke={chartColors.axisStroke} style={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} />
                          <Tooltip
                            contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, fontFamily: 'JetBrains Mono', fontSize: '11px' }}
                            itemStyle={{ color: chartColors.tooltipText }}
                            cursor={{ fill: chartColors.hoverBar }}
                          />
                          <Bar dataKey="PASS" stackId="a" fill={chartColors.pass} />
                          <Bar dataKey="FAIL" stackId="a" fill={chartColors.fail} />
                          <Bar dataKey="SKIP" stackId="a" fill={chartColors.skip} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="text-xs text-center py-12 font-mono" style={{ color: 'var(--text-faint)' }}>no runs yet</div>}
                  </div>
                </div>

                <div className="border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                  <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[10px] tracking-[0.2em] font-mono" style={{ color: 'var(--text-muted)' }}>RECENT_RUNS</span>
                    <button onClick={clearAll} className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Trash2 size={11} /> CLEAR_ALL
                    </button>
                  </div>
                  <div>
                    {runs.map((run, idx) => {
                      const tests = run.tests || [];
                      const passed = tests.filter(t => t.status === 'PASS').length;
                      const failed = tests.filter(t => t.status === 'FAIL').length;
                      const skipped = tests.filter(t => t.status === 'SKIP').length;
                      const isOpen = selectedRunId === run.runId;
                      return (
                        <div key={run.runId} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                          <div className="w-full flex items-center transition-colors"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <button
                              onClick={() => setSelectedRunId(isOpen ? null : run.runId)}
                              className="flex-1 px-5 py-4 flex items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-4">
                                <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                                <div>
                                  <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{run.runId}</div>
                                  <div className="text-[10px] font-mono mt-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                    {run.suite} • {run.environment} • {formatTime(run.timestamp)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 font-mono text-xs">
                                {passed > 0 && <span style={{ color: 'var(--accent)' }}>✓ {passed}</span>}
                                {failed > 0 && <span style={{ color: 'var(--danger)' }}>✗ {failed}</span>}
                                {skipped > 0 && <span style={{ color: 'var(--warning)' }}>○ {skipped}</span>}
                              </div>
                            </button>
                            <button
                              onClick={() => deleteRun(run.runId)}
                              className="px-4 py-4 transition-colors"
                              style={{ color: 'var(--text-faint)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
                              title="Delete this run"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {isOpen && (
                            <div style={{ background: 'var(--bg-inset)', borderTop: '1px solid var(--border)' }}>
                              {tests.map((t, i) => (
                                <div key={i} className="px-5 py-3 flex items-start gap-4"
                                  style={{ borderBottom: i === tests.length - 1 ? 'none' : '1px solid var(--border)' }}>
                                  <StatusBadge status={t.status} />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                                    <div className="font-mono text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t.endpoint || '—'}</div>
                                    {t.errorMessage && (
                                      <div className="mt-2 px-2 py-1.5 text-[10px] font-mono border-l-2"
                                        style={{ color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'var(--danger)' }}>
                                        {t.errorMessage}
                                      </div>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-right whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                    {t.duration}ms<br />
                                    {t.statusCode > 0 && <span>HTTP {t.statusCode}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tests' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 border px-3 py-2 flex-1 min-w-[240px]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="search by name or endpoint..."
                      className="bg-transparent outline-none text-xs font-mono w-full"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex gap-1">
                    {['ALL', 'PASS', 'FAIL', 'SKIP'].map(s => {
                      const active = filterStatus === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          className="px-3 py-2 text-[10px] tracking-[0.2em] font-mono border transition-colors"
                          style={{
                            borderColor: active ? 'var(--accent)' : 'var(--border)',
                            color: active ? 'var(--accent)' : 'var(--text-muted)',
                            background: active ? 'var(--accent-bg)' : 'transparent',
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border overflow-x-auto scrollbar" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                  <table className="w-full text-xs">
                    <thead style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)' }}>
                      <tr className="text-left text-[10px] tracking-[0.2em] font-mono" style={{ color: 'var(--text-muted)' }}>
                        <th className="px-4 py-3 font-normal">STATUS</th>
                        <th className="px-4 py-3 font-normal">TEST_NAME</th>
                        <th className="px-4 py-3 font-normal">ENDPOINT</th>
                        <th className="px-4 py-3 font-normal text-right">DURATION</th>
                        <th className="px-4 py-3 font-normal text-right">HTTP</th>
                        <th className="px-4 py-3 font-normal text-right">RUN</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {filteredTests.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--text-faint)' }}>no tests match these filters</td></tr>
                      ) : filteredTests.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{t.name}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{t.endpoint || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t.duration}ms</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{t.statusCode || '—'}</td>
                          <td className="px-4 py-3 text-right text-[10px]" style={{ color: 'var(--text-faint)' }}>{t.runId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  SHOWING {filteredTests.length} OF {allTestsFlat.length} TESTS
                </div>
              </div>
            )}

            {activeTab === 'submit' && (
              <div className="space-y-4 max-w-4xl">
                <div className="p-5 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileJson size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-[10px] tracking-[0.2em] font-mono" style={{ color: 'var(--text-secondary)' }}>SUBMIT_RUN_RESULTS</span>
                  </div>
                  <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Paste JSON below. The dashboard inserts it directly into Supabase.
                  </p>

                  <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    className="w-full h-80 text-xs font-mono p-4 outline-none resize-y scrollbar border"
                    style={{ background: 'var(--bg-inset)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    spellCheck={false}
                  />

                  {submitMessage && (
                    <div className="mt-3 px-3 py-2 text-xs font-mono flex items-center gap-2 border"
                      style={{
                        color: submitMessage.type === 'success' ? 'var(--accent)' : 'var(--danger)',
                        background: submitMessage.type === 'success' ? 'var(--accent-bg)' : 'var(--danger-bg)',
                        borderColor: submitMessage.type === 'success' ? 'var(--accent-border)' : 'var(--danger-border)',
                      }}>
                      {submitMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {submitMessage.text}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSubmit}
                      className="flex items-center gap-2 px-4 py-2 text-[10px] tracking-[0.2em] font-mono font-semibold transition-opacity hover:opacity-90"
                      style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                    >
                      <Plus size={12} /> SUBMIT_RUN
                    </button>
                    <button
                      onClick={() => setJsonInput(SCHEMA_EXAMPLE)}
                      className="flex items-center gap-2 px-4 py-2 border text-[10px] tracking-[0.2em] font-mono transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      RESET_TEMPLATE
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schema' && (
              <div className="space-y-6 max-w-4xl">
                <div className="p-5 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-[10px] tracking-[0.2em] font-mono" style={{ color: 'var(--text-secondary)' }}>JSON_SCHEMA</span>
                  </div>
                  <pre className="p-4 text-xs overflow-x-auto scrollbar border"
                    style={{ background: 'var(--bg-inset)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>{SCHEMA_EXAMPLE}</pre>
                </div>

                <div className="p-5 border" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-[10px] tracking-[0.2em] font-mono" style={{ color: 'var(--text-secondary)' }}>REST_ASSURED_INTEGRATION</span>
                  </div>
                  <pre className="p-4 text-xs overflow-x-auto scrollbar border"
                    style={{ background: 'var(--bg-inset)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>{REST_ASSURED_SNIPPET}</pre>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 py-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[10px] font-mono tracking-wider"
          style={{ color: 'var(--text-faint)' }}>
          <span>RULE_CENTER © {new Date().getFullYear()}</span>
          <span>v0.2.0 • powered by Supabase</span>
        </div>
      </footer>
    </div>
  );
}

function ConnectionPill({ connected }) {
  if (connected === null) return <span style={{ color: 'var(--text-muted)' }}>CONNECTING...</span>;
  if (connected) {
    return (
      <span className="flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
        <Wifi size={10} /> ONLINE
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
      <WifiOff size={10} /> OFFLINE
    </span>
  );
}

function EmptyState({ onLoadSeed, onSubmit, connected }) {
  return (
    <div className="py-20 text-center border border-dashed" style={{ borderColor: 'var(--border-strong)' }}>
      <div className="inline-flex items-center gap-2 mb-4">
        <div className="w-2 h-2" style={{ background: 'var(--text-faint)' }} />
        <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>NO_RUNS_YET</span>
        <div className="w-2 h-2" style={{ background: 'var(--text-faint)' }} />
      </div>
      <h2 className="font-mono text-2xl mb-2" style={{ color: 'var(--text-primary)' }}>Empty workspace</h2>
      <p className="text-xs mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
        Submit your first test run from REST Assured, or load sample data to explore the dashboard.
      </p>
      <div className="flex justify-center gap-2">
        <button
          onClick={onLoadSeed}
          disabled={!connected}
          className="px-4 py-2 text-[10px] tracking-[0.2em] font-mono font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          LOAD_SAMPLE_DATA
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-2 border text-[10px] tracking-[0.2em] font-mono transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          SUBMIT_RUN
        </button>
      </div>
    </div>
  );
}
