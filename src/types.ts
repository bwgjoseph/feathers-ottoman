import { ServiceOptions } from '@feathersjs/adapter-commons';
import { SearchConsistency, ModelTypes } from 'ottoman';

interface OttomanOptions {
  Model: ModelTypes;
  ottoman: {
    lean: boolean;
    consistency: SearchConsistency;
  }
}

type OttomanServiceOptions = OttomanOptions & Partial<ServiceOptions>;

type Filters = Record<string, any>;

type Methods = 'find' | 'default';

export {
  OttomanOptions,
  OttomanServiceOptions,
  Filters,
  Methods,
};
