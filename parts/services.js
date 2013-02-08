var EventEmitter2 = require('eventemitter2').EventEmitter2
var ReadStream = require('fs').ReadStream
var url_parse = require('url').parse

exports.init = function (events, state) {

  var host_services = {}

  read(ReadStream(state.config.services.bootstrap_file))
    //.on('service', services.push.bind(services))
    .on('service', function (service) {
      var uri = url_parse(service.uri)
      if (uri.protocol === 'services:') {
        // TODO complain about duplicate keys
        host_services[uri.hostname] = service
      } else {
        events.emit('bad bootstrap service [31m' + service.uri + '[m')
      }
    })
    .on('service', events.emit.bind(events, 'service'))
    //.on('service', function (service) {
    //  var uri = url_parse(service.uri)
    //  console.log(uri)
    //  events.emit('service', service)
    //})
    .once('end', events.emit.bind(events, 'services-ready'))
    // TODO on error

  events.on('host-up', function (name) {
    if (host_services.hasOwnProperty(name)) {
      // TODO check only if cache is too old
      console.log('TODO', 'check services of ' + name)
    }
  })
}

// TODO emit only valid uris see http://www.ietf.org/rfc/rfc2396.txt
function read (input) {
  var output = new EventEmitter2

  var buffer = ''

  input.on('data', function (data) {
    data = (buffer + data)
      .replace(/\n +/mg, ' ') // join multi-part lines; TODO preserve \n w/ \
      .toString().split('\n')

    buffer = data.pop()

    data
      .filter(function (line) {
        return line.length > 0 // empty lines
            && line[0] !== '#' // comments
      })
      .map(function (line) {
        return line.replace(/\s+$/, '') // rtrim
      })
      .forEach(function (line) {
        var service = {}
        var i = line.indexOf(' ')
        if (i > 0) {
          service.uri = line.slice(0, i)
          service.rest = line.slice(i).replace(/^\s+/, '') // ltrim
        } else {
          service.uri = line
        }
        output.emit('service', service)
      })
  })

  input.on('end', output.emit.bind(output, 'end'))

  return output
}

