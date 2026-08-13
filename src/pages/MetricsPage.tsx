import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';

export const MetricsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<string>('1h');

  const metricsData = [
    { time: '10:00', cpu: 1.1, memory: 4.2, restarts: 0, nodePressure: 0 },
    { time: '10:10', cpu: 1.4, memory: 4.5, restarts: 1, nodePressure: 0 },
    { time: '10:20', cpu: 2.2, memory: 6.8, restarts: 8, nodePressure: 1 },
    { time: '10:30', cpu: 2.5, memory: 7.4, restarts: 14, nodePressure: 2 },
    { time: '10:40', cpu: 1.9, memory: 5.9, restarts: 3, nodePressure: 1 },
    { time: '10:50', cpu: 1.3, memory: 4.6, restarts: 0, nodePressure: 0 },
  ];

  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Prometheus Metrics</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time time-series telemetry collected from SkyOps agent metric providers.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800 text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Range:</span>
          {['5m', '15m', '1h', '6h', '24h', '7d'].map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                timeRange === r
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Cluster CPU Usage (Cores)
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricsData}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                <Area type="monotone" dataKey="cpu" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Chart */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Cluster Memory Usage (GB)
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsData}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                <Line type="monotone" dataKey="memory" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Restarts Chart */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Pod Restarts Rate
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metricsData}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                <Bar dataKey="restarts" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Node Pressure Chart */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Node Pressure Events
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricsData}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                <Area type="stepAfter" dataKey="nodePressure" stroke="#eab308" fill="#eab308" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
