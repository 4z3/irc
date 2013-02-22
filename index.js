var state = {
  hosts: {},
  config: {},
  use: {
    informer: true,
    ip_setup: true,
    tinc_config: true,
    tincd: true,
    manage_host_state: true,
    http_server: true,
    github_post_receive: true,
    dashboard: true,
    services: true,
  },
}
state.config.informer = {
  uri: process.env.informer_socket || 'run/tincd.sock'
}
state.config.tinc_config = {
  uri: process.env.conf_dir || 'etc'
}
state.config.services = {
  bootstrap_file: '/krebs/services/etc/services/bootstrap',
  identity_file: process.env.identity_file || 'etc/id_rsa',
}
state.config.tincd = {
  command: process.env.tincd_path || 'sbin/tincd',
  args: [ '-D'
    , '--debug=' + (process.env.debug || 5)
    , '--config=' + state.config.tinc_config.uri
    , '--pidfile=' + (process.env.pid_file || 'run/pid')
  ],
}
state.config.http_server = {
  port: process.env.PORT || 1027
}

var util = require('./util')
var inspect = util.inspect
var log = util.log

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

function log_blacklist (e, x) {
  return false
}

events.onAny(function () {
  if (!events._events.hasOwnProperty(this.event)) {
    var args = inspect(arguments)
    if (!log_blacklist(this.event, args)) {
      log.unhandled(this.event + ' ' + args)
    }
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

Object.keys(state.use)
  .filter(function (part) { return state.use[part] })
  .forEach(function (part) {
    require('./parts/' + part).init(events, state)
  })
