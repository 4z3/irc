var inspect = require('../util').inspect

exports.init = function (events, state) {
  events.on('host-load', function (hostname, config) {
    events.emit('load', hostname, config)
  })
  events.on('host-reload', function (hostname, config) {
    events.emit('reload', hostname, config)
  })
  events.on('host-unload', function (hostname) {
    events.emit('unreload', hostname)
  })
}
