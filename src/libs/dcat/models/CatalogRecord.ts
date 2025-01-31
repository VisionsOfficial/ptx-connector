import { dcterms } from './dcterms';

export class CatalogRecord {
    public 'dcterms:title': string;
    public 'dcterms:description': string;
    public 'dcterms:issued': string;
    public 'dcterms:modified': string; // modificationDate;
    public 'foaf:primaryTopic': any;
    public 'dcterms:conformsTo': dcterms.Standard;
}
