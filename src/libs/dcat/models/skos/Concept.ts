import { skos } from '.';

export class Concept {
    public inScheme: skos.ConceptScheme;
    public topConceptOf: skos.ConceptScheme;
    public definition: any;
}
