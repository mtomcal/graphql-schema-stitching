const express = require('express');
const bodyParser = require('body-parser');
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const {
    makeExecutableSchema,
    addMockFunctionsToSchema,
    makeRemoteExecutableSchema,
    introspectSchema,
    mergeSchemas,
} = require('graphql-tools');
const { HttpLink } = require('apollo-link-http');
const fetch = require('node-fetch');

async function buildApp() {
    const chirpLink = new HttpLink({
        uri: 'https://p0q3wwq3q0.lp.gql.zone/graphql',
        fetch,
    });
    const authorLink = new HttpLink({
        uri: 'https://0vj8x397v5.lp.gql.zone/graphql',
        fetch,
    });
    let chirpSchema;
    let authorSchema;
    try {
        chirpSchema = makeRemoteExecutableSchema({
            schema: await introspectSchema(chirpLink),
            link: chirpLink,
        });
        authorSchema = makeRemoteExecutableSchema({
            schema: await introspectSchema(authorLink),
            link: authorLink,
        });
    } catch (e) {
        console.error(e);
    }

    const linkTypeDefs = `
  extend type User {
    chirps: [Chirp]
  }

  extend type Chirp {
    author: User
  }
`;

    const schema = mergeSchemas({
        schemas: [chirpSchema, authorSchema, linkTypeDefs],
        resolvers: {
            User: {
                chirps: {
                    fragment: `fragment UserFragment on User { id }`,
                    resolve(user, args, context, info) {
                        return info.mergeInfo.delegateToSchema({
                            schema: chirpSchema,
                            operation: 'query',
                            fieldName: 'chirpsByAuthorId',
                            args: {
                                authorId: user.id,
                            },
                            context,
                            info,
                        });
                    },
                },
            },
            Chirp: {
                author: {
                    fragment: `fragment ChirpFragment on Chirp { authorId }`,
                    resolve(chirp, args, context, info) {
                        return info.mergeInfo.delegateToSchema({
                            schema: authorSchema,
                            operation: 'query',
                            fieldName: 'userById',
                            args: {
                                id: chirp.authorId,
                            },
                            context,
                            info,
                        });
                    },
                },
            },
        },
    });

    // Initialize the app
    const app = express();

    // The GraphQL endpoint
    app.use('/graphql', bodyParser.json(), graphqlExpress({ schema }));

    // GraphiQL, a visual editor for queries
    app.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

    // Start the server
    app.listen(3000, () => {
        console.log('Go to http://localhost:3000/graphiql to run queries!');
    });
}

buildApp();
