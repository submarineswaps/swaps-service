const badRequestCode = 400;

/** Get a function to return JSON

  {
    log: <Error Log Function>
    res: <Express Res Object>
  }
*/
module.exports = ({log, res}) => {
  return (err, json) => {
    const [errCode, errMessage] = err || [];

    if (!!errCode && errCode !== badRequestCode) {
      log(err);
    }

    return !!err ? res.status(errCode).send(errMessage) : res.json(json);
  };
};

