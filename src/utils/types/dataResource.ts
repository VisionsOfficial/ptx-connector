import { IDataRepresentation } from './dataRepresentation';

export interface IDataResource {
    representation?: IDataRepresentation;
    apiResponseRepresentation?: IDataRepresentation;
    createdAt?: Date;
    updatedAt?: Date;
    name?: any;
    description?: any;
    license?: any;
    policy?: any;
    producedBy?: any;
    schema_version?: any;
    country_or_region?: any;
    copyrightOwnedBy?: any;
    category?: any;
    subCategories?: any;
    exposedThrough?: any;
}
