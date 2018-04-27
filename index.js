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
    const resourceLink = new HttpLink({
        uri: 'https://p0q3wwq3q0.lp.gql.zone/graphql',
        fetch,
    });
    const productLink = new HttpLink({
        uri: 'https://0vj8x397v5.lp.gql.zone/graphql',
        fetch,
    });
    let chirpSchema;
    let authorSchema;
    try {
        resourceSchema = makeRemoteExecutableSchema({
            schema: await introspectSchema(resourceLink),
            link: resourceLink,
        });
        productSchema = makeRemoteExecutableSchema({
            schema: await introspectSchema(productLink),
            link: productLink,
        });
    } catch (e) {
        console.error(e);
    }

    const linkTypeDefs = `
  extend type Product {
    resources: [Resource]
  }

  extend type Resource {
    product: Product
  }
`;

    const schema = mergeSchemas({
        schemas: [productSchema, resourceSchema, linkTypeDefs],
        resolvers: {
            Product: {
                resources: {
                    fragment: `fragment ResourcesFragment on Product { id }`,
                    resolve(product, args, context, info) {
                        return info.mergeInfo.delegateToSchema({
                            schema: resourceSchema,
                            operation: 'query',
                            fieldName: 'resourcesByProductId',
                            args: {
                                productId: product.id,
                            },
                            context,
                            info,
                        });
                    },
                },
            },
            Resource: {
                product: {
                    fragment: `fragment ProductFragment on Resource { productId }`,
                    resolve(resource, args, context, info) {
                        return info.mergeInfo.delegateToSchema({
                            schema: productSchema,
                            operation: 'query',
                            fieldName: 'productById',
                            args: {
                                id: resource.productId,
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
