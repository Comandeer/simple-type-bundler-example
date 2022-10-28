import { Fixture } from './Fixture';

export interface Test {
	readonly name: string;
	createFixture( name: string ): Fixture;
}