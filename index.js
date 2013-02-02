var conf_dir = '/etc/tinc/retiolum'

var informer_socket = '/run/retiolum/informer.sock'
var http_port = 1027


var log = require('./log')
var tinc = require('./tinc')
var config = new tinc.Config()
var server = new tinc.Server()

server.listen(informer_socket)
config.watch(conf_dir)

process.on('exit', function (code, signal) {
  log.info('Terminating')
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
  config.on('error', function (err) {
    log.error('config: ' + err)
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
  server.on('error', function (err) {
    log.error('server: ' + err)
  })
  server.on('stopped', function () {
    log.info('server stopped')
  })


})()
