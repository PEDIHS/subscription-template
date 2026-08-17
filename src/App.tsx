import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  Database,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Zap,
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
  const isFa = i18n.language.startsWith('fa');
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
  const remainingPercentage = !effectiveData.data_limit
    ? 100
    : Math.max(0, Math.min(100, 100 - usagePercentage));
  const liquidHue = Math.round(remainingPercentage * 1.35);
  const liquidStyle = {
    '--liquid-level': `${remainingPercentage}%`,
    '--liquid-color': `hsl(${liquidHue} 72% 38%)`,
    '--liquid-color-bright': `hsl(${liquidHue} 78% 55%)`,
  } as CSSProperties;

  const scrollToConnections = () => {
    document.getElementById('connection-links')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Layout>
      <div className="treasury-shell relative min-h-[100svh] overflow-hidden">
        <div className="treasury-ambient" aria-hidden="true" />

        <header className="treasury-navigation">
          <div className="ios-container flex items-center justify-between gap-3">
            <div className="treasury-brand" aria-label="ganj">
              <span className="treasury-brand-shield"><ShieldCheck className="size-[18px]" /></span>
              <span>ganj</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="ios-container treasury-page">
          <section className="treasury-titlebar animate-fadeIn">
            <div className="min-w-0">
              <p className="treasury-kicker"><Sparkles className="size-3.5" /> {isFa ? 'فضای امن شما' : 'Your secure space'}</p>
              <h1>{isFa ? 'اشتراک من' : t('dashboard.title')}</h1>
              <div className="treasury-identity">
                <span className={cn('treasury-live-dot', statusStyle.dot)} aria-hidden="true" />
                <span dir="ltr" title={effectiveData.username}>{effectiveData.username}</span>
                <OnlineBadge lastOnline={effectiveData.online_at} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => !isValidating && normalizedStatus !== 'disabled' && refresh()}
              disabled={isValidating || normalizedStatus === 'disabled'}
              className="treasury-refresh"
              aria-label={isFa ? 'به‌روزرسانی اطلاعات' : 'Refresh data'}
            >
              <RefreshCcw className={cn('size-[18px]', isValidating && 'animate-spin')} />
            </button>
          </section>

          <section className={cn('treasury-hero animate-fadeIn', statusStyle.tone)} aria-labelledby="account-status">
            <div className="treasury-hero-glow" aria-hidden="true" />
            <div className="treasury-hero-copy">
              <span className="treasury-shield"><ShieldCheck className="size-7" /></span>
              <div id="account-status" className="treasury-status">
                <span className={cn('size-2 rounded-full', statusStyle.dot)} aria-hidden="true" />
                {normalizedStatus === 'active' && isFa ? 'متصل و فعال' : t(`status.${normalizedStatus}`)}
              </div>
              <p>{isFa ? 'اتصال امن شما آماده استفاده است' : 'Your secure connection is ready'}</p>
              <button type="button" className="treasury-quick-action" onClick={scrollToConnections}>
                <Zap className="size-[18px] fill-current" />
                {isFa ? 'اتصال سریع' : 'Quick connect'}
              </button>
            </div>

            <div className="treasury-orbit-wrap">
              <div
                className="treasury-orbit"
                style={{ '--progress': `${Math.min(usagePercentage, 100) * 3.6}deg` } as CSSProperties}
                role="img"
                aria-label={`${Math.min(usagePercentage, 100).toFixed(0)}% ${t('userInfo.used')}`}
              >
                <span className="treasury-orbit-spark" aria-hidden="true" />
                <div className="treasury-orbit-center">
                  <strong>{Math.min(usagePercentage, 100).toFixed(0)}<small>%</small></strong>
                  <span>{t('userInfo.used')}</span>
                </div>
              </div>
              <div className={cn('treasury-expiry', expiryInfo.isExpired && 'is-danger')}>
                <CalendarDays className="size-4" />
                <span>{expiryInfo.time}</span>
              </div>
            </div>

            <svg className="treasury-wave" viewBox="0 0 720 150" preserveAspectRatio="none" aria-hidden="true">
              <path className="treasury-wave-soft" d="M0 95 C70 20 115 130 190 68 C255 12 302 126 375 72 C455 15 510 126 575 70 C636 18 675 96 720 48" />
              <path className="treasury-wave-line" d="M0 108 C76 36 122 136 194 82 C262 26 306 132 382 80 C452 31 512 132 580 79 C638 34 681 104 720 65" />
            </svg>
          </section>

          <section className="treasury-metrics animate-fadeIn" aria-label={t('userInfo.usageDetails', 'Usage details')}>
            <div className="treasury-metric">
              <span>{t('userInfo.totalLimit')}</span>
              <strong dir="ltr">{effectiveData.data_limit ? formatBytes(effectiveData.data_limit) : t('userInfo.unlimited')}</strong>
            </div>
            <div className="treasury-filament" aria-hidden="true"><i /></div>
            <div className="treasury-metric">
              <span>{t('userInfo.usedTraffic')}</span>
              <strong dir="ltr">{formatBytes(effectiveData.used_traffic || 0)}</strong>
            </div>
            <div className="treasury-filament" aria-hidden="true"><i /></div>
            <div className="treasury-metric is-success">
              <span>{t('remaining')}</span>
              <strong dir="ltr">{remainingTraffic}</strong>
            </div>
          </section>

          <section className="treasury-reservoir animate-fadeIn" style={liquidStyle} aria-labelledby="reservoir-title">
            <div className="treasury-reservoir-copy">
              <div>
                <span className="treasury-reservoir-icon" aria-hidden="true"><Database className="size-[18px]" /></span>
                <div>
                  <h2 id="reservoir-title">{isFa ? 'ذخیره باقی‌مانده' : 'Remaining reserve'}</h2>
                  <p>{isFa ? 'سطح مخزن با مصرف شما کاهش پیدا می‌کند' : 'The reservoir falls as your usage grows'}</p>
                </div>
              </div>
              <strong dir="ltr">{remainingTraffic}</strong>
            </div>
            <div
              className="treasury-liquid-vessel"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(remainingPercentage)}
              aria-label={`${Math.round(remainingPercentage)}% ${t('remaining')}`}
            >
              <div className="treasury-liquid-fill">
                <span className="treasury-liquid-wave is-front" />
                <span className="treasury-liquid-wave is-back" />
                <i className="treasury-liquid-bubble is-one" />
                <i className="treasury-liquid-bubble is-two" />
                <i className="treasury-liquid-bubble is-three" />
              </div>
              <div className="treasury-liquid-readout">
                <strong>{Math.round(remainingPercentage)}<small>%</small></strong>
                <span>{isFa ? 'باقی مانده' : 'remaining'}</span>
              </div>
              <div className="treasury-liquid-scale" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            </div>
            <div className="treasury-reservoir-legend" aria-hidden="true">
              <span>{isFa ? 'بحرانی' : 'Critical'}</span>
              <i />
              <span>{isFa ? 'مطمئن' : 'Healthy'}</span>
            </div>
          </section>

          <section className="treasury-notice animate-fadeIn" aria-labelledby="announcement-title">
            <div className="treasury-notice-icon"><Bell className="size-[18px]" /></div>
            <div className="min-w-0 flex-1">
              <h2 id="announcement-title">{t('userInfo.announcement')}</h2>
              <p className="whitespace-pre-wrap break-words">
                {announcementMessage || (isFa ? 'سرویس شما آماده استفاده است' : 'Your service is ready to use')}
              </p>
              {announceUrl && (
                <a href={announceUrl} target="_blank" rel="noopener noreferrer" className="ios-link">
                  {t('userInfo.viewAnnouncement')}
                </a>
              )}
            </div>
            <ChevronDown className="size-4 -rotate-90 text-muted-foreground rtl:rotate-90" aria-hidden="true" />
          </section>

          <section className="treasury-detail-strip animate-fadeIn">
            <div><Database className="size-4" /><span>{t('userInfo.lifetimeTraffic')}</span><strong dir="ltr">{formatBytes(effectiveData.lifetime_used_traffic || 0)}</strong></div>
            <div><CalendarDays className="size-4" /><span>{effectiveData.status === 'on_hold' ? t('userInfo.duration') : t('userInfo.expiryDate')}</span><strong dir={dir === 'rtl' && effectiveData.status === 'on_hold' ? 'rtl' : 'ltr'}>{effectiveData.status === 'on_hold' ? durationText : expiryDate}</strong></div>
            <div><Activity className="size-4" /><span>{t('userInfo.lastOnline')}</span><strong dir="ltr">{effectiveData.online_at ? formatDate(effectiveData.online_at, locale) : t('notConnectedYet')}</strong></div>
          </section>

          <div className="treasury-content-stack">
            {(hasLinks || hasChart) && (
              <div className={cn('treasury-content-grid', hasLinks && hasChart && 'has-two-columns')}>
                {hasChart && (
                  <div className="min-w-0 w-full animate-fadeIn">
                    <TrafficChart data={chartUsage} isLoading={!chartData} error={chartError} timeRange={timeRange} onTimeRangeChange={setTimeRange} />
                  </div>
                )}
                {hasLinks ? (
                  <div id="connection-links" className="scroll-mt-24">
                    <ConnectionLinks links={configData!.links} />
                  </div>
                ) : (
                  <ProminentSubscriptionLink hasChart={hasChart} />
                )}
              </div>
            )}

            <div className="treasury-section-title animate-fadeIn">
              <div><span><Sparkles className="size-4" /></span><h2>{isFa ? 'اپلیکیشن پیشنهادی' : t('apps.title')}</h2></div>
              <p>{isFa ? 'بهترین ابزار برای دستگاه شما' : 'The best tools for your device'}</p>
            </div>
            <AppsList />
          </div>
        </main>
      </div>
    </Layout>
  );
}

export default App;
