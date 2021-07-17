# feathers-ottoman

[![GitHub license](https://img.shields.io/github/license/bwgjoseph/feathers-ottoman?style=flat-square)](https://github.com/bwgjoseph/feathers-ottoman/blob/master/LICENSE)
[![Download Status](https://img.shields.io/npm/dm/feathers-ottoman.svg?style=flat-square)](https://www.npmjs.com/package/feathers-ottoman)

__IMPORTANT__: This is still in early development stage, please report any issue found

This library is written against [ottoman-2.0.0-beta.3](https://github.com/couchbaselabs/node-ottoman). It is tested against [Couchbase 7.0 BETA](https://docs.couchbase.com/server/7.0/introduction/intro.html) which supports [scope and collection](https://docs.couchbase.com/server/7.0/learn/data/scopes-and-collections.html) and it should work with current version, [Couchbase 6.6](https://docs.couchbase.com/server/current/introduction/intro.html)

---

A [Feathers](https://feathersjs.com) database adapter for [Ottoman](https://ottomanjs.com/), an object modeling tool for [Couchbase](https://www.couchbase.com/)

```bash
$ npm install feathers-ottoman
```

> __Important:__ `feathers-ottoman` implements the [Feathers Common database adapter API](https://docs.feathersjs.com/api/databases/common.html) and [querying syntax](https://docs.feathersjs.com/api/databases/querying.html)

> This adapter also requires a [running Couchbase](https://docs.couchbase.com/tutorials/getting-started-ce/index.html) database server

## API

### `service([options])`

Returns a new service instance initialized with the given options. `Model` has to be a `Ottoman` model. See the [Ottoman Guide](https://ottomanjs.com/guides/schema.html#defining-your-schema) for more information on defining your model

```js
// commonjs
const service = require('feathers-ottoman');
// es6 / typescript
import { service } from 'feathers-ottoman';

app.use('/messages', service({ Model }));
app.use('/messages', service({ Model, id, events, paginate, ottoman: { lean, consistency } }));
```

__Options:__

- `Model` (**required**) - The Ottoman model definition
- `id` (*optional*, default: `'id'`) - The name of the id field property. Note that the `id` has to be also define when initializing the `Ottoman Model` if not using default value
- `events` (*optional*) - A list of [custom service events](https://docs.feathersjs.com/api/events.html#custom-events) sent by this service
- `paginate` (*optional*) - A [pagination object](https://docs.feathersjs.com/api/databases/common.html#pagination) containing a `default` and `max` page size
- `whitelist` (*optional*) - A list of additional query parameters to allow
- `multi` (*optional*) - Allow `create` with arrays and `update` and `remove` with `id` `null` to change multiple items. Can be `true` for all methods or an array of allowed methods (e.g. `[ 'remove', 'create' ]`)
- `ottoman.lean` (*optional*, default: `true`) - Runs queries faster by returning plain objects instead of `Ottoman Model`
- `ottoman.consistency` (*optional*, default: `NONE`) - Define default [Search Consistency Strategy](https://docs.couchbase.com/server/current/learn/services-and-indexes/indexes/index-replication.html#index-consistency)

> **Note:** You can get access to the Ottoman model via `this.Model` inside a [hook](https://docs.feathersjs.com/api/hooks.html) and use it as usual. See the [Ottoman Guide](https://ottomanjs.com/guides/schema.html#defining-your-schema) for more information on defining your model

## Example

Here is an example of a Feathers server with a `messages` Ottoman service

```
$ npm install @feathersjs/feathers @feathersjs/express ottoman feathers-ottoman
```

In `index.js`:

```js
// Initialize Ottoman connection
const { Ottoman, getModel, Schema, SearchConsistency } = require('ottoman');

const ottoman = new Ottoman();

ottoman.connect({
  connectionString: 'couchbase://localhost',
  bucketName: 'messageBucket',
  username: 'user',
  password: 'password',
});

const modelOptions = {
  // specify `idKey` if not using default
  // idKey: 'customId',
  scopeName: 'messageScope',
  collectionName: 'messageCollection',
};

const schema = new Schema({
  text: { type: String },
});

ottoman.model('message', schema, modelOptions);

ottoman.start();

// Setup feathers service
const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');

const { Service } = require('feathers-ottoman');

// Creates an ExpressJS compatible Feathers application
const app = express(feathers());

// Parse HTTP JSON bodies
app.use(express.json());
// Parse URL-encoded params
app.use(express.urlencoded({ extended: true }));
// Host static files from the current folder
app.use(express.static(__dirname));
// Add REST API support
app.configure(express.rest());
// Register a Ottoman message service
app.use('/messages', new Service({
  Model: getModel('message'),
  // if `idKey` is specify for the Model
  // id: 'customid',
  ottoman: {
    lean: true,
    consistency: SearchConsistency.LOCAL,
  },
  paginate: {
    default: 10,
    max: 100
  }
}));
// Register a nicer error handler than the default Express one
app.use(express.errorHandler());

// Create a dummy Message
app.service('messages').create({
  text: 'Message created on Ottoman server'
}).then(function(message) {
  console.log('Created messages', message);
});

app.listen(3030).on('listening', () => console.log('feathers-ottoman example started'));
```

Run the example with `node .` and go to [localhost:3030/messages](http://localhost:3030/messages)

For a complete example, take a look at [feathers-ottoman-demo](https://github.com/bwgjoseph/feathers-ottoman-demo) repository

## Development

Ensure index has been created before running the test

```sql
// Run on Couchbase UI > Query
CREATE PRIMARY INDEX ON `default`:`testBucket`.`testpostscope`.`testpostcollection`
```

## License

Copyright (c) 2021

Licensed under the [MIT license](LICENSE).
