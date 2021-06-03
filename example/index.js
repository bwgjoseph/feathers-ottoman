// Initialize Ottoman connection
const {
  Ottoman, getModel, Schema, SearchConsistency,
} = require('ottoman');

const ottoman = new Ottoman();

ottoman.connect({
  connectionString: 'couchbase://localhost',
  bucketName: 'messageBucket',
  username: 'user',
  password: 'password',
});

const modelOptions = {
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
// Register a Couchbase message service
app.use('/messages', new Service({
  Model: getModel('message'),
  ottoman: {
    lean: true,
    consistency: SearchConsistency.LOCAL,
  },
  paginate: {
    default: 10,
    max: 100,
  },
}));
// Register a nicer error handler than the default Express one
app.use(express.errorHandler());

// Create a dummy Message
app.service('messages').create({
  text: 'Message created on Couchbase server',
}).then((message) => {
  console.log('Created messages', message);
});

app.listen(3030).on('listening', () => console.log('feathers-ottoman example started'));
