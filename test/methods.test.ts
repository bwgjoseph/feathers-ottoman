import assert from 'assert';

const customTestSuite = (app: any, serviceName: string): void => {
  describe('adapter methods', () => {
    let service: any;

    beforeEach(() => {
      service = app.service(serviceName);
    });

    afterEach(async () => {
      service.options.multi = ['remove'];
      await service.remove(null);
      service.options.multi = [];
      service.options.whitelist = [];
    });

    it('.get + id + query (id + $ne)', async () => {
      const data = await service.create({ name: 'Dave', age: 29, created: true });

      try {
        await service.get(data.id, {
          query: { id: 'other', name: { $ne: 'Dave' } },
        });
        throw new Error('Should never get here');
      } catch (error) {
        assert.strictEqual(error.name, 'NotFound',
          `No record found for id ${data.id}`);
      }
    });

    it('.create + multi + $select', async () => {
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

      service.options.multi = [];
    });

    it('.update + multi', async () => {
      try {
        await service.update(null, {});
        throw new Error('Should never get here');
      } catch (error) {
        assert.strictEqual(error.name, 'BadRequest',
          'You can not replace multiple instances. Did you mean \'patch\'');
      }
    });

    it('.update + id + query (id + $ne)', async () => {
      const data = await service.create({ name: 'Dave', age: 29, created: true });

      try {
        await service.update(data.id, { name: 'joseph' }, {
          query: { id: 'other', name: { $ne: 'Dave' } },
        });
        throw new Error('Should never get here');
      } catch (error) {
        assert.strictEqual(error.name, 'NotFound',
          `No record found for id ${data.id}`);
      }
    });

    it('.patch + id + query (id + $ne)', async () => {
      const data = await service.create({ name: 'Dave', age: 29, created: true });

      try {
        await service.patch(data.id, { name: 'joseph' }, {
          query: { id: 'other', name: { $ne: 'Dave' } },
        });
        throw new Error('Should never get here');
      } catch (error) {
        assert.strictEqual(error.name, 'NotFound',
          `No record found for id ${data.id}`);
      }
    });

    it('.patch + multi + $select', async () => {
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

      service.options.multi = [];
    });

    it('.patch + multi + $ne', async () => {
      service.options.multi = ['patch'];

      await service.create({ name: 'Dave', age: 29, created: true });
      await service.create({ name: 'David', age: 3, created: true });

      const data = await service.patch(null, { age: 10 }, {
        query: { name: { $ne: 'Dave' } },
      });

      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].name, 'David');
      assert.strictEqual(data[0].age, 10);

      service.options.multi = [];
    });

    it('.remove + id + query (id + $ne)', async () => {
      const data = await service.create({ name: 'Dave', age: 29, created: true });

      try {
        await service.remove(data.id, {
          query: { id: 'other', name: { $ne: 'Dave' } },
        });
        throw new Error('Should never get here');
      } catch (error) {
        assert.strictEqual(error.name, 'NotFound',
          `No record found for id ${data.id}`);
      }
    });

    it('.remove + multi + $select', async () => {
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

      service.options.multi = [];
    });

    it('.remove + multi + $ne', async () => {
      service.options.multi = ['remove'];

      await service.create({ name: 'Dave', age: 29, created: true });
      await service.create({ name: 'David', age: 3, created: true });

      const data = await service.remove(null, {
        query: { name: { $ne: 'Dave' } },
      });

      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].name, 'David');

      service.options.multi = [];
    });

    it('.find + $ignoreCase filter', async () => {
      await service.create({ name: 'Dave', age: 29, created: true });

      const q = { name: 'dave', $ignoreCase: true };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Dave');
    });

    it('.find + $eq', async () => {
      service.options.whitelist = ['$eq'];

      await service.create({ name: 'Dave', age: 29, created: true });

      const q = { name: { $eq: 'Dave' } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Dave');
    });

    it('.find + $eq + $ignoreCase', async () => {
      service.options.whitelist = ['$eq', '$ignoreCase'];

      await service.create({ name: 'Dave', age: 29, created: true });

      const q = { name: { $eq: 'dave', $ignoreCase: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Dave');
    });

    it('.find + $neq', async () => {
      service.options.whitelist = ['$neq'];

      await service.create({ name: 'Dave', age: 29, created: true });
      await service.create({ name: 'David', age: 29, created: true });

      const q = { name: { $neq: 'Dave' } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'David');
    });

    it('.find + $like', async () => {
      service.options.whitelist = ['$like'];

      await service.create({ name: 'Dave', age: 29, created: true });

      const q = { name: { $like: 'D%' } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Dave');
    });

    it('.find + $notLike', async () => {
      service.options.whitelist = ['$notLike'];

      await service.create({ name: 'Dave', age: 29, created: true });
      await service.create({ name: 'Joseph', age: 29, created: true });

      const q = { name: { $notLike: 'D%' } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Joseph');
    });

    it('.find + $btw', async () => {
      service.options.whitelist = ['$btw'];

      await service.create({ name: 'Dave', age: 10, created: true });
      await service.create({ name: 'Joseph', age: 30, created: true });

      const q = { age: { $btw: [1, 20] } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Dave');
    });

    it('.find + $notBtw', async () => {
      service.options.whitelist = ['$notBtw'];

      await service.create({ name: 'Dave', age: 10, created: true });
      await service.create({ name: 'Joseph', age: 30, created: true });

      const q = { age: { $notBtw: [1, 20] } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Joseph');
    });

    it('.find + $isNull', async () => {
      service.options.whitelist = ['$isNull'];

      await service.create({ name: null, age: 10, created: true });
      const q = { name: { $isNull: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, null);
      assert.strictEqual(data[0].age, 10);
    });

    it('.find + $isNotNull', async () => {
      service.options.whitelist = ['$isNotNull'];

      await service.create({ age: 10, created: true });
      await service.create({ name: 'Joseph', age: 30, created: true });

      const q = { name: { $isNotNull: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Joseph');
    });

    it('.find + $isMissing', async () => {
      service.options.whitelist = ['$isMissing'];

      await service.create({ age: 10, created: true });
      await service.create({ name: 'David', age: 30, created: true });

      const q = { name: { $isMissing: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].age, 10);
    });

    it('.find + $isNotMissing', async () => {
      service.options.whitelist = ['$isNotMissing'];

      await service.create({ name: 'Dave', age: 10, created: true });
      await service.create({ age: 20, created: true });

      const q = { name: { $isNotMissing: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'Dave');
    });

    it('.find + $isValued', async () => {
      service.options.whitelist = ['$isValued'];

      await service.create({ age: 10, created: true });
      await service.create({ name: 'David', age: 30, created: true });

      const q = { name: { $isValued: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].name, 'David');
    });

    it('.find + $isNotValued', async () => {
      service.options.whitelist = ['$isNotValued'];

      await service.create({ age: 10, created: true });
      await service.create({ name: 'David', age: 30, created: true });

      const q = { name: { $isNotValued: true } };
      const data = await service.find({ query: q });

      assert.strictEqual(data.length, 1, 'returned one entries');
      assert.strictEqual(data[0].age, 10);
    });
  });
};

export default customTestSuite;
