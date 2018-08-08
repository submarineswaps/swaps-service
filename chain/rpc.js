const http = require('http');

const defaultTimeout = 500;

/** Call JSON RPC

  {
    cmd: <Command String>
    host: <Host Name String>
    params: [<Parameter Object>]
    pass: <Password String>
    port: <Port Number>
    [timeout]: <Ms Timeout Number>
    user: <Username String>
  }

  @returns via cbk
  <Result Object>
*/
module.exports = ({cmd, host, params, pass, port, timeout, user}, cbk) => {
  const post = JSON.stringify({params, id: '1', method: cmd});

  const req = http.request({
    port,
    auth: `${user}:${pass}`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': post.length,
    },
    hostname: host,
    method: 'POST',
    path: '/',
  },
  res => {
    let data = '';

    res.setEncoding('utf8');

    res.on('data', chunk => data += chunk);

    res.on('end', () => {
      switch (res.statusCode) {
      case 401:
        return cbk([401, 'InvalidAuthenticationForRpc']);

      default:
        try {
          return cbk(null, JSON.parse(data));
        } catch (err) {
          return cbk([503, 'InvalidDataResponseForRpcCall']);
        }
      }
    });
  });

  req.on('error', err => cbk([503, 'FailedToCallRpc', err.message]));

  req.setTimeout(timeout || defaultTimeout, () => {
    req.abort();

    return cbk([503, 'RpcOperationTimedOut']);
  });

  req.write(post);

  req.end()

  return;
};

