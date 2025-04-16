// lambda.js
const serverlessExpress = require('@vendia/serverless-express');
const app = require('./app');

const options = {
  binarySettings: {
    isBinary: true,
    contentTypes: ['image/*']
  }
};

exports.handler = serverlessExpress({ app, ...options });
