import adapterTests from '@feathersjs/adapter-tests';
import errors from '@feathersjs/errors';
import feathers from '@feathersjs/feathers';
import assert from 'assert';
import {
  getDefaultInstance, getModel, Ottoman, Schema, SearchConsistency,
} from 'ottoman';
import { ModelOptions } from 'ottoman/lib/types/model/interfaces/create-model.interface';
import { Service } from '../src/index';

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

  ottoman.connect({
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

const removeDocuments = async () => {
  const query = `
    DELETE FROM \`testBucket\`.testpostscope.testpostcollection
    `;
  try {
    await getDefaultInstance().cluster.query(query, { scanConsistency: 'request_plus' });
  } catch (err) {
    console.error(err);
    throw err;
  }
};

describe('Feathers Ottoman Service', () => {
  let app: any;

  before(async () => {
    await initOttoman();
    await removeDocuments();

    const options = {
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

  it('.update + multi', async () => {
    try {
      await app.service('posts').update(null, {});
      throw new Error('Should never get here');
    } catch (error) {
      assert.strictEqual(error.name, 'BadRequest',
        'You can not replace multiple instances. Did you mean \'patch\'');
    }
  });

  it('.create + multi + $select', async () => {
    const service = app.service('posts');
    service.options.multi = ['create'];

    const items = [
      {
        name: 'Gerald',
        age: 18,
      },
      {
        name: 'Herald',
        age: 18,
      },
    ];

    const data = await service.create(items, {
      query: { $select: ['name'] },
    });

    assert.ok(Array.isArray(data), 'data is an array');
    assert.ok(typeof data[0].id !== 'undefined', 'id is set');
    assert.strictEqual(data[0].name, 'Gerald', 'first name matches');
    assert.ok(typeof data[1].id !== 'undefined', 'id is set');
    assert.strictEqual(data[1].name, 'Herald', 'second name macthes');
    assert.ok(!data[0].age, 'data.age is falsy');
    assert.ok(!data[1].age, 'data.age is falsy');

    await service.remove(data[0].id);
    await service.remove(data[1].id);

    service.options.multi = [];
  });

  it('.patch + multi + $select', async () => {
    const service = app.service('posts');
    service.options.multi = ['patch'];

    await service.create({ name: 'Dave', age: 29, created: true });
    await service.create({ name: 'David', age: 3, created: true });

    const data = await service.patch(null, { age: 2 }, {
      query: { created: true, $select: ['age'] },
    });

    assert.strictEqual(data.length, 2, 'returned two entries');
    assert.strictEqual(data[0].age, 2, 'First entry age was updated');
    assert.strictEqual(data[1].age, 2, 'Second entry age was updated');
    assert.ok(!data[0].name, 'data.name is falsy');
    assert.ok(!data[1].name, 'data.name is falsy');

    await service.remove(data[0].id);
    await service.remove(data[1].id);

    service.options.multi = [];
  });

  it('.remove + multi + $select', async () => {
    const service = app.service('posts');
    service.options.multi = ['remove'];

    await service.create({ name: 'Dave', age: 29, created: true });
    await service.create({ name: 'David', age: 3, created: true });

    const data = await service.remove(null, {
      query: { created: true, $select: ['name'] },
    });

    const names = data.map((person: any) => person.name);

    assert.strictEqual(data.length, 2, 'returned two entries');
    assert.ok(names.includes('Dave'), 'Dave removed');
    assert.ok(names.includes('David'), 'David removed');
    assert.ok(!data[0].age, 'data.age is falsy');
    assert.ok(!data[1].age, 'data.age is falsy');

    await service.remove(null);

    service.options.multi = [];
  });

  it('.find + $ignoreCase filter', async () => {
    const service = app.service('posts');

    await service.create({ name: 'Dave', age: 29, created: true });

    const q = { name: 'dave', $ignoreCase: true };
    const data = await service.find({ query: q });

    assert.strictEqual(data.length, 1, 'returned one entries');
    assert.strictEqual(data[0].name, 'Dave');

    await service.remove(data[0].id);
  });
});
