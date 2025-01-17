import { Dataset } from './Dataset';
import { Resource } from './Resource';

export class DataService extends Resource {
    public 'dcat:endpointURL'?: string | string[];
    public 'dcat:endpointDescription'?: string;
    public 'dcat:servesDataset'?: Dataset[];
}
