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
   * @returns limit filters
   */
  _getSkipQuery(filters: Filters): Query {
    const { $skip } = filters;

    if (!$skip) return {};

    return { skip: $skip };
  }

  /**
   * We need to map some of the operator between Common API and Ottoman
   *
   * Maps (Common API : Ottoman):
   *  - $ne : $neq
   *  - $in : $in { search_expr: k, target_expr: v }
   *  - $nin: $not: [{ $in { search_expr: k, target_expr: v } }]
   *
   * After mapping, the correct query construct can then be passed into
   * Ottoman API options so that it can process correctly
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
        } else if (v && typeof v === 'object' && v.$in) {
          keys.set(k, { $in: { search_expr: k, target_expr: v.$in } });
        } else if (v && typeof v === 'object' && v.$nin) {
          keys.set(k, { $not: [{ $in: { search_expr: k, target_expr: v.$nin } }] });
        } else {
          keys.set(k, v);
        }
      });

    let operatorQuery = {};

    // the query construct of $in and $nin in Ottoman is slightly
    // where they key is not the `fieldname` but rather the `operator`
    // for example, instead of `name: { $in: ['x'] }`
    // it's `$in: { search_expr: 'name', target_expr: ['x'] }`
    keys.forEach((v, k) => {
      // assign default query
      let q: Record<string, unknown> = { [k]: v };

      if (v.$in) {
        q = { $in: v.$in };
      }

      if (v.$not) {
        q = { $not: v.$not };
      }

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
    const { query } = this.filterQuery(params);

    if (id) {
      // Pass in both `id` and `query.id`
      if (query[this.id]) {
        const { [this.id]: tId, ...restQuery } = query;

        return {
          ...restQuery,
          $and: [
            {
              id,
            },
            {
              id: query[this.id],
            },
          ],
        };
      }

      return {
        ...query,
        id,
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
    };
  }

  async _find(params: Params = {}): Promise<T | T[] | Paginated<T>> {
    const { filters, paginate, query } = this.filterQuery(params);
    const cQuery = this._mapQueryOperator(query);
    const cOptions = this._getOptions(filters, 'find');

    const result = await this.Model.find(cQuery, cOptions);

    if (Object.keys(paginate).length > 0) {
      return {
        total: await this.Model.count(cQuery),
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
      return Promise.reject(new BadRequest('Not replacing multiple records. Did you mean `patch`?'));
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

    if (id == null) {
      const entries = await this._find({ ...params, paginate: false }) as T[];
      const { message } = await this.Model.updateMany(query, data, cOptions);

      if (message && message.success > 0) {
        return entries.map((e) => _select({ ...e, ...data }, params, this.id));
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

    if (id == null) {
      // get all current data before removing
      const allData = await this._find({ ...params, paginate: false }) as T[];
      await this.Model.removeMany(query, this._options.ottoman);

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
