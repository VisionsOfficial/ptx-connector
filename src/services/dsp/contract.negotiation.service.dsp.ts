import { ContractNegotiationModel } from '../../utils/types/dsp/ContractNegotiation.model';
import { ContractNegotiation } from '../../libs/dsp/ContractNegotiation.dsp';
import { randomUUID } from 'node:crypto';
import { NegotiationState } from '../../utils/types/dsp/message-types.interface.dsp';

/**
 * Service that handles the database operations for ContractNegotiation
 */
class ContractNegotiationService {
    private static instance: ContractNegotiationService;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}

    public static getInstance(): ContractNegotiationService {
        if (!ContractNegotiationService.instance) {
            ContractNegotiationService.instance =
                new ContractNegotiationService();
        }

        return ContractNegotiationService.instance;
    }

    /**
     * Get the mapped property name in the database
     */
    public getMappedIDSToDBProperty(
        idsProperty:
            | 'dspace:providerPid'
            | 'dspace:consumerPid'
            | 'dspace:negotiationState'
    ) {
        switch (idsProperty) {
            case 'dspace:providerPid':
                return 'providerPid';
            case 'dspace:consumerPid':
                return 'consumerPid';
            case 'dspace:negotiationState':
                return 'state';
            default:
                throw new Error('Property not found');
        }
    }

    public async getContractNegotiationFromProviderPid({
        providerPid,
    }: {
        providerPid: string;
    }) {
        const cn = await ContractNegotiationModel.findOne({
            providerPid,
        });

        return cn;
    }

    public async getContractNegotiationFromConsumerPid({
        consumerPid,
    }: {
        consumerPid: string;
    }) {
        const cn = await ContractNegotiationModel.findOne({
            consumerPid,
        });

        return cn;
    }

    public async getContractNegotiationFromConsumerPidAnProviderPid({
        consumerPid,
        providerPid,
    }: {
        consumerPid: string;
        providerPid: string;
    }) {
        const cn = await ContractNegotiationModel.findOne({
            consumerPid,
            providerPid,
        });

        return cn;
    }

    public async createContractNegotiation({
        consumerPid,
        providerPid,
        state,
    }: {
        providerPid?: string;
        consumerPid?: string;
        state: NegotiationState;
    }) {
        const cn = new ContractNegotiationModel({
            providerPid: providerPid ?? this.generateContractNegotiationPid(),
            consumerPid: consumerPid ?? this.generateContractNegotiationPid(),
            state,
        });

        await cn.save();
        return cn;
    }

    public async getContractNegotiationMessageFromDocumentId(
        documentId: string
    ) {
        const cn = await ContractNegotiationModel.findById(documentId);
        return new ContractNegotiation(cn).toJSON();
    }

    private generateContractNegotiationPid() {
        return 'urn:uuid:' + randomUUID();
    }
}

export default ContractNegotiationService.getInstance();
