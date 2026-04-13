import { DataExchange } from '../../../utils/types/dataExchange';
import { DataExchangeStatusEnum } from '../../../utils/enums/dataExchangeStatusEnum';

const SUCCESS_STATUSES = [
    DataExchangeStatusEnum.EXPORT_SUCCESS,
    DataExchangeStatusEnum.IMPORT_SUCCESS,
];

export interface KpiOverview {
    totalExchanges: number;
    completedExchanges: number;
    successfulExchanges: number;
    globalSuccessRate: number;
    totalBytesTransferred: number;
    simpleExchanges: number;
    serviceChainExchanges: number;
}

export interface KpiByOffer {
    serviceOffering: string;
    totalExchanges: number;
    successfulExchanges: number;
    successRate: number;
}

export interface KpiServiceChain {
    totalServiceChainExchanges: number;
    successfulServiceChainExchanges: number;
    successRate: number;
}

export interface KpiSimple {
    totalSimpleExchanges: number;
    successfulSimpleExchanges: number;
    successRate: number;
}

export interface KpiVolume {
    totalBytesTransferred: number;
    byteCoverageNote: string;
    exchangesByDay: { date: string; count: number }[];
}

const BYTE_COVERAGE_NOTE =
    'Only REST non-service-chain exchanges report a size. This total is partial.';

const serviceChainFilter = { 'serviceChain.services.0': { $exists: true } };
const simpleFilter = { 'serviceChain.services.0': { $exists: false } };

/**
 * Returns a global overview of all data exchanges:
 * total count, completed count, successful count, global success rate,
 * total bytes transferred, and a breakdown between simple and service-chain types.
 * @returns Promise<KpiOverview>
 */
