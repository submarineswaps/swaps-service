const {get} = require('prompt');
const {start} = require('prompt');

/** Prompt at the command line for a value

  {
    [default_value]: <Default Value String>
    explain: <Explanation String>
  }

  @returns via cbk
  {
    value: <Entered Value String>
  }
*/
module.exports = (args, cbk) => {
  start();

  const key = `${args.explain}`;

  return get([key], (err, res) => {
    if (!!err) {
      return cbk([0, 'ErrorPrompting', err]);
    }

    return cbk(null, {value: res[key] || args.default_value});
  });
};

