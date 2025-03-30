const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch'); // Fixed import syntax
const { Client } = require('@elastic/elasticsearch');

// Create an Elasticsearch client
const esClient = new Client({
    node: 'https://localhost:9200',
    auth: {
        username: 'elastic',
        password: '78lE7-J88xqqIMDvcxhX'
    },
    ssl: {
        rejectUnauthorized: false
    }
});

// Elasticsearch transport options
const esTransportOpts = {
    level: 'info',
    client: esClient,
    indexPrefix: 'logs'
};

// Create Winston logger
const logger = winston.createLogger({
    transports: [
        new ElasticsearchTransport(esTransportOpts), // Now correctly constructed
        new winston.transports.Console()
    ]
});

module.exports = logger;


