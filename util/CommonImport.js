'use strict';

module.exports = {
  jwt: require('jsonwebtoken'),
  Promise: require('bluebird'),
  moment: require('moment'),
  shortid: require('shortid'),

  protos: require('microservice-protos'),
  errors: require('microservice-errors'),
  utils: require('microservice-utils'),
  i18n: require('microservice-i18n')
};


