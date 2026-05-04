// Common types used across the application

export interface DataExchange {
    _id: string;
    contract?: string;
    purposeId?: string;
    resourceId?: string;
    serviceChainId?: string;
    resources?: Array<{
        resource: string;
        params?: Record<string, unknown>;
    }>;
    purposes?: Array<{
        resource: string;
        params?: Record<string, unknown>;
    }>;
    providerParams?: Record<string, unknown>;
    consumerParams?: Record<string, unknown>;
    serviceChainParams?: Array<Record<string, unknown>>;
    createdAt?: string;
    updatedAt?: string;
    status?: string;
    [key: string]: unknown;
}

// KPI types — shapes mirror the API response `content` field exactly

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
    name?: string;
    totalExchanges: number;
    successfulExchanges: number;
    successRate: number;
}

export interface KpiError {
    _id: string;
    contract?: string;
    contractName?: string;
    status: string;
    errorMessage?: string;
    errorLocation?: string;
    payload?: string;
    participantEndpoint?: string;
    participantName?: string;
    connectorName: string;
    createdAt: string;
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
