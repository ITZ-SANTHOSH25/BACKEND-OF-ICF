'use strict';
const { verifyToken }=require('../utils/jwt'); const {User}=require('../models'); const ApiError=require('../utils/ApiError');
function getToken(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7).trim():null;}
async function requireAuth(req,res,next){try{const token=getToken(req);if(!token)throw ApiError.unauthorized('Missing authentication token.');let payload;try{payload=verifyToken(token)}catch{throw ApiError.unauthorized('Invalid or expired token.')}const user=await User.findOne({id:payload.sub}).lean();if(!user)throw ApiError.unauthorized('Account no longer exists.');req.user=user;next()}catch(e){next(e)}}
async function optionalAuth(req,res,next){try{const token=getToken(req);if(token){try{const payload=verifyToken(token);req.user=await User.findOne({id:payload.sub}).lean()||null}catch{req.user=null}}next()}catch(e){next(e)}}
function requireRole(...roles){return(req,res,next)=>{if(!req.user)return next(ApiError.unauthorized());if(!roles.includes(req.user.role))return next(ApiError.forbidden(`This action requires role: ${roles.join(' or ')}.`));next()}}
module.exports={requireAuth,optionalAuth,requireRole};
