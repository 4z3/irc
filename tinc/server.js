var util = require('util')
var net = require('net')
var url_parse = require('url').parse
var EventEmitter = require('events').EventEmitter
var fs = require('fs')

function Server () {
  EventEmitter.call(this)

  this._onstop = []
  this.config = {}
}
util.inherits(Server, EventEmitter)
module.exports = Server

Server.prototype.listen = function (uri, callback) {
  // TODO check, if we already listen to uri
  // TODO normalize uri
  var config = this.config[uri] = {}

  var url = url_parse(uri)

  var self = this

  switch (url.protocol) {
    case undefined:
    case 'unix:':
      config.server = new net.Server(listener)
      config.server.listen(url.pathname, function () {
        self._onstop.push(function () {
          fs.unlinkSync(url.pathname)
        })
        self.emit('listening', uri)
      })
      break
    default:
      throw new Error('bad uri: ' + uri)
    // TODO default
  }

  if (callback) {
    self.on('listening', callback)
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
        return self.emit(err)
      }
      switch (message.type) {
        // TODO validate data?
        case 'host-up':
        case 'host-down':
          var event = message.type
          var hostname = message.NODE
          var remoteAddress = message.REMOTEADDRESS
          var remotePort = message.REMOTEPORT
          return self.emit(event, hostname, remoteAddress, remotePort)
        case 'subnet-up':
        case 'subnet-down':
          var event = message.type
          var hostname = message.NODE
          var remoteAddress = message.REMOTEADDRESS
          var remotePort = message.REMOTEPORT
          var subnet = message.SUBNET
          return self.emit(event, hostname, remoteAddress, remotePort, subnet)
        case 'tinc-up':
        case 'tinc-down':
          var event = message.type
          var name = message.NAME
          var interface = message.INTERFACE
          return self.emit(event, name, interface)
        default:
          //log_error('unix: ' + inspect(data))
      }
    })
  }
}

Server.prototype.stop = function () {
  for (var stop; stop = this._onstop.pop(); stop())
  this.emit('stopped')
}

//var event_unix_server = new net.Server(listener)
//event_unix_server.listen(event_unix_socket, function () {
//  log_info('listen unix://' + event_unix_socket)
//})
////var event_tcp_server = new net.createServer(listener)
////event_tcp_server.listen(event_tcp_port, 'localhost', function () {
////  log_info('listen tcp://localhost:' + event_tcp_port)
////})
