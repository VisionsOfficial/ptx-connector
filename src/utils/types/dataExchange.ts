import { connection, Schema } from 'mongoose';
import axios from 'axios';
import { urlChecker } from '../urlChecker';
import { getEndpoint } from '../../libs/loaders/configuration';
import { ObjectId } from 'mongodb';
import { handle } from '../../libs/loaders/handler';
import { ContractServiceChain } from './contractServiceChain';

interface IData {
    serviceOffering?: string;
    resource: string;
    params?: IParams;
    completed: boolean;
}

export interface IQueryParams {
    [key: string]: string | number | any;
}

export interface IParams {
    query: [IQueryParams];
}

export interface IService {
    participant: string;
    service: string;
    connector: string;
    configuration: string;
    params: any;
    completed?: boolean;
}

export interface IServiceChain {
    catalogId?: string;
    serviceChainId: string;
    services: IService[];
}

interface IDataExchange {
    _id: ObjectId;
    exchangeIdentifier: string;
    exchangeKey: string;
    providerEndpoint: string;
    resources: [IData];
    purposeId?: string;
    contract: string;
    consumerEndpoint?: string;
    consumerDataExchange?: string;
    providerDataExchange?: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    payload?: string;
    providerParams?: IParams;
    serviceChain?: ContractServiceChain;

    // Define method signatures
    createDataExchangeToOtherParticipant(
        participant: 'provider' | 'consumer'
    ): Promise<void>;
    syncWithParticipant(): Promise<void>;
    updateStatus(status: string, payload?: any): Promise<IDataExchange>;
    syncWithInfrastructure(
        service: string,
        infrastructureEndpoint?: string
    ): Promise<IDataExchange>;
    completeServiceChain(serviceOffering: string): Promise<void>;
}

const paramsSchema = new Schema({
    query: [{ type: Schema.Types.Mixed, required: true }],
});

export type DataExchangeResult = {
    exchange: IDataExchange;
    errorMessage?: string;
} | null;

interface IDataExchangeMethods {
    createDataExchangeToOtherParticipant(
        participant: 'provider' | 'consumer'
    ): Promise<void>;
    syncWithParticipant(endpoint: string): Promise<void>;
    updateStatus(status: string, payload?: any): Promise<IDataExchangeModel>;
}

const dataSchema = new Schema({
    serviceOffering: String,
    resource: String,
    params: paramsSchema,
});

const schema = new Schema({
    resources: [dataSchema],
    exchangeIdentifier: String,
    exchangeKey: String,
    purposeId: String,
    contract: String,
    consumerEndpoint: String,
    providerEndpoint: String,
    consumerDataExchange: String,
    providerDataExchange: String,
    status: String,
    createdAt: Date,
    updatedAt: Date,
    payload: String,
    providerParams: {
        query: [{ type: Schema.Types.Mixed, required: true }],
    },
    serviceChain: {
        catalogId: String,
        serviceChainId: String,
        services: [
            {
                participant: String,
                service: String,
                connector: String,
                dataExchange: String,
                configuration: String,
                params: { type: Schema.Types.Mixed },
                pre: [{ type: Schema.Types.Mixed }],
                completed: { type: Boolean, default: false },
            },
        ],
    },
});

/**
 * Create the data exchange to the other participant PDC
 * @param participant The participant
 */
schema.methods.createDataExchangeToOtherParticipant = async function (
    participant: 'provider' | 'consumer'
) {
    let data;
    if (participant === 'provider') {
        data = {
            exchangeIdentifier: this.exchangeIdentifier,
            exchangeKey: this.exchangeKey,
            consumerEndpoint: await getEndpoint(),
            resources: this.resources,
            purposeId: this.purposeId,
            contract: this.contract,
            status: this.status,
            providerParams: this.providerParams,
            consumerDataExchange: this._id,
            serviceChain: this.serviceChain,
        };
    } else {
        data = {
            exchangeIdentifier: this.exchangeIdentifier,
            exchangeKey: this.exchangeKey,
            providerEndpoint: await getEndpoint(),
            resources: this.resources,
            purposeId: this.purposeId,
            contract: this.contract,
            status: this.status,
            providerParams: this.providerParams,
            providerDataExchange: this._id,
            serviceChain: this.serviceChain,
        };
    }
    const response = await axios.post(
        urlChecker(
            participant === 'provider'
                ? this.providerEndpoint
                : this.consumerEndpoint,
            'dataexchanges'
        ),
        data
    );

    if (participant === 'provider') {
        this.providerDataExchange = response.data.content._id;
    } else {
        this.consumerDataExchange = response.data.content._id;
    }
    this.save();
};

/**
 * Sync the data exchange with the participant
 */
