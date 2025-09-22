import { Resource } from './Resource';

export class Relationship extends Resource {
    public 'dcterms:relation'?: string;
    public 'dcat:hadRole'?: string;
}
