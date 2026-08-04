'use strict';

const { validationResult, matchedData } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs express-validator chains, then replaces req.body/query/params with only
 * the fields that were actually declared. Undeclared keys are dropped, which is
 * what stops mass-assignment (e.g. a client sending `role: "admin"`).
 */
function validate(chains = []) {
  return [
    ...chains,
    (req, _res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        const errors = result.array().map((err) => ({
          field: err.path ?? err.param,
          message: err.msg,
        }));
        return next(ApiError.unprocessable('Validation failed', { details: errors }));
      }

      req.body = matchedData(req, { locations: ['body'], includeOptionals: false });
      Object.assign(req.params, matchedData(req, { locations: ['params'], includeOptionals: false }));

      // Controllers read `req.validated.query` so this keeps working if the app
      // is ever moved to Express 5, where req.query became a read-only getter.
      req.validated = { query: matchedData(req, { locations: ['query'], includeOptionals: false }) };
      return next();
    },
  ];
}

module.exports = validate;
