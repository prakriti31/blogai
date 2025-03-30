// elasticsearch.js
const { Client } = require('@elastic/elasticsearch');

const client = new Client({
    node: 'http://localhost:9200', // Docker container with ES should be accessible here
});

module.exports = client;