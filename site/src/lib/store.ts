/**
 * Build-time entry point to the fact store. Importing this module verifies the whole store;
 * a single invalid fact fails the build (PB-1 publishes only verified facts).
 */
import { CHANGES } from '../data/changes';
import { DESTINATIONS, DESTINATION_BY_SLUG } from '../data/destinations';
import { FACTS, SEED_DATE, SIGNALS } from '../data/facts';
import { INDIA_FACTS } from '../data/sourced';
import { toIsoDate } from './facts';
import { assertValidStore } from './validate';

export const BUILD_DATE = toIsoDate(new Date());

assertValidStore({ facts: [...FACTS, ...INDIA_FACTS], signals: SIGNALS, changes: CHANGES }, BUILD_DATE);

export { CHANGES, DESTINATIONS, DESTINATION_BY_SLUG, FACTS, INDIA_FACTS, SEED_DATE, SIGNALS };
