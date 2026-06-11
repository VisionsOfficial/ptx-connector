import { connection, Schema } from 'mongoose';
import axios from 'axios';
import { urlChecker } from '../urlChecker';
import { getEndpoint } from '../../libs/loaders/configuration';
import { ObjectId } from 'mongodb';
import { handle } from '../../libs/loaders/handler';
import { ContractServiceChain } from './contractServiceChain';

interface IData {
    serviceOffering?: string;
    skipBodyProcessing?: boolean;
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
    purposes: [IData];
    purposeId?: string;
    contract: string;
    consumerEndpoint?: string;
    consumerDataExchange?: string;
    providerDataExchange?: string;
    status: string;
    consentId?: string;
    createdAt: string;
    DVCTPassed?: boolean;
    updatedAt?: string;
    error?: {
        message: string;
        code?: number;
        location?: string;
        host?: string;
        connector?: string;
        responseData?: unknown;
    };
    payload?: string;
    providerData?: {
        checksum: string;
        size: number;
        mimetype: string;
    };
    providerParams?: IParams;
    consumerParams?: IParams;
    serviceChain?: ContractServiceChain;
    serviceChainParams?: [IData];

    // Define method signatures
    createDataExchangeToOtherParticipant(): Promise<void>;
    syncWithParticipant(): Promise<void>;
    updateStatus(
        status: string,
        payload?: any,
        location?: string
    ): Promise<IDataExchange>;
    updateProviderData(payload: {
        checksum: string;
        mimeType: string;
        size: number;
    }): Promise<IDataExchange>;
    syncWithInfrastructure(
        service: string,
        infrastructureEndpoint?: string
    ): Promise<IDataExchange>;
    completeServiceChain(serviceOffering: string): Promise<void>;
}

const paramsSchema = new Schema(
    {
        query: [{ type: Schema.Types.Mixed, required: true }],
    },
    { _id: false }
);

export type DataExchangeResult = {
    exchange: IDataExchange;
    errorMessage?: string;
} | null;

interface IDataExchangeMethods {
    createDataExchangeToOtherParticipant(): Promise<void>;
    syncWithParticipant(endpoint: string): Promise<void>;
    updateStatus(status: string, payload?: any): Promise<IDataExchangeModel>;
}

const dataSchema = new Schema(
    {
        serviceOffering: String,
        skipBodyProcessing: Boolean,
        resource: String,
        params: paramsSchema,
    },
    {
        _id: false,
    }
);

const schema = new Schema({
    resources: [dataSchema],
    exchangeIdentifier: String,
    exchangeKey: String,
    purposes: [dataSchema],
    purposeId: String,
    contract: String,
    consumerEndpoint: String,
    providerEndpoint: String,
    consumerDataExchange: String,
    providerDataExchange: String,
    providerData: {
        checksum: String,
        size: Number,
        mimetype: String,
    },
    status: String,
    createdAt: Date,
    updatedAt: Date,
    payload: String,
    error: {
        message: String,
        code: { type: Schema.Types.Mixed },
        location: String,
        host: String,
        connector: String,
        stack: { type: Schema.Types.Mixed },
    },
    consentId: String,
    providerParams: {
        query: [{ type: Schema.Types.Mixed, required: true }],
    },
    consumerParams: {
        query: [{ type: Schema.Types.Mixed, required: true }],
    },
    serviceChainParams: [dataSchema],
    serviceChain: {
        catalogId: String,
        serviceChainId: String,
        services: [
            {
                participant: String,
                service: String,
                connector: String,
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
 */
schema.methods.createDataExchangeToOtherParticipant = async function () {
    if(this.providerEndpoint !== this.consumerEndpoint){
        const endpoint = this.providerEndpoint === (await getEndpoint())
            ? this.consumerEndpoint
            : this.providerEndpoint;

        const data = { ...this._doc };
        delete data._id;

        const response = await axios.post(
            urlChecker(
                endpoint,
                'dataexchanges'
            ),
            data
        );

        if (endpoint === this.consumerDataExchange) {
            this.providerDataExchange = response.data.content._id;
            this.consumerDataExchange = this._id;
        } else {
            this.consumerDataExchange = response.data.content._id;
            this.providerDataExchange = this._id;
        }
        await this.save();
    }
};

/**
 * Sync the data exchange with the participant
 */
schema.methods.syncWithParticipant = async function (endpoint: string) {
    const data = { ...this._doc };
    delete data._id;

    console.log(`Syncing data exchange ${this.exchangeIdentifier} with participant at ${endpoint}`);

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

        console.log(`Syncing data exchange ${this.exchangeIdentifier} with infrastructure at ${infrastructureEndpoint} for service ${service}`);

        const [response] = await handle(
            axios.post(urlChecker(infrastructureEndpoint, 'dataexchanges'), {
                exchangeIdentifier: this.exchangeIdentifier,
                exchangeKey: this.exchangeKey,
                providerParams: this.providerParams,
                serviceChain: this.serviceChain,
                consumerParams: this.consumerParams,
                serviceChainParams: this.serviceChainParams,
                resources: this.resources,
                purposes: this.purposes,
                purposeId: this.purposeId,
                contract: this.contract,
                consumerEndpoint: this.consumerEndpoint,
                status: this.status,
                consentId: this.consentId,
                consumerDataExchange: this.consumerDataExchange,
                providerDataExchange: this.providerDataExchange,
                providerEndpoint: this.providerEndpoint,
                providerData: this.providerData,
            })
        );

        if (response.content._id) {
            try{
                await this.syncWithParticipant(
                    this.consumerEndpoint !== (await getEndpoint())
                        ? this.consumerEndpoint
                        : this.providerEndpoint
                );
            } catch(error) {
                console.error(`Failed to sync with participant after syncing with infrastructure: ${error.message}`);
            }

            return response.content;
        } else {
            throw new Error('Failed to sync with infrastructure');
        }
    }



};

/**
 * Update the status of the data exchange
 * @param status The status
 * @param payload The payload or an ExchangeError instance
 * @param location location of the error
 */
schema.methods.updateStatus = async function (
    status: string,
    payload?: any,
    location?: string,
) {
    this.status = status;
    if (payload) {
        this.payload = payload;
        this.error = {
            message:
                typeof payload === 'string' ? payload : payload?.message ? payload.message : JSON.stringify(payload),
            location: location,
            host: payload?.host,
            connector: await getEndpoint(),
            code: payload?.code,
            stack: payload?.stack,
        };
    }
    await this.save();

    if (this.serviceChain?.serviceChainId) {
        for (const service of this.serviceChain?.services ?? []) {
            if (service?.connector && service.connector !== (await getEndpoint())) {
                await this.syncWithParticipant(service.connector);
            }
        }
    } else {
        const endpoint = this?.providerEndpoint !== (await getEndpoint())
            ? this?.providerEndpoint
            : this?.consumerEndpoint;

        if (endpoint) {
            await this.syncWithParticipant(endpoint);
        }
    }

    return this;
};

/**
 * Update the providerData of the data exchange
 */
schema.methods.updateProviderData = async function (payload: {
    mimeType: string;
    size: number;
    checksum: string;
}) {
    this.providerData = {
        mimetype: payload.mimeType,
        size: payload.size,
        checksum: payload.checksum,
    };
    await axios.put(
        urlChecker(
            this?.consumerEndpoint ?? this?.providerEndpoint,
            `dataexchanges/${
                this?.exchangeIdentifier
            }`
        ),
        {
            providerData: this.providerData,
        }
    );
    return this.save();
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
