import axios from 'axios';
import { IDataResource } from '../../utils/types/dataResource';
import { IServiceOffering } from '../../utils/types/serviceOffering';
import { ISoftwareResource } from '../../utils/types/softwareResource';
import { urlChecker } from '../../utils/urlChecker';
import { getAppKey, getCatalogUri } from '../loaders/configuration';
import { Catalog } from './models/Catalog';
import { DataService } from './models/DataService';
import { Dataset } from './models/Dataset';
import { Distribution } from './models/Distribution';
import { foaf } from './models/foaf';
import { skos } from './models/skos';
import { vcard } from './models/vcard';
import { Relationship } from './models/Relationship';
import { ICatalog } from '../../utils/types/catalog';
export const mapDataResource = (
    resource: IDataResource & { _id: string }
): Dataset => {
    const dataService = new DataService();
    dataService['@id'] = resource._id;
    dataService['@type'] = 'SoftwareResource';
    dataService['dcterms:title'] = resource.name;
    dataService['dcterms:description'] = resource.description;
    dataService['dcterms:issued'] = resource.createdAt;
    dataService['dcterms:modified'] = resource.updatedAt;
    dataService['dcterms:license'] = resource.license;
    dataService['dcat:version'] = resource.schema_version;
    dataService['odrl:hasPolicy'] = resource.policy;
    // providedBy
    dataService['dcterms:creator'] = new foaf.Agent();
    dataService['dcterms:creator'].account = resource.producedBy;
    // category
    dataService['dcat:theme'] = new skos.Concept();
    dataService['dcat:theme'].definition = resource.category;
    //
    dataService['dcterms:rights'] = resource.copyrightOwnedBy;
    dataService['dcat:endpointURL'] = resource.exposedThrough;

    return dataService;
};

export const mapSoftwareResource = (
    resource: ISoftwareResource & { _id: string }
): DataService => {
    const dataService = new DataService();
    dataService['@id'] = resource._id;
    dataService['@type'] = 'SoftwareResource';
    dataService['dcterms:title'] = resource.name;
    dataService['dcterms:description'] = resource.description;
    dataService['dcterms:issued'] = resource.createdAt;
    dataService['dcterms:modified'] = resource.updatedAt;
    dataService['dcterms:license'] = resource.license;
    dataService['dcat:version'] = resource.schema_version;
    dataService['odrl:hasPolicy'] = resource.policy;
    // providedBy
    dataService['dcterms:creator'] = new foaf.Agent();
    dataService['dcterms:creator'].account = resource.providedBy;
    // category
    dataService['dcat:theme'] = new skos.Concept();
    dataService['dcat:theme'].definition = resource.category;
    //
    dataService['dcterms:rights'] = resource.copyrightOwnedBy;
    dataService['dcterms:hasPart'] = (resource.aggregationOf || []).map(
        (resourceId: string) => {
            const dataset = new Dataset();
            dataset['@id'] = resourceId;
            return dataset;
        }
    );
    const countryCodes = resource.locationAddress.map(
        (element: { countryCode: any }) => {
            return element.countryCode;
        }
    );
    dataService['dcterms:language'] = countryCodes.join(';');
    dataService['dcat:endpointURL'] = resource.exposedThrough;

    dataService['dcat:endpointDescription'] = resource.demo_link;
    return dataService;
};
export const mapServiceOffering = async (
    resource: IServiceOffering & { _id: string }
): Promise<Catalog> => {
    const dataset = new Dataset();

    //distributions and relations for dataResources and softwareResources
    const distributions: Distribution | Distribution[] = [];
    const relations: Relationship | Relationship[] = [];
    for (const element of resource.aggregationOf) {
        const response = await axios.get(element);

        const relation = new Relationship();
        relation['dcat:hadRole'] = response.data['@type'];
        relation['dcterms:relation'] = element;
        relation['dcterms:description'] = response.data.description;
        relations.push(relation);

        if (response.data.representation) {
            const distribution = new Distribution();
            distribution['dcat:accessURL'] = response.data.representation.url;
            distribution['dcat:mediaType'] =
                response.data.representation.fileType;
            distribution['dcat:accessService'] =
                response.data['@type'] === 'SoftwareResource'
                    ? mapSoftwareResource(response.data)
                    : response.data['@type'] === 'DataResource'
                    ? mapDataResource(response.data)
                    : new DataService();
            distributions.push(distribution);
        }

        if (response.data.apiResponseRepresentation) {
            const distribution = new Distribution();
            distribution['dcat:accessURL'] =
                response.data.apiResponseRepresentation.url;
            distribution['dcat:mediaType'] =
                response.data.apiResponseRepresentation.fileType;
            distribution['dcat:accessService'] =
                response.data['@type'] === 'SoftwareResource'
                    ? mapSoftwareResource(response.data)
                    : response.data['@type'] === 'DataResource'
                    ? mapDataResource(response.data)
                    : new DataService();
            distributions.push(distribution);
        }
    }

    dataset['@id'] = resource._id;
    dataset['@type'] = 'ServiceOffering';
    dataset['dcterms:title'] = resource.name;
    dataset['dcterms:description'] = resource.description;
    dataset['dcterms:identifier'] = resource._id;
    //
    dataset['odrl:hasPolicy'] = resource.policy;
    dataset['dcterms:issued'] = resource.createdAt;
    dataset['dcterms:modified'] = resource.updatedAt;
    dataset['dcat:version'] = resource.schema_version;
    dataset['odrl:hasPolicy'] = resource.policy;
    dataset['dcat:keyword'] =
        resource.keywords.join(';') && resource.category.join(';');

    dataset['dcterms:hasPart'] = resource.aggregationOf;
    dataset['dcat:distribution'] = distributions;
    dataset['dcat:qualifiedRelation'] = relations;

    // providedBy
    dataset['dcterms:creator'] = new foaf.Agent();
    dataset['dcterms:creator'].account = resource.providedBy;
    //
    dataset['dcterms:spatial'] = resource.location;
    dataset['dcat:contactPoint'] = new vcard.Kind();
    dataset['dcat:contactPoint'].url = resource.dependsOn;
    dataset['dcterms:conformsTo'] = resource.termsAndConditions;
    // dataProtectionRegime: PersonalDataProtectionRegimes[];
    // dataAccountExport

    return dataset;
};

export const mapConnectorCatalogToDcatCatalog = (resources: any[]) => {
    return resources.map((element: ICatalog & { _id: string }) => element._id);
};

export const mapCatalog = async (resources: any[]) => {
    const dataset = resources.filter(
        (element) => element.type === 'serviceofferings'
    );

    return {
        '@context': 'https://w3id.org/dspace/2024/1/context.json',
        '@type': 'dcat:Catalog',
        'dcat:dataset': mapConnectorCatalogToDcatCatalog(dataset), //map as dataset
        'dspace:participantId': await getAppKey(), //get SD
        'foaf:homepage': urlChecker(await getCatalogUri(), 'catalog/offers'),
    };
};
