import { TransferState } from '../../utils/types/dsp/message-types.interface.dsp';

export class TransferProcess {
    '@context': 'https://w3id.org/dspace/2024/1/context.json';
    '@type': 'dspace:TransferProcess';
    'dspace:providerPid': string;
    'dspace:consumerPid': string;
    'dspace:state': TransferState;

    constructor(transferProcessDocument?: any) {
        this['@context'] = 'https://w3id.org/dspace/2024/1/context.json';
        this['@type'] = 'dspace:TransferProcess';

        if (transferProcessDocument) {
            this['dspace:providerPid'] = transferProcessDocument.providerPid;
            this['dspace:consumerPid'] = transferProcessDocument.consumerPid;
            this['dspace:state'] = transferProcessDocument.state;
        }
    }

    toJSON() {
        return {
            '@context': this['@context'],
            '@type': this['@type'],
            'dspace:providerPid': this['dspace:providerPid'],
            'dspace:consumerPid': this['dspace:consumerPid'],
            'dspace:state': this['dspace:state'],
        };
    }
}
