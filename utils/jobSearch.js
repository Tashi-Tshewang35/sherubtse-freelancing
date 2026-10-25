function filterJobs(jobs, query = {}) {
  const string = key => typeof query[key] === 'string' ? query[key].trim().toLowerCase() : '';
  const search=string('search'),type=string('type'),urgency=string('urgency'),location=string('location'),date=string('date');
  const matches=jobs.filter(job=>
    [job.title,job.employer_name,job.location,job.work_type,job.requirements].join(' ').toLowerCase().includes(search) &&
    (!type||job.work_type.toLowerCase()===type) && (!urgency||job.urgency===urgency) &&
    (!location||job.location.toLowerCase().includes(location)) &&
    (!date||new Date(new Date(job.start_at).getTime()+6*3600000).toISOString().slice(0,10)===date));
  const sort=string('sort');
  return matches.sort((a,b)=>sort==='closing' ? new Date(a.application_closes_at)-new Date(b.application_closes_at) :
    sort==='wage' ? Number(b.wage_rate)-Number(a.wage_rate) :
    sort==='urgent' ? Number(b.urgency==='urgent')-Number(a.urgency==='urgent') || new Date(b.created_at)-new Date(a.created_at) :
    new Date(b.created_at)-new Date(a.created_at));
}
module.exports={filterJobs};
