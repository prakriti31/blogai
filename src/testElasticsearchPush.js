const { Client } = require('@elastic/elasticsearch');

// Create an Elasticsearch client instance with SSL options to disable verification
const client = new Client({
    node: 'https://localhost:9200',  // Your Elasticsearch URL
    auth: {
        username: 'elastic',
        password: '78lE7-J88xqqIMDvcxhX',  // Replace with your password
    },
    tls: {
        rejectUnauthorized: false  // Disable SSL certificate validation
    }
});

// Function to check Elasticsearch connection and push a test document
async function testElasticsearchPush() {
    try {
        // Check connection to Elasticsearch cluster
        const health = await client.cluster.health();
        console.log('Elasticsearch Cluster Health:', health.body);

        // Index name to check
        const indexName = 'posts';

        // Check if the index exists
        const indexExists = await client.indices.exists({ index: indexName });
        if (!indexExists.body) {
            // If index doesn't exist, create it
            await client.indices.create({
                index: indexName,
                body: {
                    mappings: {
                        properties: {
                            title: { type: 'text' },
                            author: { type: 'text' },
                            content: { type: 'text' },
                            date: { type: 'date' }
                        }
                    }
                }
            });
            console.log(`Index "${indexName}" created.`);
        } else {
            console.log(`Index "${indexName}" already exists.`);
        }

        // Create a sample document to push
        const sampleDocument = {
            title: 'Sample Post Title',
            author: 'John Doe',
            content: 'This is a sample content for testing Elasticsearch push.',
            date: new Date()
        };

        // Push document to Elasticsearch
        const response = await client.index({
            index: indexName,
            body: sampleDocument
        });
        console.log('Document indexed successfully:', response.body);

        // Refresh the index to make the document searchable
        await client.indices.refresh({ index: indexName });
        console.log('Index refreshed successfully!');
    } catch (error) {
        console.error('Error during Elasticsearch push test:', error);
    }
}

// Run the test
testElasticsearchPush();




