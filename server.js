'use strict';
const createApp = require('./src/app');
const env = require('./src/config/env');
const { connectDB } = require('./src/config/db');
async function start(){
 await connectDB();
 const app=createApp();
 const server=app.listen(env.port,()=>console.log(`ICF Child Crowdfunding API running on port ${env.port} (${env.nodeEnv})`));
 ['SIGINT','SIGTERM'].forEach(sig=>process.on(sig,()=>server.close(async()=>{const {mongoose}=require('./src/config/db');await mongoose.disconnect();process.exit(0);} )));
}
start().catch(err=>{console.error('[ICF] Startup failed:',err.message);process.exit(1);});
