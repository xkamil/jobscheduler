const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({rejectUnauthorized: false});
const {v4} = require('uuid');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const port = process.env.PORT || 8080;
let scheduledJobs = [];

const jobSchedulingStatus = {
  WAITING: 'waiting',
  SUCCESS: 'success',
  FAILED: 'failed'
}

setInterval(() => scheduledJobs.forEach(runScheduledJob), 1000);

app.get('/health', (req, res) => {
  res.json('ok');
})

app.post("/jobs/schedule", (req, res) => {
  const id = v4();
  const jobDetails = req.body;
  console.log(req.body);
  scheduledJobs.push({...jobDetails, id, status: jobSchedulingStatus.WAITING});
  res.json(id);
});

app.delete("/jobs/schedule/:id", (req, res) => {
  const id = req.params.id;
  scheduledJobs = scheduledJobs.filter(job => job.id !== id);
  res.json('job canceled');
});

app.delete("/jobs/schedule", (req, res) => {
  scheduledJobs = scheduledJobs.filter(job => job.status === jobSchedulingStatus.WAITING);
  res.json('ok');
});

app.get('/jobs', (req, res) => {
  const jobs = scheduledJobs.map(job => ({
    ...job,
    jenkinsApiToken: null
  }));
  res.json(jobs);
});

app.get('/debug/jobs', (req, res) => {
  res.json(scheduledJobs);
})

app.use(express.static(__dirname + '/public'));

app.listen(port, () => console.log('listening on ' + port));

function runScheduledJob(job) {
  const jobExecutionDate = new Date(job.jobExecutionDate);
  const currentDate = new Date();

  if (jobExecutionDate <= currentDate && job.status === jobSchedulingStatus.WAITING) {
    console.log(`Executing job ${job.id}`);

    const auth = {
      username: job.jenkinsUsername,
      password: job.jenkinsApiToken
    }
    axios
    .post(job.jobUrl, {}, {auth, httpsAgent})
    .then(res => {
      console.log(`Job ${job.id} executed`);
      job.status = jobSchedulingStatus.SUCCESS;
    })
    .catch(error => {
      console.log(`Job ${job.id} not executed`);
      job.status = jobSchedulingStatus.FAILED;
      const errorMessage = `${error.response.status} ${error.response.statusText} -  ${JSON.stringify(error.response.data)}`;
      job.error = errorMessage;
    })
  }
}