schema.methods.syncWithParticipant = async function (endpoint: string) {
    const data = { ...this._doc };
    delete data._id;
    await axios.put(
        urlChecker(
            endpoint,
            `private/dataexchanges/exchangeidentifier/${this.exchangeIdentifier}`
        ),
        data,
        {
            headers: {
                'ptx-data-exchange-key': this.exchangeKey,
            },
        }
    );
};

/**
 * Sync the data exchange with the infrastructure
 * @param infrastructureEndpoint The infrastructure endpoint, if not provided, the participant endpoint will be requested
 * @param service
 */
schema.methods.syncWithInfrastructure = async function (
    infrastructureEndpoint?: string,
    service?: string
) {
    if (!this.providerDataExchange) this.providerDataExchange = this._id;
    if (!this.consumerDataExchange) this.consumerDataExchange = this._id;
    if (!this.providerEndpoint) this.providerEndpoint = await getEndpoint();
    if (!this.consumerEndpoint) this.consumerEndpoint = this._id;

    if (!this.serviceChain.services[0].connector) {
        this.serviceChain.services[0].connector = this.providerEndpoint;
    }

    if (
        !this.serviceChain.services[this.serviceChain.services.length - 1]
            .connector
    ) {
        this.serviceChain.services[
            this.serviceChain.services.length - 1
        ].connector = this.consumerEndpoint;
    }

    if (service && infrastructureEndpoint && this.serviceChain.serviceChainId) {
        const index = this.serviceChain.services.findIndex(
            (element: { service: string }) => element.service === service
        );

        if (index) {
            this.serviceChain.services[index].connector =
                infrastructureEndpoint;
        } else {
            if (
                this.serviceChain.services[index].pre &&
                this.serviceChain.services[index].pre.length > 0
            ) {
                for (const preChain of this.serviceChain.services[index].pre) {
                    const preIndex = preChain.services.findIndex(
                        (element: { service: string }) =>
                            element.service === service
                    );

                    if (preIndex) {
                        preChain.services[preIndex].connector =
                            infrastructureEndpoint;
                    }
                }
            }
        }

        await this.save();

        const [response] = await handle(
            axios.post(urlChecker(infrastructureEndpoint, 'dataexchanges'), {
                exchangeIdentifier: this.exchangeIdentifier,
                exchangeKey: this.exchangeKey,
                providerParams: this.providerParams,
                serviceChain: this.serviceChain,
                resources: this.resources,
                purposeId: this.purposeId,
                contract: this.contract,
                consumerEndpoint: this.consumerEndpoint,
                status: this.status,
                consumerDataExchange: this.consumerDataExchange,
                providerDataExchange: this.providerDataExchange,
                providerEndpoint: this.providerEndpoint,
            })
        );

        if (response.content._id) {
            await this.syncWithParticipant(
                this.consumerEndpoint !== (await getEndpoint())
                    ? this.consumerEndpoint
                    : this.providerEndpoint
            );
            return response.content;
        } else {
            throw new Error('Failed to sync with infrastructure');
        }
    }
};

/**
 * Update the status of the data exchange
 * @param status The status
 * @param payload The payload
 */
schema.methods.updateStatus = async function (status: string, payload?: any) {
    this.status = status;
    this.payload = payload;
    await this.save();

    if (this.serviceChain.serviceChainId) {
        for (const service of this.serviceChain.services) {
            if (service.connector !== (await getEndpoint())) {
                await this.syncWithParticipant(service.connector);
            }
        }
    } else {
        await this.syncWithParticipant(
            this?.consumerEndpoint ?? this?.providerEndpoint
        );
    }

    return this;
};

/**
 * Update the status of the serviceChain
 * @param service
 */
schema.methods.completeServiceChain = async function (service: string) {
    const indexToUpdate = this.serviceChain.services.findIndex(
        (element: IService) => element.service === service
    );

    if (indexToUpdate === -1) {
        throw new Error('Failed to sync');
    } else {
        this.serviceChain.services[indexToUpdate].completed = true;

        await this.save();

        if (this.serviceChain.serviceChainId) {
            for (const service of this.serviceChain.services) {
                if (service.connector !== (await getEndpoint())) {
                    await this.syncWithParticipant(service.connector);
                }
            }
        } else {
            await this.syncWithParticipant(
                this?.consumerEndpoint ?? this?.providerEndpoint
            );
        }
    }
};

type IDataExchangeModel = Document & IDataExchange & IDataExchangeMethods;

schema.set('versionKey', false);

const DataExchange = connection.model<IDataExchangeModel>(
    'dataexchange',
    schema
);

export { IData, IDataExchange, DataExchange };
