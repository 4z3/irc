var conf_dir = process.env.conf_dir || 'etc'

var informer_socket = process.env.informer_socket || 'run/tincd.sock'
var http_port = process.env.http_port || 1027

var daemon_options = {
  command: process.env.tincd_path || 'sbin/tincd',
  args: [ '-D'
    , '--config=' + conf_dir
    , '--pidfile=' + (process.env.pid_file || 'run/pid')
  ],
  env: {},
}


var state = { hosts: {} }

var inspect = function (x) { return require('util').inspect(x, null, 23, true) }
var log = require('./log')

var use = {
  config: true,
  daemon: true,
  server: true,
}
if (typeof process.env.use === 'string') {
  Object.keys(use).forEach(function (name) {
    use[name] = false
  })
  process.env.use
    .split(',')
    .filter(function (x) { return !!x })
    .forEach(function (name) {
      if (use.hasOwnProperty(name)) {
        use[name] = true
      } else {
        throw new Error('cannot use unknown module: ' + name)
      }
    })
}
log.info('use: ' + inspect(use))

function to_array (x) {
  return Array.prototype.slice.call(x)
}

var EventEmitter = require('eventemitter2').EventEmitter2
var events = new EventEmitter()

var common_events = {
  'info': log.info,
  'error': log.error,
}
Object.keys(common_events).forEach(function (event) {
  events.on(event, common_events[event])
})
events.onAny(function () {
  if (!events._events.hasOwnProperty(this.event)) {
    log.unhandled(this.event + ' ' + inspect(to_array(arguments)))
  }
})

state.config = {}
state.config.tincd = daemon_options
state.config.informer = {
  uri: informer_socket
}
state.config.tinc_config = {
  uri: conf_dir
}

state.use = {}
if (use.server) {
  state.use.informer = true
}

if (use.config) {

  require('./parts/tinc_config').init(events, state)

  events.on('host-load', function (hostname, config) {
    log.info('host-load ' + hostname + ' ' + inspect(config))
  })
  events.on('host-reload', function (hostname, config) {
    log.unhandled([ 'host-reload', hostname, inspect(config)].join(' '))
  })
  events.on('host-unload', function (hostname) {
    log.unhandled([ 'host-unload', hostname].join(' '))
  })

  events.on('host-load', function (hostname, config) {
    if (!state.hosts[hostname]) {
      state.hosts[hostname] = { addresses: {} }
    }
    var host = state.hosts[hostname]

    host.config = config
  })
}

if (use.daemon) {

  require('./parts/tincd').init(events, state)

  process.on('exit', function (code, signal) {
    events.emit('stop')
  })

}

if (use.server) {

  require('./parts/informer').init(events, state)

  events.on('host-up', function (hostname, remoteAddress, remotePort) {
    log.info('[32;1mUP[m ' + [ hostname ].join(' '))
  })
  events.on('host-down', function (hostname, remoteAddress, remotePort) {
    log.info('[31;1mDN[m ' + [ hostname ].join(' '))
  })
  events.on('subnet-up', function (hostname, remoteAddress, remotePort, subnet) {
    log.unhandled([ 'subnet-up', hostname, subnet].join(' '))
  })
  events.on('subnet-down', function (hostname, remoteAddress, remotePort, subnet) {
    log.unhandled([ 'subnet-down', hostname, subnet].join(' '))
  })

  require('./parts/ip-config').init(events, state)

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


process.on('exit', function (code, signal) {
  log.info('Terminating')
})

process.on('SIGINT', function () {
  log.info('Got INT signal')
  process.exit(0)
})
