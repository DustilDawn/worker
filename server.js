/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const path = require("path");
const WebSocket = require("ws");
const fs = require("fs");
const url = "https://ylgfjdlgyjmdikqavpcj.supabase.co"
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZ2ZqZGxneWptZGlrcWF2cGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTQ3NTc3NTIsImV4cCI6MTk3MDMzMzc1Mn0.2XdkerM98LhI6q5MBBaXRq75yxOSy-JVbwtTz6Dn9d0";
const fetch = require("cross-fetch");
// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false,
});
const { PKPWallet } = require('@lit-protocol/pkp-ethers.js-node');

const authSig = { "sig": "0xa527fc31d6330310dac6244218d3e122d07bf93b3f0d5d92b8aa69ec03403c444476d9b625a513683daefe3589cece743348f833a59953374abd39526c8bd5c81b", "derivedVia": "web3.eth.personal.sign", "signedMessage": "localhost:3000 wants you to sign in with your Ethereum account:\n0x019c5821577B1385d6d668d5f3F0DF16A9FA1269\n\n\nURI: http://localhost:3000/\nVersion: 1\nChain ID: 80001\nNonce: V0ho59TkT9p9BpeqC\nIssued At: 2022-12-25T03:27:08.996Z\nExpiration Time: 2027-11-29T03:27:08.988Z", "address": "0x019c5821577B1385d6d668d5f3F0DF16A9FA1269" };

// (async () => {
//   let pkpWallet = new PKPWallet({
//     pkpPubKey: "0x040b1f9dba171e2d62cb244082c7fe83917135bd29c3b4dfa10c6ce7b5d7488844e1fefb0af5a4ca15e8aab45be3e63a1b4082bfea443ed3356a664311639eaf2f",
//     controllerAuthSig: authSig,
//     provider: "https://rpc-mumbai.maticvigil.com",
//   })

//   await pkpWallet.init();

//   const tx = {
//     to: "0x65d86B3E0E8B92a0FF6197Cb0fE5847835B78c5e",
//     value: 0
//   };

//   // -- Sign Transaction
//   const signedTx = await pkpWallet.signTransaction(tx);
//   console.log("signedTx:", signedTx);

//   // -- Send Transaction
//   const sentTx = await pkpWallet.sendTransaction(signedTx);
//   console.log("sentTx:", sentTx);

// })();

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
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

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };

  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

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

var cache = [
  {
    timestamp: "",
    data: "",
  },
];

setInterval(() => {
  console.log(`cache has length ${cache.length}`);

  if (cache.length > 0) {
    console.log("clearing now");
    cache = [];
    console.log(`cache cleared. Now it has ${cache.length}`);
  }
}, 60000);

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

// https://ylgfjdlgyjmdikqavpcj.supabase.co/rest/v1/orbis_v_profiles?select=*&did=eq.did%3Apkh%3Aeip155%3A1%3A0x6d30a9f79a35fe3ede1827f8fd0050ada6fea901
// accepted type: "chat_message"
const jobs = []

const wss = new WebSocket.Server({ port: 8080, host: "0.0.0.0" });
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    // console.log(`Received message: ${message}`);
  });

  setInterval(async () => {
    // const res = await fetch(url + "/rest/v1/rpc/default_posts_alpha?offset=0&limit=50&order=timestamp.desc.nullslast", {
    //   headers: { apiKey }
    // });

    console.log(jobs);

    // for each job
    for (let i = 0; i < jobs.length; i++) {

      // if job is chat_message
      if (jobs[i].task === "chat_message") {

        const did = jobs[i].params.pkp.did;
        const pkpPubKey = jobs[i].params.pkp.pubKey;

        // fetch orbis posts by did
        const res = await fetch(url + `/rest/v1/rpc/default_posts_alpha?offset=0&limit=50&order=timestamp.desc.nullslast`, {
          method: 'POST',
          body: JSON.stringify({ "q_did": did, "q_tag": null, "q_only_master": false, "q_context": null, "q_master": null }),
          headers: { apiKey }
        });

        const posts = await res.json();

        var commands;

        try {
          commands = posts?.filter(post => post.content.body.includes("/test"));

          for (let j = 0; j < commands.length; j++) {

            const body = commands[j].content.body;

            let pkpWallet = new PKPWallet({
              pkpPubKey: pkpPubKey,
              controllerAuthSig: authSig,
              provider: "https://rpc-mumbai.maticvigil.com",
            })

            await pkpWallet.init();

            const tx = {
              to: "0x65d86B3E0E8B92a0FF6197Cb0fE5847835B78c5e",
              value: 0
            };

            // -- Sign Transaction
            const signedTx = await pkpWallet.signTransaction(tx);
            console.log("signedTx:", signedTx);

            // -- Send Transaction
            const sentTx = await pkpWallet.sendTransaction(signedTx);
            console.log("sentTx:", sentTx);

            // if command is /test
            if (body.includes("/test")) {
              // 
            }

            // /send [amount] to [address] [hourly]
            else if (body.includes('/send')) {
              // send payment
            }
          }
        } catch (e) {
          // 
          console.log(e);
        }

      }
    }

    // var str = (await res.json());
    // // filter out item.content.body include the keyword "/test"
    // str = str.filter(item => item.content.body.includes("/test"));
    // str = JSON.stringify(str);
    // ws.send(str);
    ws.send(JSON.stringify(jobs));
  }, 10000);
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
    } else {
      res
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ status: "job already exists" });
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
    } else {
      res
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .send({ status: "job not found" });
    }
  } else {
    res
      .code(500)
      .header("Content-Type", "application/json; charset=utf-8")
      .send({ status: 500, message: "unrecognized task" });

  }

})
/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/", function (request, reply) {
  // Build the params object to pass to the template
  let params = { seo: seo };

  // If the user submitted a color through the form it'll be passed here in the request body
  let color = request.body.color;

  // If it's not empty, let's try to find the color
  if (color) {
    // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES

    // Load our color data file
    const colors = require("./src/colors.json");

    // Take our form submission, remove whitespace, and convert to lowercase
    color = color.toLowerCase().replace(/\s/g, "");

    // Now we see if that color is a key in our colors object
    if (colors[color]) {
      // Found one!
      params = {
        color: colors[color],
        colorError: null,
        seo: seo,
      };
    } else {
      // No luck! Return the user value as the error property
      params = {
        colorError: request.body.color,
        seo: seo,
      };
    }
  }

  // The Handlebars template will use the parameter values to update the page with the chosen color
  return reply.view("/src/pages/index.hbs", params);
});

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

// write the jobs data to a file
// setInterval(() => {
//   fs.writeFile(
//     "./src/jobs.json",
//     JSON.stringify(jobs),
//     (err) => console.log(err)
//   );
// }
// , 10000);