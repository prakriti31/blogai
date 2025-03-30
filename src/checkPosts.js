const { Client } = require('@elastic/elasticsearch');

const client = new Client({
    node: 'https://localhost:9200', // Use localhost for better compatibility
    auth: { username: 'elastic', password: '78lE7-J88xqqIMDvcxhX' },
    maxRetries: 5,
    sniffOnStart: true,
    tls: {
        rejectUnauthorized: false // Ignore SSL verification
    }
});

async function verifyConnection() {
    try {
        const info = await client.info(); // Removed the `requestTimeout` here
        console.log('Cluster Info:', info);

        const indices = await client.cat.indices({ format: 'json' });
        console.log('Existing Indices:', indices);

        await checkPosts();
    } catch (error) {
        console.error('Connection Verification Failed:', error.meta);
    }
}

async function checkPosts() {
    try {
        const { body } = await client.search({
            index: 'posts',
            body: {
                query: {
                    match_all: {}
                }
            }
        });

        // Check if body.hits is defined before accessing it
        if (body && body.hits && body.hits.hits) {
            console.log("Posts in Elasticsearch:");
            console.log(JSON.stringify(body.hits.hits, null, 2));
        } else {
            console.log("No posts found or unexpected response format.");
        }
    } catch (err) {
        console.error("Error querying posts index:", err);
    }
}


async function createPostsIndex() {
    try {
        const response = await client.indices.create({
            index: 'posts',
            body: {
                settings: {
                    number_of_shards: 1,
                    number_of_replicas: 0
                },
                mappings: {
                    properties: {
                        title: { type: 'text' },
                        content: { type: 'text' },
                        author: { type: 'text' },
                        createdAt: { type: 'date' }
                    }
                }
            }
        });
        console.log("Posts index created:", response);
    } catch (error) {
        console.error("Error creating posts index:", error);
    }
}

async function addPost() {
    try {
        const response = await client.index({
            index: 'posts',
            body: {
                title: 'First Post',
                content: 'This is the content of the first post.',
                author: 'Prakriti Sharma',
                createdAt: new Date()
            }
        });
        console.log("Post added:", response);
    } catch (error) {
        console.error("Error adding post:", error);
    }
}



verifyConnection();
addPost();
checkPosts()



