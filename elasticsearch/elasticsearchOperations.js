// elasticsearchOperations.js
const client = require('./elasticsearch');

async function indexPost(post) {
    const index = 'posts';

    try {
        await client.index({
            index,
            id: post._id.toString(), // Use the unique ID from your primary datastore
            body: {
                title: post.title,
                content: post.content,
                author: post.author,
                date: post.date || new Date(),
                tags: post.tags || [],
                likeCount: post.like || 0,
                comments: post.comments || [],
            },
            refresh: 'true'  // This forces an immediate refresh so the document is searchable right away
        });
        console.log('Post indexed successfully.');
    } catch (error) {
        console.error('Error indexing post:', error);
    }
}

module.exports = { indexPost };