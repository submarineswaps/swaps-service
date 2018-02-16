const {get, start} = require('prompt');

const errCode = require('./../conf/error_codes');

/** Prompt at the command line for a value

  {
    [default_value]: <Default Value String>
    explain: <Explanation String>
    role: <Addressed Role String>
  }

  @returns via cbk
  {
    value: <Entered Value String>
  }
*/
module.exports = ({default_value, explain, role}, cbk) => {
  start();

  const key = `[${role}]: ${explain}`;

  return get([key], (err, res) => {
    if (!!err) {
      return cbk([errCode.local_err, 'Error prompting for value', err]);
    }

    return cbk(null, {value: res[key] || default_value});
  });
};

