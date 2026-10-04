export const manager = true;
export const limits = { fileBytes:20*1024*1024, dailyJobs:60, globalDailyJobs:600, jobSeconds:180, controls:500 };
export const rates = { ec2Hourly:0.182, rhinoCoreHourly:0.10, billableCores:4, storageMonthly:2.508, ipv4Hourly:0.005 };
export const hourly = rates.ec2Hourly + rates.rhinoCoreHourly*rates.billableCores + rates.ipv4Hourly;
export const estimate = seconds => Number(seconds||0)/3600*hourly;
