// createIndex.js
const client = require('./elasticsearch');

async function createPostIndex() {
    const index = 'posts';

    // Check if the index already exists
    const exists = await client.indices.exists({ index });
    if (exists.body) {
        console.log(`Index "${index}" already exists.`);
        return;
    }

    // Create the index with mappings
    await client.indices.create({
        index,
        body: {
            mappings: {
                properties: {
                    title: { type: 'text' },
                    content: { type: 'text' },
                    author: { type: 'keyword' },
                    date: { type: 'date' },
                    tags: { type: 'keyword' },
                    likeCount: { type: 'integer' },
                    // If you have comments, store them as nested documents
                    comments: {
                        type: 'nested',
                        properties: {
                            author: { type: 'keyword' },
                            content: { type: 'text' },
                            date: { type: 'date' },
                        },
                    },
                },
            },
        },
    });
    console.log(`Index "${index}" created successfully.`);
}

createPostIndex().catch(console.error);