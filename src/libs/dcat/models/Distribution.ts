import { DataService } from './DataService';

export class Distribution {
    public '@id': string;
    public '@type': string;
    public 'dcterms:title': string;
    public 'dcterms:description': string;
    //
    public 'dcterms:issued'?: string;
    public 'dcterms:modified'?: string;
    public 'dcterms:license'?: string;
    public 'dcterms:accessRights'?: string;
    public 'dcterms:rights'?: string;
    public 'odrl:hasPolicy'?: boolean;
    public 'dcat:accessURL'?: string | string[];
    public 'dcat:downloadURL'?: string | string[];
    public 'dcat:accessService'?: DataService;
    public 'dcat:byteSize'?: number;
    public 'dcat:spatialResolutionInMeters'?: string;
    public 'dcat:temporalResolution'?: string;
    public 'dcterms:conformsTo'?: string;
    public 'dcat:mediaType'?: string;
    public 'dcterms:format'?: string;
    public 'dcat:compressFormat'?: string;
    public 'dcat:packageFormat'?: string;
}
