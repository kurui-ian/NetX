import React, { useState, useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  RotateCcw,
  DownloadCloud,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useNetX } from '../context/NetXContext';
import { MetricTile, StatusBadge, Button } from '../components/ui/Primitives';

type UsageRange = 'day' | 'week' | 'month';

interface UsageBarItem {
  label: string;
  downloadGb: number;
  uploadGb: number;
}

export const DataUsageView: React.FC = () => {
  const {
    todayUsageGb,
    monthUsageGb,
    monthDownloadGb,
    monthUploadGb,
    usageStore,
    clearUsageHistory,
    settings,
    apps,
    networkInfo,
    pushToast,
  } = useNetX();

  const [range, setRange] = useState<UsageRange>('day');
  const [resetting, setResetting] = useState(false);

  // Month Forecasting & Budget calculations
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const dailyRunRateGb = monthUsageGb / daysElapsed;
  const projectedMonthEndGb = Math.round(dailyRunRateGb * daysInMonth * 10) / 10;
  const monthlyCap = settings.monthlyCapGb || 500;
  const projectedCapPct = Math.min(999, Math.round((projectedMonthEndGb / monthlyCap) * 100));
  const currentCapPct = Math.min(100, Math.round((monthUsageGb / monthlyCap) * 100));
  const isOverCapProjected = projectedMonthEndGb > monthlyCap;

  const handleRecalibrate = async () => {
    if (window.confirm('Reset data usage counters to 0 GB and recalibrate?')) {
      setResetting(true);
      await clearUsageHistory();
      setResetting(false);
    }
  };

  const exportUsageCSV = () => {
    if (!usageStore?.daily || Object.keys(usageStore.daily).length === 0) {
      pushToast('No historical daily records to export.', 'warning');
      return;
    }
    const headers = ['Date', 'Download (GB)', 'Upload (GB)', 'Total (GB)'];
    const rows = Object.entries(usageStore.daily)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, b]) => {
        const dlGb = (b.rxBytes / 1_073_741_824).toFixed(4);
        const ulGb = (b.txBytes / 1_073_741_824).toFixed(4);
        const totGb = ((b.rxBytes + b.txBytes) / 1_073_741_824).toFixed(4);
        return [date, dlGb, ulGb, totGb].join(',');
      });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NetX-DataUsage-${new Date().toISOString().slice(0, 7)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    pushToast('Exported daily data usage to CSV.', 'success');
  };

  // Build real bars from the persistent usageStore recorded on disk
  const { bars, weekTotalGb } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Day bars (8 3-hour buckets or recent hours of today)
    const dayBars: UsageBarItem[] = [];
    const hourSlots = [0, 3, 6, 9, 12, 15, 18, 21];
    for (const h of hourSlots) {
      let rx = 0;
      let tx = 0;
      for (let sub = h; sub < h + 3; sub++) {
        const key = `${todayStr}-${String(sub).padStart(2, '0')}`;
        const bucket = usageStore?.hourly?.[key];
        if (bucket) {
          rx += bucket.rxBytes;
          tx += bucket.txBytes;
        }
      }
      dayBars.push({
        label: `${String(h).padStart(2, '0')}:00`,
        downloadGb: rx / 1_073_741_824,
        uploadGb: tx / 1_073_741_824,
      });
    }

    // 2. Week bars (Last 7 days from usageStore.daily)
    const weekBars: UsageBarItem[] = [];
    let weekSumBytes = 0;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dKey = d.toISOString().slice(0, 10);
      const bucket = usageStore?.daily?.[dKey] || { rxBytes: 0, txBytes: 0 };
      weekSumBytes += bucket.rxBytes + bucket.txBytes;
      weekBars.push({
        label: i === 0 ? 'Today' : dayNames[d.getDay()],
        downloadGb: bucket.rxBytes / 1_073_741_824,
        uploadGb: bucket.txBytes / 1_073_741_824,
      });
    }

    // 3. Month bars (Last 6 months from usageStore.monthly)
    const monthBars: UsageBarItem[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = usageStore?.monthly?.[mKey] || { rxBytes: 0, txBytes: 0 };
      monthBars.push({
        label: monthNames[d.getMonth()],
        downloadGb: bucket.rxBytes / 1_073_741_824,
        uploadGb: bucket.txBytes / 1_073_741_824,
      });
    }

    return {
      bars: range === 'day' ? dayBars : range === 'week' ? weekBars : monthBars,
      weekTotalGb: weekSumBytes / 1_073_741_824,
    };
  }, [range, usageStore]);

  const maxBarTotal = Math.max(...bars.map((b) => b.downloadGb + b.uploadGb), 0.05);
  const dlSharePct =
    monthUsageGb > 0 ? Math.round((monthDownloadGb / monthUsageGb) * 1000) / 10 : 0;
  const ulSharePct =
    monthUsageGb > 0 ? Math.round((monthUploadGb / monthUsageGb) * 1000) / 10 : 0;

  return (
    <div className="page-container">
      {/* Summary Strip: Today, This Week, This Month (Section 12) */}
      <section className="metrics-strip" aria-label="Data usage periods">
        <MetricTile
          label="This Month Total"
          value={monthUsageGb.toFixed(2)}
          unit="GB"
          accentColor="var(--brand-mint)"
          icon={<Calendar size={18} />}
          subtext={
            <>
              <span>Cap:</span>
              <span className="mono">{settings.monthlyCapGb} GB</span>
            </>
          }
        />

        <MetricTile
          label="Downloaded"
          value={monthDownloadGb.toFixed(2)}
          unit="GB"
          accentColor="var(--series-download)"
          icon={<ArrowDownRight size={18} />}
          subtext={`${dlSharePct}% of recorded traffic`}
        />

        <MetricTile
          label="Uploaded"
          value={monthUploadGb.toFixed(2)}
          unit="GB"
          accentColor="var(--series-upload)"
          icon={<ArrowUpRight size={18} />}
          subtext={`${ulSharePct}% of recorded traffic`}
        />

        <MetricTile
          label="Today &amp; This Week"
          value={todayUsageGb.toFixed(2)}
          unit="GB today"
          accentColor="var(--series-ping)"
          icon={<BarChart3 size={18} />}
          subtext={
            <>
              <span>This week:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {weekTotalGb.toFixed(2)} GB
              </span>
            </>
          }
        />
      </section>

      {/* Forecasting & Allowance Projection Panel (Section 5) */}
      <section className="surface-panel" aria-label="Usage forecast and budget">
        <div className="surface-panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="surface-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} style={{ color: 'var(--brand-mint)' }} />
              <span>Data Allowance &amp; Month-End Forecast</span>
            </h2>
            <p className="surface-panel-subtitle">
              Calculated run rate based on {daysElapsed} days elapsed in {now.toLocaleString('default', { month: 'long' })} ({daysRemaining} days remaining).
            </p>
          </div>
          <StatusBadge
            variant={isOverCapProjected ? 'warning' : 'success'}
            iconStyle="check"
            label={isOverCapProjected ? 'Projected Over Budget' : 'Within Plan Allowance'}
          />
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>CURRENT CONSUMPTION</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {monthUsageGb.toFixed(2)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>GB ({currentCapPct}%)</span>
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>DAILY RUN RATE</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {dailyRunRateGb.toFixed(2)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>GB / day</span>
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>ESTIMATED MONTH-END</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: isOverCapProjected ? 'var(--status-danger)' : 'var(--brand-mint)' }}>
                {projectedMonthEndGb.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>GB ({projectedCapPct}%)</span>
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>MONTHLY DATA CAP</div>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {monthlyCap} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>GB cap</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="progress-track" style={{ height: 10 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, currentCapPct)}%`,
                  background: isOverCapProjected
                    ? 'linear-gradient(90deg, #38bdf8 0%, #f43f5e 100%)'
                    : 'linear-gradient(90deg, #a855f7 0%, #2dd4bf 100%)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Consumed: {monthUsageGb.toFixed(1)} GB of {monthlyCap} GB</span>
              <span>Projected: {projectedMonthEndGb.toFixed(1)} GB by month-end</span>
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic' }}>
            <AlertTriangle size={13} style={{ color: 'var(--brand-amber)' }} />
            <span>Notice: Month-end usage is an automated mathematical projection based on your daily rate of consumption; it is not measured traffic.</span>
          </div>
        </div>
      </section>

      {/* Historical Usage Graph with Day / Week / Month Switcher (Section 12) */}
      <section className="surface-panel" aria-label="Historical data usage graph">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Historical Data Usage</h2>
            <p className="surface-panel-subtitle">
              Real system adapter counters recorded on {networkInfo.hostname} (
              {networkInfo.interfaceName})
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Day / Week / Month Segmented Control */}
            <div className="segmented-control" role="tablist" aria-label="Usage timeframe">
              {(['day', 'week', 'month'] as UsageRange[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={range === item}
                  className={`segmented-btn ${range === item ? 'active' : ''}`}
                  onClick={() => setRange(item)}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<DownloadCloud size={13} />}
              onClick={exportUsageCSV}
            >
              Export CSV
            </Button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRecalibrate}
              disabled={resetting}
              title="Reset and recalibrate local data counters to 0"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <RotateCcw size={13} className={resetting ? 'spin' : ''} />
              <span>{resetting ? 'Resetting...' : 'Recalibrate'}</span>
            </button>
          </div>
        </div>

        {/* Clean Stacked Bar Graph */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
            gap: 18,
            alignItems: 'end',
            height: 230,
            padding: '24px 12px 8px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {bars.map((item) => {
            const total = item.downloadGb + item.uploadGb;
            const dlHeightPct =
              item.downloadGb > 0
                ? Math.max(6, Math.round((item.downloadGb / maxBarTotal) * 145))
                : 2;
            const ulHeightPct =
              item.uploadGb > 0
                ? Math.max(4, Math.round((item.uploadGb / maxBarTotal) * 145))
                : 2;

            return (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>
                  {total.toFixed(2)} GB
                </span>

                <div
                  style={{
                    width: '100%',
                    maxWidth: 54,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    gap: 2,
                  }}
                >
                  <div
                    title={`Uploaded: ${item.uploadGb.toFixed(3)} GB`}
                    style={{
                      height: ulHeightPct,
                      background: 'var(--series-upload)',
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      opacity: item.uploadGb > 0 ? 1 : 0.25,
                      transition: 'height 220ms ease',
                    }}
                  />
                  <div
                    title={`Downloaded: ${item.downloadGb.toFixed(3)} GB`}
                    style={{
                      height: dlHeightPct,
                      background: 'var(--series-download)',
                      borderBottomLeftRadius: 6,
                      borderBottomRightRadius: 6,
                      opacity: item.downloadGb > 0 ? 1 : 0.25,
                      transition: 'height 220ms ease',
                    }}
                  />
                </div>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 14,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', gap: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: 'var(--series-download)',
                }}
              />
              <span>Downloaded</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: 'var(--series-upload)',
                }}
              />
              <span>Uploaded</span>
            </span>
          </div>
          <span>Stored locally in %APPDATA%\NetX\netx-usage-store.json</span>
        </div>
      </section>

      {/* Per-Application Usage Breakdown */}
      <section className="surface-panel" aria-label="Application data consumption">
        <div className="surface-panel-header">
          <div>
            <h2 className="surface-panel-title">Active Process Socket Distribution</h2>
            <p className="surface-panel-subtitle">
              Proportional session traffic across active processes on {networkInfo.hostname}.
            </p>
          </div>
          <StatusBadge variant="neutral" label={`${monthUsageGb.toFixed(2)} GB Tracked`} />
        </div>

        <div className="table-wrap">
          <table className="netx-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Socket Activity</th>
                <th>Today Est.</th>
                <th>Month Est.</th>
                <th>Socket Share</th>
              </tr>
            </thead>
            <tbody>
              {apps.slice(0, 12).map((app) => {
                const share =
                  monthUsageGb > 0
                    ? Math.min(100, Math.round((app.monthTotalGb / monthUsageGb) * 100))
                    : 0;
                return (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{app.name}</div>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {app.processName} (PID {app.pid})
                      </div>
                    </td>
                    <td>
                      <StatusBadge variant="neutral" label={app.category} />
                    </td>
                    <td className="mono">{app.todayTotalGb.toFixed(3)} GB</td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {app.monthTotalGb.toFixed(3)} GB
                    </td>
                    <td style={{ width: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="progress-track" style={{ height: 8 }}>
                          <div className="progress-fill" style={{ width: `${share}%` }} />
                        </div>
                        <span className="mono" style={{ fontSize: 12, minWidth: 36 }}>
                          {share}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
