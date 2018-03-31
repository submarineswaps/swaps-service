/** Return a specific result of an asyncAuto process

  {
    [of]: <Function to Return String>
  }

  @returns
  <Result Picking Function>
*/
module.exports = ({of}, cbk) => {
  return (err, res) => (!!err ? cbk(err) : cbk(null, res[of]));
};

