var util = require('util')
var fs = require('fs')
var path = require('path')
var EventEmitter = require('events').EventEmitter
var Inotify = require('inotify').Inotify
var crypto = require('crypto')

function Config (path) {
  EventEmitter.call(this)

  this.digests = {}
}
util.inherits(Config, EventEmitter)
module.exports = Config


Config.prototype.watch = function (config_path) {
  var hosts_path = path.join(config_path, 'hosts')

  var self = this

  fs.readdir(hosts_path, function (err, files) {
    if (err) {
      this.emit('error', err)
    } else {
      var count = 0
      files.forEach(function (hostname) {
        var filename = path.join(hosts_path, hostname)
        load_host_config(filename, function (err, config, digest) {
          if (err) {
            self.emit('error', err)
          } else {
            var event = 'host-load'
            self.emit(event, hostname, config)
            self.digests[hostname] = digest
          }
          if (++count === files.length) {
            self._watch(hosts_path)
          }
        })
      })
    }
  })
}

function is_tinc_hostname (x) {
  // TODO check how tinc distinguishes between host config and HOST-{up,down}
  //  and do the same here
  return /^[A-Za-z_]+$/.test(x)
}

//var event_string_map = {}
//Object.keys(Inotify)
//  .filter(function (key) { return typeof Inotify[key] === 'number' })
//  .forEach(function (key) { event_string_map[key] = Inotify[key] })

var IN_CREATE = Inotify.IN_CREATE
var IN_MOVED_TO = Inotify.IN_MOVED_TO
var IN_CLOSE_WRITE = Inotify.IN_CLOSE_WRITE
var IN_DELETE = Inotify.IN_DELETE
var IN_MOVED_FROM = Inotify.IN_MOVED_FROM

var NEW_MASK = IN_CREATE | IN_MOVED_TO | IN_CLOSE_WRITE
var OLD_MASK = IN_DELETE | IN_MOVED_FROM
var WATCH_FOR_MASK = NEW_MASK | OLD_MASK

Config.prototype._watch = function (hosts_path) {
  // TODO assert typeof path is tinc hosts directory
  var inotify = new Inotify()
  var self = this

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
                self.emit('error', err)
              } else if (self.digests[hostname] !== digest) {
                var event = self.digests[hostname] ? 'host-reload' : 'host-load'
                self.emit(event, hostname, config)
                self.digests[hostname] = digest
              }
              // else ignore unchanged host config
            })
          }
          if (mask & OLD_MASK) {
            // TODO systemctl reload tincd@retiolum?
            // assert !!digests[hostname]
            delete self.digests[hostname]
            self.emit('host-unload', hostname)
          }
        }
      })
      self.emit('watching', hosts_path)
    }
  })
}






load_host_config = function (filename, callback) {
  var data = []
  var hash = crypto.createHash('sha1')
  var stream = fs.ReadStream(filename);

  stream.on('data', function (chunk) {
    hash.update(chunk)
    data.push(chunk)
  })
  stream.on('end', function() {
    var config = { addresses: {} }
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
            // TODO assert line[1] and line[2]
            config.addresses[line[1]] = Number(line[2])
            break
          // Port = port (655)
          case 'Port':
            port = Number(line[1])
            break
          // Subnet = address[/prefixlength[#weight]]
          //case 'Subnet':
          //  set_subnet(hostname, line[1])
          //  break
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

//exports.unload_host_config = function (hostname) {
//  log_info('unload_config: ' + hostname)
//  // TODO only unload if tincd@retiolum also reloads
//}

