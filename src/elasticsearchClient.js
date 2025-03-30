// elasticsearchClient.js
const { Client } = require('@elastic/elasticsearch');

// Change the node URL to match your ElasticSearch endpoint (default is localhost:9200)
const client = new Client({ node: 'http://localhost:9200' });

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
                        // You can also add mappings for comments and other nested fields if needed.
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
