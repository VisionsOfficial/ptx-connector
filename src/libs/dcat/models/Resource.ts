import { odrl } from './odrl';
import { skos } from './skos';
import { dcterms } from './dcterms';
import { foaf } from './foaf';
import { vcard } from './vcard';
import { prov } from './prov';
import { Relationship } from './Relationship';

export class Resource {
    public '@id'?: string;
    public '@context'?: string;
    public '@type': string;
    public 'dcterms:title': string;
    public 'dcterms:description': string;
    //
    public 'dcterms:accessRights'?: dcterms.RightsStatement;
    public 'dcterms:conformsTo'?: dcterms.Standard;
    public 'dcat:contactPoint'?: vcard.Kind;
    public 'dcterms:creator'?: foaf.Agent;
    public 'dcterms:issued'?: Date;
    public 'dcterms:modified'?: Date;
    public 'dcterms:language'?: string;
    public 'dcterms:publisher'?: foaf.Agent;
    public 'dcterms:identifier'?: string;
    public 'dcat:theme'?: skos.Concept;
    public 'dcterms:type'?: string;
    public 'dcterms:relation'?: string | string[];
    public 'dcat:qualifiedRelation'?: Relationship | Relationship[];
    public 'dcat:keyword'?: string;
    public 'dcat:landingPage'?: string;
    public 'prov:qualifiedAttribution'?: prov.Attribution;
    public 'dcterms:license'?: string | string[];
    public 'dcterms:rights'?: string | string[];
    public 'dcterms:hasPart'?: Resource | Resource[];
    public 'odrl:hasPolicy'?: odrl.Policy | odrl.Policy[];
    public 'dcterms:isReferencedBy'?: Resource;
    public 'dcat:previousVersion'?: Resource;
    public 'dcat:hasVersion'?: Resource;
    public 'dcat:hasCurrentVersion'?: Resource;
    public 'dcterms:replaces'?: Resource;
    public 'dcat:version'?: string;
    public 'adms:versionNotes'?: string;
    public 'adms:status'?: string;
    public 'dcat:first'?: Resource;
    public 'dcat:last'?: Resource;
    public 'dcat:prev'?: Resource;
}
