var util = require('util')
var EventEmitter = require('events').EventEmitter
var spawn = require('child_process').spawn

function Daemon () {
  EventEmitter.call(this)
  this._onstop = []
}
util.inherits(Daemon, EventEmitter)
module.exports = Daemon

Daemon.prototype.start = function (options) {

  var child = spawn(options.command, options.args, { env: options.env })
  this._onstop.push(function () {
    child.kill()
  })

  child.stdout.on('data', make_data_to_lines(this, 'stdout-line'))
  child.stderr.on('data', make_data_to_lines(this, 'stderr-line'))

  var self = this
  child.on('exit', function (code, signal) {
    self.emit('error', new Error('child exited unexpectedly; code = ' + code))
  })
}

Daemon.prototype.stop = function () {
  for (var stop; stop = this._onstop.pop(); stop())
  this.emit('stopped')
}

function make_data_to_lines (target, event_name) {
  if (!event_name) event_name = 'line'

  var buffer = ''

  return function (data) {
    var lines = (buffer + data).toString().split('\n')

    buffer = lines.pop()

    lines.forEach(function (line) {
      target.emit(event_name, line)
    })
  }
}
