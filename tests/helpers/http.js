// Browser-like test client: obtains a real CSRF token from the same session.
// Security tests use raw supertest to assert that missing/forged tokens fail.
const request = require('supertest');
function client(app) {
  const agent=request.agent(app);
  for(const method of ['post','put','patch','delete']) {
    const original=agent[method].bind(agent);
    agent[method]=path=>{
      const calls=[];
      let promise;
      const execute=()=>promise ||= (async()=>{
        const response=await agent.get('/login');
        const token=response.text.match(/name="csrf-token" content="([a-f0-9]{64})"/)?.[1];
        const test=original(path);
        if(token)test.set('X-CSRF-Token',token);
        for(const [name,args]of calls)test[name](...args);
        return await test;
      })();
      const proxy=new Proxy({}, {get:(_,name)=>{
        if(['then','catch','finally'].includes(name))return (...args)=>execute()[name](...args);
        if(name==='end')return callback=>{execute().then(result=>callback(null,result),callback);return proxy;};
        return (...args)=>{calls.push([name,args]);return proxy;};
      }});
      return proxy;
    };
  }
  return agent;
}
module.exports=client;
module.exports.agent=client;
