import adapterTests from '@feathersjs/adapter-tests';
import errors from '@feathersjs/errors';
import feathers from '@feathersjs/feathers';
import assert from 'assert';
import {
  getDefaultInstance, QueryScanConsistency, getModel, Ottoman, Schema, SearchConsistency, ModelOptions,
} from 'ottoman';
import { OttomanServiceOptions, Service } from '../src/index';
import customTestSuite from './methods.test';

const testSuite = adapterTests([
  '.options',
  '.events',
  '._get',
  '._find',
  '._create',
  '._update',
  '._patch',
  '._remove',
  '.get',
  '.get + $select',
  '.get + id + query',
  '.get + NotFound',
  '.get + id + query id',
  '.find',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.remove + id + query id',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.update + id + query id',
  '.update + query + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multi query same',
  '.patch multi query changed',
  '.patch + NotFound',
  '.patch + id + query id',
  '.patch + query + NotFound',
  '.create',
  '.create + $select',
  '.create multi',
  'internal .find',
  'internal .get',
  'internal .create',
  'internal .update',
  'internal .patch',
  'internal .remove',
  '.find + equal',
  '.find + equal multiple',
  '.find + $sort',
  '.find + $sort + string',
  '.find + $limit',
  '.find + $limit 0',
  '.find + $skip',
  '.find + $select',
  '.find + $or',
  '.find + $in',
  '.find + $nin',
  '.find + $lt',
  '.find + $lte',
  '.find + $gt',
  '.find + $gte',
  '.find + $ne',
  '.find + $gt + $lt + $sort',
  '.find + $or nested + $sort',
  '.find + paginate',
  '.find + paginate + $limit + $skip',
  '.find + paginate + $limit 0',
  '.find + paginate + params',
]);

const initOttoman = async () => {
  let ottoman = getDefaultInstance();

  if (!ottoman) {
    ottoman = new Ottoman({ collectionName: '_default' });
  }

  await ottoman.connect({
    connectionString: 'couchbase://localhost',
    bucketName: 'testBucket',
    username: 'user',
    password: 'password',
  });

  const modelOptions: ModelOptions = {
    scopeName: 'testpostscope',
    collectionName: 'testpostcollection',
  };

  const schema = new Schema({
    name: { type: String },
    age: { type: Number },
    created: { type: Boolean },
  });

  ottoman.model('posts', schema, modelOptions);
  ottoman.model('customPosts', schema, { ...modelOptions, idKey: 'customid' });

  await ottoman.start();

  return ottoman;
};

const initIndexes = async () => {
  const createIndexQuery = `
    CREATE PRIMARY INDEX ON \`testBucket\`.\`testpostscope\`.\`testpostcollection\`
    `;

  try {
    await getDefaultInstance().cluster.query(createIndexQuery, { scanConsistency: QueryScanConsistency.RequestPlus });
  } catch (err) {
    console.error(err);
  }
};

const removeDocuments = async () => {
  const query = `
    DELETE FROM \`testBucket\`.testpostscope.testpostcollection
    `;
  try {
    await getDefaultInstance().cluster.query(query, { scanConsistency: QueryScanConsistency.RequestPlus });
  } catch (err) {
    console.error(err);
    throw err;
  }
};

describe('Feathers Ottoman Service', () => {
  let app: any;

  before(async () => {
    await initOttoman();
    await initIndexes();
    await removeDocuments();

    const options: OttomanServiceOptions = {
      Model: getModel('posts'),
      ottoman: {
        lean: true,
        consistency: SearchConsistency.GLOBAL,
      },
      events: ['testing'],
    };

    const optionsCustomId = {
      ...options,
      Model: getModel('customPosts'),
      id: 'customid',
    };

    app = feathers()
      .use('/posts', new Service(options))
      .use('/posts-customid', new Service(optionsCustomId));
  });

  it('exports', () => {
    assert.ok(typeof Service === 'function');
  });

  it('run test suite', () => {
    testSuite(app, errors, 'posts', 'id');
  });

  it('run test suite - customid', () => {
    testSuite(app, errors, 'posts-customid', 'customid');
  });

  it('run custom test suite', () => {
    customTestSuite(app, 'posts');
  });
});
