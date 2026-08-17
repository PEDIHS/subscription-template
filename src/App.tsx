import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Bell,
  CalendarDays,
  Database,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { useUserInfo, useConfigData, useChartData } from '@/hooks/useUserData';
import { useLanguage } from '@/hooks/useLanguage';
import { Layout } from '@/components/layout';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OnlineBadge } from '@/components/online-badge';
import { TrafficChart } from '@/components/traffic-chart';
import { ConnectionLinks } from '@/components/connection-links';
import { ProminentSubscriptionLink } from '@/components/prominent-subscription-link';
import { AppsList } from '@/components/AppsList';
import { formatRelativeExpiry, formatDate } from '@/lib/dateFormatter';
import { useDir } from '@/hooks/useDir';
import { cn } from '@/lib/utils';
import type { UsageDataPoint } from '@/types/user';

const isUsageDataSeries = (value: unknown): value is UsageDataPoint[] => Array.isArray(value);

const getChartUsageData = (stats: unknown): UsageDataPoint[] => {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return [];
  return Object.values(stats).find(isUsageDataSeries) ?? [];
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0 || Number.isNaN(bytes)) return '0 B';
  const unit = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(unit));
  if (index < 0 || index >= sizes.length) return '0 B';
  return `${(bytes / Math.pow(unit, index)).toFixed(2)} ${sizes[index]}`;
};

