var spawn = require('child_process').spawn
var make_data_to_lines = require('../events-utils').make_data_to_lines
var EventEmitter2 = require('eventemitter2').EventEmitter2
var ReadStream = require('fs').ReadStream
var url_parse = require('url').parse
var inspect = require('../util').inspect

exports.init = function (events, state) {

  state.services = {}

  var bookmarks = {}

  read(ReadStream(state.config.services.bootstrap_file))
    .on('service', function (service) {
      var uri = url_parse(service.uri)
      if (uri.protocol === 'services:') {
        set_bookmark(service)
      } else {
        events.emit('bad bootstrap service ' + inspect(service.uri, 'bad'))
      }
    })
    .on('service', events.emit.bind(events, 'service'))
    .once('end', events.emit.bind(events, 'services-ready'))
    // TODO on error

  events.on('host-up', function (name) {
    var bmark = bookmarks[name]

    if (!bmark) return

    if (bmark.last_ssh_check) {
      var rel_last_ssh_check = Date.now() - bmark.last_ssh_check
      if (rel_last_ssh_check < 60 * 60 * 1000) {
        events.emit(inspect(normalize_bookmark_uri(bmark), 'falsy')
          + ' last check ' + inspect(rel_last_ssh_check / 1000) + 's ago')
      }
      return
    }

    fetch_services(bmark, function (host_services) {

      var message = {
        hostname: name,
      }

      if (Object.keys(host_services).length > 0) {
        message.services = host_services
      }

      ;[ 'via'
      , 'last_ssh_check'
      , 'last_ssh_exit_code'
      , 'last_ssh_exit_reason'
      ].forEach(function (key) {
        if (bmark[key]) {
          message[key] = bmark[key]
        }
      })

      state.services[name] = message
      events.emit('services', message)
    })
  })

  function set_bookmark (service, via) {
    var uri = url_parse(service.uri)

    // TODO complain if there's no hostname
    // TODO complain if it's an unknown hostname?
    var hostname = uri.hostname

    if (!bookmarks[hostname]) {
      bookmarks[hostname] = {
        hostname: hostname,
      }
    }
    var bmark = bookmarks[hostname]

    if (uri.hasOwnProperty('auth')) {
      // TODO auth could be login_name:password...
      bmark.login_name = uri.auth
    }

    if (uri.hasOwnProperty('port')) {
      bmark.port = Number(uri.port)
      // TODO complain if isNaN
    }

    if (via) {
      bmark.via = via
    }

    events.emit('bookmark ' + inspect(normalize_bookmark_uri(bmark)))
  }

  function fetch_services (bmark, callback) {

    var host_services = {}

    // reset bookmark
    delete bmark.last_ssh_exit_code
    delete bmark.last_ssh_exit_reason
    bmark.last_ssh_check = Date.now()

    var bookmark_uri = normalize_bookmark_uri(bmark)

    var command = 'ssh'
    var args = [ '-T'
      , '-o', 'PasswordAuthentication=no'
      , '-o', 'UserKnownHostsFile=/dev/null'
      , '-o', 'StrictHostKeyChecking=no'
      // TODO per uri identity_file
      , '-i', state.config.services.identity_file
      , '-p', (bmark.port || 1337)
      , '-l', (bmark.login_name || 'services')
      , bmark.hostname ]
    var options = { env: {} }

    // TODO timeout if we get a real shell
    var ssh = spawn(command, args, options)

    // TODO use some proper async handler
    var finish_count = 0

    finish_count++
    ssh.on('exit', function (code, signal) {
      bmark.last_ssh_exit_code = code
      finish()
    })

    finish_count++
    read(ssh.stdout)
      .on('service', function (service) {
        if (url_parse(service.uri).protocol === 'services:') {
          set_bookmark(service, bookmark_uri)
        }
        host_services[service.uri] = service.comment || null
      })
      .once('end', finish)

    ssh.stderr.on('data', make_data_to_lines(ssh.stderr))
    ssh.stderr.on('line', (function () {
      var connection_refused_mask =
        /^ssh: connect to host [^ ]+ port [^0-9]+: Connection refused\r$/

      var connection_reset_by_peer =
        /^Read from socket failed: Connection reset by peer\r$/

      var permission_denied_mask =
        /^Permission denied \((.*)\).\r$/

      var permanently_added_mask =
/^Warning: Permanently added '([^']*)' \((.*)\) to the list of known hosts.\r$/

      return function (line) {
        var match
        if (match = permanently_added_mask.exec(line)) {
          events.emit(inspect(bookmark_uri, 'warny')
              + ' permanently added '
              + inspect(match[1], 'warny')
              + ' (' + inspect(match[2], 'warny') + ')')
        }
        else if (connection_refused_mask.test(line)) {
          bmark.last_ssh_exit_reason = line
          events.emit(inspect(bookmark_uri, 'falsy')
              + ' connection refused')
        }
        else if (connection_reset_by_peer.test(line)) {
          bmark.last_ssh_exit_reason = line
          events.emit(inspect(bookmark_uri, 'falsy')
              + ' connection reset by peer')
        }
        else if (match = permission_denied_mask.exec(line)) {
          bmark.last_ssh_exit_reason = line
          match[1] = match[1].split(',')
          events.emit(inspect(bookmark_uri, 'falsy')
              + ' permission denied'
              + ' (' + inspect(match[1], 'bad') + ')')
        }
        else {
          events.emit(['services','stderr'], bookmark_uri, line)
        }
      }
    })())

    function finish () {
      if (--finish_count > 0) return
      callback(host_services)
    }
  }
}

// TODO emit only valid uris see http://www.ietf.org/rfc/rfc2396.txt
function read (input) {
  var output = new EventEmitter2

  var buffer = ''

  input.on('data', function (data) {
    data = (buffer + data)
      // TODO preserve \n when there's no trailing \
      .replace(/\n +/mg, ' ')
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
          service.comment = line.slice(i).replace(/^\s+/, '') // ltrim
        } else {
          service.uri = line
        }
        output.emit('service', service)
      })
  })

  input.on('end', output.emit.bind(output, 'end'))

  return output
}

function normalize_bookmark_uri (bmark) {
  var uri = 'services://'

  if (bmark.login_name && bmark.login_name !== 'services') {
    uri += bmark.login_name + '@'
  }

  uri += bmark.hostname

  if (bmark.port && bmark.port !== 1337) {
    uri += ':' + bmark.port
  }

  return uri
}
