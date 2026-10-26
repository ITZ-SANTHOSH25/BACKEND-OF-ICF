'use strict';const {History}=require('../models');const {uid,today}=require('../utils/helpers');
async function logHistory(caseId,action,actor,actorId){return History.create({id:uid('HIS'),case_id:caseId,action,actor:actor||'',actor_id:actorId||null,date:today()})}
async function listHistory(req,res){const filter=req.query.caseId?{case_id:req.query.caseId}:{};const rows=await History.find(filter).sort({created_at:-1}).limit(200).lean();res.json({success:true,data:{history:rows.map(r=>({id:r.case_id,action:r.action,by:r.actor,date:r.date}))}})}module.exports={logHistory,listHistory};
