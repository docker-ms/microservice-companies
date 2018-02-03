'use strict';

const CommonImport = require('../../util/CommonImport');

class CreateCompanyImpl {

  static createCompany(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const companiesCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.companiesCollectionName);

    if (call.request.mobilePhone) {
      Object.assign(call.request.mobilePhone, {
        isVerified: false
      });
    }

    const epochNow = new Date().getTime();

    const companyObj = Object.assign(CommonImport.utils.copyWithoutProperties(call.request, ['lang']), {
      companyId: CommonImport.shortid.generate(),
      isEmailVerified: false,
      lastUpdate: epochNow,
      createAt: epochNow
    });

    CommonImport.utils.cleanup(companyObj);

    CommonImport.utils.bluebirdRetryExecutor(() => {
      return companiesCollection.insertOne(companyObj);
    }, {}).then(() => {

      CommonImport.Promise.promisify(CommonImport.jwt.sign)({
        email: call.request.email,
        lang: call.request.lang,
        verificationType: 'isCompany'
      }, global.JWT_GATE_OPTS.strSecret, global.JWT_GATE_OPTS.token24Opts).then((token24) => {
        let verificationLink = '';
        if (process.env.MS_SERVICE_TAG && process.env.MS_SERVICE_TAG.indexOf('localhost') > -1) {
          verificationLink = encodeURI('https://localhost:53547/api/v1/auth/VerifyEmail?at=' + token24);
        } else {
          verificationLink = encodeURI('https://micro02.sgdev.vcube.com:53547/api/v1/auth/VerifyEmail?at=' + token24);
        }

        return CommonImport.Promise.join(

          CommonImport.utils.bluebirdRetryExecutor(() => {
            return CommonImport.utils.sendEmail(
              CommonImport.utils.pickRandomly(global.MAILER_POOL),
              call.request.email,
              call.request.lang,
              {
                tplId: 'EmailTpl.VerifyEmail',
                subject: {},
                htmlBody: {
                  COMPANY_NAME: call.request.companyName,
                  VERIFICATION_LINK: verificationLink
                }
              }
            );
          }, {}),

          CommonImport.utils.bluebirdRetryExecutor(() => {
            if (call.request.mobilePhone) {
              // Verify mobile phone number here.
            }
          }, {})

        );
      }).catch((err) => {
        // Nothing need to be done here.
      });

      // Don't let the email/mobilePhoneNo verification block the process.
      callback(null, {success: true});

    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = CreateCompanyImpl;


