import { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { KpiOverview, KpiSimple, KpiServiceChain, KpiByOffer, KpiVolume } from '@/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtRate(rate: number) {
    return `${(rate * 100).toFixed(1)}%`;
}

function fmtBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function rateBadgeVariant(
    rate: number
): 'default' | 'secondary' | 'destructive' {
    if (rate >= 0.8) return 'default';
    if (rate >= 0.5) return 'secondary';
    return 'destructive';
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
    title,
    value,
    description,
    color,
}: {
    title: string;
    value: string | number;
    description?: string;
    color?: string;
}) {
    return (
        <Card className={color}>
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-bold">{value}</p>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function RateCard({
    title,
    total,
    successful,
    rate,
    totalLabel,
    color,
}: {
    title: string;
    total: number;
    successful: number;
    rate: number;
    totalLabel: string;
    color?: string;
}) {
    return (
        <Card className={color}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        {totalLabel}
                    </span>
                    <span className="font-semibold">{total}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        Successful
                    </span>
                    <span className="font-semibold">{successful}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        Success Rate
                    </span>
                    <Badge variant={rateBadgeVariant(rate)}>
                        {fmtRate(rate)}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function KpiTab() {
    const [overview, setOverview] = useState<KpiOverview | null>(null);
    const [simple, setSimple] = useState<KpiSimple | null>(null);
    const [chain, setChain] = useState<KpiServiceChain | null>(null);
    const [byOffer, setByOffer] = useState<KpiByOffer[]>([]);
    const [volume, setVolume] = useState<KpiVolume | null>(null);
    const [offerType, setOfferType] = useState<'resource' | 'purpose'>(
        'resource'
    );
    const [loading, setLoading] = useState(true);

    const load = async (type: 'resource' | 'purpose' = 'resource') => {
        setLoading(true);
        try {
            const [ov, si, sc, bo, vol] = await Promise.allSettled([
                apiService.getKpiOverview(),
                apiService.getKpiSimple(),
                apiService.getKpiServiceChain(),
                apiService.getKpiByOffer(type),
                apiService.getKpiVolume(),
            ]);
            if (ov.status === 'fulfilled') setOverview(ov.value);
            if (si.status === 'fulfilled') setSimple(si.value);
            if (sc.status === 'fulfilled') setChain(sc.value);
            if (bo.status === 'fulfilled') setByOffer(Array.isArray(bo.value) ? bo.value : []);
            if (vol.status === 'fulfilled') setVolume(vol.value);
            else console.error('volume failed:', vol.reason);
        } catch (err) {
            console.error('KPI load error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load('resource');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOfferTypeChange = (type: 'resource' | 'purpose') => {
        setOfferType(type);
        load(type);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Exchange KPIs</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Management overview of dataspace connector exchanges
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => load()}
                    disabled={loading}
                >
                    {loading ? 'Refreshing…' : 'Refresh'}
                </Button>
            </div>

            {/* ── Section 1: Global overview ──────────────────────────────── */}
            <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Global Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Exchanges"
                        value={overview?.totalExchanges ?? '—'}
                        description="All statuses including pending"
                        color="bg-blue-50 border-blue-100"
                    />
                    <StatCard
                        title="Successful"
                        value={overview?.successfulExchanges ?? '—'}
                        description="EXPORT_SUCCESS or IMPORT_SUCCESS"
                        color="bg-green-50 border-green-100"
                    />
                    <Card className="bg-emerald-50 border-emerald-100">
                        <CardHeader className="pb-2">
                            <CardDescription>
                                Global Success Rate
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center gap-2">
                            <p className="text-3xl font-bold text-emerald-700">
                                {overview
                                    ? fmtRate(overview.globalSuccessRate)
                                    : '—'}
                            </p>
                            {overview && (
                                <Badge
                                    variant={rateBadgeVariant(
                                        overview.globalSuccessRate
                                    )}
                                >
                                    {overview.globalSuccessRate >= 0.8
                                        ? 'Good'
                                        : overview.globalSuccessRate >= 0.5
                                        ? 'Fair'
                                        : 'Low'}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                    <StatCard
                        title="Bytes Transferred"
                        value={
                            overview
                                ? fmtBytes(overview.totalBytesTransferred)
                                : '—'
                        }
                        description="REST non-chain exchanges only"
                        color="bg-purple-50 border-purple-100"
                    />
                </div>
            </section>

            {/* ── Section 2: Exchanges per day ─────────────────────────── */}
            <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Exchanges per Day
                </h3>
                <Card>
                    <CardContent className="pt-5">
                        {loading ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
                        ) : !volume || !volume.exchangesByDay || volume.exchangesByDay.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
                        ) : (() => {
                            const max = Math.max(...volume.exchangesByDay.map(x => x.count));
                            const total = volume.exchangesByDay.reduce((s, d) => s + d.count, 0);
                            const peak = volume.exchangesByDay.reduce((a, d) => d.count > a.count ? d : a);
                            return (
                                <>
                                    <div className="flex gap-2">
                                        {/* Y-axis labels */}
                                        <div className="flex flex-col justify-between text-xs text-muted-foreground text-right w-8 h-40 select-none">
                                            <span>{max}</span>
                                            <span>{Math.round(max / 2)}</span>
                                            <span>0</span>
                                        </div>
                                        {/* Chart area */}
                                        <div className="relative flex-1 h-40">
                                            {/* Horizontal grid lines */}
                                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                                <div className="border-t border-border/40" />
                                                <div className="border-t border-border/40" />
                                                <div className="border-t border-border/40" />
                                            </div>
                                            {/* Bars */}
                                            <div className="absolute inset-0 flex items-end gap-[2px]">
                                                {volume.exchangesByDay.map((d) => {
                                                    const heightPct = max > 0 ? (d.count / max) * 100 : 0;
                                                    return (
                                                        <div
                                                            key={d.date}
                                                            className="flex-1 rounded-sm bg-primary/70 hover:bg-primary transition-colors self-end"
                                                            style={{ height: `${heightPct}%`, minHeight: heightPct > 0 ? '2px' : '0' }}
                                                            title={`${d.date}: ${d.count}`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Date axis */}
                                    <div className="flex justify-between mt-1 pl-10 text-xs text-muted-foreground">
                                        <span>{volume.exchangesByDay[0].date}</span>
                                        <span>{volume.exchangesByDay[Math.floor(volume.exchangesByDay.length / 2)].date}</span>
                                        <span>{volume.exchangesByDay[volume.exchangesByDay.length - 1].date}</span>
                                    </div>
                                    {/* Summary */}
                                    <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                                        <span>Total: <span className="font-medium text-foreground">{total.toLocaleString()}</span></span>
                                        <span>Peak: <span className="font-medium text-foreground">{peak.count}</span> on <span className="font-medium text-foreground">{peak.date}</span></span>
                                        <span>Avg/day: <span className="font-medium text-foreground">{(total / volume.exchangesByDay.length).toFixed(1)}</span></span>
                                    </div>
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>
            </section>

            {/* ── Section 3: Status distribution ──────────────────────────── */}
            <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Status Distribution
                </h3>
                <Card>
                    <CardContent className="pt-5 space-y-3">
                        {!overview ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                {loading ? 'Loading…' : 'No data available.'}
                            </p>
                        ) : (
                            <>
                                <div className="flex h-4 rounded-full overflow-hidden w-full">
                                    <div
                                        className="bg-green-500"
                                        style={{ width: `${(overview.successfulExchanges / overview.totalExchanges) * 100}%` }}
                                        title={`Successful: ${overview.successfulExchanges}`}
                                    />
                                    <div
                                        className="bg-orange-400"
                                        style={{ width: `${((overview.completedExchanges - overview.successfulExchanges) / overview.totalExchanges) * 100}%` }}
                                        title="Pending / incomplete"
                                    />
                                    <div
                                        className="bg-red-400"
                                        style={{ width: `${((overview.totalExchanges - overview.completedExchanges) / overview.totalExchanges) * 100}%` }}
                                        title="Error"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" />
                                        Successful — {overview.successfulExchanges}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400" />
                                        Pending — {overview.completedExchanges - overview.successfulExchanges}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" />
                                        Error — {overview.totalExchanges - overview.completedExchanges}
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* ── Section 4: Exchange types ───────────────────────────────── */}
            <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Exchange Types
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RateCard
                        title="Simple Exchanges"
                        total={simple?.totalSimpleExchanges ?? 0}
                        successful={simple?.successfulSimpleExchanges ?? 0}
                        rate={simple?.successRate ?? 0}
                        totalLabel="Total simple"
                        color="bg-blue-50 border-blue-100"
                    />
                    <RateCard
                        title="Service Chain Exchanges"
                        total={chain?.totalServiceChainExchanges ?? 0}
                        successful={chain?.successfulServiceChainExchanges ?? 0}
                        rate={chain?.successRate ?? 0}
                        totalLabel="Total service chain"
                        color="bg-orange-50 border-orange-100"
                    />
                </div>
            </section>

            {/* ── Section 3: By offer ─────────────────────────────────────── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Exchanges by Offer
                    </h3>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={
                                offerType === 'resource' ? 'default' : 'outline'
                            }
                            onClick={() => handleOfferTypeChange('resource')}
                            disabled={loading}
                        >
                            Resource
                        </Button>
                        <Button
                            size="sm"
                            variant={
                                offerType === 'purpose' ? 'default' : 'outline'
                            }
                            onClick={() => handleOfferTypeChange('purpose')}
                            disabled={loading}
                        >
                            Purpose
                        </Button>
                    </div>
                </div>

                {byOffer.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {loading ? 'Loading…' : 'No offer data available.'}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left px-4 py-3 font-medium">
                                                Service Offering
                                            </th>
                                            <th className="text-right px-4 py-3 font-medium">
                                                Total
                                            </th>
                                            <th className="text-right px-4 py-3 font-medium">
                                                Successful
                                            </th>
                                            <th className="text-right px-4 py-3 font-medium">
                                                Rate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byOffer.map((row, i) => (
                                            <tr
                                                key={i}
                                                className="border-b last:border-0 hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3 font-mono text-xs truncate max-w-xs">
                                                    {row.serviceOffering}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {row.totalExchanges}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {row.successfulExchanges}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Badge
                                                        variant={rateBadgeVariant(
                                                            row.successRate
                                                        )}
                                                    >
                                                        {fmtRate(
                                                            row.successRate
                                                        )}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </section>


        </div>
    );
}
