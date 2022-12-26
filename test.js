const fs = require('fs');

var text = JSON.parse((fs.readFileSync('jobs.json')).toString());
console.log(text);