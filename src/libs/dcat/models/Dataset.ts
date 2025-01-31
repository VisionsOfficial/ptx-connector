import { DatasetSeries } from './DatasetSeries';
import { dcterms } from './dcterms';
import { Distribution } from './Distribution';
import { Resource } from './Resource';

export class Dataset extends Resource {
    public 'dcat:distribution'?: Distribution | Distribution[];
    public 'dcterms:accrualPeriodicity'?: string;
    public 'dcat:inSeries'?: DatasetSeries;
    public 'dcterms:spatial'?: string; // geographicalCoverage;
    public 'dcat:spatialResolutionInMeters'?: number;
    public 'dcterms:temporal'?: dcterms.PeriodOfTime;
    public 'dcat:temporalResolution'?: string;
}
