/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const { PKPWallet } = require('@lit-protocol/pkp-ethers.js-node');
const WebSocket = require("ws");
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const fetch = require("cross-fetch");
const fastify = require("fastify")({
  logger: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const AUTH_SIG = process.env.AUTH_SIG;
const ORBIS_KEY = process.env.ORBIS_KEY;
let jobs = [];
let donePosts = [];
const connections = {};

// load jobs from file
log("Loading jobs.json");
try {
  jobs = JSON.parse((fs.readFileSync('jobs.json')).toString())
} catch (e) {
  log("Error loading jobs.json");
  jobs = [];
}

// load done posts from file
log("Loading done.json");
try {
  donePosts = JSON.parse((fs.readFileSync('done.json')).toString())
} catch (e) {
  log("Error loading done.json");
  donePosts = [];
}


const indexer = createClient(SUPABASE_URL, ORBIS_KEY);

function log(msg) {
  let date = getNow();
  let logMsg = `[${date}] ${msg}`;
  console.log(logMsg);
  fs.appendFile('log.txt', logMsg + '\n', () => {});
}

function saveCache() {
  console.log("Cache saved");
  // beautify json before saving
  const saveJobs = JSON.stringify(jobs, null, 2);
  const saveDonePosts = JSON.stringify(donePosts, null, 2);

  fs.writeFileSync('jobs.json', saveJobs);
  fs.writeFileSync('done.json', saveDonePosts);
}
process.on('SIGINT', () => {
  saveCache();
  process.exit();
});

// save file when process exits
process.on('exit', () => {
  saveCache();
});


var cache = [
  {
    timestamp: "",
    data: "",
  },
];

const wss = new WebSocket.Server({ port: 8080, host: "0.0.0.0" });

wss.on('connection', (ws, req) => {

  const connection = req.connection.remoteAddress;

  // console.log(`New WebSocket connection ${connection}`);

  connections[connection] = ws;

  // ws.on('message', (message) => {
  // console.log(`Received message: ${message}`);
  // });

});

var lastConnectionsLength;
var lastJobsLength;

function getNow() {
  const date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  return date;
}

setInterval(() => {

  // only print if the length of connections or jobs has changed
  if (lastConnectionsLength !== Object.keys(connections).length || lastJobsLength !== jobs.length) {
    lastConnectionsLength = Object.keys(connections).length;
    lastJobsLength = jobs.length;
    log(`${lastConnectionsLength} connections and ${lastJobsLength} jobs`);
  }

}, 2000);

async function infiniteLoop() {
  while (true) {
    // for each job
    for (let i = 0; i < jobs.length; i++) {

      // if job is chat_message
      if (jobs[i].task === "chat_message") {

        const job = jobs[i];
        const did = job.params.pkp.did;
        const pkpPubKey = job.params.pkp.pubKey;

        // did: did:pkh:eip155:1:0x6d30a9f79a35fe3ede1827f8fd0050ada6fea901
        // pkpPubKey: 0x040b1f9dba171e2d62cb244082c7fe83917135bd29c3b4dfa10c6ce7b5d7488
        // console.log(`did: ${did}`);
        // console.log(`pkpPubKey: ${pkpPubKey}`);

        // ignore job if counter is more than 0
        // if(job.counter > 0){
        //   continue;
        // }

        var posts;

        var page = 0;
        // continue;

        try {
          // fetch orbis posts by did
          posts = await indexer.rpc("all_did_master_posts", {
            post_did: did,
          }).range(page * 50, (page + 1) * 50 - 1);

          posts = posts.data;
        } catch (e) {
          console.log(e);
          // clearInterval(interval);
        }

        if (posts) {
          for (let j = 0; j < posts.length; j++) {

            var post = posts[j];

            const streamId = post.stream_id;
            const content = post.content.body;
            const timestamp = post.timestamp;
            const creatorDid = post.creator;
            const creatorAddress = post.creator_details.metadata.address;

            // ignore posts older than 5 minutes
            // 300000 = 5 mins
            if ((timestamp * 1000) < (Date.now() - 9000000)) {
              continue;
            }

            // ignore if post is already done
            if (donePosts.includes(post.stream_id)) {
              continue;
            }


            // if command is /test
            // /test 0x65d86B3E0E8B92a0FF6197Cb0fE5847835B78c5e 1
            if (content.includes("/test")) {
              // 
              console.log("Found test message");
              console.log(content);

              var commands = content.split(' ');
              const address = commands[1];
              const amount = commands[2];

              let pkpWallet = new PKPWallet({
                pkpPubKey: pkpPubKey,
                controllerAuthSig: JSON.parse(AUTH_SIG),
                provider: "https://rpc-mumbai.maticvigil.com",
              })
              await pkpWallet.init();

              const tx = {
                to: address,
                value: parseInt(amount),
              };

              console.log(tx);

              var signedTx;
              var sentTx;

              console.log("signing transaction");
              try {
                signedTx = await pkpWallet.signTransaction(tx);
              } catch (e) {
                console.log("Error signing transaction");
                console.log(e);

                if (!donePosts.includes(streamId)) {
                  donePosts.push(streamId);
                  console.log(`[[${getNow()}]] Archived ${streamId}`);
                }
                return;
              }

              console.log("sending transaction");
              try {
                sentTx = await pkpWallet.sendTransaction(signedTx);
              } catch (e) {
                console.log("Error sending transaction");
                console.log(e);
                return;
              }

              log("Sent transaction");

              // save it to done tasks if not already done
              if (!donePosts.includes(streamId)) {
                donePosts.push(streamId);
                log(`Archived ${streamId}`);
              }

            }

            // /send [amount] to [address] [hourly]
            else if (content.includes('/send')) {
              // send payment
              console.log("Found send message");
              console.log(content);
            }
          }
        }

      }
    }

    // var str = (await res.json());
    // // filter out item.content.body include the keyword "/test"
    // str = str.filter(item => item.content.body.includes("/test"));
    // str = JSON.stringify(str);
    // ws.send(str);
    // ws.send(JSON.stringify(jobs));

    // for each connection, send message
    for (const connection in connections) {
      connections[connection].send(JSON.stringify(jobs));
    }
  }
}
infiniteLoop();

setInterval(() => {
  if (cache.length > 0) {
    console.log(`cache has length ${cache.length}`);
    console.log("clearing now");
    cache = [];
    console.log(`cache cleared. Now it has ${cache.length}`);
  }
}, 60000);

function hasSameDataWithinElapsedTime(arr, data, elapsedTime) {
  const now = Date.now();
  for (let i = arr.length - 1; i >= 0; i--) {
    const timeDifference = now - arr[i].timestamp;
    if (
      timeDifference < elapsedTime &&
      JSON.stringify(arr[i].data) === JSON.stringify(data)
    ) {
      return true;
    }
  }
  return false;
}


fastify.register(require("@fastify/cors"), (instance) => {
  return (req, callback) => {
    const corsOptions = {
      // This is NOT recommended for production as it enables reflection exploits
      origin: true,
    };

    // do not include CORS headers for requests from localhost
    if (/^localhost$/m.test(req.headers.origin)) {
      corsOptions.origin = false;
    }

    // callback expects two parameters: error and options
    callback(null, corsOptions);
  };
});



fastify.post("/api/check", async (req, res) => {
  var data = req.body;

  if (hasSameDataWithinElapsedTime(cache, data, 5000)) {
    console.log("Same data found within the specified elapsed time");

    res
      .code(200)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ status: "nope" });
  } else {
    console.log("No same data found within the specified elapsed time");
    cache.push({
      timestamp: new Date(),
      data: data,
    });

    res
      .code(200)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ status: "ok" });
  }
});

