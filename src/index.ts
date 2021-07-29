import { AdapterService, InternalServiceMethods, select } from '@feathersjs/adapter-commons';
import { BadRequest, NotFound } from '@feathersjs/errors';
import {
  Id, NullableId, Paginated, Params, Query,
} from '@feathersjs/feathers';
import { SearchConsistency, ModelTypes } from 'ottoman';
import { OttomanServiceOptions, Filters, Methods } from './types';

const defaultOptions = {
  id: 'id',
  ottoman: {
    lean: true,
    consistency: SearchConsistency.NONE,
  },
};

const SORT_ORDER = new Map([
  [1, 'ASC'],
  [-1, 'DESC'],
]);

const _select = (data: any, params: any, ...args: any[]) => {
  if (!params.query?.$select) return data;

  const base = select(params, ...args);

  return base(JSON.parse(JSON.stringify(data)));
};

/**
 * Allow `$ignoreCase` as additional filters option
 * See {@link https://ottomanjs.com/classes/findoptions.html findOptions}
 */
const filterQueryOpts = {
  filters: ['$ignoreCase'],
};

const _hasQueryDefined = (data: Record<string, any>): boolean => Object.keys(data).length > 0;

// this.filterQuery returns { filters: {}, query: {}, paginate: {} }
// filters = $sort, $skip, $limit, $select
class OttomanService<T = any> extends AdapterService<T> implements InternalServiceMethods<T> {
  _options: OttomanServiceOptions;

  constructor(config: OttomanServiceOptions) {
    if (!config.Model) throw new Error('Model must be provided');

    super({ ...defaultOptions, ...config });
    this._options = config;
  }

  get Model(): ModelTypes {
    return this._options.Model;
  }

  /**
   * In Couchbase, an id can be number but internally, it is still stored as string
   * Hence, the query by Id still needs to pass in as String rather than Number
   *
   * @param id Id
   * @returns id in string
   */
  _getId(id: Id): string {
    if (typeof id === 'string') return id;

    return id.toString();
  }

  /**
   * Maps $select to select
   *
   * Append `id` field to $select if not defined by caller
   * Without doing so, the result to caller would be without `id` field
   *
   * @param filters filters
   * @returns select filters
   */
  _getSelectQuery(filters: Filters): Query {
    const { $select } = filters;

    if (!$select) return {};

    // must always concat with id
    if (!$select.includes(this.id)) {
      $select.push(this.id);
    }

    return { select: $select };
  }

  /**
   * Maps $sort to sort
   *  - 1 to ASC
   *  - -1 to DESC
   *
   * @param filters filters
   * @returns sort filters
   */
  _getSortQuery(filters: Filters): Query {
    const { $sort } = filters;

    if (!$sort) return {};

    const sort = Object.entries($sort).reduce(
      (acc, [k, v]) => ({
        ...acc,
        [k]: SORT_ORDER.get(v as number),
      }),
      {},
    );

    return { sort };
  }

  /**
   * Maps $limit to limit
   *  - 1 to ASC
   *  - -1 to DESC
   *
   * @param filters filters
   * @returns limit filters
   */
  _getLimitQuery(filters: Filters): Query {
    const { $limit } = filters;

    // 0 is a valid value where should return empty data array
    // See https://docs.feathersjs.com/api/databases/querying.html#limit
    if (!$limit && $limit !== 0) return {};

    return {
      // may need to abs($limit)
      // see https://github.com/Automattic/mongoose/issues/3473
      // but check with what's the behavior for common API
      limit: $limit,
    };
  }

  /**
   * Maps $skip to skip
   *
   * @param filters filters
   * @returns skip filters
   */
  _getSkipQuery(filters: Filters): Query {
    const { $skip } = filters;

    if (!$skip) return {};

    return { skip: $skip };
  }

  /**
   * Maps $ignoreCase to ignoreCase
   *
   * @param filters filters
   * @returns ignoreCase filters
   */
  _getIgnoreCaseQuery(filters: Filters): Query {
    const { $ignoreCase } = filters;

    if (!$ignoreCase) return {};

    return { ignoreCase: $ignoreCase };
  }

  /**
   * We need to map some of the operator between Common API and Ottoman
   *
   * Maps (Common API : Ottoman):
   *  - $ne : $neq
   *  - $nin: $notIn
   *
   * After mapping, the correct query construct can then be passed into
   * Ottoman API options so that it can process correctly
   *
   * Since `Ottoman.beta.3`, it simplify some of the operator query such as `$in, $notIn, etc`
   * See {@link https://github.com/bwgjoseph/mongoose-vs-ottoman/issues/87 simplify operator usage}
   *
   * @param query query
   * @returns Query
   */
  _mapQueryOperator(query: Query): Query {
    const keys = new Map();

    Object.entries(query)
      .forEach(([k, v]: any) => {
        if (v && typeof v === 'object' && v.$ne) {
          keys.set(k, { $neq: v.$ne });
        } else if (v && typeof v === 'object' && v.$nin) {
          keys.set(k, { $notIn: v.$nin });
        } else {
          keys.set(k, v);
        }
      });

    let operatorQuery = {};

    keys.forEach((v, k) => {
      // assign default query
      const q: Record<string, unknown> = { [k]: v };

      operatorQuery = {
        ...operatorQuery,
        ...q,
      };
    });

    return operatorQuery;
  }

