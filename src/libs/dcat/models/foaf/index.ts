/* eslint-disable @typescript-eslint/no-namespace */
import { Agent as _Agent } from './Agent';
import { Person as _Person } from './Person';
import { Organization as _Organization } from './Organization';

export namespace foaf {
    export class Agent extends _Agent {}
    export class Person extends _Person {}
    export class Organization extends _Organization {}
}
