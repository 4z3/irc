var IncomingForm = require('formidable').IncomingForm

exports.init = function (events, state) {
  events.on('http-req', function (uri, accept) {
    if (uri === '/github') {
      return accept(handler)
    }
  })

  function handler (req, callback, wait) {
    switch (req.headers['x-github-event']) {
      case 'push': return push_handler(req, callback, wait)
      default:
    }
  }

  function push_handler (req, callback, wait) {
    var form = new IncomingForm()
    form.type = 'urlencoded'
    form.maxFieldsSize = 16 * 1024

    var payload

    form.on('field', function (name, value) {
      if (name === 'payload') {
        try {
          payload = JSON.parse(value)
        } catch (error) {
          finish(error, 400)
        }
        //events.emit('github_payload', payload)
        // TODO we could trigger update-hosts here
      } else {
        finish(new Error('bad field ' + inspect(name)), 400)
      }
    })

    form.on('aborted', function () {
      // TODO was it an 'timeout' or 'close' event on the socket?
      finish(new Error('form aborted'))
    })

    form.on('error', function (error) {
      finish(error, is_formidable_client_error(error) ? 400 : 500)
    })

    form.on('end', function () {
      if (payload) {
        finish(null, 200)
        if (is_relevant_push_event(payload)) {
          update_hosts()
        }
      } else {
        finish(null, 400)
      }
    })

    form.on('progress', function (bytesReceived, bytesExpected) {
      events.emit('github_post_receive_form_progress', bytesReceived, bytesExpected)
      wait(1000)
    })

    function finish (error, code) {
      if (error) {
        form.removeAllListeners()
        // TODO log the request?
        events.emit('error', 'github_post_receive: ' + error.message)
      }
      callback(code)
    }

    form.parse(req)
  }

  function update_hosts () {
    events.emit('update-hosts')
    git([ 'pull', 'github', 'master' ]).on('exit', function (code) {
    })
  }

  var spawn = require('child_process').spawn
  var make_data_to_lines = require('../events-utils').make_data_to_lines

  // TODO merge with ip_setup's ip
  function git (args) {
    var command = 'git'
    var options = { cwd: 'src', env: {} } // TODO configurable cwd
    var child = spawn(command, args, options)

    child.stdout.on('data', make_data_to_lines(child.stdout))
    child.stderr.on('data', make_data_to_lines(child.stderr))

    child.stderr.on('line', function (line) {
      events.emit('info', command + ' stdout: ' + line)
    })

    child.stdout.on('line', function (line) {
      events.emit('info', command + ' stderr: ' + line)
    })

    child.on('exit', function (code) {
      var cmd = [command].concat(args).join(' ')
      if (code === 0) {
        events.emit('info', cmd)
      } else {
        events.emit('error', cmd + '; code = ' + code)
        // TODO terminate?
      }
    })

    return child
  }
}

var client_error_mask =
  /^(?:bad content-type|unknown transfer-encoding|maxFieldsSize exceeded)/
function is_formidable_client_error (error) {
  return client_error_mask.test(error.message)
}

function is_relevant_push_event (push) {
  return push.repository.url === 'https://github.com/krebscode/painload'
      && push.ref === 'refs/heads/master'
      //&& push.forced === false // TODO else warn?
      // TODO check if all authors/committers are sane?
      && push.commits.filter(is_relevant_push_commit).length > 0
}

function is_relevant_push_commit (commit) {
  return []
      .concat(commit.added)
      .concat(commit.modified)
      .concat(commit.removed)
      .filter(is_relevant_push_path)
      .length > 0
}

// TODO exclude HOST-{up,down} ?
var relevant_push_path_mask = /^retiolum\/hosts\//
function is_relevant_push_path (path) {
  return relevant_push_path_mask.test(path)
}