export const getKpiOverviewService = async (): Promise<KpiOverview> => {
    const [result] = await DataExchange.aggregate([
        {
            $facet: {
                total: [{ $count: 'count' }],
                completed: [
                    {
                        $match: {
                            status: { $ne: DataExchangeStatusEnum.PENDING },
                        },
                    },
                    { $count: 'count' },
                ],
                successful: [
                    { $match: { status: { $in: SUCCESS_STATUSES } } },
                    { $count: 'count' },
                ],
                bytes: [
                    {
                        $match: {
                            'providerData.size': {
                                $exists: true,
                                $type: 'number',
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$providerData.size' },
                        },
                    },
                ],
                serviceChain: [
                    { $match: serviceChainFilter },
                    { $count: 'count' },
                ],
                simple: [{ $match: simpleFilter }, { $count: 'count' }],
            },
        },
    ]);

    const totalExchanges: number = result.total[0]?.count ?? 0;
    const completedExchanges: number = result.completed[0]?.count ?? 0;
    const successfulExchanges: number = result.successful[0]?.count ?? 0;
    const totalBytesTransferred: number = result.bytes[0]?.total ?? 0;
    const serviceChainExchanges: number = result.serviceChain[0]?.count ?? 0;
    const simpleExchanges: number = result.simple[0]?.count ?? 0;

    return {
        totalExchanges,
        completedExchanges,
        successfulExchanges,
        globalSuccessRate:
            totalExchanges > 0
                ? Math.round((successfulExchanges / totalExchanges) * 1000) /
                  1000
                : 0,
        totalBytesTransferred,
        simpleExchanges,
        serviceChainExchanges,
    };
};

/**
 * Returns exchange counts and success rates grouped by service offering URI.
 * Supports two grouping modes:
 * - 'resource': groups by the provider's resource offering (default)
 * - 'purpose': groups by the consumer's purpose offering
 * Results are sorted by total exchange count descending.
 * @param {'resource' | 'purpose'} type - Which offering dimension to group by
 * @returns Promise<KpiByOffer[]>
 */
export const getKpiByOfferService = async (
    type: 'resource' | 'purpose' = 'resource'
): Promise<KpiByOffer[]> => {
    const field =
        type === 'purpose'
            ? 'purposes.serviceOffering'
            : 'resources.serviceOffering';

    const arrayField = type === 'purpose' ? 'purposes' : 'resources';

    const results = await DataExchange.aggregate([
        { $unwind: `$${arrayField}` },
        {
            $match: {
                [`${arrayField}.serviceOffering`]: { $exists: true, $ne: null },
            },
        },
        {
            $group: {
                _id: `$${arrayField}.serviceOffering`,
                totalExchanges: { $sum: 1 },
                successfulExchanges: {
                    $sum: {
                        $cond: [{ $in: ['$status', SUCCESS_STATUSES] }, 1, 0],
                    },
                },
            },
        },
        { $sort: { totalExchanges: -1 } },
    ]);

    return results.map((r) => ({
        serviceOffering: r._id as string,
        totalExchanges: r.totalExchanges as number,
        successfulExchanges: r.successfulExchanges as number,
        successRate:
            r.totalExchanges > 0
                ? Math.round(
                      (r.successfulExchanges / r.totalExchanges) * 1000
                  ) / 1000
                : 0,
    }));
};

/**
 * Returns exchange counts and success rate for service-chain exchanges only.
 * A service-chain exchange is any DataExchange document whose
 * serviceChain.services array contains at least one entry.
 * Note: each individual step in a chain is counted as a separate exchange.
 * @returns Promise<KpiServiceChain>
 */
export const getKpiServiceChainService = async (): Promise<KpiServiceChain> => {
    const [result] = await DataExchange.aggregate([
        { $match: serviceChainFilter },
        {
            $facet: {
                total: [{ $count: 'count' }],
                successful: [
                    { $match: { status: { $in: SUCCESS_STATUSES } } },
                    { $count: 'count' },
                ],
            },
        },
    ]);

    const totalServiceChainExchanges: number = result.total[0]?.count ?? 0;
    const successfulServiceChainExchanges: number =
        result.successful[0]?.count ?? 0;

    return {
        totalServiceChainExchanges,
        successfulServiceChainExchanges,
        successRate:
            totalServiceChainExchanges > 0
                ? Math.round(
                      (successfulServiceChainExchanges /
                          totalServiceChainExchanges) *
                          1000
                  ) / 1000
                : 0,
    };
};

/**
 * Returns exchange counts and success rate for simple (bilateral) exchanges only.
 * A simple exchange is any DataExchange document whose
 * serviceChain.services array is absent or empty.
 * @returns Promise<KpiSimple>
 */
export const getKpiSimpleService = async (): Promise<KpiSimple> => {
    const [result] = await DataExchange.aggregate([
        { $match: simpleFilter },
        {
            $facet: {
                total: [{ $count: 'count' }],
                successful: [
                    { $match: { status: { $in: SUCCESS_STATUSES } } },
                    { $count: 'count' },
                ],
            },
        },
    ]);

    const totalSimpleExchanges: number = result.total[0]?.count ?? 0;
    const successfulSimpleExchanges: number = result.successful[0]?.count ?? 0;

    return {
        totalSimpleExchanges,
        successfulSimpleExchanges,
        successRate:
            totalSimpleExchanges > 0
                ? Math.round(
                      (successfulSimpleExchanges / totalSimpleExchanges) * 1000
                  ) / 1000
                : 0,
    };
};

/**
 * Returns total bytes transferred and a daily exchange count time-series.
 * An optional date range can be supplied to narrow the time window.
 * Note: byte totals only cover REST non-service-chain exchanges (where providerData.size is set).
 * @param {string} [from] - Start of the date range as an ISO 8601 string (inclusive)
 * @param {string} [to]   - End of the date range as an ISO 8601 string (inclusive)
 * @returns Promise<KpiVolume>
 */
export const getKpiVolumeService = async (
    from?: string,
    to?: string
): Promise<KpiVolume> => {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const timeMatch =
        Object.keys(dateFilter).length > 0
            ? { $match: { createdAt: dateFilter } }
            : null;

    const basePipeline = timeMatch ? [timeMatch] : [];

    const [result] = await DataExchange.aggregate([
        ...basePipeline,
        {
            $facet: {
                bytes: [
                    {
                        $match: {
                            'providerData.size': {
                                $exists: true,
                                $type: 'number',
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$providerData.size' },
                        },
                    },
                ],
                byDay: [
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: { $toDate: '$createdAt' },
                                },
                            },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ],
            },
        },
    ]);

    return {
        totalBytesTransferred: result.bytes[0]?.total ?? 0,
        byteCoverageNote: BYTE_COVERAGE_NOTE,
        exchangesByDay: (result.byDay as { _id: string; count: number }[]).map(
            (d) => ({ date: d._id, count: d.count })
        ),
    };
};
