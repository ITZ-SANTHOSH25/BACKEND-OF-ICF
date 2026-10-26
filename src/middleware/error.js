'use strict';
const ApiError=require('../utils/ApiError');const env=require('../config/env');
function notFound(req,res,next){next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))}
function errorHandler(err,req,res,next){let status=err.status||err.statusCode||500;let message=err.message||'Internal server error';let details=err.details;if(err.code===11000){status=409;message='A record with those details already exists.'}if(status>=500){console.error('[ICF] Unhandled error:',err);if(env.isProd)message='Internal server error'}res.status(status).json({success:false,error:{message,...(details?{details}:{})}})}
function asyncHandler(fn){return(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next)}
module.exports={notFound,errorHandler,asyncHandler};
