var inspect = require('util').inspect
exports.inspect = function _inspect (x, type) {
  if (is_array_like(x)) {
    return ''+Array.prototype.slice.call(x).map(function (x) {
      return _inspect(x, type)
    })
  }

  var result = inspect(x, null, 23, true)
    .replace(/\[33mtrue\[39m/g, '[1;32mtrue[;39m')
    .replace(/\[33mfalse\[39m/g, '[1;31mfalse[;39m')
    .replace(/(\[32m)'/g, '$1')
    .replace(/'(\[39m)/g, '$1')

  switch (type) {
    case 'bad':
      result = result.replace(/(\[[^m]*)32([^m]*m)/g, '$131$2')
      break
    case 'falsy':
      result = result.replace(/(\[[^m]*)32([^m]*m)/g, '$131;1$2')
      break
    case 'warny':
      result = result.replace(/(\[[^m]*)32([^m]*m)/g, '$133;1$2')
      break
  }

  return result
}
function is_array_like (x) {
  return typeof x === 'object'
      && typeof x.length === 'number'
      && typeof x.length === 'number'
}

var t0 = new Date

function log (message) {
  var t = new Date
  var head = '' + (t - t0)
  while (head.length < 4) head = '0' + head
  head = head.slice(0, head.length - 3) + '.' + head.slice(-3)
  console.log('[34m' + head + '[m ' + message)
}

var reset_seq = /\[(?:;?(?:39)?)m/g

exports.log = {
  info: function (message) {
    log(message)
  },
  error: function (message) {
    if (typeof message !== 'string') {
      message = exports.inspect(message)
    }
    log('[31m' + message.replace(reset_seq, '[;31m') + '[m')
  },
  unhandled: function (message) {
    log('[30m' + message.replace(reset_seq, '[;30m') + '[m')
  },
}
