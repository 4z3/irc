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

var inspect = require('util').inspect
var log = require('./log')
var tinc = require('./tinc')


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

if (use.daemon) var daemon = new tinc.Daemon()
if (use.server) var server = new tinc.Server()
if (use.config) var config = new tinc.Config()

if (use.config) {

  config.watch(conf_dir)

  config.on('error', function (err) {
    log.error('config: ' + err.message)
    process.exit(1)
  })

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

  config.on('host-load', function (hostname, config) {
    if (!state.hosts[hostname]) {
      state.hosts[hostname] = { addresses: {} }
    }
    var host = state.hosts[hostname]

    host.config = config
  })
}

if (use.daemon) {

  if (use.server) {
    server.on('listening', function () {
      daemon.start(daemon_options)
    })
  } else {
    daemon.start(daemon_options)
  }

  daemon.on('error', function (err) {
    log.error('daemon: ' + err.message)
    process.exit(1)
  })

  process.on('exit', function (code, signal) {
    daemon.stop()
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
}

if (use.server) {

  server.listen(informer_socket)

  server.on('error', function (err) {
    log.error('server: ' + err.message)
    process.exit(1)
  })

  process.on('exit', function (code, signal) {
    server.stop()
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
}


process.on('exit', function (code, signal) {
  log.info('Terminating')
})

process.on('SIGINT', function () {
  log.info('Got INT signal')
  process.exit(0)
})
