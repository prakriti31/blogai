const { Client } = require('@elastic/elasticsearch');

// Change the node URL to match your ElasticSearch endpoint (default is localhost:9200)
const client = new Client({
    node: 'https://127.0.0.1:9200',
});

// Optional: Create the index if it doesn't exist with a basic mapping
async function createIndex() {
    const indexExists = await client.indices.exists({ index: 'posts' });
    if (!indexExists.body) {
        await client.indices.create({
            index: 'posts',
            body: {
                mappings: {
                    properties: {
                        author: { type: 'text' },
                        title: { type: 'text' },
                        content: { type: 'text' },
                        thumbnail: { type: 'text' },
                        date: { type: 'date' },
                        like: { type: 'integer' },
                        comments: {
                            type: 'nested',
                            properties: {
                                user: { type: 'text' },
                                text: { type: 'text' },
                                date: { type: 'date' }
                            }
                        }
                    }
                }
            }
        });
        console.log('ElasticSearch index "posts" created.');
    } else {
        console.log('ElasticSearch index "posts" already exists.');
    }
}

createIndex().catch(console.error);

module.exports = client;

const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch'); // Fixed import syntax

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



