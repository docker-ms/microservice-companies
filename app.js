'use strict';

const os = require('os');
const cluster = require('cluster');

const grpc = require('grpc');

const CommonImport = require('./util/CommonImport');

/*
 * Constants define.
 */
global.SERVICE_TAG = process.env.SERVICE_TAG;
global.CONSUL = require('microservice-consul');
global.RELATED_MONGODB_COLLECTIONS = {
  companiesCollectionName: 'Companies'
};

if (cluster.isMaster) {
  /*
   * The master process should be kept as light as it can be, that is: only do the workers management jobs and some others very necessary jobs.
   */

  const workerPortMap = {};

  const numOfWorkers = os.cpus().length;

  for (var i = 0; i < numOfWorkers; i++) {
    const port = 53547 + i;
    const worker = cluster.fork({
      port: port
    });
    workerPortMap['' + worker.process.pid] = port;
  }

  cluster.on('exit', (worker, code, signal) => {
    const oriKey = '' + worker.process.pid;
    const newWorker = cluster.fork({
      port: workerPortMap[oriKey]
    });
    workerPortMap[newWorker.process.pid] = workerPortMap[oriKey];
    delete workerPortMap[oriKey];
  });

} else {

  /*
   * Here the woker process will always be full featured.
   */

  const buildCompaniesGrpcServer = () => {
    const companiesGrpcServer = new grpc.Server();
    const companies = grpc.load({root: CommonImport.protos.root, file: CommonImport.protos.companies}).microservice.companies;
    
    companiesGrpcServer.addService(companies.Companies.service, {
      healthCheck: CommonImport.utils.healthCheck,
      createCompanyV1: require('./api/v1/CreateCompanyImpl').createCompany
    });

    return companiesGrpcServer;
  };

  CommonImport.Promise.join(
    require('microservice-mongodb-conn-pools')(global.CONSUL.keys.mongodbGate).then((dbPools) => {
      return dbPools;
    }),
    require('microservice-email')(global.CONSUL.keys.emailGate).then((mailerPool) => {
      return mailerPool;
    }),
    CommonImport.utils.pickRandomly(global.CONSUL.agents).kv.get(global.CONSUL.keys['jwtGate']),
    buildCompaniesGrpcServer(),
    (dbPools, mailerPool, jwtGateOpts, companiesGrpcServer) => {
      if (dbPools.length === 0) {
        throw new Error('None of the mongodb servers is available.');
      }
      if (mailerPool.length === 0) {
        throw new Error('None of the email servers is available.');
      }
      if (!jwtGateOpts) {
        throw new Error('Invalid gate JWT configurations.');
      }

      global.DB_POOLS = dbPools;
      global.MAILER_POOL = mailerPool;
      global.JWT_GATE_OPTS = JSON.parse(jwtGateOpts.Value);

      companiesGrpcServer.bind('0.0.0.0:' + process.env.port, grpc.ServerCredentials.createInsecure());
      companiesGrpcServer.start();
    }
  );

}


