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


var log = require('./log')
var tinc = require('./tinc')

var config = new tinc.Config()
var daemon = new tinc.Daemon()
var server = new tinc.Server()

config.watch(conf_dir)
daemon.start(daemon_options)
server.listen(informer_socket)

config.on('error', function (err) {
  log.error('config: ' + err.message)
  process.exit(1)
})
daemon.on('error', function (err) {
  log.error('daemon: ' + err.message)
  process.exit(1)
})
server.on('error', function (err) {
  log.error('server: ' + err.message)
  process.exit(1)
})

process.on('exit', function (code, signal) {
  log.info('Terminating')
  daemon.stop()
  server.stop()
})

process.on('SIGINT', function () {
  log.info('Got INT signal')
  process.exit(0)
})

var state = { hosts: {} }

config.on('host-load', function (hostname, config) {
  if (!state.hosts[hostname]) {
    state.hosts[hostname] = { addresses: {} }
  }
  var host = state.hosts[hostname]

  host.config = config
})
server.on('host-up', function (hostname, remoteAddress, remotePort) {
  if (!state.hosts[hostname]) {
    state.hosts[hostname] = { addresses: {} }
  }
  var host = state.hosts[hostname]

  host.addresses[remoteAddress] = remotePort
  host.status = 'online'
})
server.on('host-down', function (hostname, remoteAddress, remotePort) {
  if (!state.hosts[hostname]) {
    state.hosts[hostname] = { addresses: {} }
  }
  var host = state.hosts[hostname]

  host.addresses[remoteAddress] = remotePort
  host.status = 'offline'
})

;(function () {
  var inspect = require('util').inspect


  config.on('watching', function (uri) {
    log.info('watching ' + uri)
  })
  config.on('host-load', function (hostname, config) {
    log.info('host-load ' + hostname + ' ' + inspect(config))
  })
  config.on('host-reload', function (hostname, config) {
    log.unhandled([ 'host-reload', hostname, inspect(config)].join(' '))
  })
  config.on('host-unload', function (hostname) {
    log.unhandled([ 'host-unload', hostname].join(' '))
  })


  daemon.on('ready', function () {
    log.info('daemon ready')
  })
  daemon.on('stdout-line', function (line) {
    log.info('[33;1mtincd stdout: ' + line + '[m')
  })
  daemon.on('stderr-line', function (line) {
    log.info('[33mtincd stderr: ' + line + '[m')
  })
  daemon.on('stderr-line', function ready_listener (line) {
    if (line === 'Ready') {
      daemon.removeListener('stderr-line', ready_listener)
      daemon.emit('ready')
    }
  })
  daemon.on('stopped', function () {
    log.info('daemon stopped')
  })


  server.on('listening', function (uri) {
    log.info('listening ' + uri)
  })
  server.on('host-up', function (hostname, remoteAddress, remotePort) {
    log.info('[32;1mUP[m ' + [ hostname ].join(' '))
  })
  server.on('host-down', function (hostname, remoteAddress, remotePort) {
    log.info('[31;1mDN[m ' + [ hostname ].join(' '))
  })
  server.on('subnet-up', function (hostname, remoteAddress, remotePort, subnet) {
    log.unhandled([ 'subnet-up', hostname, subnet].join(' '))
  })
  server.on('subnet-down', function (hostname, remoteAddress, remotePort, subnet) {
    log.unhandled([ 'subnet-down', hostname, subnet].join(' '))
  })
  server.on('stopped', function () {
    log.info('server stopped')
  })


})()
