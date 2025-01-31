// Class for the contract negotiation error as per defined
// by the IDS Information Model https://docs.internationaldataspaces.org/ids-knowledgebase/v/dataspace-protocol/contract-negotiation/contract.negotiation.protocol#id-3.2-error-contract-negotiation-error

export class ContractNegotiationError
    extends Error
    implements IDSA.IContractNegotiationError
{
    '@context' = 'https://w3id.org/dspace/2024/1/context.json' as const;
    '@type' = 'dspace:ContractNegotiationError' as const;

    /**
     * The Contract negotiation Unique ID on Provider side
     */
    'dspace:providerPid': string;

    /**
     * The Contract negotiation Unique ID on Consumer side
     */
    'dspace:consumerPid': string;
    'dspace:code'?: string;
    'dspace:reason'?: any[];
    'dct:description'?: IDSA.MultilanguageProperty[];

    constructor(message?: string) {
        super(message);
        this['dspace:code'] = '';
        this['dspace:reason'] = [];
        this['dct:description'] = [];
    }

    getJSONResponse() {
        return {
            '@context': this['@context'],
            '@type': this['@type'],
            'dspace:providerPid': this['dspace:providerPid'],
            'dspace:consumerPid': this['dspace:consumerPid'],
            'dspace:code': this['dspace:code'],
            'dspace:reason': this['dspace:reason'],
            'dct:description': this['dct:description'],
        };
    }
}

const n = new ContractNegotiationError();