  /**
   * Workaround to support '.get/remove/update/patch + id + query *' syntax
   * as Ottoman does not allow to pass in additional query with `*ById` method
   *
   * @param id Id
   * @param params Params
   * @returns reconstructed query
   */
  _getQuery(id: string, params: Params): Query {
    let { query } = this.filterQuery(params);
    query = this._mapQueryOperator(query);

    if (id) {
      // Pass in both `id` and `query.id`
      if (query[this.id]) {
        const { [this.id]: tId, ...restQuery } = query;

        return {
          ...restQuery,
          $and: [
            {
              [this.id]: id,
            },
            {
              [this.id]: query[this.id],
            },
          ],
        };
      }

      return {
        ...query,
        [this.id]: id,
      };
    }

    return query;
  }

  /**
   * Construct the filters to pass into Ottoman API options
   *
   * @param filters filters
   * @param method find | default
   * @returns Ottoman options
   */
  _getOptions(filters: Filters, method: Methods = 'default'): Query {
    if (method === 'default') {
      return {
        ...this._options.ottoman,
        ...this._getSelectQuery(filters),
      };
    }

    return {
      ...this._options.ottoman,
      ...this._getSelectQuery(filters),
      ...this._getSortQuery(filters),
      ...this._getLimitQuery(filters),
      ...this._getSkipQuery(filters),
      ...this._getIgnoreCaseQuery(filters),
    };
  }

  async _find(params: Params = {}): Promise<T | T[] | Paginated<T>> {
    const { filters, paginate, query } = this.filterQuery(params, filterQueryOpts);
    const cQuery = this._mapQueryOperator(query);
    const cOptions = this._getOptions(filters, 'find');

    const [result, total] = await Promise.all([
      this.Model.find(cQuery, cOptions),
      Object.keys(paginate).length > 0 ? this.Model.count(cQuery) : -1,
    ]);

    if (total >= 0) {
      return {
        total,
        limit: filters.$limit,
        skip: filters.$skip || 0,
        data: result.rows,
      };
    }

    return (result.rows && result.rows.length > 0) ? result.rows : [];
  }

  async _get(id: Id, params: Params = {}): Promise<T> {
    const { filters, query } = this.filterQuery(params);
    const cOptions = this._getOptions(filters);

    if (_hasQueryDefined(query)) {
      const cQuery = this._getQuery(this._getId(id), params);

      const { rows } = await this.Model.find(cQuery, cOptions);

      if (rows && rows[0]) return rows[0];

      throw new NotFound(`No record found for id ${id}`);
    }

    return this.Model
      .findById(this._getId(id), cOptions)
      .catch(() => { throw new NotFound(`No record found for id ${id}`); });
  }

  async _create(data: Partial<T> | Partial<T>[], params: Params = {}): Promise<T | T[]> {
    if (Array.isArray(data)) {
      return Promise.all(data.map((current) => this._create(current, params))) as Promise<T[]>;
    }

    return this.Model
      .create(data)
      .then((result) => _select(result, params, this.id));
  }

  async _update(id: Id, data: T, params: Params = {}): Promise<T> {
    if (id === null) {
      return Promise.reject(new BadRequest('You can not replace multiple instances. Did you mean \'patch\'?'));
    }

    const { filters, query } = this.filterQuery(params);

    if (_hasQueryDefined(query)) {
      const cQuery = this._getQuery(this._getId(id), params);
      const cOptions = this._getOptions(filters);

      const { message } = await this.Model.updateMany(cQuery, data, cOptions);

      if (message && message.success > 0) return _select(message.data, params, this.id);

      throw new NotFound(`No record found for id ${id}`);
    }

    return this.Model
      .replaceById(this._getId(id), data)
      .then((result) => _select(result, params, this.id))
      .catch(() => { throw new NotFound(`No record found for id ${id}`); });
  }

  async _patch(id: NullableId, data: Partial<T>, params: Params = {}): Promise<T | T[]> {
    const { filters, query } = this.filterQuery(params);
    const cOptions = this._getOptions(filters);

    if (id === null) {
      const cQuery = this._mapQueryOperator(query);
      const entries = await this._find({ ...params, paginate: false }) as T[];
      const { message } = await this.Model.updateMany(cQuery, data, cOptions);

      if (message && message.success > 0) {
        return entries.map((e) => ({ ...e, ...data }));
      }

      throw new NotFound(`No record found for query ${query}`);
    }

    if (_hasQueryDefined(query)) {
      const cQuery = this._getQuery(this._getId(id), params);
      const { message } = await this.Model.updateMany(cQuery, data, cOptions);

      if (message && message.success > 0) return _select(message.data, params, this.id);

      throw new NotFound(`No record found for id ${id}`);
    }

    return this.Model
      .updateById(this._getId(id), data)
      .then((result) => _select(result, params, this.id))
      .catch(() => { throw new NotFound(`No record found for id ${id}`); });
  }

  async _remove(id: NullableId, params: Params = {}): Promise<T | T[]> {
    const { query } = this.filterQuery(params);

    if (id === null) {
      const cQuery = this._mapQueryOperator(query);
      // get all current data before removing
      const allData = await this._find({ ...params, paginate: false }) as T[];
      await this.Model.removeMany(cQuery, this._options.ottoman);

      return allData;
    }

    // get current data before removing
    const data = await this._get(this._getId(id));

    if (_hasQueryDefined(query)) {
      const { filters } = this.filterQuery(params);
      const cQuery = this._getQuery(this._getId(id), params);
      const cOptions = this._getOptions(filters);

      const { message } = await this.Model.removeMany(cQuery, cOptions);

      if (message && message.success > 0) return _select(data, params, this.id);

      throw new NotFound(`No record found for id ${id}`);
    }

    return this.Model
      .removeById(this._getId(id))
      .then(() => _select(data, params, this.id));
  }
}

const InternalOttomanService = (options: OttomanServiceOptions)
: OttomanService => new OttomanService(options);

export default InternalOttomanService;

export {
  OttomanServiceOptions,
  OttomanService as Service,
};
