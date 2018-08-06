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

    if (!!err) {
      res.statusMessage = errMessage;
    }

    return !!err ? res.status(errCode).send() : res.json(json);
  };
};