fastify.post('/api/job', async (req, res) => {
  var data = req.body;
  const pkpAddress = data.params.pkp.address;

  if (data.task === 'chat_message') {

    // check if address has been pushed to jobs array already with the same task name
    // if yes, then don't push it again
    // if no, then push it to jobs array
    if (jobs.filter(job => job.params.pkp.address === pkpAddress && job.task === data.task).length === 0) {
      jobs.push(data);
      res
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ status: "ok" });
      log(`a new job has been added ${JSON.stringify(data.params.pkp.address)}`);
    } else {
      res
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ status: "job already exists" });
      log(`job already exists ${data.params.pkp.address}`);
    }
  } else if (data.task === 'remove_job') {
    // remove the job from jobs array
    const index = jobs.findIndex(job => job.params.pkp.address === pkpAddress && job.task === data.params.task);
    if (index > -1) {
      jobs.splice(index, 1);
      res
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ status: "ok" });
      log(`job removed ${data.params.task}`);
    } else {
      res
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ status: "job not found" });
      log(`job not found ${data.params.task}`);
    }
  } else {
    res
      .code(500)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ status: 500, message: "unrecognized task" });
    log(`job not recognized ${data.params.task}`);
  }

  console.log("data => ", data);

})

fastify.post('/api/has/job', async (req, res) => {
  var data = req.body;

  const pkpAddress = data.params.pkp.address;

  // check if address has been pushed to jobs array already with the same task name
  // if yes, then don't push it again
  // if no, then push it to jobs array
  if (jobs.filter(job => job.params.pkp.address === pkpAddress).length === 0) {

    res
      .code(200)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ status: "no job" });
  }
  else {
    res
      .code(200)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ status: "job exists" });
  }

})

// Run the server and report out to the logs
fastify.listen(
  { port: 8081, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
