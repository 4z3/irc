var state = {
  hosts: {},
  config: {},
  use: {
    informer: true,
    prettyprint_informer_events: true,
    prettyprint_host_config_events: true,
    ip_setup: true,
    tinc_config: true,
    tincd: true,
  },
}
state.config.informer = {
  uri: process.env.informer_socket || 'run/tincd.sock'
}
state.config.tinc_config = {
  uri: process.env.conf_dir || 'etc'
}
state.config.tincd = {
  command: process.env.tincd_path || 'sbin/tincd',
  args: [ '-D'
    , '--config=' + state.config.tinc_config.uri
    , '--pidfile=' + (process.env.pid_file || 'run/pid')
  ],
}

var util = require('./util')
var inspect = util.inspect
var log = util.log
var to_array = util.to_array

if (typeof process.env.use === 'string') {
  Object.keys(state.use).forEach(function (name) {
    state.use[name] = false
  })
  process.env.use
    .split(',')
    .filter(function (x) { return !!x })
    .forEach(function (name) {
      if (state.use.hasOwnProperty(name)) {
        state.use[name] = true
      } else {
        throw new Error('cannot use unknown module: ' + name)
      }
    })
}
log.info('initial state:\n' + inspect(state))

var EventEmitter = require('eventemitter2').EventEmitter2
var events = new EventEmitter()

events.on('info', log.info)
events.on('error', log.error)

events.onAny(function () {
  if (!events._events.hasOwnProperty(this.event)) {
    log.unhandled(this.event + ' ' + inspect(to_array(arguments)))
  }
})

process.on('exit', function (code, signal) {
  log.info('Terminating')
  events.emit('stop')
})

process.on('SIGINT', function () {
  log.info('Got INT signal')
  process.exit(0)
})

if (state.use.tinc_config) {

  require('./parts/tinc_config').init(events, state)

  require('./parts/prettyprint_host_config_events.js').init(events, state)

  events.on('host-load', function (hostname, config) {
    if (!state.hosts[hostname]) {
      state.hosts[hostname] = { addresses: {} }
    }
    var host = state.hosts[hostname]

    host.config = config
  })
}

if (state.use.tincd) {
  require('./parts/tincd').init(events, state)
}

if (state.use.informer) {

  require('./parts/informer').init(events, state)

  require('./parts/prettyprint_informer_events').init(events, state)

  require('./parts/ip_setup').init(events, state)

  events.on('host-up', function (hostname, remoteAddress, remotePort) {
    if (!state.hosts[hostname]) {
      state.hosts[hostname] = { addresses: {} }
    }
    var host = state.hosts[hostname]

    host.addresses[remoteAddress] = remotePort
    host.status = 'online'
  })
  events.on('host-down', function (hostname, remoteAddress, remotePort) {
    if (!state.hosts[hostname]) {
      state.hosts[hostname] = { addresses: {} }
    }
    var host = state.hosts[hostname]

    host.addresses[remoteAddress] = remotePort
    host.status = 'offline'
  })
}
