var net = require('net')
var url_parse = require('url').parse
var fs = require('fs')

exports.init = function (events, state) {
  var url = url_parse(state.config.informer.uri)
  var server

  switch (url.protocol) {
    case undefined:
    case 'unix:':
      server = new net.Server(listener)
      server.listen(url.pathname, function () {
        events.on('stop', function () {
          // TODO async & handle error
          fs.unlinkSync(url.pathname)
          events.emit('informer-stopped')
        })
        events.emit('informer-ready')
      })
      break
    default:
      events.emit('error', 'bad uri: ' + state.config.informer.uri)
  }

  function listener (socket) {
    var data = []
    socket.on('data', function (chunk) {
      data.push(chunk)
    })
    socket.on('end', function () {
      try {
        var message = JSON.parse(Buffer.concat(data).toString())
      } catch (err) {
        return emitter.emit('error', err,essage)
      }
      switch (message.type) {
        // TODO validate data?
        case 'host-up':
        case 'host-down':
          var event = message.type
          var hostname = message.NODE
          var remoteAddress = message.REMOTEADDRESS
          var remotePort = message.REMOTEPORT
          return events.emit(event, hostname, remoteAddress, remotePort)
        case 'subnet-up':
        case 'subnet-down':
          var event = message.type
          var hostname = message.NODE
          var remoteAddress = message.REMOTEADDRESS
          var remotePort = message.REMOTEPORT
          var subnet = message.SUBNET
          return events.emit(event, hostname, remoteAddress, remotePort, subnet)
        case 'tinc-up':
        case 'tinc-down':
          var event = message.type
          var name = message.NAME
          var interface = message.INTERFACE
          return events.emit(event, name, interface)
        default:
          //log_error('unix: ' + inspect(data))
      }
    })
  }
}
