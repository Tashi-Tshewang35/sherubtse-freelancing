const draft=JSON.parse(document.getElementById('draftData').textContent);
const fields={title:'title',requirements:'requirements',description:'description',workType:'work_type',location:'location',wageRate:'wage_rate',wageUnit:'wage_unit',workersNeeded:'workers_needed',urgency:'urgency',startAt:'start_at',endAt:'end_at',opensAt:'application_opens_at',closesAt:'application_closes_at'};
for(const [name,key] of Object.entries(fields)){
 const input=document.querySelector(`[name="${name}"]`);
 input.value=input.hasAttribute('data-schedule-date')?window.ScheduleDates.display(draft[key]):(draft[key] || '');
}
