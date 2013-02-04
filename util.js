var inspect = require('util').inspect

exports.inspect = function (x) {
  return inspect(x, null, 23, true)
}

var t0 = new Date

function log (message) {
  var t = new Date
  var head = '' + (t - t0)
  while (head.length < 4) head = '0' + head
  head = head.slice(0, head.length - 3) + '.' + head.slice(-3)
  console.log('[34m' + head + '[m ' + message)
}

var reset_seq = /\[(39)?m/g

exports.log = {
  info: function (message) {
    log(message)
  },
  error: function (message) {
    log('[31m' + message.replace(reset_seq, '[$1;31m') + '[m')
  },
  unhandled: function (message) {
    log('[30m' + message.replace(reset_seq, '[$1;30m') + '[m')
  },
}

exports.to_array = function (x) {
  return Array.prototype.slice.call(x)
}
