export type Service = {
    participant: string;
    connector?: string;
    service: string;
    configuration: string;
    params: {
        [key: string]: string;
    };
    completed?: boolean;
    pre?: any[];
};

export type ContractServiceChain = {
    catalogId?: string;
    serviceChainId: string;
    services: Service[];
};
