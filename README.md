# BlogAI

BlogAI is a smart blogging platform that integrates AI-driven features for enhanced user interaction and experience.

## Features

- **Docker Elasticsearch**: Logs subscription and unsubscription events.
- **AI-Powered Commenting**: Suggests comments using ChatGPT AI.
- **Built-in Chatbot**: Acts as a tour guide for new users.

## Getting Started

### Clone the Repository

```sh
 git clone https://github.com/prakriti31/blogai.git
 cd blogai
```

### Run the Application

Ensure you have Node.js installed, then run:

```sh
 node src/App.js
```

## Elasticsearch Debugging

To check and debug your connection to Elasticsearch, use `checkPosts.js`:

```sh
 node src/checkPosts.js
```

### Test Elasticsearch Connection with cURL

#### Search for a Post by Title (Example: "valorant")
```sh
curl -X POST "http://localhost:9200/posts/_search" \
-H "Content-Type: application/json" \
-d '{ "query": { "wildcard": { "title": "valorant" } } }'
```

#### Check if Elasticsearch is Running
```sh
curl -X GET "http://localhost:9200"
```

#### Check Elasticsearch Cluster Health
```sh
curl -k -u elastic:78lE7-J88xqqIMDvcxhX "https://localhost:9200/_cluster/health?pretty"
```

## Running Elasticsearch with Docker

Ensure you have Docker installed, then pull and run the Elasticsearch image:

```sh
docker pull elasticsearch:latest
docker run -d -p 9200:9200 -e "discovery.type=single-node" elasticsearch
```

## Enjoy Blogging with AI! 🚀
