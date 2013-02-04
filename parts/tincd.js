var spawn = require('child_process').spawn
var make_data_to_lines = require('../events-utils').make_data_to_lines

exports.init = function (events, state) {
  if (state.use.informer) {
    events.on('informer-ready', function () {
      init(events, state)
    })
  } else {
    init(events, state)
  }
}

function init (events, state) {
  var command = state.config.tincd.command
  var args = state.config.tincd.args
  var options = { env: {} }

  var tincd = spawn(command, args, options)

  tincd.stdout.on('data', make_data_to_lines(tincd.stdout))
  tincd.stderr.on('data', make_data_to_lines(tincd.stderr))

  tincd.on('exit', function (code, signal) {
    events.emit('error', 'process exited unexpectedly; code = ' + code)
    process.exit(1)
  })

  tincd.stdout.on('line', function (line) {
    events.emit('info', '[33;1mtincd stdout: ' + line + '[m')
  })

  tincd.stderr.on('line', function (line) {
    events.emit('info', '[33mtincd stderr: ' + line + '[m')
  })

  tincd.stderr.on('line', function ready_listener (line) {
    if (line === 'Ready') {
      tincd.stderr.removeListener('line', ready_listener)
      events.emit('tincd-ready')
    }
  })

  events.on('stop', function () {
    tincd.kill()
    events.emit('tincd-stopped')
  })
}
