var net = require('net')
var url_parse = require('url').parse
var fs = require('fs')
var path = require('path')
var inspect = require('../util').inspect

exports.init = function (events, state) {
  var url = url_parse(state.config.informer.uri)
  var server

  setup(function () {
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
  })

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


  function setup (next) {
    var informer_script = path.join(path.dirname(__dirname), 'informer')
    var dstpaths = [
      'host-up',
      'host-down',
      'tinc-up',
      'tinc-down',
      'subnet-up',
      'subnet-down',
    ].map(function (basename) {
      return path.join('etc', basename)
    })

    dstpaths
      .forEach(function (dst) {
        fs.exists(dst, function (exists) {
          if (exists)
            return finish_setup({ message: 'file exists' }, dst)

          fs.symlink(informer_script, dst, function (err) {
            events.on('stop', function () {
              // TODO async, ASA the core can handle it
              //fs.unlink(dst, function (err) {
              //  finish_cleanup(err, dst)
              //})
              var err
              try { fs.unlinkSync(dst) } catch (exn) { err = exn }
              finish_cleanup(err, dst)
            })
            finish_setup(err, dst)
          })
        })
      })
   
    var errors = 0
    var countdown = dstpaths.length
    function finish_setup (err, dst) {
      if (err) {
        errors++
        events.emit('informer cannot setup [31m' + dst + '[m; '
          + err.message)
      } else {
        events.emit('informer setup [36;1m' + dst + '[m')
      }
      if (--countdown > 0) return
      else if (errors) process.exit(23)
      else next()
    }

    function finish_cleanup (err, dst) {
      if (err) {
        events.emit('informer cannot cleanup [31m' + dst + '[m; '
            + err.message)
        errors++
      } else {
        events.emit('informer cleanup [36;1m' + dst + '[m')
      }
      if (++countdown < dstpaths.length) return
      else events.emit('informer stopped ' + inspect(errors))
    }
  }
}

