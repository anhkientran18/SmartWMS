// Pass only runtime credentials via inherited environment; never persist response bodies or tokens.
const path=require('path'), fs=require('fs');
const repo=path.resolve(__dirname,'../..');
const newman=require(path.join(repo,'obj/F1/tools/newman/node_modules/newman'));
const collection=JSON.parse(fs.readFileSync(path.join(repo,'obj/F1/postman/SmartWMS.Api - v1 - WORKING.postman_collection.json'),'utf8'));
const records=[];
newman.run({collection,environment:{values:['baseUrl','username','password'].map(key=>({key,value:process.env['F1_'+key.toUpperCase()],enabled:true}))},
 workingDir:repo,timeoutRequest:45000,reporters:[]},(err,summary)=>{
 if(err){console.error(err.name);process.exitCode=1;return;}
 const failures=summary.run.failures.map(f=>({request:f.source?.name,test:f.error?.test,message:f.error?.message}));
 fs.writeFileSync(process.env.F1_REPORT,JSON.stringify({stats:summary.run.stats,records,failures},null,2));
 console.log('NEWMAN requests='+records.length+' failures='+failures.length);
 process.exitCode=failures.length?1:0;
}).on('request',(err,args)=>{records.push({name:args.item.name,method:args.request.method,path:args.request.url.getPath(),status:args.response?.code,error:err?.name});});
