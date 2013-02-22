var fs = require('fs')
var path = require('path')
var Inotify = require('inotify').Inotify
var crypto = require('crypto')

exports.init = function (events, state) {

  state.tinc_config = {}
  var hosts = state.tinc_config.hosts = {}

  var hosts_path = path.join(state.config.tinc_config.uri, 'hosts')

  var digests = {}

  fs.readdir(hosts_path, function (err, files) {
    if (err) {
      events.emit('error', err.message)
    } else {
      var count = 0
      files.forEach(function (hostname) {
        var filename = path.join(hosts_path, hostname)
        load_host_config(filename, function (err, config, digest) {
          if (err) {
            events.emit('error', err)
          } else {
            var event = 'host-load'
            events.emit(event, hostname, config)
            digests[hostname] = digest
          }
          if (++count === files.length) {
            watch(hosts_path)
          }
        })
      })
    }
  })

  function watch (hosts_path) {
    // TODO assert typeof path is tinc hosts directory
    var inotify = new Inotify()

    fs.realpath(hosts_path, function (err, real_hosts_path) {
      if (err) {
        log_error(err)
      } else {
        inotify.addWatch({
          path: real_hosts_path,
          watch_for: WATCH_FOR_MASK,
          callback: function (event) {
            if (!is_tinc_hostname(event.name)) {
              return // ignore non-host-config-files
            }
            var mask = event.mask
            var hostname = event.name
            var filename = path.join(real_hosts_path, hostname)

            //console.log('inotify', hostname, mask)

            //// XXX this only works when watch_for IN_ALL_EVENTS
            //if (mask ^ (mask & WATCH_FOR_MASK)) {
            //  console.log('ignore', hostname, mask)
            //}

            if (mask & NEW_MASK) {
            // TODO systemctl reload tincd@retiolum on success?
              load_host_config(filename, function (err, config, digest) {
                if (err) {
                  events.emit('error', err.message)
                } else if (digests[hostname] !== digest) {
                  var event = digests[hostname] ? 'host-reload' : 'host-load'
                  events.emit(event, hostname, config)
                  digests[hostname] = digest
                }
                // else ignore unchanged host config
              })
            }
            if (mask & OLD_MASK) {
              // TODO systemctl reload tincd@retiolum?
              // assert !!digests[hostname]
              delete digests[hostname]
              events.emit('host-unload', hostname)
            }
          }
        })
        events.emit('tinc_config-ready', hosts_path)
      }
    })
  }

  events.on('host-load', host_load)
  events.on('host-reload', host_reload)
  events.on('host-unload', host_unload)

  function host_load (hostname, config) {
    hosts[hostname] = {
      hostname: hostname,
      config: config,
    }
  }
  function host_reload (hostname, config) {
    hosts[hostname] = {
      hostname: hostname,
      config: config,
    }
  }
  function host_unload (hostname) {
    delete hosts[hostname]
  }
}

function is_tinc_hostname (x) {
  // TODO check how tinc distinguishes between host config and HOST-{up,down}
  //  and do the same here
  return /^[A-Za-z_]+$/.test(x)
}

var IN_CREATE = Inotify.IN_CREATE
var IN_MOVED_TO = Inotify.IN_MOVED_TO
var IN_CLOSE_WRITE = Inotify.IN_CLOSE_WRITE
var IN_DELETE = Inotify.IN_DELETE
var IN_MOVED_FROM = Inotify.IN_MOVED_FROM

var NEW_MASK = IN_CREATE | IN_MOVED_TO | IN_CLOSE_WRITE
var OLD_MASK = IN_DELETE | IN_MOVED_FROM
var WATCH_FOR_MASK = NEW_MASK | OLD_MASK

function load_host_config (filename, callback) {
  var data = []
  var hash = crypto.createHash('sha1')
  var stream = fs.ReadStream(filename);

  stream.on('data', function (chunk) {
    hash.update(chunk)
    data.push(chunk)
  })
  stream.on('end', function() {
    var config = { addresses: {}, subnets: {} }
    var port
    Buffer
      .concat(data)
      .toString()
      .split('\n')
      .map(function (line) { return line
        .replace(/#.*/,'')
        .replace(/\s+/g, ' ')
        .replace(/^ | $/g,'')
        .replace(/ = /, ' ')
      })
      .forEach(function (line) {
        line = line.split(' ')
        switch (line[0]) {
          // Address = address [port]
          case 'Address':
            // Note: we cannot set default port here, as Port doesn't have to
            // be specified before Address in the host configuration.
            config.addresses[line[1]] = Number(line[2])
            break
          // Port = port (655)
          case 'Port':
            port = Number(line[1])
            break
          // Subnet = address[/prefixlength[#weight]]
          case 'Subnet':
            line[1] = line[1].split('#')
            var subnet = line[1][0]
            var weight = Number(line[1][1])
            if (isNaN(weight)) {
              weight = 10
            }
            config.subnets[subnet] = weight
            break
        }
      })
    // finalize
    var addresses = Object.keys(config.addresses)
    if (addresses.length > 0) {
      // set default port
      addresses.forEach(function (address) {
        if (isNaN(config.addresses[address])) {
          config.addresses[address] = 655
        }
      })
    }
    callback(null, config, hash.digest('hex'))
  })
  // TODO on('error')

}
