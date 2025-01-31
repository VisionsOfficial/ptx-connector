import { DataService } from './DataService';
import { Dataset } from './Dataset';
import { Resource } from './Resource';

export class Catalog extends Dataset {
    public 'foaf:homepage'?: string;
    public 'dcat:themeTaxonomy'?: string[];
    public 'dcat:resource'?: Resource | Resource[];
    public 'dcat:dataset'?: Dataset | Dataset[];
    public 'dcat:service'?: DataService[];
    public 'dcat:catalog'?: Catalog | Catalog[];
}
