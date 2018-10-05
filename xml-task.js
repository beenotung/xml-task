var fetch = require('node-fetch');
var xml2rec = require('xml2rec');
var fs = require('fs');

var default_config = {
  url: 'http://resource.data.one.gov.hk/td/journeytime.xml',
  doc: 'jtis_journey_time',
  infilename: 'in.xml',
  outfilename: 'journeytime.csv',
  tmpfilename: 'out.csv',
  interval_size: 2,
  '# interval_unit can be either minute or second': '',
  interval_unit: 'minute',
  '# mode can be either start or stop': '',
  mode: 'start'
};
var config_file_path = 'xml-task.ini';

function readConfig() {
  var config = Object.assign({}, default_config);
  try {
    fs.readFileSync(config_file_path).toString().split('\n')
      .forEach(line => {
        line = line.trim();
        if (line[0] === '#') {
          return;
        }
        var idx = line.indexOf('=');
        var key = line.substr(0, idx).trim();
        var value = line.substr(idx + 1).trim();
        config[key] = value;
      });
    return config;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(e);
    }
    var config_file_content = '';
    Object.keys(config).forEach(key => {
      if (key[0] === '#') {
        config_file_content += key + '\n'
      } else {
        config_file_content += key + ' = ' + config[key] + '\n';
      }
    });
    fs.writeFileSync(config_file_path, config_file_content);
  }
  return config;
}

function main(config) {
  return fetch(config.url)
    .then(res => res.text())
    .then(text => {
      fs.writeFileSync(config.infilename, text);
      xml2rec(config.infilename, config.doc, config.tmpfilename);
      // wait until the file is ready
      return new Promise((resolve, reject) => {
        var loop = function () {
          if (fs.existsSync(config.tmpfilename)) {
            try {
              if (fs.readFileSync(config.tmpfilename).toString()) {
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
          if (fs.existsSync(config.outfilename)) {
            // not the first time, update existing file
            var text = fs.readFileSync(config.tmpfilename).toString();
            var lines = text.split('\n');
            lines.shift();
            var last = lines[lines.length - 1] || lines[lines.length - 2];

            // check if updated
            var _lines = fs.readFileSync(config.outfilename).toString().split('\n');
            var _last = _lines[_lines.length - 1] || _lines[_lines.length - 2];
            if (last !== _last) {
              // remote data is updated, append to the local file
              text = lines.join('\n');
              fs.appendFileSync(config.outfilename, text);
              console.log('updated', config.outfilename);
            } else {
              // remote data is not updated, done
              console.log('remote is not updated, skipping')
            }

            fs.unlinkSync(config.tmpfilename);
          } else {
            // first time, just save to a new file
            fs.renameSync(config.tmpfilename, config.outfilename);
            console.log('saved to', config.outfilename);
          }
          fs.unlinkSync(config.infilename);
        });
    });
}

function run_main() {
  console.log('checking for update:', new Date().toLocaleString());
  var config = readConfig();
  if (config.mode === 'stop') {
    console.log('stopping the program.');
    process.exit(0);
    return;
  }
  main(config)
    .then(() => {
      var interval = config.interval_size;
      if (config.interval_unit === 'minute') {
        interval *= 1000 * 60;
      } else if (config.interval_unit === 'second') {
        interval *= 1000;
      } else {
        console.error('invalid interval_unit in ' + config_file_path + '!');
        process.exit(1);
      }
      console.log('waiting to check again after ' + config.interval_size + ' ' + config.interval_unit + '...');
      setTimeout(run_main, interval);
    })
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

run_main();
