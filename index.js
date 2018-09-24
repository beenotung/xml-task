var fetch = require('node-fetch');
var xml2rec = require('xml2rec');
var fs = require('fs');

var url = 'http://resource.data.one.gov.hk/td/journeytime.xml';
var infilename = 'in.xml';
var outfilename = 'journeytime.csv';
var tmpfilename = 'out.csv';

function main() {
  return fetch(url)
    .then(res => res.text())
    .then(text => {
      fs.writeFileSync(infilename, text);
      xml2rec(infilename, 'jtis_journey_time', tmpfilename);
      // wait until the file is ready
      return new Promise((resolve, reject) => {
        var loop = function () {
          if (fs.existsSync(tmpfilename)) {
            try {
              if (fs.readFileSync(tmpfilename).toString()) {
                resolve();
                return;
              }
            } catch (e) {
            }
          }
          setTimeout(loop, 100);
        };
        loop();
      })
        .then(() => {
          // the file is ready now

          // check if this is the first time
          if (fs.existsSync(outfilename)) {
            // not the first time, update existing file
            var text = fs.readFileSync(tmpfilename).toString();
            var lines = text.split('\n');
            lines.shift();
            var last = lines[lines.length - 1] || lines[lines.length - 2];

            // check if updated
            var _lines = fs.readFileSync(outfilename).toString().split('\n');
            var _last = _lines[_lines.length - 1] || _lines[_lines.length - 2];
            if (last !== _last) {
              // remote data is updated, append to the local file
              text = lines.join('\n');
              fs.appendFileSync(outfilename, text);
              console.log('updated', outfilename);
            } else {
              // remote data is not updated, done
              console.log('remote is not updated, skipping')
            }

            fs.unlinkSync(tmpfilename);
          } else {
            // first time, just save to a new file
            fs.renameSync(tmpfilename, outfilename);
            console.log('saved to', outfilename);
          }
          fs.unlinkSync(infilename);
        });
    });
}

function run_main() {
  console.log('checking for update:', new Date().toLocaleString());
  main()
    .then(() => {
      console.log('waiting to check again after 2 minutes...');
      setTimeout(run_main, 1000 * 60 * 2);
    })
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

run_main();
