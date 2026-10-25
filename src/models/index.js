'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const opts = { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, strict: false, versionKey: false };
function model(name, fields) { const s = new Schema(fields, opts); return mongoose.models[name] || mongoose.model(name, s); }
const User = model('User', { id:{type:String,required:true,unique:true}, role:{type:String,enum:['donor','hospital','authority'],required:true}, name:{type:String,default:''}, email:{type:String,required:true,lowercase:true,trim:true,unique:true}, password_hash:{type:String,required:true}, phone:{type:String,default:''}, location:{type:String,default:''} });
const Hospital = model('Hospital', { id:{type:String,required:true,unique:true}, user_id:{type:String,required:true,unique:true}, name:String, reg_id:{type:String,unique:true}, address:String, contact:String, email:String, doctor:String });
const Authority = model('Authority', { id:{type:String,required:true,unique:true}, user_id:{type:String,required:true,unique:true}, name:String, authority_id:{type:String,unique:true}, officer:String, email:String });
const Case = model('Case', { id:{type:String,required:true,unique:true}, patient_name:String, age:Number, gender:String, location:String, diagnosis:String, treatment:String, duration_days:Number, emergency:String, estimated_cost:Number, raised_amount:{type:Number,default:0}, hospital_id:String, hospital_name:String, hospital_reg_id:String, hospital_address:String, hospital_contact:String, hospital_email:String, doctor_name:String, doctor_reg_no:String, payment_upi_id:{type:String,default:''}, payment_qr_data:{type:String,default:''}, status:{type:String,default:'pending'}, submitted_date:String, verified_date:String, decline_reason:{type:String,default:''}, documents:{type:Array,default:[]}, donors:{type:Array,default:[]} });
const Donation = model('Donation', { id:{type:String,required:true,unique:true}, case_id:String, donor_id:String, patient:String, amount:Number, date:String, status:String, payment_ref:String, donor_name:String, verified_by:String, verified_at:String, rejection_reason:String });
const Notification = model('Notification', { id:{type:String,required:true,unique:true}, user_id:String, title:String, detail:String, is_read:{type:Boolean,default:false} });
const History = model('VerificationHistory', { id:{type:String,required:true,unique:true}, case_id:String, action:String, actor:String, actor_id:String, date:String });
const Saved = model('SavedCase', { id:{type:String,required:true,unique:true}, donor_id:String, case_id:String });
const Settings = model('Setting', { id:{type:String,required:true,unique:true}, user_id:{type:String,required:true,unique:true}, notifications:{type:Boolean,default:true}, privacy:{type:String,default:'public'} });
module.exports={User,Hospital,Authority,Case,Donation,Notification,History,Saved,Settings};