function App() {
  const { t, i18n } = useTranslation();
  const dir = useDir();
  useLanguage();
  const [timeRange, setTimeRange] = useState('7d');

  const { startTime, period } = useMemo(() => {
    const now = new Date();
    const start = new Date();
    let selectedPeriod = 'hour';

    switch (timeRange) {
      case '1h':
        start.setTime(now.getTime() - 60 * 60 * 1000);
        selectedPeriod = 'minute';
        break;
      case '12h':
        start.setTime(now.getTime() - 12 * 60 * 60 * 1000);
        break;
      case '24h':
        start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        selectedPeriod = 'day';
        break;
      case '90d':
        start.setTime(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        selectedPeriod = 'day';
        break;
      default:
        start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        selectedPeriod = 'day';
    }

    return { startTime: start, period: selectedPeriod };
  }, [timeRange]);

  const { data, headers, error, isLoading, isValidating, refresh } = useUserInfo();
  const { data: configData } = useConfigData();
  const { chartData, chartError } = useChartData(startTime, period, true);

  const initialUser = typeof window !== 'undefined' ? window.__INITIAL_DATA__?.user : undefined;
  const effectiveData = data ?? initialUser;
  const hasData = Boolean(effectiveData);

  const rawAnnouncement = headers?.announce;
  const announcementMessage = useMemo(() => {
    if (!rawAnnouncement || typeof rawAnnouncement !== 'string') return null;
    if (rawAnnouncement.startsWith('base64:')) {
      try {
        const encoded = rawAnnouncement.slice(7).trim();
        return encoded ? decodeURIComponent(escape(atob(encoded))) : null;
      } catch {
        return rawAnnouncement.slice(7);
      }
    }
    try {
      return decodeURIComponent(rawAnnouncement);
    } catch {
      return rawAnnouncement;
    }
  }, [rawAnnouncement]);

  const announceUrl =
    typeof headers?.['announce-url'] === 'string' && headers['announce-url'].trim()
      ? headers['announce-url']
      : null;
  const hasAnnouncement = Boolean(announcementMessage?.trim() || announceUrl);

  const normalizedStatus = useMemo(() => {
    const status = String(effectiveData?.status || 'active').toLowerCase();
    return ['active', 'disabled', 'limited', 'expired', 'on_hold'].includes(status)
      ? status
      : 'active';
  }, [effectiveData?.status]);

  const usagePercentage = useMemo(() => {
    if (!effectiveData?.data_limit || !effectiveData.used_traffic) return 0;
    return Math.min((effectiveData.used_traffic / effectiveData.data_limit) * 100, 100);
  }, [effectiveData]);

  const expiryInfo = useMemo(() => {
    if (!effectiveData) return { status: '', time: '', isExpired: false };
    if (effectiveData.status === 'on_hold') {
      if (!effectiveData.on_hold_expire_duration) {
        return { status: t('userInfo.available'), time: t('userInfo.noTimeLimit'), isExpired: false };
      }
      const days = Math.floor(effectiveData.on_hold_expire_duration / 86400);
      const hours = Math.floor((effectiveData.on_hold_expire_duration % 86400) / 3600);
      const time = days > 0
        ? `${days} ${t(days === 1 ? 'time.day' : 'time.days')}`
        : `${hours} ${t(hours === 1 ? 'time.hour' : 'time.hours')}`;
      return { status: t('userInfo.available'), time, isExpired: false };
    }
    return formatRelativeExpiry(effectiveData.expire, t);
  }, [effectiveData, t]);

  const statusConfig = {
    active: { color: 'text-[var(--success)]', dot: 'bg-[var(--success)]', tone: 'status-success' },
    disabled: { color: 'text-muted-foreground', dot: 'bg-muted-foreground', tone: 'status-neutral' },
    limited: { color: 'text-destructive', dot: 'bg-destructive', tone: 'status-danger' },
    expired: { color: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]', tone: 'status-warning' },
    on_hold: { color: 'text-[var(--info)]', dot: 'bg-[var(--info)]', tone: 'status-info' },
  } as const;

  if (isLoading && !hasData) {
    return (
      <Layout>
        <div className="flex min-h-[100svh] items-center justify-center px-6" role="status" aria-live="polite">
          <div className="ios-loading-card">
            <div className="ios-spinner" aria-hidden="true" />
            <span className="page-label">{t('common.loading')}</span>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !hasData && !isLoading && !isValidating) {
    return (
      <Layout>
        <div className="flex min-h-[100svh] items-center justify-center px-6">
          <div className="ios-error-card" role="alert">
            <div className="ios-error-symbol">!</div>
            <p className="text-xl font-semibold text-foreground">{t('dashboard.error')}</p>
            <p className="page-meta">{error.message}</p>
            <button type="button" className="ios-primary-button" onClick={() => refresh()}>
              <RefreshCcw className="size-4" />
              {t('common.retry', 'Try again')}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!effectiveData) return null;

  const statusStyle = statusConfig[normalizedStatus as keyof typeof statusConfig];
  const locale = i18n.language === 'fa' ? 'fa-IR' : i18n.language;
  const remainingTraffic = !effectiveData.data_limit
    ? '∞'
    : formatBytes(Math.max(0, effectiveData.data_limit - (effectiveData.used_traffic || 0)));
  const expiryDate = !effectiveData.expire || effectiveData.expire === '0'
    ? t('userInfo.noTimeLimit')
    : formatDate(effectiveData.expire, locale);
  const durationText = !effectiveData.on_hold_expire_duration
    ? t('userInfo.noTimeLimit')
    : `${Math.max(1, Math.floor(effectiveData.on_hold_expire_duration / 86400))} ${t('time.days')}`;

  const hasLinks = Boolean(configData?.links?.length);
  const hasChart = !chartError;
  const chartUsage = getChartUsageData(chartData?.stats);

  return (
    <Layout>
      <div className="relative min-h-[100svh] overflow-hidden">
        <div className="ios-ambient" aria-hidden="true" />

        <header className="ios-navigation">
          <div className="ios-container flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="ios-eyebrow">{t(`status.${normalizedStatus}`)}</p>
              <h1 className="ios-large-title">{t('dashboard.title')}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="ios-container ios-page-stack">
          <section className="ios-profile-row animate-fadeIn" aria-label={effectiveData.username}>
            <div className="ios-account-icon" aria-hidden="true">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p dir="ltr" title={effectiveData.username} className="truncate text-start text-[15px] font-semibold text-foreground">
                {effectiveData.username}
              </p>
              <OnlineBadge lastOnline={effectiveData.online_at} showText />
            </div>
            <button
              type="button"
              onClick={() => !isValidating && normalizedStatus !== 'disabled' && refresh()}
              disabled={isValidating || normalizedStatus === 'disabled'}
              className="ios-icon-button"
              aria-label={normalizedStatus === 'disabled' ? 'Account disabled' : 'Refresh data'}
              title={normalizedStatus === 'disabled' ? 'Account disabled' : 'Refresh data'}
            >
              <RefreshCcw className={cn('size-[18px]', isValidating && 'animate-spin')} />
            </button>
          </section>

          {hasAnnouncement && (
            <section className="ios-notice animate-fadeIn" aria-labelledby="announcement-title">
              <div className="ios-notice-icon"><Bell className="size-[18px]" /></div>
              <div className="min-w-0 flex-1">
                <h2 id="announcement-title" className="text-[15px] font-semibold text-foreground">
                  {t('userInfo.announcement')}
                </h2>
                {announcementMessage && <p className="page-meta mt-1 whitespace-pre-wrap break-words">{announcementMessage}</p>}
                {announceUrl && (
                  <a href={announceUrl} target="_blank" rel="noopener noreferrer" className="ios-link mt-2">
                    {t('userInfo.viewAnnouncement')}
                  </a>
                )}
              </div>
            </section>
          )}

          <section className={cn('ios-hero-card animate-fadeIn', statusStyle.tone)} aria-labelledby="account-status">
            <div className="ios-hero-header">
              <div>
                <p className="page-label">{t('userInfo.status')}</p>
                <div id="account-status" className={cn('ios-status-pill', statusStyle.color)}>
                  <span className={cn('size-2 rounded-full', statusStyle.dot)} aria-hidden="true" />
                  {t(`status.${normalizedStatus}`)}
                </div>
              </div>
              <div className="text-end">
                <p className={cn('page-label', expiryInfo.isExpired && 'text-destructive')}>{expiryInfo.status}</p>
                <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{expiryInfo.time}</p>
              </div>
            </div>

            <div className="ios-usage-layout">
              <div
                className="ios-progress-ring"
                style={{ '--progress': `${Math.min(usagePercentage, 100) * 3.6}deg` } as CSSProperties}
                role="img"
                aria-label={`${Math.min(usagePercentage, 100).toFixed(0)}% ${t('userInfo.used')}`}
              >
                <div className="ios-progress-center">
                  <strong>{Math.min(usagePercentage, 100).toFixed(0)}%</strong>
                  <span>{t('userInfo.used')}</span>
                </div>
              </div>
              <div className="ios-metrics-list">
                <div className="ios-metric-row">
                  <span>{t('userInfo.totalLimit')}</span>
                  <strong dir="ltr">{effectiveData.data_limit ? formatBytes(effectiveData.data_limit) : t('userInfo.unlimited')}</strong>
                </div>
                <div className="ios-metric-row">
                  <span>{t('userInfo.usedTraffic')}</span>
                  <strong dir="ltr">{formatBytes(effectiveData.used_traffic || 0)}</strong>
                </div>
                <div className="ios-metric-row">
                  <span>{t('remaining')}</span>
                  <strong dir="ltr" className="text-[var(--success)]">{remainingTraffic}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="ios-stat-grid animate-fadeIn" aria-label={t('userInfo.usageDetails', 'Usage details')}>
            <div className="ios-stat-card">
              <span className="ios-stat-icon"><Database className="size-[18px]" /></span>
              <p className="page-label">{t('userInfo.lifetimeTraffic')}</p>
              <strong dir="ltr" className="ios-stat-value">{formatBytes(effectiveData.lifetime_used_traffic || 0)}</strong>
            </div>
            <div className="ios-stat-card">
              <span className="ios-stat-icon"><CalendarDays className="size-[18px]" /></span>
              <p className="page-label">{effectiveData.status === 'on_hold' ? t('userInfo.duration') : t('userInfo.expiryDate')}</p>
              <strong dir={dir === 'rtl' && effectiveData.status === 'on_hold' ? 'rtl' : 'ltr'} className="ios-stat-value">
                {effectiveData.status === 'on_hold' ? durationText : expiryDate}
              </strong>
            </div>
            <div className="ios-stat-card">
              <span className="ios-stat-icon"><Activity className="size-[18px]" /></span>
              <p className="page-label">{t('userInfo.lastOnline')}</p>
              <strong dir="ltr" className="ios-stat-value text-sm">
                {effectiveData.online_at ? formatDate(effectiveData.online_at, locale) : t('notConnectedYet')}
              </strong>
            </div>
          </section>

          <div className="ios-content-stack">
            {(hasLinks || hasChart) && (
              <div className={cn('grid w-full grid-cols-1 gap-5', hasLinks && hasChart && 'lg:grid-cols-2')}>
                {hasLinks ? (
                  <div className={hasChart ? 'order-2 lg:order-1' : ''}>
                    <ConnectionLinks links={configData!.links} />
                  </div>
                ) : (
                  <ProminentSubscriptionLink hasChart={hasChart} />
                )}
                {hasChart && (
                  <div className={cn('min-w-0 w-full animate-fadeIn', hasLinks && 'order-1 lg:order-2')}>
                    <TrafficChart
                      data={chartUsage}
                      isLoading={!chartData}
                      error={chartError}
                      timeRange={timeRange}
                      onTimeRangeChange={setTimeRange}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="ios-section-heading animate-fadeIn">
              <h2>{t('apps.title')}</h2>
            </div>
            <AppsList />
          </div>
        </main>
      </div>
    </Layout>
  );
}

export default App;
