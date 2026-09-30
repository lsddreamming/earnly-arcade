const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'iphone-quit-stress.spec.js',fullyParallel:true,workers:4,retries:0,maxFailures:0,timeout:60000,
 reporter:[['list'],['html',{outputFolder:'iphone-qa-report',open:'never'}]],
 use:{...devices['iPhone 14'],baseURL:process.env.EARNLY_QA_BASE_URL||'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure',serviceWorkers:'block'},
 webServer:process.env.EARNLY_QA_BASE_URL?undefined:{command:'python3 -m http.server 4173',url:'http://127.0.0.1:4173',reuseExistingServer:true}
});
