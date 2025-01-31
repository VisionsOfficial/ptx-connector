import { IDataRepresentation } from './dataRepresentation';

export interface ISoftwareResource {
    representation?: IDataRepresentation;
    apiResponseRepresentation?: IDataRepresentation;
    createdAt?: Date;
    updatedAt?: Date;
    name?: any;
    description?: any;
    license?: any;
    policy?: any;
    schema_version?: any;
    country_or_region?: any;
    copyrightOwnedBy?: any;
    category?: any;
    subCategories?: any;
    exposedThrough?: any;
    providedBy?: any;
    aggregationOf?: any;
    locationAddress?: any;
    demo_link?: any;
}
