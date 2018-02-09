/** Return the result of an async function

  The result of that function should look like {subResult0, subResult1, result}

  {
    of: <Result Property Name String>
  }

  @returns
  <Returning Result Function>
*/
module.exports = (args, cbk) => {
  return (err, res) => {
    if (!!err) {
      return cbk(err);
    }

    if (!args.of) {
      return cbk();
    }

    return cbk(null, res[args.of]);
  };
};

